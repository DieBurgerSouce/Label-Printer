import { Page } from 'playwright';
import sharp from 'sharp';
import { createLogger } from '../utils/logger';

const logger = createLogger('ProductScreenshotComposer');

export interface ProductScreenshotParts {
  productImage: Buffer;
  priceTable: Buffer;
  productNumber: Buffer;
}

export interface ComposedScreenshotOptions {
  parts: ProductScreenshotParts;
  outputPath: string;
}

/**
 * Product Screenshot Composer
 * Creates a grid-based composite screenshot with:
 * - Left: Product image (large)
 * - Right top: Price table
 * - Right bottom: Product number
 */
export class ProductScreenshotComposer {
  /**
   * Capture specific parts of a product page
   */
  async captureProductParts(page: Page): Promise<ProductScreenshotParts> {
    logger.info('Capturing product parts...');

    try {
      // 1. Capture product image
      const productImage = await this.captureProductImage(page);

      // 2. Capture price table
      const priceTable = await this.capturePriceTable(page);

      // 3. Capture product number
      const productNumber = await this.captureProductNumber(page);

      logger.info('All product parts captured successfully');

      return {
        productImage,
        priceTable,
        productNumber,
      };
    } catch (error) {
      logger.error('Failed to capture product parts', { error });
      throw error;
    }
  }

  /**
   * Capture ONLY the product image (not navigation, not page elements)
   */
  private async captureProductImage(page: Page): Promise<Buffer> {
    const selectors = [
      '.product-detail-media img.gallery-slider-image',
      '.product-image-container img',
      '.product-detail-image img',
      '.gallery-slider-item img',
      'img.product-image',
      '.product-detail .image-slider img',
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          // Scroll element into view to ensure it's fully visible
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500); // Wait for scroll to complete

          // Get the bounding box
          const box = await element.boundingBox();

          if (!box) {
            logger.warn('Could not get bounding box for image', { selector });
            continue;
          }

          // Make sure the image is within viewport (positive coordinates)
          if (box.x < 0 || box.y < 0) {
            logger.warn('Image is outside viewport, scrolling...', { selector, box });
            await element.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
          }

          logger.info('Found product image', { selector, boundingBox: box });

          // Use clip to capture exact image area
          const screenshot = await page.screenshot({
            type: 'png',
            clip: {
              x: Math.max(0, box.x),
              y: Math.max(0, box.y),
              width: box.width,
              height: box.height,
            },
          });

          return screenshot;
        }
      } catch (error) {
        logger.warn('Failed to capture product image', { selector, error });
        continue;
      }
    }

    throw new Error('Product image not found');
  }

  /**
   * Capture ONLY the price information (no buttons, no inputs)
   */
  private async capturePriceTable(page: Page): Promise<Buffer> {
    // Try selectors in order of preference:
    // 1. Staffelpreise table (multi-price products like jackets, knives)
    // 2. Single price container (single-price products like food items)
    const selectors = [
      '.product-block-prices',              // Staffelpreise table
      '.product-detail-price-container',    // Single price or price table
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          // Check if this element contains buttons or inputs (we don't want those)
          const hasInteractiveElements = await element.evaluate((el) => {
            const html = el.innerHTML;
            return html.includes('<button') || html.includes('<input');
          });

          if (hasInteractiveElements) {
            logger.info('Skipping price element with interactive elements', { selector });
            continue;
          }

          const box = await element.boundingBox();
          logger.info('Found clean price info', {
            selector,
            boundingBox: box,
          });

          const screenshot = await element.screenshot({ type: 'png' });
          return screenshot;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('Price info not found');
  }

  /**
   * Capture the product number
   */
  private async captureProductNumber(page: Page): Promise<Buffer> {
    // Simple and reliable: use the specific CSS class
    const selectors = [
      '.product-detail-ordernumber-container',
      '.product-detail-ordernumber',
      'div:has(.product-detail-ordernumber)',
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          // Get bounding box to log it
          const box = await element.boundingBox();
          logger.info('Found product number', {
            selector,
            boundingBox: box,
          });

          const screenshot = await element.screenshot({ type: 'png' });
          return screenshot;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('Product number not found');
  }

  /**
   * Compose the three parts into a grid layout
   * Layout:
   * +----------------+----------+
   * |                |  Price   |
   * |   Product      |  Table   |
   * |   Image        +----------+
   * |   (Large)      | Product  |
   * |                | Number   |
   * +----------------+----------+
   */
  async composeScreenshot(options: ComposedScreenshotOptions): Promise<void> {
    const { parts, outputPath } = options;

    logger.info('Composing screenshot grid...');

    try {
      // Get metadata for each image
      const [productMeta, priceMeta, numberMeta] = await Promise.all([
        sharp(parts.productImage).metadata(),
        sharp(parts.priceTable).metadata(),
        sharp(parts.productNumber).metadata(),
      ]);

      // Calculate dimensions
      const productWidth = productMeta.width || 400;
      const productHeight = productMeta.height || 400;

      const priceWidth = priceMeta.width || 300;
      const priceHeight = priceMeta.height || 150;

      const numberWidth = numberMeta.width || 300;
      const numberHeight = numberMeta.height || 50;

      // Right column width should be the max of price and number widths
      const rightColumnWidth = Math.max(priceWidth, numberWidth);

      // Total canvas dimensions
      const canvasWidth = productWidth + rightColumnWidth + 20; // 20px padding
      const canvasHeight = Math.max(productHeight, priceHeight + numberHeight + 20); // 20px padding between

      // Resize images to fit properly
      const resizedPrice = await sharp(parts.priceTable)
        .resize(rightColumnWidth, null, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer();

      const resizedNumber = await sharp(parts.productNumber)
        .resize(rightColumnWidth, null, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer();

      // Create composite image
      await sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: parts.productImage,
            top: 0,
            left: 0,
          },
          {
            input: resizedPrice,
            top: 0,
            left: productWidth + 10,
          },
          {
            input: resizedNumber,
            top: priceHeight + 10,
            left: productWidth + 10,
          },
        ])
        .png()
        .toFile(outputPath);

      logger.info('Screenshot composed successfully', { outputPath });
    } catch (error) {
      logger.error('Failed to compose screenshot', { error });
      throw error;
    }
  }
}

// Singleton instance
let composerInstance: ProductScreenshotComposer | null = null;

/**
 * Get composer singleton
 */
export function getProductScreenshotComposer(): ProductScreenshotComposer {
  if (!composerInstance) {
    composerInstance = new ProductScreenshotComposer();
  }
  return composerInstance;
}
