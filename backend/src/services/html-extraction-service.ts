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
      // @ts-nocheck - Browser context functions don't support type annotations
      const extractedData = await page.evaluate(() => {
      // ===== HELPER FUNCTIONS (Browser-Context) =====

      /**
       * Normalize common character encoding errors (OCR artifacts)
       * Fixes: é→ö, ™→", ©→Ø, etc.
       */
      function normalizeCharacters(text: string): string {
        if (!text) return '';

        const replacements = {
          // Common OCR encoding errors
          'é': 'ö',
          'ä': 'ü',
          '™': '"',
          '©': 'Ø',
          '@': 'Ø',  // Alternative OCR interpretation of Ø
          'Ã¶': 'ö',
          'Ã¼': 'ü',
          'Ã¤': 'ä',
          'ÃŸ': 'ß',
          // Fix common quote errors (using Unicode escapes to avoid TypeScript issues)
          '\u201C': '"',  // Left double quote
          '\u201D': '"',  // Right double quote
          '\u2018': "'",  // Left single quote
          '\u2019': "'"   // Right single quote
        };

        let normalized = text;
        for (const [wrong, correct] of Object.entries(replacements)) {
          normalized = normalized.replace(new RegExp(wrong, 'g'), correct);
        }

        return normalized;
      }

      /**
       * Remove cookie banner and navigation contamination from text
       */
      function removeContamination(text: string): string {
        if (!text) return '';

        // Patterns that indicate cookie/header contamination
        const contaminationPatterns = [
          /©\s*servicer.*?(?=\n|$)/gi,
          /egriff eingeben.*?(?=\n|$)/gi,
          /Goooe.*?(?=\n|$)/gi,
          /cookie.*?akzeptieren/gi,
          /alle cookies/gi,
          /zur suche springen/gi,
          /zum hauptinhalt/gi,
          /zur hauptnavigation/gi,
          /anmelden oder registrieren/gi,
          /ihr konto/gi,
          /zeige alle kategorien/gi
        ];

        let cleaned = text;
        for (const pattern of contaminationPatterns) {
          cleaned = cleaned.replace(pattern, '');
        }

        // Remove multiple consecutive newlines
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        return cleaned.trim();
      }

      /**
       * Clean and extract text from element
       */
      function cleanText(text: string): string {
        if (!text) return '';

        // Apply cleaning pipeline
        let cleaned = text.trim();
        cleaned = removeContamination(cleaned);
        cleaned = normalizeCharacters(cleaned);

        // FIX: Ensure line breaks always create spaces between words
        // Step 1: Replace all newlines/line breaks with a space
        cleaned = cleaned.replace(/[\r\n]+/g, ' ');
        // Step 2: Collapse multiple spaces into one
        cleaned = cleaned.replace(/\s+/g, ' ');

        return cleaned;
      }

      /**
       * Remove "Produktinformationen" prefix and product name from description
       * Cleans up redundant shop-specific prefixes
       */
      function cleanDescription(text: string, productName: string): string {
        if (!text) return '';

        // Remove "Produktinformationen" prefix (with or without quotes)
        // Matches: "Produktinformationen", "Produktinformationen "Name"", etc.
        let cleaned = text.replace(/^Produktinformationen\s*[""']?[^""']*[""']?\s*/i, '');

        // If product name is known, also try to remove it from the start
        if (productName && cleaned.startsWith(productName)) {
          cleaned = cleaned.substring(productName.length).trim();
        }

        return cleaned.trim();
      }

      /**
       * Extract article number from text (removes prefixes like "Produktnummer: ")
       * Supports formats like: "3547-2", "ABC-123", "1234.5", etc.
       */
      function extractNumber(text: string): string {
        // Step 1: Try to split by colon and take the part after it
        // Handles: "Produktnummer: 3547-2" → "3547-2"
        if (text.includes(':')) {
          const parts = text.split(':');
          if (parts.length > 1) {
            text = parts[1].trim();
          }
        }

        // Step 2: Remove common prefixes
        const prefixes = ['Produktnummer', 'Product Number', 'Art.Nr.', 'Art.', 'SKU'];
        for (const prefix of prefixes) {
          if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
            text = text.substring(prefix.length).trim();
            break;
          }
        }

        // Step 3: Extract the article number (must START with digit)
        // Matches: "3547-2", "123ABC", "45.67" but NOT "Produktnummer"
        const match = text.match(/\d+[A-Za-z0-9\-./]*/);
        return match ? match[0] : text.trim();
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
       * Detect "Auf Anfrage" button or text (product without price)
       * Returns true if this is a "price on request" product
       */
      function detectAufAnfrageProduct() {
        // Search patterns for "price on request" in German
        const requestPatterns = [
          'produkt anfragen',
          'preis anfragen',
          'preis auf anfrage',
          'auf anfrage',
          'request product',
          'request price',
          'anfragen',
          'jetzt anfragen',
          'angebot anfordern',
          'kontaktieren sie uns'
        ];

        // Check buttons and links - ONLY in product area, not entire page!
        const buttonSelectors = [
          'button',
          'a.button',
          'a.btn',
          '[role="button"]',
          '.product-detail-price button',
          '.product-action button',
          'a[href*="anfrage"]',
          'a[href*="contact"]'
        ];

        // First check specific selectors
        for (const selector of buttonSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of Array.from(elements)) {
            const text = element.textContent?.toLowerCase().trim() || '';
            const title = element.getAttribute('title')?.toLowerCase() || '';
            const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';

            const allText = `${text} ${title} ${ariaLabel}`;
            if (requestPatterns.some(pattern => allText.includes(pattern))) {
              console.log(`   ✓ Found "Auf Anfrage" button/link: "${text}" (selector: ${selector})`);
              return true;
            }
          }
        }

        // Then check plain <a> tags, but ONLY in product detail area to avoid false positives
        const productAreaSelectors = [
          '.product-detail',
          '.product-info',
          '.product-main',
          'main',
          '[class*="product"]'
        ];

        for (const areaSelector of productAreaSelectors) {
          const productArea = document.querySelector(areaSelector);
          if (productArea) {
            const links = productArea.querySelectorAll('a');
            for (const link of Array.from(links)) {
              const text = link.textContent?.toLowerCase().trim() || '';
              if (requestPatterns.some(pattern => text.includes(pattern))) {
                console.log(`   ✓ Found "Auf Anfrage" link in product area: "${text}"`);
                return true;
              }
            }
            break; // Found product area, no need to check other selectors
          }
        }

        // Check for "Auf Anfrage" text in price fields
        const priceSelectors = [
          '.product-detail-price',
          '.price-unit',
          '[itemprop="price"]',
          '.product-price',
          '.price',
          '.product-availability',
          '.availability'
        ];

        for (const selector of priceSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of Array.from(elements)) {
            const text = element.textContent?.toLowerCase().trim() || '';
            if (requestPatterns.some(pattern => text.includes(pattern))) {
              console.log(`   ✓ Found "Auf Anfrage" in price field: "${text}"`);
              return true;
            }
          }
        }

        return false;
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
            // Normalize whitespace: collapse all whitespace (including newlines) to single spaces
            const quantityText = (cells[0].textContent || '').replace(/\s+/g, ' ').trim();
            const priceText = (cells[1].textContent || '').replace(/\s+/g, ' ').trim();

            // Skip header rows (contain text like "Anzahl", "Stückpreis", "Quantity", etc.)
            const headerKeywords = ['anzahl', 'stückpreis', 'quantity', 'price', 'menge', 'preis'];
            const isHeader = headerKeywords.some(keyword =>
              quantityText.toLowerCase().includes(keyword) ||
              priceText.toLowerCase().includes(keyword)
            );
            if (isHeader) return;

            // Extract quantity (look for numbers, handle "ab X", "bis X" patterns)
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
        price?: number | null;
        priceType?: 'normal' | 'tiered' | 'auf_anfrage' | 'unknown';
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
          if (element) {
            const text = (element as any).innerText || element.textContent;
            if (text) {
              data.productName = cleanText(text);
              data.confidence.productName = 1.0;
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error extracting product name:', error);
      }

      // 2. Extract Description
      try {
        const descriptionSelectors = [
          '.product-detail-description-text',  // FIRST: Only text content (without "Produktinformationen" title)
          '[itemprop="description"]',
          '.product-description',
          '.description',
          '.product-detail-description'        // LAST: Fallback (includes title + text)
        ];

        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            // FIX: Use innerText to preserve <br> tags as newlines!
            // This ensures "Gusseisen<br>2" becomes "Gusseisen 2" (not "Gusseisen2")
            let descText = (element as any).innerText || element.textContent || '';
            descText = cleanText(descText);
            descText = cleanDescription(descText, data.productName || ''); // Remove "Produktinformationen" prefix

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
          if (element) {
            const text = (element as any).innerText || element.textContent;
            if (text) {
              const articleText = cleanText(text);
              // Extract just the number (remove "Produktnummer:" prefix)
              data.articleNumber = extractNumber(articleText);
              data.confidence.articleNumber = data.articleNumber ? 1.0 : 0;
              break;
            }
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

      // 5. Extract Prices (tiered or single or "auf anfrage")
      try {
        // FIRST: Check if this is an "Auf Anfrage" product
        // FIX: Try to find REAL PRICES FIRST, only check "auf anfrage" if nothing found!

        // Step 1: Try tiered prices
        const tieredResult = extractTieredPricesFromTable();

        if (tieredResult.tieredPrices && tieredResult.tieredPrices.length > 0) {
          data.tieredPrices = tieredResult.tieredPrices;
          data.tieredPricesText = tieredResult.tieredPricesText;
          data.confidence.tieredPrices = 1.0;
          data.price = null; // No single price when tiered exists
          data.priceType = 'tiered'; // Mark as tiered pricing
          data.confidence.price = 1.0;
          console.log(`   ✓ Found tiered prices: ${tieredResult.tieredPrices.length} tiers`);
        } else {
          // Step 2: Try single price
          const priceSelectors = [
            '.product-detail-price',
            '.price-unit',
            '[itemprop="price"]',
            '.product-price',
            '.price'
          ];

          let foundPrice = false;
          for (const selector of priceSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              const priceText = cleanText(element.textContent);
              const priceNum = parsePrice(priceText);

              if (priceNum !== null && priceNum > 0) {
                data.price = priceNum;
                data.priceType = 'normal'; // Mark as normal pricing
                data.confidence.price = 1.0;
                foundPrice = true;
                console.log(`   ✓ Found normal price: ${priceNum} EUR`);
                break;
              }
            }
          }

          // Step 3: ONLY check "auf anfrage" if no price found
          if (!foundPrice) {
            const isAufAnfrage = detectAufAnfrageProduct();

            if (isAufAnfrage) {
              data.price = null;
              data.priceType = 'auf_anfrage';
              data.tieredPricesText = 'Preis auf Anfrage'; // Show this text in UI/labels
              data.confidence.price = 1.0;
              console.log('   ✓ Product marked as "Auf Anfrage" (price on request)');
            } else {
              data.price = null;
              data.priceType = 'unknown';
              data.confidence.price = 0;
              console.log('   ⚠️ No price found');
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
      if (data.price !== undefined && data.price !== null) {
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
