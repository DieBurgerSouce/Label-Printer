/**
 * Precise Screenshot Service
 * Captures EXACT element screenshots as defined in SS_Pos reference screenshots
 */

import { Page } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VariantDetectionService, VariantGroup, ProductVariant } from './variant-detection-service';
import htmlExtractionService from './html-extraction-service';

/**
 * Precise selectors for product page elements
 * Based on SS_Pos reference screenshots
 */
export const PRECISE_SELECTORS = {
  // Main product elements
  // CRITICAL: Try specific selectors first for main product image,
  // then fall back to generic selector with "largest displayed image" logic
  productImage: '.product-detail-media img',

  // Specific selectors to try first (in order of priority)
  // CRITICAL: ALL specific selectors are DISABLED because they all match CONTAINERS instead of IMG elements!
  // The "largest displayed image" strategy below works PERFECTLY and finds the actual main image!
  productImageSpecific: [
    // DISABLED: All these selectors match containers that include both thumbnails AND main image
    // '.gallery-slider-image',
    // 'img.gallery-slider-item-image',
    // '.product-image--image',
    // '.gallery-slider-item.is-active img',
    // '.product-detail-media .base-slider-item img',
    // '.product-detail-media img[itemprop="image"]',
  ],

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
  // New variant tracking fields
  articleNumber?: string;
  variantInfo?: {
    label: string;
    type: string;
    isBaseProduct: boolean;
    parentUrl?: string;
  };
}

export class PreciseScreenshotService {
  private screenshotDir: string;
  private variantDetectionService: VariantDetectionService;

  constructor(screenshotDir: string = './data/screenshots/precise') {
    this.screenshotDir = screenshotDir;
    this.variantDetectionService = new VariantDetectionService();
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
   * NEW: Now supports variants (OMNI, Fruitmax, etc.)
   */
  async captureProductScreenshots(
    page: Page,
    productUrl: string,
    jobId: string,
    articleNumber?: string
  ): Promise<ProductScreenshots[]> {
    const result: ProductScreenshots = {
      url: productUrl,
      layoutType: LayoutType.UNKNOWN,
      screenshots: [],
      timestamp: new Date(),
      articleNumber: undefined, // Will be set later
      variantInfo: {
        label: 'Base Product',
        type: 'base',
        isBaseProduct: true
      }
    };

    try {
      // Navigate to product page ONLY if we're not already there
      const currentUrl = page.url();
      if (currentUrl !== productUrl) {
        console.log(`📱 Navigating to: ${productUrl}`);
        await page.goto(productUrl, {
          waitUntil: 'domcontentloaded', // More reliable in Docker than networkidle2
          timeout: 60000 // Increased timeout for Docker
        });

        // Wait for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`✓ Already on product page: ${productUrl}`);
      }

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
            const urlNumbers = productUrl.match(/\d{4,}/); // Look for 4+ digit numbers in URL
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

      // Store the article number in the result
      result.articleNumber = extractedArticleNumber;

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

      console.log(`✅ Captured ${result.screenshots.filter(s => s.success).length} screenshots for base product`);

      // NEW: DETECT AND CAPTURE ALL VARIANTS
      console.log('\n🔍 Checking for product variants...');
      const variantGroups = await this.variantDetectionService.detectVariants(page);

      if (variantGroups.length > 0) {
        // 🔍 DEBUGGING: Log ALL detected variant groups and variants
        console.log(`\n📋 VARIANT DETECTION SUMMARY:`);
        for (const group of variantGroups) {
          console.log(`   📦 Group: "${group.label}" (Type: ${group.type})`);
          for (const v of group.variants) {
            console.log(`      - ${v.label} (value: ${v.value}, selected: ${v.isSelected})`);
          }
        }

        // 🔧 NEW: Generate ALL combinations of variants (cartesian product)
        const combinations = this.generateVariantCombinations(variantGroups);
        console.log(`\n🎯 FOUND ${combinations.length} VARIANT COMBINATIONS (from ${variantGroups.length} groups)!`);

        // Store all variant results
        const allVariantResults: ProductScreenshots[] = [result]; // Include base product
        const processedCombinations = new Set<string>();

        // Process each combination
        for (let i = 0; i < combinations.length; i++) {
          const combination = combinations[i];

          // Create a unique key for this combination
          const combinationKey = combination.map(v => v.value).join('|');

          // Check if this is the initially loaded combination (all selected variants)
          const isInitialCombination = combination.every(v => v.isSelected);
          if (isInitialCombination) {
            console.log(`\n   ⏩ Skipping combination ${i + 1}/${combinations.length} (already captured as base product)`);
            processedCombinations.add(combinationKey);
            continue;
          }

          // Skip if already processed
          if (processedCombinations.has(combinationKey)) {
            console.log(`\n   ⏩ Skipping duplicate combination ${i + 1}/${combinations.length}`);
            continue;
          }

          console.log(`\n📦 Processing combination ${i + 1}/${combinations.length}:`);
          for (const variant of combination) {
            const groupLabel = variantGroups.find(g => g.variants.some(v => v.value === variant.value))?.label || 'Unknown';
            console.log(`   • ${groupLabel}: ${variant.label}`);
          }

          // Select ALL variants in this combination
          let selectionFailed = false;
          for (const variant of combination) {
            const group = variantGroups.find(g => g.variants.some(v => v.value === variant.value));
            if (!group) {
              console.log(`   ❌ Could not find group for variant ${variant.label}`);
              selectionFailed = true;
              break;
            }

            console.log(`   🔄 Selecting: ${variant.label}...`);
            const selected = await this.variantDetectionService.selectVariant(page, variant, group);
            if (!selected) {
              console.log(`   ❌ Failed to select variant ${variant.label}`);
              selectionFailed = true;
              break;
            }

            // Wait for page to update after each selection
            await new Promise(r => setTimeout(r, 1200));
          }

          if (selectionFailed) {
            console.log(`   ⚠️ Skipping combination due to selection failure`);
            continue;
          }

          // Mark as processed
          processedCombinations.add(combinationKey);

          // Wait a bit longer after all selections
          await new Promise(r => setTimeout(r, 800));

          // Extract the article number for this COMBINATION
          let combinationArticleNumber: string | null = null;
          console.log(`   🔍 Extracting article number for combination...`);

          // Try to extract article number from page
          const selectors = [
            '.product-detail-ordernumber-container',
            '[class*="article-number"]',
            '[class*="product-number"]',
            '[class*="sku"]'
          ];

          for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
              const text = await element.evaluate(el => el.textContent?.trim() || '');
              console.log(`   🔍 Found element "${selector}" with text: "${text}"`);
              const match = text.match(/\d{3,}(?:-[A-Z]+)?/);
              if (match) {
                combinationArticleNumber = match[0];
                console.log(`   ✅ Extracted article number from page: ${combinationArticleNumber}`);
                break;
              }
            }
          }

          if (!combinationArticleNumber) {
            // Generate article number based on base number and combination labels
            if (extractedArticleNumber) {
              // Create suffix from all variant labels in combination
              const suffixes = combination.map(v => {
                // Try to extract meaningful suffix
                const words = v.label.split(/[\s-]+/);
                return words[0].substring(0, 2).toUpperCase();
              });
              combinationArticleNumber = `${extractedArticleNumber}-${suffixes.join('-')}`;
              console.log(`   🔧 Generated article number from base: ${combinationArticleNumber}`);
            } else {
              // Use combination labels
              const labels = combination.map(v => v.label.replace(/\s+/g, '-')).join('_');
              combinationArticleNumber = `variant-${labels}`;
              console.log(`   🔧 Generated generic variant ID: ${combinationArticleNumber}`);
            }
          }

          console.log(`   📝 FINAL Combination article number: ${combinationArticleNumber}`);

          // Extract HTML data for this COMBINATION (after all selections)
          console.log(`   📄 Extracting HTML data for combination ${combinationArticleNumber}...`);
          const combinationHtmlData = await this.extractVariantHtmlData(page, combinationArticleNumber);
          console.log(`   ✅ Combination HTML extracted: articleNumber=${combinationHtmlData.articleNumber}, name=${combinationHtmlData.productName}`);

          // Save HTML data to combination folder
          const combinationFolder = combinationArticleNumber || `combination-${Date.now()}`;
          await this.saveVariantHtmlData(jobId, combinationFolder, combinationHtmlData);

          // Create a new result object for this combination
          const combinationResult: ProductScreenshots = {
            url: productUrl + '#combination=' + combinationKey,
            layoutType: await this.detectLayoutType(page),
            screenshots: [],
            timestamp: new Date(),
            articleNumber: combinationArticleNumber,
            variantInfo: {
              label: combination.map(v => v.label).join(' + '),
              type: 'combination',
              isBaseProduct: false,
              parentUrl: productUrl
            }
          };

          // Capture screenshots for this combination
          const elementsToCapture = this.getElementsToCapture(combinationResult.layoutType);

          for (const elementConfig of elementsToCapture) {
            const screenshot = await this.captureElement(
              page,
              elementConfig.type,
              elementConfig.selector,
              jobId,
              combinationFolder
            );
            combinationResult.screenshots.push(screenshot);
          }

          const combinationLabel = combination.map(v => v.label).join(' + ');
          console.log(`   ✅ Captured ${combinationResult.screenshots.filter(s => s.success).length} screenshots for combination: ${combinationLabel} (${combinationArticleNumber})`);

          // Store combination result
          allVariantResults.push(combinationResult);
        }

        console.log(`\n🎉 TOTAL: Captured ${allVariantResults.length} product variants (including base product)`);

        // FIXED: Now returning ALL variant results instead of just the base product
        return allVariantResults;
      } else {
        console.log('   ℹ️ No variants found for this product');
      }

    } catch (error) {
      console.error('❌ Error capturing product screenshots:', error);
    }

    // Return array with just the base product if no variants or if there was an error
    return [result];
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
      // CRITICAL: For product images, use smart selection strategy
      let element;
      if (type === 'product-image') {
        // STRATEGY 1: Try specific selectors first (for products with galleries)
        console.log(`  🔍 Trying specific selectors for main product image...`);
        for (const specificSelector of PRECISE_SELECTORS.productImageSpecific) {
          const specificElement = await page.$(specificSelector);
          if (specificElement) {
            // Verify it's visible and has reasonable size
            const isValid = await specificElement.evaluate((el: any) => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width >= 200 && rect.height >= 200 &&
                     style.display !== 'none' &&
                     style.visibility !== 'hidden';
            });

            if (isValid) {
              element = specificElement;
              console.log(`  ✅ Found main image using specific selector: ${specificSelector}`);
              break;
            }
          }
        }

        // STRATEGY 2: Fall back to "largest DISPLAYED image" logic
        if (!element) {
          console.log(`  🔄 Falling back to largest displayed image strategy...`);
          const allImages = await page.$$(selector);

          if (allImages.length === 0) {
            result.error = `Element not found: ${selector}`;
            console.log(`❌ ${type}: ${result.error}`);
            return result;
          }

          // Get the largest DISPLAYED image (not natural size!)
          let largestImage = allImages[0];
          let maxArea = 0;

          for (const img of allImages) {
            const imgData = await img.evaluate((el: any) => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              const isVisible = rect.width > 0 && rect.height > 0 &&
                              style.display !== 'none' &&
                              style.visibility !== 'hidden';

              // CRITICAL FIX: Use DISPLAYED size (getBoundingClientRect),
              // not naturalWidth/Height (which is the same for thumbnails!)
              const width = rect.width;
              const height = rect.height;

              return {
                area: width * height,
                isVisible,
                width,
                height,
                src: el.src
              };
            }) as any;

            // Only consider visible images with minimum displayed size of 200px
            if (imgData.isVisible && imgData.area > maxArea && imgData.width >= 200) {
              maxArea = imgData.area;
              largestImage = img;
            }
          }

          element = largestImage;
          console.log(`  ✅ Found ${allImages.length} images, selected largest displayed (${Math.sqrt(maxArea).toFixed(0)}px area)`);
        }
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
      await (element as any).scrollIntoViewIfNeeded();

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

      // CRITICAL FIX: For product images, download the image directly from src URL instead of screenshot
      // This avoids ALL UI elements (gallery controls, arrows, thumbnails, overlays, containers, etc.)
      let buffer;
      let box = await element.boundingBox(); // Get dimensions first (needed for dimension reporting)

      if (!box) {
        throw new Error('Could not get element bounding box');
      }

      if (type === 'product-image') {
        // Extract the src URL from the IMG element
        const imgSrc = await element.evaluate((el: any) => {
          // CRITICAL: Use el.src (original /media/ URL), NOT currentSrc (browser's /thumbnail/ URL)
          return el.src || el.getAttribute('data-src') || el.currentSrc;
        });

        if (!imgSrc) {
          throw new Error('Could not extract image src from element');
        }

        console.log(`  🔗 Downloading image directly from: ${imgSrc.substring(0, 80)}...`);

        // CRITICAL: Download image using fetch() WITHOUT navigating the page!
        // Using page.goto() would navigate away from the product page and break other screenshots!
        const response = await fetch(imgSrc);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        console.log(`  ✅ Downloaded pure product image (${(buffer.length / 1024).toFixed(1)} KB) - no UI elements!`);
      } else {
        // For other elements, element.screenshot() is fine
        buffer = await element.screenshot();
      }
      await fs.writeFile(screenshotPath, buffer);

      // Get file stats
      const stats = await fs.stat(screenshotPath);

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

      // First try Shopware 6 specific cookie selector
      const shopwareCookieButton = await page.$('button.js-cookie-configuration-button.cookie-permission--accept-button');
      if (shopwareCookieButton) {
        await shopwareCookieButton.click();
        console.log('   ✅ Accepted cookies (Shopware 6 specific button)');
        await new Promise(r => setTimeout(r, 1500));
        return;
      }

      // Fallback: Try to click "Alle Cookies akzeptieren" button
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

  /**
   * 🔧 NEW: Extract HTML data for a variant (after variant selection)
   */
  private async extractVariantHtmlData(page: Page, variantArticleNumber: string): Promise<any> {
    try {
      // Extract HTML data from the current page state (variant is already selected)
      const htmlData = await htmlExtractionService.extractProductData(page);

      // Override article number with variant-specific one if it differs
      // This ensures variants get their correct article number (e.g., "7900-SH" instead of just "7900")
      if (variantArticleNumber && variantArticleNumber !== htmlData.articleNumber) {
        console.log(`   🔧 Overriding HTML articleNumber "${htmlData.articleNumber}" with variant number "${variantArticleNumber}"`);
        htmlData.articleNumber = variantArticleNumber;
      }

      return htmlData;
    } catch (error) {
      console.error(`   ❌ Failed to extract HTML data for variant:`, error);
      // Return minimal data structure
      return {
        articleNumber: variantArticleNumber,
        productName: `Product ${variantArticleNumber}`,
        price: null,
        priceType: 'unknown',
        description: '',
        tieredPrices: [],
        tieredPricesText: ''
      };
    }
  }

  /**
   * 🔧 NEW: Save HTML data to variant folder
   */
  private async saveVariantHtmlData(jobId: string, variantFolder: string, htmlData: any): Promise<void> {
    try {
      const jobDir = path.join(this.screenshotDir, jobId);
      const variantDir = path.join(jobDir, variantFolder);

      // Ensure directory exists
      await fs.mkdir(variantDir, { recursive: true });

      // Save HTML data
      const htmlDataPath = path.join(variantDir, 'html-data.json');
      await fs.writeFile(htmlDataPath, JSON.stringify(htmlData, null, 2));

      console.log(`   💾 Variant HTML data saved: ${htmlDataPath}`);
    } catch (error) {
      console.error(`   ❌ Failed to save variant HTML data:`, error);
    }
  }

  /**
   * 🎯 NEW: Generate all possible combinations of variants (cartesian product)
   * Example: If we have 2 variant groups:
   *   Group 1: [A, B]
   *   Group 2: [X, Y, Z]
   * This will generate: [[A,X], [A,Y], [A,Z], [B,X], [B,Y], [B,Z]]
   */
  private generateVariantCombinations(variantGroups: VariantGroup[]): ProductVariant[][] {
    if (variantGroups.length === 0) return [];
    if (variantGroups.length === 1) {
      // Single group: return each variant as a single-element array
      return variantGroups[0].variants.map(v => [v]);
    }

    // Recursive cartesian product
    const [firstGroup, ...restGroups] = variantGroups;
    const restCombinations = this.generateVariantCombinations(restGroups);

    const combinations: ProductVariant[][] = [];
    for (const variant of firstGroup.variants) {
      for (const restCombo of restCombinations) {
        combinations.push([variant, ...restCombo]);
      }
    }

    return combinations;
  }
}

// Export singleton instance
export const preciseScreenshotService = new PreciseScreenshotService();