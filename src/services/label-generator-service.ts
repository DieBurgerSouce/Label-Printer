import { Page } from 'playwright';
import sharp from 'sharp';
import * as fs from 'fs-extra';
import path from 'path';
import { createLogger } from '../utils/logger';
import {
  PriceLabel,
  LabelTemplateType,
  PriceInfo,
  LabelTemplate,
} from '../types/label-types';
import { getExcelParserService } from './excel-parser-service';

const logger = createLogger('LabelGeneratorService');

export interface LabelExtractionOptions {
  includeImage?: boolean;
  includePrice?: boolean;
  includeProductNumber?: boolean;
  includeDescription?: boolean;
  templateType?: LabelTemplateType;
  customWidth?: number;  // in px
  customHeight?: number; // in px
}

export interface ExtractedLabelParts {
  priceTableImage?: Buffer;
  productNumberImage?: Buffer;
  productImageUrl?: string;
}

export class LabelGeneratorService {
  private templates: Map<string, LabelTemplate> = new Map();
  private outputDir: string;

  constructor(outputDir: string = './data/labels') {
    this.outputDir = outputDir;
    this.init();
  }

  /**
   * Initialize service
   */
  private async init(): Promise<void> {
    try {
      await fs.ensureDir(this.outputDir);
      await this.loadDefaultTemplates();
    } catch (error) {
      logger.error('Failed to initialize LabelGeneratorService', { error });
    }
  }

  /**
   * Extract price label from a product page
   */
  async extractLabelFromPage(
    page: Page,
    articleNumber: string,
    options: LabelExtractionOptions = {}
  ): Promise<PriceLabel> {
    logger.info('Extracting label from page', { articleNumber, options });

    try {
      // Extract the label parts
      const parts = await this.extractLabelParts(page, options);

      // Get product description from Excel if available
      const excelService = getExcelParserService();
      const productDesc = excelService.getProductDescription(articleNumber);

      // Extract price information from the page
      const priceInfo = await this.extractPriceInfo(page);

      // Generate unique ID
      const id = `label-${articleNumber}-${Date.now()}`;

      // Create the label
      const label: PriceLabel = {
        id,
        articleNumber,
        productName: productDesc?.description || `Product ${articleNumber}`,
        description: productDesc?.additionalInfo,
        priceInfo,
        imageData: parts.priceTableImage,
        templateType: options.templateType || 'standard',
        createdAt: new Date(),
        tags: productDesc?.category ? [productDesc.category] : undefined,
      };

      // Save the label
      await this.saveLabel(label, parts);

      logger.info('Label extracted successfully', { id, articleNumber });
      return label;
    } catch (error) {
      logger.error('Failed to extract label from page', { error, articleNumber });
      throw error;
    }
  }

  /**
   * Extract individual parts of the label from the page
   */
  private async extractLabelParts(page: Page, options: LabelExtractionOptions): Promise<ExtractedLabelParts> {
    const parts: ExtractedLabelParts = {};

    // Extract price table (the main price display area)
    if (options.includePrice !== false) {
      try {
        parts.priceTableImage = await this.capturePriceTable(page);
      } catch (error) {
        logger.warn('Failed to capture price table', { error });
      }
    }

    // Extract product number
    if (options.includeProductNumber !== false) {
      try {
        parts.productNumberImage = await this.captureProductNumber(page);
      } catch (error) {
        logger.warn('Failed to capture product number', { error });
      }
    }

    return parts;
  }

  /**
   * Capture the price table/price display area
   */
  private async capturePriceTable(page: Page): Promise<Buffer> {
    const selectors = [
      '.product-block-prices',              // Staffelpreise table
      '.product-detail-price-container',    // Single price or price table
      '.product-price',                     // Generic price container
      '[class*="price-block"]',            // Any price block
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          // Scroll into view
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);

          // Take screenshot
          const screenshot = await element.screenshot({ type: 'png' });

          logger.info('Price table captured', { selector });
          return screenshot;
        }
      } catch (error) {
        logger.debug('Selector not found', { selector });
        continue;
      }
    }

    throw new Error('Price table not found');
  }

  /**
   * Capture the product number/SKU display
   */
  private async captureProductNumber(page: Page): Promise<Buffer> {
    const selectors = [
      '.product-detail-ordernumber-container',
      '.product-detail-ordernumber',
      '[class*="ordernumber"]',
      '[class*="article-number"]',
      '[class*="sku"]',
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);

          const screenshot = await element.screenshot({ type: 'png' });

          logger.info('Product number captured', { selector });
          return screenshot;
        }
      } catch (error) {
        logger.debug('Selector not found', { selector });
        continue;
      }
    }

    throw new Error('Product number not found');
  }

  /**
   * Extract price information from the page
   */
  private async extractPriceInfo(page: Page): Promise<PriceInfo> {
    try {
      // Try to extract price from the page
      const priceText = await page
        .locator('.product-detail-price, .price, [class*="price"]')
        .first()
        .textContent()
        .catch(() => null);

      if (priceText) {
        // Parse price from text (e.g., "€ 19,99" or "19.99 EUR")
        const priceMatch = priceText.match(/[\d,.]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : 0;

        // Try to detect currency
        const currency = priceText.includes('€') || priceText.includes('EUR') ? 'EUR' : 'EUR';

        // Try to extract Staffelpreise if available
        const staffelpreise = await this.extractStaffelpreise(page);

        return {
          price,
          currency,
          staffelpreise: staffelpreise.length > 0 ? staffelpreise : undefined,
        };
      }

      // Fallback
      return {
        price: 0,
        currency: 'EUR',
      };
    } catch (error) {
      logger.warn('Failed to extract price info', { error });
      return {
        price: 0,
        currency: 'EUR',
      };
    }
  }

  /**
   * Extract Staffelpreise (volume pricing) if available
   */
  private async extractStaffelpreise(page: Page): Promise<Array<{ quantity: number; price: number }>> {
    const staffelpreise: Array<{ quantity: number; price: number }> = [];

    try {
      // Check if Staffelpreise table exists
      const tableExists = await page.locator('.product-block-prices').isVisible({ timeout: 1000 }).catch(() => false);

      if (!tableExists) {
        return staffelpreise;
      }

      // Extract rows from the table
      const rows = await page.locator('.product-block-prices tr').all();

      for (const row of rows) {
        try {
          const text = await row.textContent();
          if (!text) continue;

          // Try to extract quantity and price
          // Example: "ab 10 Stück: € 8,99"
          const quantityMatch = text.match(/(\d+)\s*Stück/i);
          const priceMatch = text.match(/[\d,.]+/);

          if (quantityMatch && priceMatch) {
            staffelpreise.push({
              quantity: parseInt(quantityMatch[1]),
              price: parseFloat(priceMatch[0].replace(',', '.')),
            });
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      logger.debug('No Staffelpreise found', { error });
    }

    return staffelpreise;
  }

  /**
   * Create a label from existing data (without screenshot extraction)
   */
  async createLabel(data: {
    articleNumber: string;
    productName?: string;
    description?: string;
    priceInfo: PriceInfo;
    templateType?: LabelTemplateType;
    imageData?: Buffer;
  }): Promise<PriceLabel> {
    const id = `label-${data.articleNumber}-${Date.now()}`;

    // Try to get description from Excel
    const excelService = getExcelParserService();
    const productDesc = excelService.getProductDescription(data.articleNumber);

    const label: PriceLabel = {
      id,
      articleNumber: data.articleNumber,
      productName: data.productName || productDesc?.description || `Product ${data.articleNumber}`,
      description: data.description || productDesc?.additionalInfo,
      priceInfo: data.priceInfo,
      imageData: data.imageData,
      templateType: data.templateType || 'standard',
      createdAt: new Date(),
      tags: productDesc?.category ? [productDesc.category] : undefined,
    };

    await this.saveLabel(label);

    logger.info('Label created', { id, articleNumber: data.articleNumber });
    return label;
  }

  /**
   * Generate label image from template
   */
  async generateLabelImage(
    label: PriceLabel,
    templateId?: string,
    customSize?: { width: number; height: number }
  ): Promise<Buffer> {
    const template = templateId ? this.templates.get(templateId) : this.getDefaultTemplate(label.templateType);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      // Get dimensions
      const width = customSize?.width || template.layout.width * 11.811; // mm to px at 300dpi
      const height = customSize?.height || template.layout.height * 11.811;

      // Create canvas
      const canvas = sharp({
        create: {
          width: Math.round(width),
          height: Math.round(height),
          channels: 4,
          background: template.styles.background || '#ffffff',
        },
      });

      // If label already has image data, use it
      if (label.imageData) {
        return label.imageData;
      }

      // Otherwise, render from template
      // For now, just return a simple white image
      // In a full implementation, you would render text, prices, etc.
      const buffer = await canvas.png().toBuffer();

      logger.info('Label image generated', { labelId: label.id, templateId });
      return buffer;
    } catch (error) {
      logger.error('Failed to generate label image', { error, labelId: label.id });
      throw error;
    }
  }

  /**
   * Combine multiple label parts into one label
   */
  async combineLabelParts(parts: ExtractedLabelParts, layout: 'vertical' | 'horizontal' = 'vertical'): Promise<Buffer> {
    const images = [parts.priceTableImage, parts.productNumberImage].filter(
      (img): img is Buffer => img !== undefined
    );

    if (images.length === 0) {
      throw new Error('No label parts to combine');
    }

    if (images.length === 1) {
      return images[0];
    }

    try {
      // Get metadata for all images
      const metadataList = await Promise.all(images.map((img) => sharp(img).metadata()));

      if (layout === 'vertical') {
        // Stack vertically
        const maxWidth = Math.max(...metadataList.map((m) => m.width || 0));
        const totalHeight = metadataList.reduce((sum, m) => sum + (m.height || 0), 0);

        const compositeImages = [];
        let currentY = 0;

        for (let i = 0; i < images.length; i++) {
          const meta = metadataList[i];
          compositeImages.push({
            input: images[i],
            top: currentY,
            left: 0,
          });
          currentY += meta.height || 0;
        }

        return await sharp({
          create: {
            width: maxWidth,
            height: totalHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .composite(compositeImages)
          .png()
          .toBuffer();
      } else {
        // Stack horizontally
        const totalWidth = metadataList.reduce((sum, m) => sum + (m.width || 0), 0);
        const maxHeight = Math.max(...metadataList.map((m) => m.height || 0));

        const compositeImages = [];
        let currentX = 0;

        for (let i = 0; i < images.length; i++) {
          const meta = metadataList[i];
          compositeImages.push({
            input: images[i],
            top: 0,
            left: currentX,
          });
          currentX += meta.width || 0;
        }

        return await sharp({
          create: {
            width: totalWidth,
            height: maxHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .composite(compositeImages)
          .png()
          .toBuffer();
      }
    } catch (error) {
      logger.error('Failed to combine label parts', { error });
      throw error;
    }
  }

  /**
   * Save label to storage
   */
  private async saveLabel(label: PriceLabel, parts?: ExtractedLabelParts): Promise<void> {
    const labelDir = path.join(this.outputDir, label.id);
    await fs.ensureDir(labelDir);

    // Save metadata
    const metadata = {
      id: label.id,
      articleNumber: label.articleNumber,
      productName: label.productName,
      description: label.description,
      priceInfo: label.priceInfo,
      templateType: label.templateType,
      createdAt: label.createdAt,
      tags: label.tags,
    };

    await fs.writeJson(path.join(labelDir, 'metadata.json'), metadata, { spaces: 2 });

    // Save main image if available
    if (label.imageData) {
      await fs.writeFile(path.join(labelDir, 'label.png'), label.imageData);

      // Generate thumbnail
      const thumbnail = await sharp(label.imageData).resize(200, 200, { fit: 'inside' }).png().toBuffer();

      await fs.writeFile(path.join(labelDir, 'thumbnail.png'), thumbnail);
    }

    // Save individual parts if provided
    if (parts) {
      if (parts.priceTableImage) {
        await fs.writeFile(path.join(labelDir, 'price-table.png'), parts.priceTableImage);
      }
      if (parts.productNumberImage) {
        await fs.writeFile(path.join(labelDir, 'product-number.png'), parts.productNumberImage);
      }
    }

    logger.info('Label saved to storage', { labelId: label.id, labelDir });
  }

  /**
   * Load default templates
   */
  private async loadDefaultTemplates(): Promise<void> {
    // Minimal template - just price and article number
    this.templates.set('minimal', {
      id: 'minimal',
      name: 'Minimal',
      description: 'Nur Preis und Artikelnummer',
      layout: { width: 50, height: 30 },
      fields: [
        { type: 'text', key: 'articleNumber', x: 5, y: 5, fontSize: 10 },
        { type: 'price', key: 'price', x: 5, y: 15, fontSize: 20 },
      ],
      styles: { background: '#ffffff', border: '1px solid #000000' },
      isDefault: true,
      createdAt: new Date(),
    });

    // Standard template
    this.templates.set('standard', {
      id: 'standard',
      name: 'Standard',
      description: 'Preis, Artikelnummer und Produktname',
      layout: { width: 70, height: 50 },
      fields: [
        { type: 'text', key: 'articleNumber', x: 5, y: 5, fontSize: 10 },
        { type: 'text', key: 'productName', x: 5, y: 15, fontSize: 12 },
        { type: 'price', key: 'price', x: 5, y: 30, fontSize: 24 },
      ],
      styles: { background: '#ffffff', border: '1px solid #000000' },
      isDefault: true,
      createdAt: new Date(),
    });

    // Extended template
    this.templates.set('extended', {
      id: 'extended',
      name: 'Erweitert',
      description: 'Alle Informationen inkl. Beschreibung',
      layout: { width: 90, height: 70 },
      fields: [
        { type: 'text', key: 'articleNumber', x: 5, y: 5, fontSize: 10 },
        { type: 'text', key: 'productName', x: 5, y: 15, fontSize: 12 },
        { type: 'description', key: 'description', x: 5, y: 27, fontSize: 9 },
        { type: 'price', key: 'price', x: 5, y: 50, fontSize: 24 },
      ],
      styles: { background: '#ffffff', border: '1px solid #000000' },
      isDefault: true,
      createdAt: new Date(),
    });

    logger.info('Default templates loaded', { count: this.templates.size });
  }

  /**
   * Get default template for a template type
   */
  private getDefaultTemplate(type: LabelTemplateType): LabelTemplate | undefined {
    return this.templates.get(type);
  }

  /**
   * Get all templates
   */
  getTemplates(): LabelTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add custom template
   */
  async addTemplate(template: LabelTemplate): Promise<void> {
    this.templates.set(template.id, template);
    logger.info('Template added', { templateId: template.id });
  }
}

// Singleton instance
let generatorInstance: LabelGeneratorService | null = null;

export function getLabelGeneratorService(outputDir?: string): LabelGeneratorService {
  if (!generatorInstance) {
    generatorInstance = new LabelGeneratorService(outputDir);
  }
  return generatorInstance;
}

export function resetLabelGeneratorService(): void {
  generatorInstance = null;
}
