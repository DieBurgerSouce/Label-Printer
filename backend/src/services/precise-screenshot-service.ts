/**
 * Precise Screenshot Service
 * Captures EXACT element screenshots as defined in SS_Pos reference screenshots
 */

import { Page, ElementHandle } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Precise selectors for product page elements
 * Based on SS_Pos reference screenshots
 */
export const PRECISE_SELECTORS = {
  // Main product elements
  // CRITICAL: Don't require itemprop="image" - some products don't have it!
  // The "largest image" logic will pick the right one
  productImage: '.product-detail-media img',
  title: 'h1.product-detail-name',
  articleNumber: '.product-detail-ordernumber-container', // Get the whole container with "Produktnummer:"

  // Price elements (one or the other)
  singlePrice: '.product-detail-price-container', // Get whole price container
  tieredPriceTable: 'table.product-block-prices-grid',

  // Description - capture BOTH title and text content
  description: '.product-detail-description', // Get the whole description container
  descriptionText: '.product-detail-description-text', // The actual text content
  descriptionTitle: '.product-detail-description-title', // Just the title
};

/**
 * Layout types based on price structure
 */
export enum LayoutType {
  SINGLE_PRICE = 'single_price',
  TIERED_PRICE = 'tiered_price',
  UNKNOWN = 'unknown'
}

/**
 * Screenshot result for a single element
 */
export interface ElementScreenshot {
  type: string;
  selector: string;
  path: string;
  success: boolean;
  error?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
}

/**
 * Complete screenshot result for a product page
 */
export interface ProductScreenshots {
  url: string;
  layoutType: LayoutType;
  screenshots: ElementScreenshot[];
  timestamp: Date;
}

export class PreciseScreenshotService {
  private screenshotDir: string;

  constructor(screenshotDir: string = './data/screenshots/precise') {
    this.screenshotDir = screenshotDir;
  }

  /**
   * Detect layout type based on price elements
   */
  async detectLayoutType(page: Page): Promise<LayoutType> {
    // Check for tiered price table first (more specific)
    const hasTieredPrice = await page.$('table.product-block-prices-grid') !== null;
    if (hasTieredPrice) {
      console.log('✅ Detected: TIERED PRICE layout');
      return LayoutType.TIERED_PRICE;
    }

    // Check for single price - try multiple selectors
    const hasSinglePrice = await page.$('.product-detail-price-container') !== null ||
                           await page.$('.product-detail-price') !== null;
    if (hasSinglePrice) {
      console.log('✅ Detected: SINGLE PRICE layout');
      return LayoutType.SINGLE_PRICE;
    }

    console.log('⚠️ Could not detect layout type');
    return LayoutType.UNKNOWN;
  }

  /**
   * Capture all product screenshots based on SS_Pos reference
   */
  async captureProductScreenshots(
    page: Page,
    productUrl: string,
    jobId: string,
    articleNumber?: string
  ): Promise<ProductScreenshots> {
    const result: ProductScreenshots = {
      url: productUrl,
      layoutType: LayoutType.UNKNOWN,
      screenshots: [],
      timestamp: new Date()
    };

    try {
      // Navigate to product page
      console.log(`📱 Navigating to: ${productUrl}`);
      await page.goto(productUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // CRITICAL: Accept cookie banner to remove overlay
      await this.acceptCookieBanner(page);

      // Wait for page to stabilize
      await new Promise(r => setTimeout(r, 2000));

      // Scroll to load lazy images
      await this.scrollPage(page);
      await new Promise(r => setTimeout(r, 1000));

      // First, extract article number
      let extractedArticleNumber = articleNumber;
      if (!extractedArticleNumber) {
        try {
          // Try multiple selectors to find article number
          const selectors = [
            '.product-detail-ordernumber-container',
            '[class*="article-number"]',
            '[class*="product-number"]',
            '[class*="sku"]',
            '[itemprop="sku"]',
            '.product-sku',
            '.product-code'
          ];

          for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
              const fullText = await element.evaluate(el => el.textContent?.trim() || '');
              // Extract just the number part
              const numbers = fullText.match(/\d{3,}/); // Look for 3+ digit numbers
              if (numbers && numbers[0]) {
                extractedArticleNumber = numbers[0];
                console.log(`📦 Extracted article number: ${extractedArticleNumber} from ${selector}`);
                break;
              }
            }
          }

          // If still no number, try to extract from URL
          if (!extractedArticleNumber) {
            const urlNumbers = url.match(/\d{4,}/); // Look for 4+ digit numbers in URL
            if (urlNumbers && urlNumbers[0]) {
              extractedArticleNumber = urlNumbers[0];
              console.log(`📦 Extracted article number from URL: ${extractedArticleNumber}`);
            }
          }
        } catch (e) {
          console.log('⚠️ Could not extract article number from page');
        }
      }

      // Use article number as folder name, or generate a unique ID
      const folderName = extractedArticleNumber || `product-${Date.now()}`;

      // Detect layout type
      result.layoutType = await this.detectLayoutType(page);

      // Define elements to capture based on layout
      const elementsToCapture = this.getElementsToCapture(result.layoutType);

      // Capture each element
      for (const elementConfig of elementsToCapture) {
        const screenshot = await this.captureElement(
          page,
          elementConfig.type,
          elementConfig.selector,
          jobId,
          folderName
        );
        result.screenshots.push(screenshot);
      }

      console.log(`✅ Captured ${result.screenshots.filter(s => s.success).length} screenshots successfully`);

    } catch (error) {
      console.error('❌ Error capturing product screenshots:', error);
    }

    return result;
  }

  /**
   * Get elements to capture based on layout type
   */
  private getElementsToCapture(layoutType: LayoutType): Array<{type: string; selector: string}> {
    const elements = [
      { type: 'product-image', selector: PRECISE_SELECTORS.productImage },
      { type: 'title', selector: PRECISE_SELECTORS.title },
      { type: 'article-number', selector: PRECISE_SELECTORS.articleNumber },
      // Capture complete description container (title + text)
      { type: 'description', selector: PRECISE_SELECTORS.description }
    ];

    // Add price based on layout type
    if (layoutType === LayoutType.TIERED_PRICE) {
      elements.push({ type: 'price-table', selector: PRECISE_SELECTORS.tieredPriceTable });
    } else if (layoutType === LayoutType.SINGLE_PRICE) {
      elements.push({ type: 'price', selector: PRECISE_SELECTORS.singlePrice });
    } else {
      // Try both if unknown
      elements.push({ type: 'price', selector: PRECISE_SELECTORS.singlePrice });
      elements.push({ type: 'price-table', selector: PRECISE_SELECTORS.tieredPriceTable });
    }

    return elements;
  }

  /**
   * Capture a single element screenshot
   */
  private async captureElement(
    page: Page,
    type: string,
    selector: string,
    jobId: string,
    folderName: string = 'product'
  ): Promise<ElementScreenshot> {
    const result: ElementScreenshot = {
      type,
      selector,
      path: '',
      success: false
    };

    try {
      // CRITICAL: For product images, find the LARGEST image (main product photo)
      // not the first one (which might be a thumbnail or gallery preview)
      let element;
      if (type === 'product-image') {
        // Find ALL matching images
        const allImages = await page.$$(selector);

        if (allImages.length === 0) {
          result.error = `Element not found: ${selector}`;
          console.log(`❌ ${type}: ${result.error}`);
          return result;
        }

        // Get the largest VISIBLE image by dimensions
        let largestImage = allImages[0];
        let maxArea = 0;

        for (const img of allImages) {
          const imgData = await img.evaluate((el: HTMLImageElement) => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                            window.getComputedStyle(el).display !== 'none' &&
                            window.getComputedStyle(el).visibility !== 'hidden';

            // Use naturalWidth/Height for actual image size (not CSS size)
            const width = el.naturalWidth || el.width;
            const height = el.naturalHeight || el.height;

            return {
              area: width * height,
              isVisible,
              width,
              height,
              src: el.src
            };
          });

          // Only consider visible images with actual content
          if (imgData.isVisible && imgData.area > maxArea && imgData.width > 100) {
            maxArea = imgData.area;
            largestImage = img;
          }
        }

        element = largestImage;
        console.log(`  🔍 Found ${allImages.length} images, using largest visible (${Math.sqrt(maxArea).toFixed(0)}px area)`);
      } else {
        element = await page.$(selector);
      }

      if (!element) {
        result.error = `Element not found: ${selector}`;
        console.log(`❌ ${type}: ${result.error}`);
        return result;
      }

      // Ensure element is visible
      const isVisible = await page.evaluate((sel) => {
        const elem = document.querySelector(sel);
        if (!elem) return false;
        const rect = elem.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }, selector);

      if (!isVisible) {
        result.error = 'Element not visible';
        console.log(`❌ ${type}: ${result.error}`);
        return result;
      }

      // Scroll element into view
      await element.scrollIntoViewIfNeeded();

      // CRITICAL: For images, wait until they're fully loaded (lazy loading!)
      if (type === 'product-image') {
        try {
          // Wait for image to load (max 5 seconds)
          await page.evaluate((sel) => {
            return new Promise<void>((resolve) => {
              const img = document.querySelector(sel) as HTMLImageElement;
              if (!img) {
                resolve();
                return;
              }

              // If already loaded, resolve immediately
              if (img.complete && img.naturalHeight > 0) {
                resolve();
                return;
              }

              // Wait for load event
              const timeout = setTimeout(() => resolve(), 5000); // Max 5s wait
              img.addEventListener('load', () => {
                clearTimeout(timeout);
                resolve();
              }, { once: true });

              img.addEventListener('error', () => {
                clearTimeout(timeout);
                resolve();
              }, { once: true });
            });
          }, selector);
          console.log(`  ⏳ Waited for image to load: ${selector}`);

          // CRITICAL: Wait for page to stabilize after lazy-loading
          // (prevents screenshot from being shifted due to layout changes)
          await new Promise(r => setTimeout(r, 1500));
          console.log(`  ⏳ Page stabilized after lazy-load (1500ms)`);
        } catch (e) {
          console.log(`  ⚠️ Image load timeout, proceeding anyway`);
        }
      } else {
        // For other elements, shorter wait is fine
        await new Promise(r => setTimeout(r, 500));
      }

      // Create screenshot path using article number as folder name
      const screenshotPath = path.join(
        this.screenshotDir,
        jobId,
        folderName,
        `${type}.png`
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

      // Take screenshot using element.screenshot() for EXACT boundaries
      const buffer = await element.screenshot();
      await fs.writeFile(screenshotPath, buffer);

      // Get file stats
      const stats = await fs.stat(screenshotPath);

      // Get element dimensions
      const box = await element.boundingBox();

      result.path = screenshotPath;
      result.success = true;
      result.fileSize = stats.size;

      if (box) {
        result.dimensions = {
          width: Math.round(box.width),
          height: Math.round(box.height)
        };
      }

      console.log(`✅ ${type}: Captured (${(result.fileSize / 1024).toFixed(1)} KB) - ${result.dimensions?.width}x${result.dimensions?.height}px`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ ${type}: Failed - ${result.error}`);
    }

    return result;
  }

  /**
   * Accept cookie banner to remove overlay
   */
  private async acceptCookieBanner(page: Page): Promise<void> {
    try {
      // Wait a moment for cookie banner to appear
      await new Promise(r => setTimeout(r, 1000));

      // Try to click "Alle Cookies akzeptieren" button
      const accepted = await page.evaluate(() => {
        // Find all buttons
        const buttons = Array.from(document.querySelectorAll('button'));

        // Look for accept button
        const acceptButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('alle cookies akzeptieren') ||
                 text.includes('akzeptieren') ||
                 text.includes('accept all');
        });

        if (acceptButton) {
          acceptButton.click();
          return true;
        }

        // Also check for links
        const links = Array.from(document.querySelectorAll('a'));
        const acceptLink = links.find(link => {
          const text = link.textContent?.toLowerCase() || '';
          return text.includes('alle cookies akzeptieren') ||
                 text.includes('akzeptieren');
        });

        if (acceptLink) {
          acceptLink.click();
          return true;
        }

        return false;
      });

      if (accepted) {
        console.log('✅ Cookie banner accepted');
        await new Promise(r => setTimeout(r, 1500)); // Wait for overlay to disappear
      } else {
        console.log('⚠️ No cookie banner found or could not accept');
      }
    } catch (error) {
      console.log('⚠️ Error accepting cookies:', error);
    }
  }

  /**
   * Scroll page to load lazy-loaded images
   */
  private async scrollPage(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 200;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0); // Scroll back to top
            resolve();
          }
        }, 100);
      });
    });
  }

  /**
   * Compare screenshots with reference (for testing)
   */
  async compareWithReference(
    capturedPath: string,
    referencePath: string
  ): Promise<{match: boolean; difference?: number}> {
    try {
      const captured = await fs.readFile(capturedPath);
      const reference = await fs.readFile(referencePath);

      // Simple size comparison for now
      const sizeDiff = Math.abs(captured.length - reference.length);
      const percentDiff = (sizeDiff / reference.length) * 100;

      return {
        match: percentDiff < 10, // Allow 10% size difference
        difference: percentDiff
      };
    } catch (error) {
      console.error('Error comparing screenshots:', error);
      return { match: false, difference: 100 };
    }
  }
}

// Export singleton instance
export const preciseScreenshotService = new PreciseScreenshotService();