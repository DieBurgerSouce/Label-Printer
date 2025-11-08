import { Page } from 'puppeteer';
import {
  HtmlExtractedData,
  HtmlValidationResult,
  TieredPrice,
  FieldConfidenceScores
} from '../types/extraction-types';

/**
 * HTML Extraction Service
 * Extracts product data directly from DOM structure (primary data source)
 * Provides 100% confidence compared to OCR
 */
export class HtmlExtractionService {

  /**
   * Extract all product data from HTML DOM
   * WICHTIG: Alle Funktionen müssen im Browser-Context sein (innerhalb page.evaluate())
   */
  async extractProductData(page: Page): Promise<HtmlExtractedData> {
    console.log('[HtmlExtractionService] Starting HTML extraction...');

    try {
      // ALLES läuft im Browser-Context - kein Zugriff auf Node.js oder 'this'!
      const extractedData = await page.evaluate(() => {
      // ===== HELPER FUNCTIONS (Browser-Context) =====

      /**
       * Clean and extract text from element
       */
      function cleanText(text: string | null | undefined): string {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
      }

      /**
       * Extract number from text (removes prefixes like "Produktnummer: ")
       */
      function extractNumber(text: string): string {
        const match = text.match(/\d+/);
        return match ? match[0] : text;
      }

      /**
       * Parse price string to number
       */
      function parsePrice(priceText: string): number | null {
        // Match patterns like "45,41 €", "EUR 45.41", "45.99"
        const match = priceText.match(/([\d.,]+)/);
        if (!match) return null;

        // Normalize: replace comma with period
        const normalized = match[1].replace(',', '.');
        const price = parseFloat(normalized);

        return isNaN(price) ? null : price;
      }

      /**
       * Extract tiered prices from table
       */
      function extractTieredPricesFromTable(): {
        tieredPrices: Array<{ quantity: number; price: string }> | null;
        tieredPricesText: string;
      } {
        const result: {
          tieredPrices: Array<{ quantity: number; price: string }> | null;
          tieredPricesText: string;
        } = {
          tieredPrices: null,
          tieredPricesText: ''
        };

        // Try to find price table with multiple selectors
        const tableSelectors = [
          '.product-detail-price-table',
          'table.price-table',
          'table[class*="price"]',
          '.price-table',
          '.staffelpreise'
        ];

        let priceTable: Element | null = null;
        for (const selector of tableSelectors) {
          priceTable = document.querySelector(selector);
          if (priceTable) break;
        }

        if (!priceTable) return result;

        const tieredPrices: Array<{ quantity: number; price: string }> = [];
        const rows = priceTable.querySelectorAll('tr');

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const quantityText = cells[0].textContent?.trim() || '';
            const priceText = cells[1].textContent?.trim() || '';

            // Extract quantity (look for numbers, handle "ab X" patterns)
            const quantityMatch = quantityText.match(/(\d+)/);

            // Extract price (look for decimal number)
            const priceMatch = priceText.match(/([\d,]+(?:[.,]\d{2})?)/);

            if (quantityMatch && priceMatch) {
              const quantity = parseInt(quantityMatch[1], 10);
              const price = priceMatch[1].replace(',', '.');

              if (!isNaN(quantity) && quantity > 0) {
                tieredPrices.push({ quantity, price });
              }
            }
          }
        });

        if (tieredPrices.length > 0) {
          // Sort by quantity ascending
          tieredPrices.sort((a, b) => a.quantity - b.quantity);

          result.tieredPrices = tieredPrices;
          result.tieredPricesText = tieredPrices
            .map((t) => `ab ${t.quantity} Stück: ${t.price} EUR`)
            .join('\n');
        }

        return result;
      }

      // ===== MAIN EXTRACTION LOGIC =====

      // Build data object (Browser-Context - NO IMPORTS!)
      // Note: Only data fields here, metadata added in Node.js context
      const confidence = {
        productName: 0,
        description: 0,
        articleNumber: 0,
        price: 0,
        tieredPrices: 0,
      };

      const data: {
        confidence: typeof confidence;
        productName?: string;
        description?: string;
        articleNumber?: string;
        price?: number;
        tieredPrices?: Array<{ quantity: number; price: string }>;
        tieredPricesText?: string;
        imageUrl?: string;
      } = {
        confidence,
      };

      // 1. Extract Product Name
      try {
        const productNameSelectors = [
          'h1.product-detail-name',
          'h1[itemprop="name"]',
          '.product-name h1',
          'h1.product-title',
          '.product-detail-name'
        ];

        for (const selector of productNameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.productName = cleanText(element.textContent);
            data.confidence.productName = 1.0;
            break;
          }
        }
      } catch (error) {
        console.error('Error extracting product name:', error);
      }

      // 2. Extract Description
      try {
        const descriptionSelectors = [
          '.product-detail-description',
          '.product-detail-description-text',
          '[itemprop="description"]',
          '.product-description',
          '.description'
        ];

        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            // Get text content, preserving some structure but removing excessive whitespace
            let descText = element.textContent || '';
            descText = cleanText(descText);

            if (descText && descText.length > 10) {
              data.description = descText;
              data.confidence.description = 1.0;
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error extracting description:', error);
      }

      // 3. Extract Article Number
      try {
        const articleNumberSelectors = [
          '.product-detail-ordernumber-container',
          '[itemprop="sku"]',
          '.product-sku',
          '.sku',
          '.product-detail-ordernumber',
          '.article-number'
        ];

        for (const selector of articleNumberSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const articleText = cleanText(element.textContent);
            // Extract just the number (remove "Produktnummer:" prefix)
            data.articleNumber = extractNumber(articleText);
            data.confidence.articleNumber = data.articleNumber ? 1.0 : 0;
            break;
          }
        }
      } catch (error) {
        console.error('Error extracting article number:', error);
      }

      // 4. Extract Image URL
      try {
        const imageSelectors = [
          '.product-detail-media img',
          '.gallery-slider-item img',
          '[itemprop="image"]',
          '.product-image img',
          'img.product-image'
        ];

        for (const selector of imageSelectors) {
          const element = document.querySelector(selector) as HTMLImageElement;
          if (element && element.src) {
            data.imageUrl = element.src;
            break;
          }
        }
      } catch (error) {
        console.error('Error extracting image URL:', error);
      }

      // 5. Extract Prices (tiered or single)
      try {
        // Try tiered prices first
        const tieredResult = extractTieredPricesFromTable();

        if (tieredResult.tieredPrices && tieredResult.tieredPrices.length > 0) {
          data.tieredPrices = tieredResult.tieredPrices;
          data.tieredPricesText = tieredResult.tieredPricesText;
          data.confidence.tieredPrices = 1.0;
        }

        // Extract single price (or base price if tiered prices exist)
        const priceSelectors = [
          '.product-detail-price',
          '.price-unit',
          '[itemprop="price"]',
          '.product-price',
          '.price'
        ];

        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const priceText = cleanText(element.textContent);
            const priceNum = parsePrice(priceText);

            if (priceNum !== null && priceNum > 0) {
              data.price = priceNum;
              data.confidence.price = 1.0;
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error extracting prices:', error);
      }

        return data;
      });

      // Back in Node.js context - add metadata
      const hasAllFields = !!(
        extractedData.productName &&
        extractedData.articleNumber &&
        (extractedData.price || extractedData.tieredPrices)
      );

      const result: HtmlExtractedData = {
        ...extractedData,
        extractionMethod: 'html',
        extractionTimestamp: new Date(),
        hasAllFields,
      };

      console.log('[HtmlExtractionService] Extraction complete:', {
        hasAllFields,
        fields: {
          productName: !!result.productName,
          description: !!result.description,
          articleNumber: !!result.articleNumber,
          price: !!result.price,
          tieredPrices: !!result.tieredPrices
        },
        confidenceScores: extractedData.confidence,
      });

      return result;

    } catch (error: any) {
      console.error('[HtmlExtractionService] CRITICAL ERROR in extractProductData:', error);

      // Return safe default data structure with error indication
      const errorResult: HtmlExtractedData = {
        confidence: {
          productName: 0,
          description: 0,
          price: 0,
          tieredPrices: 0,
          articleNumber: 0,
        },
        extractionMethod: 'html',
        extractionTimestamp: new Date(),
        hasAllFields: false,
      };

      console.log('[HtmlExtractionService] Returning error result after exception');
      return errorResult;
    }
  }

  /**
   * Validate extracted HTML data quality
   */
  validateExtractedData(data: HtmlExtractedData): HtmlValidationResult {
    try {
      const missingFields: string[] = [];
      const warnings: string[] = [];

      // Safety check
      if (!data || typeof data !== 'object') {
        console.error('[HtmlExtractionService] Invalid data in validateExtractedData:', data);
        return {
          isValid: false,
          missingFields: ['all'],
          warnings: ['Invalid data object'],
        };
      }

      // Check required fields
      if (!data.productName) {
        missingFields.push('productName');
      } else if (data.productName.length < 3) {
        warnings.push('Product name is too short');
      }

      if (!data.articleNumber) {
        missingFields.push('articleNumber');
      }

      if (!data.price && !data.tieredPrices) {
        missingFields.push('price/tieredPrices');
      }

      // Validate price ranges
      if (data.price !== undefined) {
        if (data.price <= 0 || data.price > 100000) {
          warnings.push(`Price out of reasonable range: ${data.price}`);
        }
      }

      // Validate tiered prices (with error handling for forEach)
      try {
        if (data.tieredPrices && Array.isArray(data.tieredPrices) && data.tieredPrices.length > 0) {
          data.tieredPrices.forEach((tier, idx) => {
            if (!tier) {
              warnings.push(`Tiered price ${idx}: missing data`);
              return;
            }
            if (tier.quantity <= 0) {
              warnings.push(`Tiered price ${idx}: invalid quantity ${tier.quantity}`);
            }
            const priceNum = parseFloat(tier.price);
            if (isNaN(priceNum) || priceNum <= 0) {
              warnings.push(`Tiered price ${idx}: invalid price ${tier.price}`);
            }
          });
        }
      } catch (forEachError) {
        console.error('[HtmlExtractionService] Error validating tiered prices:', forEachError);
        warnings.push('Error validating tiered prices');
      }

      return {
        isValid: missingFields.length === 0,
        missingFields,
        warnings,
      };

    } catch (error: any) {
      console.error('[HtmlExtractionService] CRITICAL ERROR in validateExtractedData:', error);
      return {
        isValid: false,
        missingFields: ['validation_error'],
        warnings: [`Validation error: ${error.message || 'Unknown error'}`],
      };
    }
  }

  /**
   * Get overall confidence score (average of all field confidences)
   */
  getOverallConfidence(data: HtmlExtractedData): number {
    try {
      // Safety check
      if (!data || !data.confidence || typeof data.confidence !== 'object') {
        console.error('[HtmlExtractionService] Invalid data in getOverallConfidence:', data);
        return 0;
      }

      const scores = Object.values(data.confidence);

      // Check if scores array is valid
      if (!scores || scores.length === 0) {
        console.warn('[HtmlExtractionService] No confidence scores found');
        return 0;
      }

      const sum = scores.reduce((a, b) => a + b, 0);
      return sum / scores.length;

    } catch (error: any) {
      console.error('[HtmlExtractionService] Error calculating overall confidence:', error);
      return 0; // Return 0 confidence on error
    }
  }
}

export default new HtmlExtractionService();
