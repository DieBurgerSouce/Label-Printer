import { Page } from 'playwright';
import path from 'path';
import config from '../config';
import { createLogger } from '../utils/logger';
import {
  ScreenshotResult,
  ScreenshotMetadata,
  ErrorCategory,
  ScreenshotError,
} from '../types';
import { getBrowserManager } from './browser-manager';
import { getStorageService } from './storage-service';
import { getProductScreenshotComposer } from './product-screenshot-composer';
import {
  generateFilename,
  generateFilepath,
  extractProductIdFromUrl,
} from '../utils/file-naming';

const logger = createLogger('ScreenshotService');

export interface ScreenshotOptions {
  url: string;
  productId?: string;
  category?: string;
  fullPage?: boolean;
  timeout?: number;
}

/**
 * Screenshot Service
 * Core service for capturing screenshots with all optimizations
 */
export class ScreenshotService {
  private browserManager = getBrowserManager();
  private storageService = getStorageService();
  private composer = getProductScreenshotComposer();

  /**
   * Capture screenshot of a URL
   */
  async captureScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const { url, productId, category, fullPage = true, timeout = config.screenshot.timeout } =
      options;

    logger.info('Starting screenshot capture', { url, productId, category });

    const startTime = Date.now();
    let page: Page | null = null;
    let release: (() => Promise<void>) | null = null;

    try {
      // Acquire browser instance from pool
      const acquired = await this.browserManager.acquire();
      page = acquired.page;
      release = acquired.release;

      // Navigate to URL with wait strategies
      await this.navigateWithWaitStrategies(page, url, timeout);

      // Handle cookie banners
      await this.handleCookieBanners(page);

      // Apply consistency fixes
      await this.applyConsistencyFixes(page);

      // Handle lazy loading if enabled
      if (config.features.enableLazyLoadingFix) {
        await this.handleLazyLoading(page);
      }

      // Wait after load for animations to settle
      await page.waitForTimeout(config.screenshot.waitAfterLoad);

      // Capture screenshot
      const buffer = await page.screenshot({
        fullPage,
        animations: config.features.disableAnimations ? 'disabled' : 'allow',
        type: 'png',
      });

      // Generate filename and filepath
      const extractedProductId = productId || extractProductIdFromUrl(url);
      const filename = generateFilename({
        productId: extractedProductId,
        category,
        date: new Date(),
        version: 'v01',
      });
      const filepath = generateFilepath(filename, category);

      // Prepare metadata
      const metadata: ScreenshotMetadata = {
        productId: extractedProductId,
        category,
        sourceUrl: url,
        captureTimestamp: new Date(),
        fileSize: buffer.length,
        width: config.screenshot.width,
        height: config.screenshot.height,
        colorSpace: 'RGB',
        version: 'v01',
        contentHash: '', // Will be set by storage service
      };

      // Save to storage
      const { filepath: savedPath, fileSize, contentHash } = await this.storageService.saveScreenshot({
        filepath,
        buffer,
        metadata,
      });

      const duration = Date.now() - startTime;

      logger.info('Screenshot captured successfully', {
        url,
        filepath: savedPath,
        fileSize,
        duration,
      });

      return {
        success: true,
        url,
        filepath: savedPath,
        filename,
        contentHash,
        fileSize,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          contentHash,
          fileSize,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Screenshot capture failed', {
        url,
        error: errorMessage,
        duration,
      });

      // Categorize error for logging (future use for error-specific handling)
      this.categorizeError(error);

      return {
        success: false,
        url,
        timestamp: new Date(),
        error: errorMessage,
      };
    } finally {
      // Release browser instance back to pool
      if (release) {
        await release();
      }
    }
  }

  /**
   * Navigate to URL with combined wait strategies
   */
  private async navigateWithWaitStrategies(
    page: Page,
    url: string,
    timeout: number
  ): Promise<void> {
    try {
      // Navigate with network idle
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      // Wait for main content to be visible (common selectors)
      const mainContentSelectors = [
        '.product-detail',
        '.product-info',
        '[data-product]',
        'main',
        '#content',
      ];

      for (const selector of mainContentSelectors) {
        try {
          await page.waitForSelector(selector, {
            state: 'visible',
            timeout: 5000,
          });
          logger.debug('Main content visible', { selector });
          break;
        } catch {
          // Try next selector
          continue;
        }
      }

      // Custom wait function for loading spinners to disappear
      await page
        .waitForFunction(
          () => {
            // @ts-expect-error - runs in browser context
            const spinners = document.querySelectorAll('.loading, .spinner, [data-loading]');
            return spinners.length === 0;
          },
          { timeout: 10000 }
        )
        .catch(() => {
          // Ignore timeout - spinners might not exist
        });

      logger.debug('Navigation completed with wait strategies', { url });
    } catch (error) {
      logger.warn('Navigation encountered issues', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new ScreenshotError(
        `Navigation failed for ${url}`,
        ErrorCategory.NETWORK,
        url,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Handle cookie banners and consent dialogs
   */
  private async handleCookieBanners(page: Page): Promise<void> {
    try {
      logger.info('Checking for cookie banners...');

      // Wait a bit for cookie banners to appear (they often load async)
      await page.waitForTimeout(2000);

      // Common cookie banner selectors (ordered by priority)
      const cookieBannerSelectors = [
        // Firmenich specific (higher priority)
        'button:text-is("Alle Cookies akzeptieren")',
        'button:text("Alle Cookies akzeptieren")',

        // Accept buttons (German)
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Alle Cookies akzeptieren")',
        'button:has-text("Akzeptieren")',
        'button:has-text("Zustimmen")',
        'button:has-text("Einverstanden")',
        'a:has-text("Alle akzeptieren")',

        // Accept buttons (English)
        'button:has-text("Accept all")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'a:has-text("Accept all")',

        // Common consent management platforms
        '#onetrust-accept-btn-handler', // OneTrust
        '.accept-all-cookies',
        '.accept-cookies',
        '.cookie-accept',
        '.js-accept-all-cookies',
        '[data-testid="cookie-accept-all"]',
        '[data-testid="uc-accept-all-button"]', // Usercentrics
        '.uc-accept-all-button',
        '#uc-btn-accept-banner',

        // Cookiebot
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        'a#CybotCookiebotDialogBodyButtonAccept',

        // Borlabs Cookie
        '.cookie-preference-accept-all',
        'a[data-cookie-accept-all]',

        // Other common patterns
        '[aria-label*="Accept"]',
        '[aria-label*="Akzeptieren"]',
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="cookie-accept"]',
        'button[class*="cookie-accept"]',

        // Generic close buttons for cookie banners
        '.cookie-banner button:first-child',
        '.cookie-notice button:first-child',
        '.gdpr-banner button:first-child',
      ];

      // Try main page first
      const dismissed = await this.tryDismissCookieBanner(page, cookieBannerSelectors);
      if (dismissed) {
        return;
      }

      // Check iframes for cookie banners
      logger.info('Checking iframes for cookie banners...');
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        try {
          const frameDismissed = await this.tryDismissCookieBanner(frame, cookieBannerSelectors);
          if (frameDismissed) {
            logger.info('Cookie banner dismissed in iframe');
            return;
          }
        } catch (error) {
          // Continue with next frame
          continue;
        }
      }

      logger.warn('No cookie banner button found via selectors, applying aggressive CSS hiding');

      // Alternative approach: Hide cookie banners with CSS if clicking didn't work
      try {
        await page.addStyleTag({
          content: `
            /* Hide common cookie banner containers - very aggressive */
            [class*="cookie"],
            [id*="cookie"],
            [class*="Cookie"],
            [id*="Cookie"],
            [class*="consent"],
            [id*="consent"],
            [class*="gdpr"],
            [id*="gdpr"],
            [class*="GDPR"],
            [id*="GDPR"],
            .cookiealert,
            .cookie-overlay,
            #onetrust-banner-sdk,
            #onetrust-consent-sdk,
            #CybotCookiebotDialog,
            .uc-banner,
            [data-testid*="cookie"],
            .cc-window,
            .cc-banner,
            /* Modal overlays */
            [class*="modal"][style*="z-index"],
            div[class*="modal"]:has(button:has-text("Cookie")),
            div[class*="modal"]:has(button:has-text("Akzeptieren")),
            /* High z-index divs that might be cookie banners */
            div[style*="z-index: 999"],
            div[style*="z-index: 9999"],
            div[style*="z-index: 99999"],
            /* Backdrop/overlay elements */
            [class*="backdrop"],
            [class*="overlay"][style*="z-index"],
            .modal-backdrop,
            /* Be very aggressive - hide any suspicious high-z-index elements */
            body > div[style*="position: fixed"][style*="z-index"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
              height: 0 !important;
              width: 0 !important;
            }

            /* Re-enable scrolling and remove body overflow restrictions */
            body, html {
              overflow: auto !important;
              position: relative !important;
            }

            /* Remove any modal-open classes that disable scrolling */
            body.modal-open {
              overflow: auto !important;
            }
          `,
        });
        logger.info('Aggressive CSS hiding applied');

        // Wait for CSS to take effect
        await page.waitForTimeout(500);

      } catch (error) {
        logger.warn('Failed to hide cookie banners via CSS', { error });
      }

      logger.debug('Cookie banner handling completed');
    } catch (error) {
      logger.warn('Error handling cookie banners', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - continue with screenshot even if cookie handling fails
    }
  }

  /**
   * Try to dismiss cookie banner on a page or frame
   */
  private async tryDismissCookieBanner(
    pageOrFrame: Page | any,
    selectors: string[]
  ): Promise<boolean> {
    for (const selector of selectors) {
      try {
        // Check if element is visible with longer timeout
        const element = await pageOrFrame.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);

        if (isVisible) {
          logger.info('Found cookie banner element', { selector });

          // Wait for element to be clickable
          await element.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

          // Try to click the button
          await element.click({ timeout: 5000, force: true });
          logger.info('Cookie banner button clicked', { selector });

          // Wait longer for the banner to disappear
          await pageOrFrame.waitForTimeout(2000);

          // Check if banner is gone
          const stillVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
          if (!stillVisible) {
            logger.info('Cookie banner successfully dismissed!');
            return true;
          } else {
            logger.warn('Cookie banner still visible after click', { selector });
          }
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    return false;
  }

  /**
   * Apply consistency fixes (disable animations, hide dynamic content)
   */
  private async applyConsistencyFixes(page: Page): Promise<void> {
    if (!config.features.disableAnimations) {
      return;
    }

    try {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
          .timestamp, .live-indicator, [data-timestamp] {
            display: none !important;
          }
        `,
      });

      logger.debug('Consistency fixes applied');
    } catch (error) {
      logger.warn('Failed to apply consistency fixes', { error });
    }
  }

  /**
   * Handle lazy loading by auto-scrolling
   */
  private async handleLazyLoading(page: Page): Promise<void> {
    if (!config.features.enableAutoScroll) {
      return;
    }

    try {
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const maxHeight = 20000; // Safety limit

          const timer = setInterval(() => {
            // @ts-expect-error - runs in browser context
            const scrollHeight = document.body.scrollHeight;
            // @ts-expect-error - runs in browser context
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight || totalHeight >= maxHeight) {
              clearInterval(timer);
              // @ts-expect-error - runs in browser context
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });

      // Wait for images to load
      await page.evaluate(async () => {
        // @ts-expect-error - runs in browser context
        const images = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          images.map((img) => {
            // @ts-expect-error - img is HTMLImageElement in browser context
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              // @ts-expect-error - img is HTMLImageElement in browser context
              img.addEventListener('load', resolve);
              // @ts-expect-error - img is HTMLImageElement in browser context
              img.addEventListener('error', resolve);
              setTimeout(resolve, 5000); // Timeout per image
            });
          })
        );
      });

      logger.debug('Lazy loading handled');
    } catch (error) {
      logger.warn('Error handling lazy loading', { error });
    }
  }

  /**
   * Categorize error for better handling
   */
  private categorizeError(_error: unknown): ErrorCategory {
    if (_error instanceof Error) {
      const message = _error.message.toLowerCase();

      if (message.includes('timeout')) {
        return ErrorCategory.TIMEOUT;
      }
      if (message.includes('network') || message.includes('net::')) {
        return ErrorCategory.NETWORK;
      }
      if (message.includes('render') || message.includes('page crashed')) {
        return ErrorCategory.RENDERING;
      }
      if (message.includes('storage') || message.includes('enospc')) {
        return ErrorCategory.STORAGE;
      }
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Batch capture screenshots
   */
  async batchCapture(urls: string[]): Promise<ScreenshotResult[]> {
    logger.info('Starting batch capture', { count: urls.length });

    const results: ScreenshotResult[] = [];

    for (const url of urls) {
      try {
        const result = await this.captureScreenshot({ url });
        results.push(result);
      } catch (error) {
        logger.error('Batch capture item failed', { url, error });
        results.push({
          success: false,
          url,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info('Batch capture completed', {
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
    });

    return results;
  }

  /**
   * Capture a composed product screenshot (3 parts: image, prices, product number)
   */
  async captureComposedProductScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const { url, productId, category, timeout = config.screenshot.timeout } = options;

    logger.info('Starting composed product screenshot capture', { url, productId, category });

    const startTime = Date.now();
    let page: Page | null = null;
    let release: (() => Promise<void>) | null = null;

    try {
      // Acquire browser instance from pool
      const acquired = await this.browserManager.acquire();
      page = acquired.page;
      release = acquired.release;

      // Navigate to URL with wait strategies
      await this.navigateWithWaitStrategies(page, url, timeout);

      // Handle cookie banners
      await this.handleCookieBanners(page);

      // Apply consistency fixes
      await this.applyConsistencyFixes(page);

      // Wait for page to settle
      await page.waitForTimeout(config.screenshot.waitAfterLoad);

      // Capture the three parts
      logger.info('Capturing product parts...');
      const parts = await this.composer.captureProductParts(page);

      // Generate filename based on product number
      const extractedProductId = productId || extractProductIdFromUrl(url);

      // Try to get product number from page
      let productNumber = extractedProductId;
      try {
        const productNumberText = await page.evaluate(() => {
          // Look for "Produktnummer:" label
          // @ts-expect-error - runs in browser context
          const labels = Array.from(document.querySelectorAll('*'));
          for (const el of labels) {
            // @ts-expect-error - el is Element in browser context
            const text = el.textContent || '';
            if (text.includes('Produktnummer:')) {
              // Extract just the number part
              const match = text.match(/Produktnummer:\s*([A-Z0-9-]+)/);
              if (match && match[1]) {
                return match[1];
              }
            }
          }
          return null;
        });

        if (productNumberText) {
          productNumber = productNumberText;
          logger.info('Extracted product number from page', { productNumber });
        }
      } catch (error) {
        logger.warn('Could not extract product number from page', { error });
      }

      // Sanitize product number for filename
      const sanitizedProductNumber = (productNumber || 'unknown').replace(/[^a-zA-Z0-9-]/g, '_');
      const filename = `${sanitizedProductNumber}.png`;
      const filepath = path.join(config.storage.localPath, filename);

      // Compose the screenshot
      logger.info('Composing screenshot grid...');
      await this.composer.composeScreenshot({
        parts,
        outputPath: filepath,
      });

      // Get file stats
      const fs = require('fs-extra');
      const stats = await fs.stat(filepath);
      const fileSize = stats.size;

      const duration = Date.now() - startTime;

      logger.info('Composed screenshot captured successfully', {
        url,
        filepath,
        fileSize,
        duration,
      });

      return {
        success: true,
        url,
        filepath,
        filename,
        contentHash: '', // Not calculating hash for composed screenshots
        fileSize,
        timestamp: new Date(),
        metadata: {
          productId: productNumber,
          category,
          sourceUrl: url,
          captureTimestamp: new Date(),
          fileSize,
          width: 0, // Composed image, dimensions vary
          height: 0,
          colorSpace: 'RGB',
          version: 'v01',
          contentHash: '',
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Composed screenshot capture failed', {
        url,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        url,
        timestamp: new Date(),
        error: errorMessage,
      };
    } finally {
      // Release browser instance back to pool
      if (release) {
        await release();
      }
    }
  }
}

// Singleton instance
let screenshotService: ScreenshotService | null = null;

/**
 * Get screenshot service singleton
 */
export function getScreenshotService(): ScreenshotService {
  if (!screenshotService) {
    screenshotService = new ScreenshotService();
  }
  return screenshotService;
}

export default ScreenshotService;
