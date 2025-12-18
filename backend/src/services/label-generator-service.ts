/**
 * Label Generator Service
 * Handles label creation and management
 */

import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import type { Prisma } from '@prisma/client';
import { PriceLabel, ProductDescription } from '../types/label-types.js';
import { ExcelParserService } from './excel-parser-service.js';
import { ocrService } from './ocr-service.js';
import { prisma } from '../lib/prisma.js';
import logger from '../utils/logger.js';

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
   * Update an existing label in the database
   * @param id - Label ID (Prisma Label model)
   * @param updates - Partial updates to apply
   * @returns Updated PriceLabel or null if not found
   */
  static async updateLabel(
    id: string,
    updates: Partial<Omit<PriceLabel, 'id' | 'createdAt'>>
  ): Promise<PriceLabel | null> {
    try {
      // Fetch the existing label from database
      const existingLabel = await prisma.label.findUnique({
        where: { id },
        include: { template: true },
      });

      if (!existingLabel) {
        logger.warn('Label not found for update', { labelId: id });
        return null;
      }

      // Parse existing data
      const existingData = existingLabel.data as Record<string, unknown>;

      // Merge updates into existing data - ensure Prisma.JsonValue compatibility
      const updatedData: Record<string, unknown> = {
        ...existingData,
        ...(updates.articleNumber && { articleNumber: updates.articleNumber }),
        ...(updates.productName && { productName: updates.productName }),
        ...(updates.description && { description: updates.description }),
        ...(updates.priceInfo && { priceInfo: JSON.parse(JSON.stringify(updates.priceInfo)) }), // Serialize for JSON storage
        ...(updates.tags && { tags: updates.tags }),
        ...(updates.category && { category: updates.category }),
      };

      // Update in database
      const updatedLabel = await prisma.label.update({
        where: { id },
        data: {
          data: updatedData as Prisma.InputJsonValue,
          status: updates.imageData ? 'pending' : existingLabel.status, // Re-render if image changed
        },
      });

      // Convert to PriceLabel format for return
      const priceLabel: PriceLabel = {
        id: updatedLabel.id,
        articleNumber: (updatedData.articleNumber as string) || '',
        productName: (updatedData.productName as string) || '',
        description: updatedData.description as string | undefined,
        priceInfo: (updatedData.priceInfo as PriceLabel['priceInfo']) || { price: 0, currency: '€' },
        templateType: 'standard',
        createdAt: updatedLabel.createdAt,
        updatedAt: updatedLabel.updatedAt,
        tags: (updatedData.tags as string[]) || [],
        category: updatedData.category as string | undefined,
        source: (updatedData.source as PriceLabel['source']) || 'manual',
        imageUrl: updatedLabel.imageUrl || undefined,
      };

      logger.info('Label updated successfully', { labelId: id });
      return priceLabel;
    } catch (error) {
      logger.error('Failed to update label', { labelId: id, error });
      throw error;
    }
  }

  /**
   * Extract label data from screenshot using OCR
   * Uses Tesseract.js for text extraction with image preprocessing
   * @param imageBuffer - Screenshot image buffer (PNG/JPG)
   * @returns Partial PriceLabel with extracted data
   */
  static async extractFromScreenshot(imageBuffer: Buffer): Promise<Partial<PriceLabel>> {
    try {
      logger.info('Extracting label data from screenshot', {
        bufferSize: imageBuffer.length,
      });

      // Save buffer to temporary file for OCR processing
      const tempDir = process.env.TEMP || '/tmp';
      const tempPath = `${tempDir}/screenshot-${uuidv4()}.png`;

      // Preprocess image with Sharp for better OCR accuracy
      await sharp(imageBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Remove alpha
        .normalize() // Auto-adjust levels
        .sharpen() // Enhance text edges
        .toFile(tempPath);

      // Initialize OCR service if not already done
      if (!ocrService['workers'] || ocrService['workers'].size === 0) {
        await ocrService.initialize();
      }

      // Process screenshot with OCR
      const ocrResult = await ocrService.processScreenshot(tempPath, {
        preprocessImage: true,
      });

      // Clean up temp file
      const fs = await import('fs/promises');
      await fs.unlink(tempPath).catch(() => {
        // Ignore cleanup errors
      });

      // Extract structured data from OCR result
      const extractedData = ocrResult.extractedData;
      const confidence = ocrResult.confidence.overall;

      // Parse price from extracted text
      let price = 0;
      if (extractedData.price) {
        const priceStr = String(extractedData.price);
        const priceMatch = priceStr.match(/[\d,]+[.,]?\d*/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(',', '.'));
        }
      }

      // Build PriceLabel from OCR results
      const result: Partial<PriceLabel> = {
        articleNumber: extractedData.articleNumber || `OCR-${Date.now()}`,
        productName: extractedData.productName || 'Extracted Product',
        description: extractedData.description,
        priceInfo: {
          price,
          currency: '€',
          staffelpreise: extractedData.tieredPrices?.map((tp) => ({
            quantity: tp.quantity,
            price: parseFloat(String(tp.price).replace(',', '.')),
          })),
        },
        templateType: 'standard',
        source: 'screenshot',
      };

      logger.info('Screenshot extraction completed', {
        articleNumber: result.articleNumber,
        confidence: Math.round(confidence * 100),
        hasPrice: price > 0,
        hasTieredPrices: (result.priceInfo?.staffelpreise?.length || 0) > 0,
      });

      return result;
    } catch (error) {
      logger.error('Failed to extract label from screenshot', { error });

      // Return fallback with error indication
      return {
        articleNumber: `ERROR-${Date.now()}`,
        productName: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        priceInfo: {
          price: 0,
          currency: '€',
        },
        templateType: 'standard',
        source: 'screenshot',
      };
    }
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
