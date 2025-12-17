/**
 * Label Generator Service
 * Handles label creation and management
 */

import { v4 as uuidv4 } from 'uuid';
import { PriceLabel, ProductDescription } from '../types/label-types.js';
import { ExcelParserService } from './excel-parser-service.js';

export class LabelGeneratorService {
  /**
   * Create a new label
   */
  static async createLabel(data: {
    articleNumber: string;
    productName: string;
    description?: string;
    priceInfo: {
      price: number;
      currency?: string;
      unit?: string;
    };
    templateType?: 'minimal' | 'standard' | 'extended' | 'custom';
    tags?: string[];
    category?: string;
    source?: 'screenshot' | 'manual' | 'import';
  }): Promise<PriceLabel> {
    // Try to enrich with Excel data
    const excelProduct = ExcelParserService.getProduct(data.articleNumber);

    const label: PriceLabel = {
      id: uuidv4(),
      articleNumber: data.articleNumber,
      productName: data.productName,
      description: data.description || excelProduct?.description,
      priceInfo: {
        price: data.priceInfo.price,
        currency: data.priceInfo.currency || '€',
        unit: data.priceInfo.unit,
      },
      templateType: data.templateType || 'standard',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: data.tags || [],
      category: data.category,
      source: data.source || 'manual',
    };

    return label;
  }

  /**
   * Update an existing label
   */
  static async updateLabel(
    _id: string,
    _updates: Partial<Omit<PriceLabel, 'id' | 'createdAt'>>
  ): Promise<PriceLabel | null> {
    // This would typically fetch from storage, update, and save
    // For now, we return a mock updated label
    return null;
  }

  /**
   * Extract label from screenshot (placeholder)
   * In a real implementation, this would use image processing/OCR
   */
  static async extractFromScreenshot(_imageBuffer: Buffer): Promise<Partial<PriceLabel>> {
    // Placeholder: In reality, this would use Sharp + OCR (Tesseract.js)
    // to extract text and detect price regions from the screenshot

    return {
      articleNumber: 'EXTRACTED-001',
      productName: 'Extracted Product',
      priceInfo: {
        price: 0,
        currency: '€',
      },
      templateType: 'standard',
      source: 'screenshot',
    };
  }

  /**
   * Duplicate a label
   */
  static async duplicateLabel(sourceLabel: PriceLabel): Promise<PriceLabel> {
    return {
      ...sourceLabel,
      id: uuidv4(),
      articleNumber: `${sourceLabel.articleNumber}-copy`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Merge labels (combine information from multiple labels)
   */
  static async mergeLabels(labels: PriceLabel[]): Promise<PriceLabel> {
    if (labels.length === 0) {
      throw new Error('No labels to merge');
    }

    const first = labels[0];
    const merged: PriceLabel = {
      id: uuidv4(),
      articleNumber: first.articleNumber,
      productName: first.productName,
      description: labels
        .map((l) => l.description)
        .filter(Boolean)
        .join(' | '),
      priceInfo: first.priceInfo,
      templateType: first.templateType,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [...new Set(labels.flatMap((l) => l.tags || []))],
      category: first.category,
      source: 'manual',
    };

    return merged;
  }

  /**
   * Generate labels from Excel data
   */
  static async generateFromExcel(
    products: ProductDescription[],
    defaultPrice: number = 0
  ): Promise<PriceLabel[]> {
    const labels: PriceLabel[] = [];

    for (const product of products) {
      const label: PriceLabel = {
        id: uuidv4(),
        articleNumber: product.articleNumber,
        productName: product.description,
        description: product.additionalInfo,
        priceInfo: {
          price: defaultPrice,
          currency: '€',
        },
        templateType: 'standard',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        source: 'import',
      };

      labels.push(label);
    }

    return labels;
  }
}
