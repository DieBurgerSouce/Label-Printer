/**
 * Web Crawler Service
 * Automated product detection and screenshot capture using Puppeteer
 */

import { Browser, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PreciseScreenshotService } from './precise-screenshot-service';
import htmlExtractionService from './html-extraction-service';
import { ImageDownloadService } from './image-download-service';
import {
  CrawlJob,
  CrawlConfig,
  Screenshot,
  ProductSelectors,
  DEFAULT_CRAWL_CONFIG,
} from '../types/crawler-types';

// Import from extracted modules
import {
  extractArticleNumberFromUrl,
  isProductPage,
  detectProductSelectors,
  getFallbackSelectors,
  acceptCookies,
  findCategoryLinks,
  collectProductsFromCategory,
  collectProductLinksFromPage,
} from './crawling';

// Add stealth plugin to avoid bot detection
puppeteerExtra.use(StealthPlugin());

export class WebCrawlerService {
  private browser: Browser | null = null;
  private activeJobs: Map<string, CrawlJob> = new Map();
  private screenshotsDir: string;
  private preciseScreenshotService: PreciseScreenshotService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // How long to keep completed/failed jobs before cleanup (30 minutes)
  private static readonly JOB_RETENTION_MS = 30 * 60 * 1000;
  // How often to run cleanup (5 minutes)
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  constructor(screenshotsDir: string = './data/screenshots') {
    this.screenshotsDir = screenshotsDir;
    this.preciseScreenshotService = new PreciseScreenshotService(screenshotsDir);
    this.startCleanupScheduler();
  }

  /**
   * Start periodic cleanup of old completed/failed jobs
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.runScheduledCleanup();
    }, WebCrawlerService.CLEANUP_INTERVAL_MS);
  }

  /**
   * Run scheduled cleanup - removes completed/failed jobs older than JOB_RETENTION_MS
   */
  private runScheduledCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const completedAt = job.completedAt?.getTime() || 0;
        if (now - completedAt > WebCrawlerService.JOB_RETENTION_MS) {
          this.activeJobs.delete(jobId);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `🧹 Cleaned up ${cleanedCount} old job(s). Active jobs remaining: ${this.activeJobs.size}`
      );
    }
  }

  /**
   * Start a new crawl job
   */
  async startCrawl(shopUrl: string, config: Partial<CrawlConfig> = {}): Promise<CrawlJob> {
    const job: CrawlJob = {
      id: uuidv4(),
      shopUrl,
      status: 'pending',
      config: { ...DEFAULT_CRAWL_CONFIG, ...config },
      results: {
        productsFound: 0,
        screenshots: [],
        errors: [],
        duration: 0,
        stats: {
          totalPages: 0,
          successfulScreenshots: 0,
          failedScreenshots: 0,
          averagePageLoadTime: 0,
          totalDataTransferred: 0,
        },
      },
      createdAt: new Date(),
    };

    this.activeJobs.set(job.id, job);

    // Start crawling in background
    this.executeCrawl(job).catch((error) => {
      console.error('🚨 Unhandled error in executeCrawl (this should not happen):', error);
      job.status = 'failed';
      job.error = error.message || 'Unexpected error';
      job.completedAt = new Date();
    });

    return job;
  }

  /**
   * Execute the crawl job
   */
  private async executeCrawl(job: CrawlJob): Promise<void> {
    const startTime = Date.now();
    job.status = 'crawling';
    job.startedAt = new Date();

    try {
      // Ensure screenshots directory exists
      await this.ensureDirectory(this.screenshotsDir);

      // Launch browser with Docker-optimized settings
      this.browser = await puppeteerExtra.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ],
      });

      const page = await this.browser.newPage();

      // Set user agent
      if (job.config.userAgent) {
        await page.setUserAgent(job.config.userAgent);
      }

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to shop URL
      console.log(`Crawling: ${job.shopUrl}`);
      await page.goto(job.shopUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait a bit for dynamic content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // CRITICAL: Accept cookies BEFORE crawling to avoid cookie banners on screenshots
      await acceptCookies(page);

      job.results.stats.totalPages++;

      // Try to detect products automatically
      let selectors = await detectProductSelectors(page, job.config.customSelectors);

      if (!selectors) {
        // Last resort: If URL suggests a product page, use fallback selectors
        selectors = getFallbackSelectors(page.url());
        if (!selectors) {
          throw new Error('Could not detect product selectors. Please provide custom selectors.');
        }
      }

      // CHECK IF CURRENT PAGE IS ALREADY A PRODUCT PAGE
      const isProduct = await isProductPage(page);

      if (isProduct) {
        console.log(`\n✅ Detected product page! Taking screenshot directly...`);

        // Take screenshot of this product page directly
        await this.captureProductScreenshot(page, job.shopUrl, job, selectors);

        // Mark job as complete
        job.status = 'completed';
        job.completedAt = new Date();
        job.results.duration = Date.now() - startTime;

        // Count variants
        const baseProducts = job.results.screenshots.filter(
          (s) => !s.metadata?.variantInfo || s.metadata.variantInfo.isBaseProduct
        );
        const variants = job.results.screenshots.filter(
          (s) => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
        );

        await this.browser?.close();
        this.browser = null;

        console.log(
          `\n✅ Job complete! Captured ${baseProducts.length} product(s) with ${variants.length} variant(s) (Total: ${job.results.screenshots.length} screenshots).`
        );
        return;
      }

      // DEEP CRAWL STRATEGY
      console.log(`\n🗂️  PHASE 1: Discovering shop structure (categories & products)...`);
      const uniqueUrls = new Set<string>();
      const targetProducts = job.config.maxProducts || 10000;

      // Step 1: Find category links from navigation
      const categoryUrls = await findCategoryLinks(page, job.shopUrl);
      console.log(`\n📁 Found ${categoryUrls.length} category pages in navigation`);

      if (categoryUrls.length > 0) {
        // Deep crawl: Visit each category and collect products
        for (let i = 0; i < categoryUrls.length; i++) {
          const categoryUrl = categoryUrls[i];
          console.log(`\n📂 [${i + 1}/${categoryUrls.length}] Crawling category: ${categoryUrl}`);

          try {
            await page.goto(categoryUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 60000,
            });

            // Wait for dynamic content
            await new Promise((resolve) => setTimeout(resolve, 2000));

            job.results.stats.totalPages++;

            // Collect products from this category (with pagination)
            const categoryProducts = await collectProductsFromCategory(
              page,
              job,
              selectors,
              targetProducts
            );

            // Add to unique set
            const beforeSize = uniqueUrls.size;
            categoryProducts.forEach((url) => uniqueUrls.add(url));
            const newProducts = uniqueUrls.size - beforeSize;

            console.log(
              `   ✅ Category complete: +${newProducts} new products (${uniqueUrls.size} total unique)`
            );
          } catch (error) {
            console.error(
              `   ❌ Failed to crawl category ${categoryUrl}:`,
              error instanceof Error ? error.message : 'Unknown'
            );
          }
        }
      } else {
        // Fallback: No categories found, crawl homepage only
        console.log(`\n⚠️  No categories found in navigation. Falling back to homepage crawl...`);
        await this.crawlHomepagePagination(page, job, selectors, uniqueUrls);
      }

      // Process ALL discovered URLs
      const allUniqueUrls = Array.from(uniqueUrls);
      const urlsToProcess = allUniqueUrls;

      console.log(`\n📊 SHOP SCAN COMPLETE:`);
      console.log(`   - Total unique products found: ${allUniqueUrls.length}`);
      console.log(`   - Pages scanned: ${job.results.stats.totalPages}`);
      console.log(`   - Products to process: ALL ${urlsToProcess.length} products`);

      if (allUniqueUrls.length < targetProducts) {
        console.log(
          `   ⚠️ NOTE: Shop only has ${allUniqueUrls.length} products, processing all of them`
        );
      }

      console.log(
        `\n📸 PHASE 2: Capturing screenshots until we have ${targetProducts} successful ones...\n`
      );

      // PHASE 2: Now take screenshots until we reach the target number
      await this.captureAllScreenshots(page, urlsToProcess, job, selectors, targetProducts);

      // Count variants for summary
      const baseProducts = job.results.screenshots.filter(
        (s) => !s.metadata?.variantInfo || s.metadata.variantInfo.isBaseProduct
      );
      const variants = job.results.screenshots.filter(
        (s) => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
      );

      job.status = 'completed';
      job.completedAt = new Date();
      job.results.duration = Date.now() - startTime;

      console.log(
        `\n✅ Job complete! Captured ${baseProducts.length} product(s) with ${variants.length} variant(s) (Total: ${job.results.screenshots.length} screenshots).`
      );
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.results.errors.push({
        timestamp: new Date(),
        url: job.shopUrl,
        error: job.error,
        type: 'other',
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      // CRITICAL: Always close browser to prevent memory leaks
      if (this.browser) {
        try {
          await this.browser.close();
          this.browser = null;
          console.log('✅ Browser closed and cleaned up');
        } catch (cleanupError) {
          console.error('⚠️  Failed to close browser during cleanup:', cleanupError);
          this.browser = null;
        }
      }
    }
  }

  /**
   * Crawl homepage pagination (fallback when no categories found)
   */
  private async crawlHomepagePagination(
    page: Page,
    job: CrawlJob,
    selectors: ProductSelectors,
    uniqueUrls: Set<string>
  ): Promise<void> {
    let currentPage = 1;
    const maxPages = 100;

    while (currentPage <= maxPages) {
      console.log(
        `📄 Scanning page ${currentPage}... (${uniqueUrls.size} unique products found so far)`
      );

      try {
        if (currentPage === 1) {
          const pageUrls = await collectProductLinksFromPage(page, job, selectors);
          pageUrls.forEach((url) => uniqueUrls.add(url));
          console.log(
            `✅ Page 1: Found ${pageUrls.length} links → ${uniqueUrls.size} unique total`
          );
        } else {
          const hasNextPage = await this.navigateToNextPage(page, selectors, currentPage);
          if (!hasNextPage) {
            console.log(`✅ Reached end of pagination at page ${currentPage}`);
            break;
          }

          const pageUrls = await collectProductLinksFromPage(page, job, selectors);
          const beforeSize = uniqueUrls.size;
          pageUrls.forEach((url) => uniqueUrls.add(url));
          const newUnique = uniqueUrls.size - beforeSize;

          console.log(
            `✅ Page ${currentPage}: Found ${pageUrls.length} links → +${newUnique} new unique (${uniqueUrls.size} total)`
          );

          if (newUnique === 0) {
            console.log(`✅ No new products on page ${currentPage} - all products discovered`);
            break;
          }
        }

        currentPage++;
        job.results.stats.totalPages = currentPage;
      } catch (error) {
        console.log(
          `⚠️ Error on page ${currentPage}: ${error instanceof Error ? error.message : 'Unknown'}`
        );
        break;
      }
    }
  }

  /**
   * Navigate to next page in pagination
   */
  private async navigateToNextPage(
    page: Page,
    selectors: ProductSelectors,
    currentPage: number
  ): Promise<boolean> {
    const paginationPatterns = [
      selectors.nextPageButton,
      'a.next',
      'a[rel="next"]',
      '.next',
      '[class*="next"]',
      'button.next',
      'button[aria-label*="next"]',
      'button[aria-label*="Next"]',
      '.pagination a:last-child',
      '.paging a:last-child',
      'a[title*="next"]',
      'a[title*="Next"]',
      'a:has-text("›")',
      'a:has-text("→")',
    ].filter(Boolean);

    let nextButton = null;
    for (const pattern of paginationPatterns) {
      try {
        const element = await page.$(pattern as string);
        if (element) {
          const isDisabled = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return true;
            return (
              el.classList.contains('disabled') ||
              el.hasAttribute('disabled') ||
              el.getAttribute('aria-disabled') === 'true'
            );
          }, pattern as string);

          if (!isDisabled) {
            nextButton = element;
            break;
          }
        }
      } catch {
        // Continue to next pattern
      }
    }

    if (!nextButton) {
      return false;
    }

    // Get first product href before clicking
    const oldFirstProduct = await page.evaluate(() => {
      const el = document.querySelector(
        `[class*="product"] a, ${selectors.productContainer} ${selectors.productLink}`
      ) as HTMLAnchorElement;
      return el?.href || null;
    });

    await nextButton.click();
    console.log(`⏳ Waiting for page ${currentPage} to load...`);

    try {
      await page.waitForFunction(
        (expectedPage) => {
          const url = window.location.href;
          return (
            url.includes(`page=${expectedPage}`) ||
            url.includes(`p=${expectedPage}`) ||
            url.includes(`seite=${expectedPage}`)
          );
        },
        { timeout: 5000 },
        currentPage
      );
      console.log(`✓ URL changed to page ${currentPage}`);
    } catch {
      try {
        await page.waitForFunction(
          (oldHref: string | null, containerSel: string, linkSel: string) => {
            const firstLink = document.querySelector(
              `${containerSel} ${linkSel}`
            ) as HTMLAnchorElement;
            return firstLink && firstLink.href !== oldHref;
          },
          { timeout: 5000 },
          oldFirstProduct,
          selectors.productContainer,
          selectors.productLink
        );
        console.log(`✓ Products changed on page ${currentPage}`);
      } catch {
        console.log(`⏳ Waiting 5s for AJAX load...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    await page.waitForSelector(selectors.productContainer, { timeout: 10000 });
    return true;
  }

  /**
   * Capture screenshots for all collected product URLs
   */
  private async captureAllScreenshots(
    page: Page,
    productUrls: string[],
    job: CrawlJob,
    selectors: ProductSelectors,
    targetSuccessful: number
  ): Promise<void> {
    let successfulCount = 0;
    let attemptedCount = 0;

    console.log(`🎯 Target: ${targetSuccessful} successful screenshots\n`);

    for (const productUrl of productUrls) {
      if (successfulCount >= targetSuccessful) {
        console.log(
          `\n✅ Target reached! ${successfulCount}/${targetSuccessful} successful screenshots\n`
        );
        break;
      }

      attemptedCount++;

      try {
        await this.captureProductScreenshot(page, productUrl, job, selectors);
        successfulCount++;
        job.results.productsFound++;
        job.results.stats.successfulScreenshots++;

        if (successfulCount % 10 === 0 || successfulCount === targetSuccessful) {
          console.log(
            `📸 Progress: ${successfulCount}/${targetSuccessful} successful (${attemptedCount} attempted)`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown';

        // Retry once if it's a "detached frame" error
        if (errorMsg.includes('detached Frame')) {
          console.log(`⚠️  Detached frame error, retrying: ${productUrl}`);
          try {
            await new Promise((r) => setTimeout(r, 2000));
            await this.captureProductScreenshot(page, productUrl, job, selectors);
            successfulCount++;
            job.results.productsFound++;
            job.results.stats.successfulScreenshots++;
            console.log(
              `✓ Retry successful: ${productUrl} (${successfulCount}/${targetSuccessful})`
            );
            continue;
          } catch {
            console.error(`❌ Retry also failed: ${productUrl}`);
          }
        }

        console.error(`❌ Failed to capture: ${productUrl}`, errorMsg);
        job.results.stats.failedScreenshots++;
        job.results.errors.push({
          timestamp: new Date(),
          url: productUrl,
          error: errorMsg,
          type: 'screenshot',
        });
      }
    }

    console.log(`\n✅ Screenshot capture complete:`);
    console.log(`   - Successful: ${successfulCount}/${targetSuccessful} (target)`);
    console.log(`   - Failed: ${job.results.stats.failedScreenshots}`);
    console.log(`   - Attempted: ${attemptedCount} URLs\n`);

    if (successfulCount < targetSuccessful) {
      console.log(
        `⚠️  WARNING: Only captured ${successfulCount} screenshots out of ${targetSuccessful} requested`
      );
      console.log(`   This means not enough valid product URLs were found in the shop.\n`);
    }
  }

  /**
   * Capture screenshot of a single product
   */
  private async captureProductScreenshot(
    page: Page,
    productUrl: string,
    job: CrawlJob,
    _selectors: ProductSelectors
  ): Promise<void> {
    const loadStart = Date.now();

    // STEP 1: Extract HTML data (primary source, 100% accurate)
    console.log('📄 Extracting HTML data...');
    const htmlData = await htmlExtractionService.extractProductData(page);
    const htmlValidation = htmlExtractionService.validateExtractedData(htmlData);
    const htmlConfidence = htmlExtractionService.getOverallConfidence(htmlData);

    console.log(
      `   HTML Extraction: ${htmlValidation.isValid ? '✅' : '⚠️'} Confidence: ${(htmlConfidence * 100).toFixed(0)}%`
    );
    if (htmlValidation.warnings.length > 0) {
      console.log(`   Warnings: ${htmlValidation.warnings.join(', ')}`);
    }

    // Save HTML data to file for later use
    const jobDir = path.join(this.screenshotsDir, job.id);
    await this.ensureDirectory(jobDir);

    // Use articleNumber from HTML or generate from URL
    const articleNumber = htmlData.articleNumber || extractArticleNumberFromUrl(productUrl);
    const articleDir = path.join(jobDir, articleNumber);
    await this.ensureDirectory(articleDir);

    // STEP 1.5: Download product image if URL was extracted
    if (htmlData.imageUrl && htmlData.imageUrl.trim() !== '') {
      console.log('📥 Downloading product image...');
      const imageDownloadService = new ImageDownloadService();

      try {
        const localImageUrl = await imageDownloadService.downloadImage(
          htmlData.imageUrl,
          articleNumber
        );

        if (localImageUrl) {
          htmlData.imageUrl = localImageUrl;
          console.log(`   ✅ Image downloaded: ${localImageUrl}`);
        } else {
          console.log(`   ⚠️ Image download failed, keeping original URL`);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Image download error:`, errorMsg);
      }
    } else {
      console.log('   ⚠️ No image URL found in HTML data');
    }

    // Save HTML extracted data (with downloaded local image URL)
    const htmlDataPath = path.join(articleDir, 'html-data.json');
    await fs.writeFile(htmlDataPath, JSON.stringify(htmlData, null, 2));
    console.log(`   💾 HTML data saved: ${htmlDataPath}`);

    // STEP 2: Take screenshots (for OCR fallback and image extraction)
    console.log('📸 Capturing element screenshots...');
    const results = await this.preciseScreenshotService.captureProductScreenshots(
      page,
      productUrl,
      job.id
    );

    const loadTime = Date.now() - loadStart;

    // Process each result (base product + variants)
    for (const result of results) {
      const isVariant = result.variantInfo && !result.variantInfo.isBaseProduct;

      // Calculate total file size for this product/variant
      let totalFileSize = 0;
      const successfulScreenshots = result.screenshots.filter((s) => s.success);

      for (const screenshot of successfulScreenshots) {
        if (screenshot.fileSize) {
          totalFileSize += screenshot.fileSize;
        }
      }

      // Use first successful screenshot as main
      let mainScreenshotPath = '';
      let thumbnailPath = '';

      if (successfulScreenshots.length > 0) {
        mainScreenshotPath = successfulScreenshots[0].path;

        // Find the product-image screenshot to use as thumbnail
        const productImageScreenshot = successfulScreenshots.find(
          (s) => s.type === 'product-image'
        );
        if (productImageScreenshot) {
          thumbnailPath = productImageScreenshot.path;
        } else {
          thumbnailPath = mainScreenshotPath;
        }
      }

      // Create screenshot record for each product/variant
      const screenshotId = uuidv4();
      const screenshot: Screenshot = {
        id: screenshotId,
        url: result.url,
        productUrl: result.url,
        imagePath: mainScreenshotPath,
        thumbnailPath: thumbnailPath,
        metadata: {
          width: 1920,
          height: 0,
          timestamp: new Date(),
          pageTitle: await page.title(),
          fileSize: totalFileSize,
          format: 'png',
          targetedScreenshots: successfulScreenshots,
          layoutType: result.layoutType,
        },
        extractedElements: {},
      };

      // Add variant info to metadata if present
      if (result.variantInfo) {
        screenshot.metadata = {
          ...screenshot.metadata,
          variantInfo: result.variantInfo,
          articleNumber: result.articleNumber,
        };
      }

      // Add HTML extracted data to metadata for hybrid approach
      screenshot.metadata = {
        ...screenshot.metadata,
        htmlData: htmlData,
        htmlConfidence: htmlConfidence,
        htmlValidation: htmlValidation,
      };

      job.results.screenshots.push(screenshot);
      job.results.stats.totalDataTransferred += totalFileSize;

      // Log with variant info
      const variantLabel = isVariant ? ` [Variant: ${result.variantInfo?.label}]` : '';
      console.log(`✓ Captured: ${result.url}${variantLabel} (${loadTime}ms per variant)`);
    }

    // Update products found count to reflect all variants
    job.results.productsFound = results.length;
    console.log(`📊 Total products/variants captured: ${results.length}`);
  }

  /**
   * Get job status
   */
  getJob(jobId: string): CrawlJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): CrawlJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Stop a running job
   */
  async stopJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'crawling') {
      return false;
    }

    job.status = 'failed';
    job.error = 'Stopped by user';
    job.completedAt = new Date();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    return true;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Shutdown service and cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Web Crawler Service...');

    // Stop cleanup scheduler
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('   ✅ Cleanup scheduler stopped');
    }

    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log('   ✅ Browser closed');
      } catch (error) {
        console.error('   ❌ Error closing browser:', error);
      }
    }

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.status === 'crawling') {
        job.status = 'failed';
        job.error = 'Service shutdown';
        job.completedAt = new Date();
        console.log(`   ⚠️  Marked job ${jobId} as failed (service shutdown)`);
      }
    }

    // Clear all jobs on shutdown
    this.activeJobs.clear();
    console.log('✅ Web Crawler Service shut down');
  }

  /**
   * Clean up old jobs
   */
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const age = now - job.createdAt.getTime();
        if (age > maxAge) {
          this.activeJobs.delete(jobId);
        }
      }
    }
  }
}

// Export singleton instance
export const webCrawlerService = new WebCrawlerService();
