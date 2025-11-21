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
import sharp from 'sharp';
import { PreciseScreenshotService } from './precise-screenshot-service';
import htmlExtractionService from './html-extraction-service';
import dataValidationService from './data-validation-service';
import { ImageDownloadService } from './image-download-service';
import {
  CrawlJob,
  CrawlConfig,
  Screenshot,
  ProductSelectors,
  DEFAULT_CRAWL_CONFIG,
  COMMON_PRODUCT_SELECTORS,
  ExtractedElements
} from '../types/crawler-types';

// Add stealth plugin to avoid bot detection
puppeteerExtra.use(StealthPlugin());

export class WebCrawlerService {
  private browser: Browser | null = null;
  private activeJobs: Map<string, CrawlJob> = new Map();
  private screenshotsDir: string;
  private preciseScreenshotService: PreciseScreenshotService;

  constructor(screenshotsDir: string = './data/screenshots') {
    this.screenshotsDir = screenshotsDir;
    this.preciseScreenshotService = new PreciseScreenshotService(screenshotsDir);
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
          totalDataTransferred: 0
        }
      },
      createdAt: new Date()
    };

    this.activeJobs.set(job.id, job);

    // Start crawling in background
    // Note: executeCrawl has its own try-catch-finally, this .catch() is a safety net
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
        headless: true, // Always use headless mode (required for Docker)
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
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
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
        waitUntil: 'domcontentloaded', // More reliable in Docker than networkidle2
        timeout: 60000 // Increased timeout for Docker
      });

      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // CRITICAL: Accept cookies BEFORE crawling to avoid cookie banners on screenshots
      await this.acceptCookies(page);

      job.results.stats.totalPages++;

      // Try to detect products automatically
      let selectors = await this.detectProductSelectors(page, job.config.customSelectors);

      if (!selectors) {
        // Last resort: If URL suggests a product page, use fallback selectors
        const url = page.url();
        if (url.includes('/produkt/') || url.includes('/product/')) {
          console.log('⚠️ Using fallback selectors for product page');
          selectors = {
            productContainer: 'body',
            productLink: 'a',
            productImage: 'img[src*="product"], img[class*="product"], .product-image img',
            price: '.price, .product-price, .woocommerce-Price-amount',
            articleNumber: '.sku, .product-sku, .product-detail-ordernumber',
            productName: 'h1, .product-title, .product-name',
            nextPageButton: ''
          };
        } else {
          throw new Error('Could not detect product selectors. Please provide custom selectors.');
        }
      }

      // CHECK IF CURRENT PAGE IS ALREADY A PRODUCT PAGE
      const isProductPage = await this.isProductPage(page);

      if (isProductPage) {
        console.log(`\n✅ Detected product page! Taking screenshot directly...`);

        // Take screenshot of this product page directly
        await this.captureProductScreenshot(page, job.shopUrl, job, selectors);

        // Mark job as complete
        job.status = 'completed';
        job.completedAt = new Date();
        job.results.duration = Date.now() - startTime;

        // Count variants
        const baseProducts = job.results.screenshots.filter(
          s => !s.metadata?.variantInfo || s.metadata.variantInfo.isBaseProduct
        );
        const variants = job.results.screenshots.filter(
          s => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
        );

        await this.browser?.close();
        this.browser = null;

        console.log(`\n✅ Job complete! Captured ${baseProducts.length} product(s) with ${variants.length} variant(s) (Total: ${job.results.screenshots.length} screenshots).`);
        return;
      }

      // NEW DEEP CRAWL STRATEGY:
      // 1. Find all category pages from navigation
      // 2. Visit each category page
      // 3. Collect product links from each category (with pagination)
      // 4. Then take screenshots of collected products

      console.log(`\n🗂️  PHASE 1: Discovering shop structure (categories & products)...`);
      const uniqueUrls = new Set<string>();
      const targetProducts = job.config.maxProducts || 10000;

      // Step 1: Find category links from navigation
      const categoryUrls = await this.findCategoryLinks(page, job.shopUrl);
      console.log(`\n📁 Found ${categoryUrls.length} category pages in navigation`);

      if (categoryUrls.length > 0) {
        // Deep crawl: Visit each category and collect products
        for (let i = 0; i < categoryUrls.length; i++) {
          const categoryUrl = categoryUrls[i];
          console.log(`\n📂 [${i + 1}/${categoryUrls.length}] Crawling category: ${categoryUrl}`);

          try {
            await page.goto(categoryUrl, {
              waitUntil: 'domcontentloaded', // More reliable in Docker than networkidle2
              timeout: 60000 // Increased timeout for Docker
            });

            // Wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 2000));

            job.results.stats.totalPages++;

            // Collect products from this category (with pagination)
            const categoryProducts = await this.collectProductsFromCategory(page, job, selectors, targetProducts);

            // Add to unique set
            const beforeSize = uniqueUrls.size;
            categoryProducts.forEach(url => uniqueUrls.add(url));
            const newProducts = uniqueUrls.size - beforeSize;

            console.log(`   ✅ Category complete: +${newProducts} new products (${uniqueUrls.size} total unique)`);

            // Continue crawling all categories - no artificial limits
          } catch (error) {
            console.error(`   ❌ Failed to crawl category ${categoryUrl}:`, error instanceof Error ? error.message : 'Unknown');
          }
        }
      } else {
        // Fallback: No categories found, crawl homepage only (old behavior)
        console.log(`\n⚠️  No categories found in navigation. Falling back to homepage crawl...`);
        let currentPage = 1;
        const maxPages = 100;

        // Collect ALL unique product URLs from homepage pagination
        while (currentPage <= maxPages) {
          console.log(`📄 Scanning page ${currentPage}... (${uniqueUrls.size} unique products found so far)`);

          try {
            if (currentPage === 1) {
              const pageUrls = await this.collectProductLinksFromPage(page, job, selectors);
              pageUrls.forEach(url => uniqueUrls.add(url));
              console.log(`✅ Page 1: Found ${pageUrls.length} links → ${uniqueUrls.size} unique total`);
            } else {
              const paginationPatterns = [
                selectors.nextPageButton,
                'a.next', 'a[rel="next"]', '.next', '[class*="next"]',
                'button.next', 'button[aria-label*="next"]', 'button[aria-label*="Next"]',
                '.pagination a:last-child', '.paging a:last-child',
                'a[title*="next"]', 'a[title*="Next"]',
                'a:has-text("›")', 'a:has-text("→")'
              ].filter(Boolean);

              let nextButton = null;
              for (const pattern of paginationPatterns) {
                try {
                  const element = await page.$(pattern as string);
                  if (element) {
                    const isDisabled = await page.$eval(pattern as string, (el: any) =>
                      el.classList.contains('disabled') ||
                      el.hasAttribute('disabled') ||
                      el.getAttribute('aria-disabled') === 'true'
                    ).catch(() => false);

                    if (!isDisabled) {
                      nextButton = element;
                      break;
                    }
                  }
                } catch (e) {}
              }

              if (!nextButton) {
                console.log(`✅ Reached end of pagination at page ${currentPage}`);
                break;
              }

              const oldFirstProduct = await page.$eval(
                `${selectors.productContainer} ${selectors.productLink}`,
                el => (el as HTMLAnchorElement).href
              ).catch(() => null);

              await nextButton.click();
              console.log(`⏳ Waiting for page ${currentPage} to load...`);

              try {
                await page.waitForFunction(
                  (expectedPage) => {
                    const url = window.location.href;
                    return url.includes(`page=${expectedPage}`) ||
                           url.includes(`p=${expectedPage}`) ||
                           url.includes(`seite=${expectedPage}`);
                  },
                  { timeout: 5000 },
                  currentPage
                );
                console.log(`✓ URL changed to page ${currentPage}`);
              } catch {
                try {
                  await page.waitForFunction(
                    (oldHref, containerSel, linkSel) => {
                      const firstLink = document.querySelector(`${containerSel} ${linkSel}`) as HTMLAnchorElement;
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
                  await new Promise(r => setTimeout(r, 5000));
                }
              }

              await page.waitForSelector(selectors.productContainer, { timeout: 10000 });

              const pageUrls = await this.collectProductLinksFromPage(page, job, selectors);
              const beforeSize = uniqueUrls.size;
              pageUrls.forEach(url => uniqueUrls.add(url));
              const newUnique = uniqueUrls.size - beforeSize;

              console.log(`✅ Page ${currentPage}: Found ${pageUrls.length} links → +${newUnique} new unique (${uniqueUrls.size} total)`);

              if (newUnique === 0) {
                console.log(`✅ No new products on page ${currentPage} - all products discovered`);
                break;
              }
            }

            currentPage++;
            job.results.stats.totalPages = currentPage;

            // Continue crawling all pages - no artificial limits

          } catch (error) {
            console.log(`⚠️ Error on page ${currentPage}: ${error instanceof Error ? error.message : 'Unknown'}`);
            break;
          }
        }
      }

      // Process ALL discovered URLs - no artificial limits
      const allUniqueUrls = Array.from(uniqueUrls);
      const urlsToProcess = allUniqueUrls; // Process everything we found

      console.log(`\n📊 SHOP SCAN COMPLETE:`);
      console.log(`   - Total unique products found: ${allUniqueUrls.length}`);
      console.log(`   - Pages scanned: ${job.results.stats.totalPages}`);
      console.log(`   - Products to process: ALL ${urlsToProcess.length} products`);

      if (allUniqueUrls.length < targetProducts) {
        console.log(`   ⚠️ NOTE: Shop only has ${allUniqueUrls.length} products, processing all of them`);
      }

      console.log(`\n📸 PHASE 2: Capturing screenshots until we have ${targetProducts} successful ones...\n`);

      // PHASE 2: Now take screenshots until we reach the target number
      await this.captureAllScreenshots(page, urlsToProcess, job, selectors, targetProducts);

      // Count variants for summary
      const baseProducts = job.results.screenshots.filter(
        s => !s.metadata?.variantInfo || s.metadata.variantInfo.isBaseProduct
      );
      const variants = job.results.screenshots.filter(
        s => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
      );

      job.status = 'completed';
      job.completedAt = new Date();
      job.results.duration = Date.now() - startTime;

      console.log(`\n✅ Job complete! Captured ${baseProducts.length} product(s) with ${variants.length} variant(s) (Total: ${job.results.screenshots.length} screenshots).`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.results.errors.push({
        timestamp: new Date(),
        url: job.shopUrl,
        error: job.error,
        type: 'other',
        stack: error instanceof Error ? error.stack : undefined
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
          this.browser = null; // Set to null anyway to avoid keeping reference
        }
      }
    }
  }

  /**
   * Check if current page is a product page
   */
  private async isProductPage(page: Page): Promise<boolean> {
    try {
      // Check URL patterns first
      const url = page.url();
      if (url.includes('/produkt/') || url.includes('/product/')) {
        console.log('✅ Product URL pattern detected');
        return true;
      }

      // Check for key product page elements
      const productIndicators = [
        // Shopware 6 selectors
        '.product-detail-media img[itemprop="image"]',
        '.product-detail-ordernumber',
        '.product-detail-name',
        '.product-detail-description-text',
        // WooCommerce/Firmenich selectors
        'div.product.type-product',
        '.product-detail-ordernumber-container',
        '.summary.entry-summary',
        '.product-configurator-group',
        // Generic selectors
        'meta[property="product:price:amount"]',
        '[itemprop="offers"]',
        '.product-gallery',
        '.product-info',
        'body.single-product'
      ];

      let found = 0;
      for (const selector of productIndicators) {
        const exists = await page.$(selector);
        if (exists) found++;
      }

      // If at least 2 product indicators are found, it's likely a product page
      const isProduct = found >= 2;
      if (isProduct) {
        console.log(`✅ Product page detected (${found} indicators found)`);
      }
      return isProduct;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect product selectors automatically
   */
  private async detectProductSelectors(
    page: Page,
    customSelectors?: ProductSelectors
  ): Promise<ProductSelectors | null> {
    if (customSelectors) {
      return customSelectors;
    }

    // Check URL for known shops
    const url = page.url();
    if (url.includes('firmenich.de')) {
      console.log('🎯 Detected Firmenich shop - using specific selectors');
      return COMMON_PRODUCT_SELECTORS.firmenich;
    }

    // Check if we're on a single product page
    const isProductPage = await this.isProductPage(page);
    if (isProductPage) {
      console.log('📦 Single product page detected - using direct capture mode');
      // Return minimal selectors for single product
      return {
        productContainer: 'body',  // Use entire page
        productLink: 'a',
        productImage: '.product-image, img[class*="product"]',
        price: '.price, .product-price',
        articleNumber: '.sku, .product-sku',
        productName: '.product-title, h1',
        nextPageButton: ''  // No pagination on product pages
      };
    }

    // Try common e-commerce platforms
    for (const [platform, selectors] of Object.entries(COMMON_PRODUCT_SELECTORS)) {
      try {
        const container = await page.$(selectors.productContainer);
        if (container) {
          console.log(`Detected ${platform} platform`);
          return selectors;
        }
      } catch (error) {
        // Continue to next platform
      }
    }

    // Try generic detection
    const genericSelectors = await this.detectGenericSelectors(page);
    return genericSelectors;
  }

  /**
   * Generic product selector detection
   */
  private async detectGenericSelectors(page: Page): Promise<ProductSelectors | null> {
    try {
      // Common product container patterns
      const containerPatterns = [
        'li.product',  // WooCommerce list items
        '.product', '.product-item', '.product-card',
        '[class*="product"]', '[data-product]',
        'article', '.item', '.card'
      ];

      for (const pattern of containerPatterns) {
        const containers = await page.$$(pattern);
        // Accept 1 or more products (was 3 before)
        if (containers.length >= 1) {
          // Try to detect pagination button
          const paginationPatterns = [
            'a.next', 'a[rel="next"]', '.next', '.pagination a:last-child',
            '[class*="next"]', '[class*="pagination"] a:last-child',
            'a:has-text("Next")', 'a:has-text("Weiter")', 'a:has-text("›")',
            '.paging a:last-child', '.pages a:last-child'
          ];

          let nextButton: string | undefined;
          for (const paginationPattern of paginationPatterns) {
            try {
              const button = await page.$(paginationPattern);
              if (button) {
                nextButton = paginationPattern;
                console.log(`✅ Detected pagination button: ${nextButton}`);
                break;
              }
            } catch (e) {
              // Continue to next pattern
            }
          }

          return {
            productContainer: pattern,
            productLink: 'a',
            productImage: 'img',
            price: '[class*="price"], .price',
            articleNumber: '[class*="sku"], .sku',
            productName: '[class*="title"], [class*="name"], h2, h3',
            nextPageButton: nextButton
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Generic detection failed:', error);
      return null;
    }
  }

  /**
   * Find all category links from the entire page (including dropdowns/mega-menus)
   * This captures ALL category levels (main categories + subcategories)
   */
  private async findCategoryLinks(page: Page, shopUrl: string): Promise<string[]> {
    try {
      const baseUrl = new URL(shopUrl);
      const baseDomain = baseUrl.hostname;

      // IMPORTANT: Get ALL links from the page, not just visible navigation
      // This ensures we capture dropdown/mega-menu subcategories!
      console.log(`🔍 Searching for category links across entire page (including dropdowns)...`);

      // Hover over navigation items to trigger dropdowns
      const navSelectors = [
        'nav', 'header nav', '.navigation', '.main-navigation', '.nav',
        '[role="navigation"]', '.menu', '.main-menu', '#navigation',
        '.navbar', '.nav-main', '.primary-navigation'
      ];

      let navElement = null;
      for (const selector of navSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            navElement = element;
            console.log(`✅ Found navigation: ${selector}`);
            break;
          }
        } catch (e) {}
      }

      // Try to trigger all dropdowns by hovering over main nav items
      if (navElement) {
        try {
          const mainNavItems = await navElement.$$('a, button');
          console.log(`🖱️  Hovering over ${mainNavItems.length} navigation items to reveal dropdowns...`);

          for (const item of mainNavItems.slice(0, 20)) { // Limit to first 20 to avoid timeout
            try {
              await item.hover();
              await new Promise(r => setTimeout(r, 300)); // Wait for dropdown to appear
            } catch (e) {
              // Continue with next item
            }
          }

          console.log(`✅ Dropdowns revealed`);
        } catch (e) {
          console.log(`⚠️  Could not hover over navigation items`);
        }
      }

      // Get ALL links from the entire page (now that dropdowns are visible)
      const allLinks: Array<{href: string; text: string}> = await page.$$eval('a', (links: any[]) =>
        links.map((link: any) => ({
          href: link.href,
          text: link.textContent?.trim() || ''
        })).filter(l => l.href)
      );

      console.log(`📋 Found ${allLinks.length} total links on page`);

      // Filter to category links only
      const categoryLinks = allLinks.filter(link => {
        try {
          const linkUrl = new URL(link.href);

          // Must be same domain
          if (!linkUrl.hostname.includes(baseDomain)) {
            return false;
          }

          const pathname = linkUrl.pathname;

          // Skip common non-category pages
          const skipPatterns = [
            '/account', '/login', '/register', '/cart', '/checkout',
            '/AGB', '/Datenschutz', '/Impressum', '/Kontakt', '/Versand',
            '/search', '/suche', '/about', '/ueber-uns',
            '/#', // Hash links
            '/widgets/cms/', // CMS widgets
          ];

          if (skipPatterns.some(pattern => pathname.toLowerCase().includes(pattern.toLowerCase()))) {
            return false;
          }

          // Skip external links (PDFs, documents)
          if (link.href.includes('.pdf') || link.href.includes('yumpu.com')) {
            return false;
          }

          const pathParts = pathname.split('/').filter(p => p.length > 0);

          // Category links: End with / (category indicator) and are not the homepage
          // REMOVED length restriction to capture ALL category levels (main + subcategories)
          if (pathname.endsWith('/') && pathParts.length >= 1 && pathname !== '/') {
            console.log(`   ✓ Category found: ${link.text} → ${link.href}`);
            return true;
          }

          return false;
        } catch (e) {
          return false;
        }
      });

      // Return unique category URLs
      const uniqueCategories = Array.from(new Set(categoryLinks.map(l => l.href)));

      console.log(`\n📊 Category Discovery Summary:`);
      console.log(`   Total categories found: ${uniqueCategories.length}`);

      return uniqueCategories;

    } catch (error) {
      console.error('Failed to find category links:', error instanceof Error ? error.message : 'Unknown');
      return [];
    }
  }

  /**
   * Collect all product links from a category page (with pagination)
   */
  private async collectProductsFromCategory(
    page: Page,
    job: CrawlJob,
    selectors: ProductSelectors,
    targetProducts: number
  ): Promise<string[]> {
    const productUrls: string[] = [];
    let categoryPage = 1;
    const maxCategoryPages = 50;

    console.log(`   📄 Collecting products from category (max pages: ${maxCategoryPages})...`);

    while (categoryPage <= maxCategoryPages) {
      try {
        // Collect products from current page
        const pageProducts = await this.collectProductLinksFromPage(page, job, selectors);
        productUrls.push(...pageProducts);

        console.log(`      Page ${categoryPage}: Found ${pageProducts.length} products (${productUrls.length} total in category)`);

        // Try to find next page button
        const paginationPatterns = [
          selectors.nextPageButton,
          'a.next', 'a[rel="next"]', '.next', '[class*="next"]',
          'button.next', 'button[aria-label*="next"]', 'button[aria-label*="Next"]',
          '.pagination a:last-child', '.paging a:last-child',
          'a[title*="next"]', 'a[title*="Next"]'
        ].filter(Boolean);

        let nextButton = null;
        for (const pattern of paginationPatterns) {
          try {
            const element = await page.$(pattern as string);
            if (element) {
              const isDisabled = await page.$eval(pattern as string, (el: any) =>
                el.classList.contains('disabled') ||
                el.hasAttribute('disabled') ||
                el.getAttribute('aria-disabled') === 'true'
              ).catch(() => false);

              if (!isDisabled) {
                nextButton = element;
                break;
              }
            }
          } catch (e) {}
        }

        if (!nextButton) {
          console.log(`      ✅ No more pages in this category (page ${categoryPage})`);
          break;
        }

        // Click next page - FIX: Wait for content to CHANGE, not just exist!

        // 1. Save first product link BEFORE clicking (to detect change)
        const oldFirstProduct = await page.$eval(
          '[class*="product"] a[href*="/detail/"]',
          el => (el as HTMLAnchorElement).href
        ).catch(() => null);

        console.log(`      ⏳ Clicking next page button...`);
        await nextButton.click();
        await new Promise(r => setTimeout(r, 2000)); // Wait for AJAX to start

        try {
          // 2. Wait for content to CHANGE (not just for body to exist!)
          await page.waitForFunction(
            (oldHref) => {
              // Check if first product link changed
              const firstLink = document.querySelector('[class*="product"] a[href*="/detail/"]') as HTMLAnchorElement;
              if (firstLink && firstLink.href !== oldHref) {
                return true; // Content changed!
              }

              // Alternative: Check if page number in pagination changed
              const pagination = document.querySelector('.pagination .page-item.active');
              if (pagination && parseInt(pagination.textContent || '0') > 1) {
                return true;
              }

              return false;
            },
            { timeout: 15000 },
            oldFirstProduct
          );

          // 3. Additional safety: Wait a bit more for all products to load
          await new Promise(r => setTimeout(r, 1000));

          console.log(`      ✅ Page ${categoryPage + 1} loaded successfully`);

        } catch {
          console.log(`      ⚠️  Timeout waiting for products on page ${categoryPage + 1}`);
          console.log(`      💡 This might be the last page, or pagination failed`);
          break;
        }

        job.results.stats.totalPages++;
        categoryPage++;

        // Continue crawling all category pages - no artificial limits

      } catch (error) {
        console.log(`      ❌ Error on category page ${categoryPage}:`, error instanceof Error ? error.message : 'Unknown');
        break;
      }
    }

    console.log(`   📦 Category total: ${productUrls.length} products from ${categoryPage} pages`);
    return productUrls;
  }

  /**
   * NEW: Collect product links from a page (NO screenshots)
   */
  private async collectProductLinksFromPage(
    page: Page,
    job: CrawlJob,
    selectors: ProductSelectors
  ): Promise<string[]> {
    try {
      // IMPROVED: Try multiple container patterns with fallback logic
      const containerPatterns = [
        selectors.productContainer,
        '.product', '.product-item', '.product-card',
        'li.product', 'div.product',
        '[class*="product"]', '[data-product]',
        'article', 'a[href*="/"]' // Last resort: all links
      ];

      let allUrls: string[] = [];
      let workingContainer: string | null = null;

      // Try each pattern until we find product links
      for (const containerPattern of containerPatterns) {
        try {
          // Check if container exists (but don't wait long)
          const containers = await page.$$(containerPattern);
          if (containers.length === 0) continue;

          console.log(`   🔍 Trying container: ${containerPattern} (${containers.length} found)`);

          // Try to get links from this container
          const urls = await page.$$eval(
            `${containerPattern} a`,
            (links: any[]) => links.map((link: any) => link.href).filter(Boolean)
          );

          if (urls.length > 0) {
            allUrls = urls;
            workingContainer = containerPattern;
            console.log(`   ✅ Found ${urls.length} links using: ${containerPattern}`);
            break; // Success! Stop trying more patterns
          }
        } catch (e) {
          // This pattern didn't work, try next one
          continue;
        }
      }

      if (!workingContainer || allUrls.length === 0) {
        throw new Error(`No product links found with any selector pattern`);
      }

      // Filter to ONLY product pages (not categories, legal pages, account pages)
      const productUrls = allUrls.filter(url => {
        try {
          // Skip non-HTTP protocols (tel:, mailto:, javascript:, etc.)
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return false;
          }

          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          const hostname = urlObj.hostname;

          // Skip external domains like PDF viewers
          if (!hostname.includes(new URL(page.url()).hostname)) {
            return false;
          }

          // Skip PDF/document links
          if (url.includes('yumpu.com') || url.includes('.pdf') || url.includes('/document/')) {
            return false;
          }

          // Skip common non-product paths (EXPANDED LIST)
          const skipPatterns = [
            '/account', '/login', '/register', '/cart', '/checkout',
            '/AGB', '/Datenschutz', '/Impressum', '/Kontakt', '/Versand',
            '/Informationen/', '/Shop-Service/', '/Newsletter/',
            '/#', // Hash links (navigation)
            '/widgets/cms/', // CMS widgets (not products!)
            '/widgets/', // All widgets
          ];

          if (skipPatterns.some(pattern => pathname.toLowerCase().includes(pattern.toLowerCase()))) {
            return false;
          }

          // KEY DIFFERENCE: Product pages have NO trailing slash!
          // Products: /Spargelschaeler/Der-Griffige-rot-ohne-Aufdruck (no trailing /)
          // Categories: /Ernte/Stechmesser/ (with trailing /)
          if (pathname.endsWith('/')) {
            return false; // Skip category pages
          }

          // Must have at least 2 path parts (category + product name)
          const pathParts = pathname.split('/').filter(p => p.length > 0);
          return pathParts.length >= 2;
        } catch (e) {
          return false;
        }
      });

      console.log(`✅ Found ${productUrls.length} products on page (filtered from ${allUrls.length} total links)`);
      return productUrls;
    } catch (error) {
      throw new Error(`Failed to collect product links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * NEW: Collect links from all pagination pages (NO screenshots)
   * @deprecated - Currently unused but kept for potential future use
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async collectAllPaginationLinks(
    page: Page,
    job: CrawlJob,
    selectors: ProductSelectors
  ): Promise<string[]> {
    const allUrls: string[] = [];
    let currentPage = 1;  // We already have page 1, so we'll start clicking from page 2
    const maxPages = 50;

    console.log(`\n🔄 Starting pagination to collect links from page 2 onwards (max pages: ${maxPages}, max products: ${job.config.maxProducts})`);

    while (currentPage < maxPages) {
      try {
        // Check if max products reached
        if (job.config.maxProducts && allUrls.length >= job.config.maxProducts) {
          console.log(`✅ Reached max products: ${allUrls.length}/${job.config.maxProducts}`);
          break;
        }

        // Try multiple pagination button patterns
        const paginationPatterns = [
          selectors.nextPageButton,
          'a.next', 'a[rel="next"]', '.next', '.pagination a:last-child',
          '[class*="next"]', '[class*="pagination"] a:last-child',
          'a:has-text("Next")', 'a:has-text("Weiter")', 'a:has-text("›")',
          '.paging a:last-child', '.pages a:last-child'
        ].filter(Boolean);

        let nextButton = null;

        // Try each pattern until we find a visible button
        for (const pattern of paginationPatterns) {
          try {
            const element = await page.$(pattern as string);
            if (element) {
              const boundingBox = await element.boundingBox().catch(() => null);
              const isVisible = boundingBox !== null;
              if (isVisible) {
                nextButton = element;
                break;
              }
            }
          } catch (e) {
            // Continue to next pattern
          }
        }

        if (!nextButton) {
          console.log(`❌ No more pagination buttons found (page ${currentPage})`);
          break;
        }

        console.log(`📄 Clicking to page ${currentPage + 1}... (${allUrls.length} links collected so far)`);

        // Click next page and wait for AJAX to complete (no full page navigation)
        await nextButton.click();

        // Wait for AJAX pagination to complete (Puppeteer-compatible method)
        console.log(`⏳ Waiting for AJAX pagination...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Short wait for AJAX request

        // Wait for product containers to reload (ensures new products are loaded)
        await page.waitForSelector(selectors.productContainer, {
          timeout: 10000
        });

        console.log(`✅ Page ${currentPage + 1} loaded successfully`);

        job.results.stats.totalPages++;
        currentPage++;

        // Collect links from new page
        const pageUrls = await this.collectProductLinksFromPage(page, job, selectors);

        // CRITICAL: Only add links up to maxProducts limit!
        if (job.config.maxProducts) {
          const remainingSlots = job.config.maxProducts - allUrls.length;
          const linksToAdd = pageUrls.slice(0, remainingSlots);
          allUrls.push(...linksToAdd);
          console.log(`📋 Collected ${linksToAdd.length}/${pageUrls.length} links from page ${currentPage}. Total: ${allUrls.length}/${job.config.maxProducts}`);
        } else {
          allUrls.push(...pageUrls);
          console.log(`📋 Collected ${pageUrls.length} links from page ${currentPage}. Total: ${allUrls.length}`);
        }

      } catch (error) {
        console.log(`❌ Pagination ended at page ${currentPage}:`, error instanceof Error ? error.message : 'Unknown error');
        break;
      }
    }

    console.log(`🏁 Pagination complete. Collected ${allUrls.length} product links from ${currentPage} pages\n`);
    return allUrls;
  }

  /**
   * NEW: Capture screenshots for all collected product URLs
   * GUARANTEES exactly targetSuccessful screenshots (unless not enough products exist)
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
      // STOP when we have enough successful screenshots
      if (successfulCount >= targetSuccessful) {
        console.log(`\n✅ Target reached! ${successfulCount}/${targetSuccessful} successful screenshots\n`);
        break;
      }

      attemptedCount++;

      try {
        await this.captureProductScreenshot(page, productUrl, job, selectors);
        successfulCount++;
        job.results.productsFound++;
        job.results.stats.successfulScreenshots++;

        // Log progress every 10 screenshots
        if (successfulCount % 10 === 0 || successfulCount === targetSuccessful) {
          console.log(`📸 Progress: ${successfulCount}/${targetSuccessful} successful (${attemptedCount} attempted)`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown';

        // Retry once if it's a "detached frame" error
        if (errorMsg.includes('detached Frame')) {
          console.log(`⚠️  Detached frame error, retrying: ${productUrl}`);
          try {
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
            await this.captureProductScreenshot(page, productUrl, job, selectors);
            successfulCount++;
            job.results.productsFound++;
            job.results.stats.successfulScreenshots++;
            console.log(`✓ Retry successful: ${productUrl} (${successfulCount}/${targetSuccessful})`);
            continue; // Skip error handling below
          } catch (retryError) {
            console.error(`❌ Retry also failed: ${productUrl}`);
          }
        }

        console.error(`❌ Failed to capture: ${productUrl}`, errorMsg);
        job.results.stats.failedScreenshots++;
        job.results.errors.push({
          timestamp: new Date(),
          url: productUrl,
          error: errorMsg,
          type: 'screenshot'
        });
      }
    }

    console.log(`\n✅ Screenshot capture complete:`);
    console.log(`   - Successful: ${successfulCount}/${targetSuccessful} (target)`);
    console.log(`   - Failed: ${job.results.stats.failedScreenshots}`);
    console.log(`   - Attempted: ${attemptedCount} URLs\n`);

    // Warn if we couldn't reach the target
    if (successfulCount < targetSuccessful) {
      console.log(`⚠️  WARNING: Only captured ${successfulCount} screenshots out of ${targetSuccessful} requested`);
      console.log(`   This means not enough valid product URLs were found in the shop.\n`);
    }
  }

  /**
   * LEGACY: Extract products from current page (DEPRECATED - not used anymore)
   */
  private async extractProductsFromPage(
    page: Page,
    job: CrawlJob,
    selectors: ProductSelectors
  ): Promise<void> {
    try {
      // IMPORTANT: Save the current page URL so we can return to it after taking screenshots
      const listingPageUrl = page.url();

      // Wait for product containers
      await page.waitForSelector(selectors.productContainer, {
        timeout: 10000
      });

      if (job.config.waitForImages) {
        await page.waitForSelector(selectors.productImage, { timeout: 5000 });
      }

      // Get all product links
      const allUrls = await page.$$eval(
        `${selectors.productContainer} ${selectors.productLink}`,
        (links: any[]) => links.map((link: any) => link.href).filter(Boolean)
      );

      // Filter to ONLY product pages (not categories, legal pages, account pages)
      const productUrls = allUrls.filter(url => {
        try {
          // Skip non-HTTP protocols (tel:, mailto:, javascript:, etc.)
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return false;
          }

          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          const hostname = urlObj.hostname;

          // Skip external domains like PDF viewers
          if (!hostname.includes(new URL(page.url()).hostname)) {
            return false;
          }

          // Skip PDF/document links
          if (url.includes('yumpu.com') || url.includes('.pdf') || url.includes('/document/')) {
            return false;
          }

          // Skip common non-product paths (EXPANDED LIST)
          const skipPatterns = [
            '/account', '/login', '/register', '/cart', '/checkout',
            '/AGB', '/Datenschutz', '/Impressum', '/Kontakt', '/Versand',
            '/Informationen/', '/Shop-Service/', '/Newsletter/',
            '/#', // Hash links (navigation)
            '/widgets/cms/', // CMS widgets (not products!)
            '/widgets/', // All widgets
          ];

          if (skipPatterns.some(pattern => pathname.toLowerCase().includes(pattern.toLowerCase()))) {
            return false;
          }

          // KEY DIFFERENCE: Product pages have NO trailing slash!
          // Products: /Spargelschaeler/Der-Griffige-rot-ohne-Aufdruck (no trailing /)
          // Categories: /Ernte/Stechmesser/ (with trailing /)
          if (pathname.endsWith('/')) {
            return false; // Skip category pages
          }

          // Must have at least 2 path parts (category + product name)
          const pathParts = pathname.split('/').filter(p => p.length > 0);
          return pathParts.length >= 2;
        } catch (e) {
          return false;
        }
      });

      console.log(`Found ${productUrls.length} products on page (filtered from ${allUrls.length} total links)`);

      // Visit each product and take screenshot
      for (const productUrl of productUrls) {
        if (job.config.maxProducts && job.results.productsFound >= job.config.maxProducts) {
          console.log(`Reached max products limit: ${job.config.maxProducts}`);
          break;
        }

        try {
          await this.captureProductScreenshot(page, productUrl, job, selectors);
          job.results.productsFound++;
          job.results.stats.successfulScreenshots++;
        } catch (error) {
          console.error(`Failed to capture product: ${productUrl}`, error);
          job.results.stats.failedScreenshots++;
          job.results.errors.push({
            timestamp: new Date(),
            url: productUrl,
            error: error instanceof Error ? error.message : 'Screenshot failed',
            type: 'screenshot'
          });
        }
      }

      // CRITICAL: Return to the listing page so pagination can work!
      console.log(`✅ Returning to listing page: ${listingPageUrl}`);
      await page.goto(listingPageUrl, {
        waitUntil: 'domcontentloaded', // More reliable in Docker than networkidle2
        timeout: 60000 // Increased timeout for Docker
      });

      // Wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      throw new Error(`Failed to extract products: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    try {
      // STEP 1: Extract HTML data (primary source, 100% accurate)
      console.log('📄 Extracting HTML data...');
      const htmlData = await htmlExtractionService.extractProductData(page);
      const htmlValidation = htmlExtractionService.validateExtractedData(htmlData);
      const htmlConfidence = htmlExtractionService.getOverallConfidence(htmlData);

      console.log(`   HTML Extraction: ${htmlValidation.isValid ? '✅' : '⚠️'} Confidence: ${(htmlConfidence * 100).toFixed(0)}%`);
      if (htmlValidation.warnings.length > 0) {
        console.log(`   Warnings: ${htmlValidation.warnings.join(', ')}`);
      }

      // Save HTML data to file for later use
      const jobDir = path.join(this.screenshotsDir, job.id);
      await this.ensureDirectory(jobDir);

      // Use articleNumber from HTML or generate from URL
      const articleNumber = htmlData.articleNumber || this.extractArticleNumberFromUrl(productUrl);
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
            // Replace remote URL with local URL
            htmlData.imageUrl = localImageUrl;
            console.log(`   ✅ Image downloaded: ${localImageUrl}`);
          } else {
            console.log(`   ⚠️ Image download failed, keeping original URL`);
          }
        } catch (error: any) {
          console.error(`   ❌ Image download error:`, error.message);
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
        const successfulScreenshots = result.screenshots.filter(s => s.success);

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
          const productImageScreenshot = successfulScreenshots.find(s => s.type === 'product-image');
          if (productImageScreenshot) {
            thumbnailPath = productImageScreenshot.path; // Use product image AS thumbnail!
          } else {
            thumbnailPath = mainScreenshotPath; // Fallback to first screenshot
          }
        }

        // Create screenshot record for each product/variant
        const screenshotId = uuidv4();
        const screenshot: Screenshot = {
          id: screenshotId,
          url: result.url,  // Use the specific URL (might have variant hash)
          productUrl: result.url,
        imagePath: mainScreenshotPath,
        thumbnailPath: thumbnailPath, // Points to product-image.png directly!
        metadata: {
          width: 1920,
          height: 0,
          timestamp: new Date(),
          pageTitle: await page.title(),
          fileSize: totalFileSize,
          format: 'png',
          targetedScreenshots: successfulScreenshots, // Store all precise screenshots
          layoutType: result.layoutType // Store detected layout type (single_price or tiered_price)
        },
        extractedElements: {} // Will be filled by OCR later
      };

        // Add variant info to metadata if present
        if (result.variantInfo) {
          screenshot.metadata = {
            ...screenshot.metadata,
            variantInfo: result.variantInfo,
            articleNumber: result.articleNumber
          };
        }

        // Add HTML extracted data to metadata for hybrid approach
        screenshot.metadata = {
          ...screenshot.metadata,
          htmlData: htmlData, // Store HTML data for later use
          htmlConfidence: htmlConfidence,
          htmlValidation: htmlValidation
        };

        job.results.screenshots.push(screenshot);
        job.results.stats.totalDataTransferred += totalFileSize;

        // Log with variant info
        const variantLabel = isVariant ? ` [Variant: ${result.variantInfo?.label}]` : '';
        console.log(`✓ Captured: ${result.url}${variantLabel} (${loadTime}ms per variant)`);
      } // End of for loop for each result

      // Update products found count to reflect all variants
      job.results.productsFound = results.length;
      console.log(`📊 Total products/variants captured: ${results.length}`);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract product data from page
   * @deprecated - Currently unused but kept for potential future use
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async extractProductData(
    page: Page,
    selectors: ProductSelectors
  ): Promise<ExtractedElements> {
    try {
      const data: ExtractedElements = {};

      // Extract article number
      try {
        const rawArticleNumber = await page.$eval(
          selectors.articleNumber,
          (el: any) => el.textContent?.trim() || ''
        );
        // Clean article number: remove prefixes like "Artikel-Nr.:", "Art.-Nr.:", "SKU:", etc.
        data.articleNumber = this.cleanArticleNumber(rawArticleNumber);
      } catch (e) { /* Field not found */ }

      // Extract price
      try {
        data.price = await page.$eval(
          selectors.price,
          (el: any) => el.textContent?.trim() || ''
        );
      } catch (e) { /* Field not found */ }

      // Extract product name
      try {
        data.productName = await page.$eval(
          selectors.productName,
          (el: any) => el.textContent?.trim() || ''
        );
      } catch (e) { /* Field not found */ }

      // Extract product image
      try {
        data.productImage = await page.$eval(
          selectors.productImage,
          (el: any) => el.src || ''
        );
      } catch (e) { /* Field not found */ }

      // Extract description if available
      if (selectors.description) {
        try {
          data.description = await page.$eval(
            selectors.description,
            (el: any) => el.textContent?.trim() || ''
          );
        } catch (e) { /* Field not found */ }
      }

      return data;
    } catch (error) {
      console.warn('Failed to extract some product data:', error);
      return {};
    }
  }

  /**
   * Follow pagination links
   * @deprecated - Currently unused but kept for potential future use
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async followPagination(
    page: Page,
    job: CrawlJob,
    selectors: ProductSelectors
  ): Promise<void> {
    let currentPage = 1;
    const maxPages = 50; // Increased safety limit

    console.log(`🔄 Starting pagination (max pages: ${maxPages}, max products: ${job.config.maxProducts})`);

    while (currentPage < maxPages) {
      try {
        // Check if max products reached
        if (job.config.maxProducts && job.results.productsFound >= job.config.maxProducts) {
          console.log(`✅ Reached max products: ${job.results.productsFound}/${job.config.maxProducts}`);
          break;
        }

        // Try multiple pagination button patterns
        const paginationPatterns = [
          selectors.nextPageButton, // User-provided or detected selector
          'a.next', 'a[rel="next"]', '.next', '.pagination a:last-child',
          '[class*="next"]', '[class*="pagination"] a:last-child',
          'a:has-text("Next")', 'a:has-text("Weiter")', 'a:has-text("›")',
          '.paging a:last-child', '.pages a:last-child'
        ].filter(Boolean); // Remove undefined/null

        let nextButton = null;

        // Try each pattern until we find a visible button
        for (const pattern of paginationPatterns) {
          try {
            const element = await page.$(pattern as string);
            if (element) {
              // Check if element is visible (Puppeteer method)
              const boundingBox = await element.boundingBox().catch(() => null);
              const isVisible = boundingBox !== null;
              if (isVisible) {
                nextButton = element;
                console.log(`✅ Found visible pagination button: ${pattern}`);
                break;
              } else {
                console.log(`⚠️ Button found but not visible: ${pattern}`);
              }
            }
          } catch (e) {
            // Continue to next pattern
          }
        }

        if (!nextButton) {
          console.log(`❌ No more pagination buttons found (page ${currentPage}, products: ${job.results.productsFound})`);
          break;
        }

        console.log(`📄 Clicking to page ${currentPage + 1}... (${job.results.productsFound} products so far)`);

        // Click next page and wait for navigation (Puppeteer method)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: job.config.timeout }),
          nextButton.click()
        ]);

        job.results.stats.totalPages++;
        currentPage++;

        console.log(`📄 Crawling page ${currentPage}...`);

        // Extract products from new page
        await this.extractProductsFromPage(page, job, selectors);

        console.log(`✅ Page ${currentPage} complete. Total products: ${job.results.productsFound}`);

      } catch (error) {
        console.log(`❌ Pagination ended at page ${currentPage}:`, error instanceof Error ? error.message : 'Unknown error');
        break;
      }
    }

    console.log(`🏁 Pagination complete. Total: ${job.results.productsFound} products from ${currentPage} pages`);
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

    // Close browser if open
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log('   ✅ Browser closed');
      } catch (error) {
        console.error('   ❌ Error closing browser:', error);
      }
    }

    // Mark all running jobs as failed
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.status === 'crawling') {
        job.status = 'failed';
        job.error = 'Service shutdown';
        job.completedAt = new Date();
        console.log(`   ⚠️  Marked job ${jobId} as failed (service shutdown)`);
      }
    }

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


  /**
   * Capture targeted screenshots of specific elements
   * Returns array of {type, path, thumbnailPath, fileSize}
   * @deprecated - Currently unused but kept for potential future use
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async captureTargetedScreenshots(
    page: Page,
    jobId: string,
    screenshotId: string,
    selectors: ProductSelectors
  ): Promise<Array<{type: string; path: string; thumbnailPath: string; fileSize: number}>> {
    const screenshots: Array<{type: string; path: string; thumbnailPath: string; fileSize: number}> = [];

    // Define which elements to screenshot
    const elementsToCapture = [
      { type: 'product-image', selector: 'img[itemprop="image"]', fallback: selectors.productImage },
      { type: 'article-number', selector: '[itemprop="sku"]', fallback: selectors.articleNumber },
      { type: 'title', selector: 'h1', fallback: selectors.productName },
      { type: 'price', selector: 'table.product-block-prices-grid', fallback: '.product-detail-price' },
      { type: 'description', selector: '[itemprop="description"]', fallback: selectors.description },
    ];

    for (const elementConfig of elementsToCapture) {
      try {
        // Try to find element (primary selector first, then fallback)
        let element = await page.$(elementConfig.selector);

        if (!element && elementConfig.fallback) {
          element = await page.$(elementConfig.fallback);
        }

        if (!element) {
          console.log(`⚠️  Element not found: ${elementConfig.type} (${elementConfig.selector})`);
          continue;
        }

        // Scroll element into view (for lazy loading)
        await element.evaluate((el) => {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        });
        await new Promise(r => setTimeout(r, 300));

        // Check if element is visible
        const boundingBox = await element.boundingBox();
        if (!boundingBox) {
          console.log(`⚠️  Element not visible: ${elementConfig.type}`);
          continue;
        }

        // Add padding around element for better OCR (10px on each side)
        const padding = 10;
        const clip = {
          x: Math.max(0, boundingBox.x - padding),
          y: Math.max(0, boundingBox.y - padding),
          width: boundingBox.width + (padding * 2),
          height: boundingBox.height + (padding * 2)
        };

        // Capture element screenshot
        const screenshotPath = path.join(
          this.screenshotsDir,
          jobId,
          `${screenshotId}_${elementConfig.type}.png`
        );
        const thumbnailPath = path.join(
          this.screenshotsDir,
          jobId,
          `${screenshotId}_${elementConfig.type}_thumb.png`
        );

        const screenshotBuffer = await page.screenshot({
          type: 'png',
          clip: clip
        });

        // Save screenshot
        await fs.writeFile(screenshotPath, screenshotBuffer);

        // Create thumbnail
        await sharp(screenshotBuffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .png({ quality: 80 })
          .toFile(thumbnailPath);

        // Get file size
        const stats = await fs.stat(screenshotPath);

        screenshots.push({
          type: elementConfig.type,
          path: screenshotPath,
          thumbnailPath: thumbnailPath,
          fileSize: stats.size
        });

        console.log(`✓ Captured element: ${elementConfig.type} (${(stats.size / 1024).toFixed(1)} KB)`);

      } catch (error) {
        console.error(`❌ Failed to capture ${elementConfig.type}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    if (screenshots.length === 0) {
      console.warn('⚠️  No targeted screenshots captured, will fall back to full page');
    } else {
      console.log(`✅ Captured ${screenshots.length} targeted screenshots`);
    }

    return screenshots;
  }

  /**
   * Clean article number by removing common prefixes and colons
   */
  /**
   * Extract article number from URL (fallback when HTML extraction fails)
   */
  private extractArticleNumberFromUrl(url: string): string {
    try {
      // Try to extract from URL path (common patterns)
      const match = url.match(/\/produkt\/([^\/\?#]+)|\/product\/([^\/\?#]+)|\/p\/([^\/\?#]+)/i);
      if (match) {
        const slug = match[1] || match[2] || match[3];
        // Extract numbers from slug
        const numbers = slug.match(/\d+/);
        if (numbers) {
          return numbers[0];
        }
        return slug;
      }

      // Fallback: use URL hash or last segment
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        const numbers = lastSegment.match(/\d+/);
        if (numbers) {
          return numbers[0];
        }
        return lastSegment;
      }

      // Last resort: use timestamp
      return `article-${Date.now()}`;
    } catch {
      return `article-${Date.now()}`;
    }
  }

  private cleanArticleNumber(raw: string): string {
    if (!raw) return '';

    // Remove common prefixes (case insensitive)
    const prefixes = [
      'Artikel-Nr.',
      'Artikelnr.',
      'Artikel Nr.',
      'Art.-Nr.',
      'Art.Nr.',
      'Art Nr.',
      'SKU',
      'Produktnummer',
      'Product Number',
      'Item Number',
      'Item No.',
    ];

    let cleaned = raw.trim();

    // Remove prefixes
    for (const prefix of prefixes) {
      const regex = new RegExp(`^${prefix}\\s*:?\\s*`, 'i');
      cleaned = cleaned.replace(regex, '');
    }

    // Remove standalone colons at the beginning
    cleaned = cleaned.replace(/^:\s*/, '');

    // Remove any remaining leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Accept all cookies to remove cookie banners from screenshots
   * CRITICAL: This must run BEFORE any product screenshots are taken!
   */
  private async acceptCookies(page: Page): Promise<void> {
    try {
      let cookieAccepted = false;

      // Text patterns to search for in buttons
      const textPatterns = [
        'alle cookies akzeptieren',
        'alle akzeptieren',
        'accept all cookies',
        'accept all',
        'akzeptieren'
      ];

      // Get all buttons and links
      const elements = await page.$$('button, a');

      for (const element of elements) {
        try {
          const text = await element.evaluate(el => el.textContent?.trim().toLowerCase() || '');

          // Check if button text matches any pattern
          for (const pattern of textPatterns) {
            if (text.includes(pattern)) {
              const box = await element.boundingBox();
              if (box) {
                console.log(`✓ Found cookie button: "${text}"`);
                await element.click();
                await new Promise(r => setTimeout(r, 1000));
                cookieAccepted = true;
                break;
              }
            }
          }

          if (cookieAccepted) break;
        } catch (e) {
          // Continue to next element
        }
      }

      if (!cookieAccepted) {
        console.log('⚠️  No cookie button found');
      }
    } catch (error) {
      console.log('⚠️  Cookie acceptance failed:', error instanceof Error ? error.message : 'Unknown');
    }
  }
}

// Export singleton instance
export const webCrawlerService = new WebCrawlerService();
