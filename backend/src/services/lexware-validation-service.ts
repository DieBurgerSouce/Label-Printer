import { HybridExtractionResult, FieldConfidenceScores } from '../types/extraction-types';
import { Product } from '@prisma/client';
import prisma from '../lib/prisma';

/**
 * Lexware Validation Service
 * Validates and sanitizes data extracted from Lexware screenshots
 * Ensures data quality before database import
 */

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationError {
  field: string;
  message: string;
  fatal: boolean;
}

export interface ValidationReport {
  articleNumber: string;
  isValid: boolean;
  confidenceScore: number;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  requiresManualReview: boolean;
  reviewReasons: string[];
  sanitizedData?: any;
}

export interface PriceTypeResult {
  type: 'normal' | 'tiered' | 'auf_anfrage' | 'unknown';
  confidence: number;
  reason: string;
}

export class LexwareValidationService {
  // Confidence thresholds
  private readonly CONFIDENCE_THRESHOLD_HIGH = 0.85;  // Auto-import safe
  private readonly CONFIDENCE_THRESHOLD_MEDIUM = 0.70; // Needs review
  private readonly CONFIDENCE_THRESHOLD_LOW = 0.50;    // Manual only

  // Price sanity limits
  private readonly MIN_PRICE = 0.01;
  private readonly MAX_PRICE = 100000.00;
  private readonly MAX_TIERED_TIERS = 10;

  /**
   * Validates a single product extraction result
   */
  validateProduct(data: HybridExtractionResult): ValidationReport {
    const warnings: ValidationWarning[] = [];
    const errors: ValidationError[] = [];
    const reviewReasons: string[] = [];

    console.log(`🔍 Validating article ${data.articleNumber}...`);

    // 1. Required field validation
    if (!data.data.articleNumber) {
      errors.push({
        field: 'articleNumber',
        message: 'Article number is missing',
        fatal: true
      });
    }

    if (!data.data.productName || data.data.productName.trim().length < 3) {
      errors.push({
        field: 'productName',
        message: 'Product name is missing or too short',
        fatal: true
      });
    }

    // 2. Article number validation
    if (data.data.articleNumber) {
      // Check format (should contain digits)
      if (!/\d/.test(data.data.articleNumber)) {
        warnings.push({
          field: 'articleNumber',
          message: 'Article number contains no digits',
          severity: 'high'
        });
        reviewReasons.push('Unusual article number format');
      }

      // Check length
      if (data.data.articleNumber.length < 3 || data.data.articleNumber.length > 20) {
        warnings.push({
          field: 'articleNumber',
          message: `Article number length unusual: ${data.data.articleNumber.length} characters`,
          severity: 'medium'
        });
      }
    }

    // 3. Product name validation
    if (data.data.productName) {
      // Check for OCR artifacts
      if (/[^\w\s\-äöüÄÖÜß.,()\/&+]/.test(data.data.productName)) {
        warnings.push({
          field: 'productName',
          message: 'Product name contains unusual characters',
          severity: 'low'
        });
      }

      // Check length
      if (data.data.productName.length > 200) {
        warnings.push({
          field: 'productName',
          message: 'Product name unusually long',
          severity: 'medium'
        });
      }
    }

    // 4. Description validation
    if (data.data.description) {
      // Check for truncation
      if (data.data.description.endsWith('...')) {
        warnings.push({
          field: 'description',
          message: 'Description appears truncated',
          severity: 'low'
        });
      }

      // Check for excessive length
      if (data.data.description.length > 1000) {
        warnings.push({
          field: 'description',
          message: 'Description very long - may need truncation',
          severity: 'low'
        });
      }
    }

    // 5. Price validation
    if (data.data.priceType === 'normal' && data.data.price !== null && data.data.price !== undefined) {
      // Convert to number if string
      const price = typeof data.data.price === 'string'
        ? parseFloat(data.data.price)
        : data.data.price;

      if (!isNaN(price) && price < this.MIN_PRICE) {
        errors.push({
          field: 'price',
          message: `Price too low: ${price} €`,
          fatal: false
        });
        reviewReasons.push('Price below minimum threshold');
      }

      if (!isNaN(price) && price > this.MAX_PRICE) {
        errors.push({
          field: 'price',
          message: `Price too high: ${price} €`,
          fatal: false
        });
        reviewReasons.push('Price above maximum threshold');
      }

      // Check for common OCR errors (e.g., 0 instead of O)
      if (price === 0) {
        warnings.push({
          field: 'price',
          message: 'Price is exactly 0 - possible OCR error',
          severity: 'high'
        });
        reviewReasons.push('Zero price detected');
      }
    }

    // 6. Tiered price validation
    if (data.data.priceType === 'tiered' && data.data.tieredPrices) {
      const tiers = data.data.tieredPrices;

      if (tiers.length === 0) {
        errors.push({
          field: 'tieredPrices',
          message: 'Tiered pricing indicated but no tiers found',
          fatal: false
        });
      }

      if (tiers.length > this.MAX_TIERED_TIERS) {
        warnings.push({
          field: 'tieredPrices',
          message: `Too many price tiers: ${tiers.length}`,
          severity: 'medium'
        });
        reviewReasons.push('Excessive number of price tiers');
      }

      // Validate individual tiers
      let previousQuantity = 0;
      let previousPrice = Infinity;

      for (const tier of tiers) {
        const price = parseFloat(tier.price);
        const quantity = tier.quantity;

        // Check price range
        if (price < this.MIN_PRICE || price > this.MAX_PRICE) {
          warnings.push({
            field: 'tieredPrices',
            message: `Tier price out of range: ${quantity} units = ${price} €`,
            severity: 'high'
          });
          reviewReasons.push('Price tier out of expected range');
        }

        // Check quantity progression
        if (quantity <= previousQuantity) {
          errors.push({
            field: 'tieredPrices',
            message: `Tier quantities not in ascending order: ${previousQuantity} -> ${quantity}`,
            fatal: false
          });
          reviewReasons.push('Tier quantity order issue');
        }

        // Check price progression (should decrease with quantity)
        if (price > previousPrice) {
          warnings.push({
            field: 'tieredPrices',
            message: `Price increases with quantity: ${previousQuantity} units = ${previousPrice} €, ${quantity} units = ${price} €`,
            severity: 'medium'
          });
        }

        previousQuantity = quantity;
        previousPrice = price;
      }
    }

    // 7. Price type validation
    if (!data.data.priceType || data.data.priceType === 'unknown') {
      warnings.push({
        field: 'priceType',
        message: 'Unable to determine price type',
        severity: 'high'
      });
      reviewReasons.push('Unknown price type');
    }

    // 8. Confidence score validation
    const overallConfidence = this.calculateOverallConfidence(data.confidence);

    if (overallConfidence < this.CONFIDENCE_THRESHOLD_LOW) {
      errors.push({
        field: 'confidence',
        message: `OCR confidence too low: ${Math.round(overallConfidence * 100)}%`,
        fatal: false
      });
      reviewReasons.push('Very low OCR confidence');
    } else if (overallConfidence < this.CONFIDENCE_THRESHOLD_MEDIUM) {
      warnings.push({
        field: 'confidence',
        message: `OCR confidence below optimal: ${Math.round(overallConfidence * 100)}%`,
        severity: 'medium'
      });
      reviewReasons.push('Low OCR confidence');
    }

    // 9. Check for "Auf Anfrage" consistency
    if (data.data.priceType === 'auf_anfrage' && data.data.price !== null && data.data.price !== undefined) {
      warnings.push({
        field: 'price',
        message: 'Price type is "auf_anfrage" but price value exists',
        severity: 'high'
      });
      data.data.price = null; // Sanitize
    }

    // Determine if manual review is required
    const requiresManualReview =
      errors.filter(e => !e.fatal).length > 0 ||
      warnings.filter(w => w.severity === 'high').length > 0 ||
      overallConfidence < this.CONFIDENCE_THRESHOLD_MEDIUM ||
      reviewReasons.length > 0;

    // Check validity
    const isValid = errors.filter(e => e.fatal).length === 0;

    // Create sanitized data
    const sanitizedData = this.sanitizeProductData(data.data);

    return {
      articleNumber: data.articleNumber,
      isValid,
      confidenceScore: overallConfidence,
      warnings,
      errors,
      requiresManualReview,
      reviewReasons: [...new Set(reviewReasons)], // Remove duplicates
      sanitizedData
    };
  }

  /**
   * Detects price type from screen2 OCR text
   */
  detectPriceType(ocrText: string): PriceTypeResult {
    const textLower = ocrText.toLowerCase();

    // Check for "Auf Anfrage"
    if (
      textLower.includes('auf anfrage') ||
      textLower.includes('auf-anfrage') ||
      textLower.includes('preis auf anfrage')
    ) {
      return {
        type: 'auf_anfrage',
        confidence: 0.95,
        reason: 'Found "auf anfrage" text'
      };
    }

    // Check for tiered pricing indicators
    if (
      textLower.includes('staffelpreis') ||
      textLower.includes('ab ') ||
      textLower.includes('stück')
    ) {
      // Look for actual price tiers
      const tierPattern = /ab\s*\d+\s*(?:stück|stk|pc)?[:\s]*\d+[.,]\d{2}/gi;
      const matches = ocrText.match(tierPattern);

      if (matches && matches.length > 0) {
        return {
          type: 'tiered',
          confidence: 0.90,
          reason: `Found ${matches.length} price tiers`
        };
      }
    }

    // Check for single price
    const pricePattern = /\d+[.,]\d{2}\s*(?:€|eur)/i;
    const priceMatch = ocrText.match(pricePattern);

    if (priceMatch) {
      return {
        type: 'normal',
        confidence: 0.85,
        reason: 'Found single price'
      };
    }

    // Unable to determine
    return {
      type: 'unknown',
      confidence: 0.0,
      reason: 'No price pattern detected'
    };
  }

  /**
   * Sanitizes tiered prices for database storage
   */
  sanitizePrices(tieredPrices: any[]): any[] {
    if (!Array.isArray(tieredPrices)) {
      return [];
    }

    return tieredPrices
      .filter(tier => tier && tier.quantity && tier.price)
      .map(tier => ({
        quantity: parseInt(tier.quantity.toString()),
        price: parseFloat(tier.price.toString().replace(',', '.'))
          .toFixed(2)
      }))
      .filter(tier => !isNaN(tier.quantity) && !isNaN(parseFloat(tier.price)))
      .sort((a, b) => a.quantity - b.quantity);
  }

  /**
   * Checks if an article number already exists in the database
   */
  async checkForDuplicates(articleNumber: string): Promise<boolean> {
    try {
      const existing = await prisma.product.findUnique({
        where: { articleNumber },
        select: { id: true }
      });

      return existing !== null;
    } catch (error) {
      console.error(`Error checking for duplicate: ${error}`);
      return false;
    }
  }

  /**
   * Batch check for duplicates
   */
  async checkForDuplicatesBatch(articleNumbers: string[]): Promise<Map<string, boolean>> {
    try {
      const existing = await prisma.product.findMany({
        where: {
          articleNumber: { in: articleNumbers }
        },
        select: { articleNumber: true }
      });

      const existingSet = new Set(existing.map(p => p.articleNumber));
      const result = new Map<string, boolean>();

      for (const articleNumber of articleNumbers) {
        result.set(articleNumber, existingSet.has(articleNumber));
      }

      return result;
    } catch (error) {
      console.error(`Error batch checking for duplicates: ${error}`);
      // Return all as non-duplicates on error
      const result = new Map<string, boolean>();
      articleNumbers.forEach(an => result.set(an, false));
      return result;
    }
  }

  /**
   * Calculates overall confidence score
   */
  private calculateOverallConfidence(confidence: FieldConfidenceScores | Record<string, number>): number {
    const weights = {
      articleNumber: 0.30,
      productName: 0.25,
      price: 0.20,
      description: 0.15,
      tieredPrices: 0.10
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [field, weight] of Object.entries(weights)) {
      const fieldConfidence = (confidence as any)[field] || 0;
      if (fieldConfidence > 0) {
        weightedSum += fieldConfidence * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Sanitizes product data for database storage
   */
  private sanitizeProductData(data: any): any {
    const sanitized: any = { ...data };

    // Trim all string fields
    if (sanitized.articleNumber) {
      sanitized.articleNumber = sanitized.articleNumber.trim();
    }

    if (sanitized.productName) {
      sanitized.productName = sanitized.productName
        .trim()
        .replace(/\s+/g, ' ')  // Multiple spaces to single
        .substring(0, 255);     // Max length
    }

    if (sanitized.description) {
      sanitized.description = sanitized.description
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 2000);    // Max length
    }

    // Ensure price is null for non-normal types
    if (sanitized.priceType !== 'normal') {
      sanitized.price = null;
    }

    // Sanitize tiered prices
    if (sanitized.tieredPrices) {
      sanitized.tieredPrices = this.sanitizePrices(sanitized.tieredPrices);
    }

    // Set defaults for missing fields
    sanitized.imageUrl = sanitized.imageUrl || null;
    sanitized.thumbnailUrl = sanitized.thumbnailUrl || null;
    sanitized.ean = sanitized.ean || null;
    sanitized.category = sanitized.category || null;
    sanitized.sourceUrl = sanitized.sourceUrl || 'lexware-import';
    sanitized.verified = false;
    sanitized.published = false;

    return sanitized;
  }

  /**
   * Generates a validation summary for multiple products
   */
  generateValidationSummary(reports: ValidationReport[]): {
    total: number;
    valid: number;
    invalid: number;
    needsReview: number;
    byConfidence: {
      high: number;
      medium: number;
      low: number;
    };
    commonIssues: Map<string, number>;
  } {
    const summary = {
      total: reports.length,
      valid: reports.filter(r => r.isValid).length,
      invalid: reports.filter(r => !r.isValid).length,
      needsReview: reports.filter(r => r.requiresManualReview).length,
      byConfidence: {
        high: reports.filter(r => r.confidenceScore >= this.CONFIDENCE_THRESHOLD_HIGH).length,
        medium: reports.filter(r =>
          r.confidenceScore >= this.CONFIDENCE_THRESHOLD_MEDIUM &&
          r.confidenceScore < this.CONFIDENCE_THRESHOLD_HIGH
        ).length,
        low: reports.filter(r => r.confidenceScore < this.CONFIDENCE_THRESHOLD_MEDIUM).length
      },
      commonIssues: new Map<string, number>()
    };

    // Count common issues
    for (const report of reports) {
      for (const reason of report.reviewReasons) {
        const count = summary.commonIssues.get(reason) || 0;
        summary.commonIssues.set(reason, count + 1);
      }
    }

    return summary;
  }
}

// Export singleton instance
export default new LexwareValidationService();