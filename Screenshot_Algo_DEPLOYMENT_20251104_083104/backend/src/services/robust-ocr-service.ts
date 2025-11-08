/**
 * Robust OCR Service - Handles 2000+ articles reliably
 * Features: Retry mechanism, batch processing, memory management, better error handling
 */

import { createWorker, Worker, RecognizeResult } from 'tesseract.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import dataValidationService from './data-validation-service';
import {
  HybridExtractionResult,
  HtmlExtractedData,
  OcrExtractedData,
  MergedProductData,
  FieldSourceTracking,
  DataSource,
  TieredPrice
} from '../types/extraction-types';

export interface OCRConfig {
  maxRetries: number;
  batchSize: number;
  workerCount: number;
  timeout: number;
}

const DEFAULT_CONFIG: OCRConfig = {
  maxRetries: 3,
  batchSize: 5,  // Reduced from 10 for Docker stability
  workerCount: 2,  // Reduced from 4 for Docker stability
  timeout: 30000
};

export class RobustOCRService {
  private workers: Map<string, Worker> = new Map();
  private isInitialized = false;
  private config: OCRConfig;
  private processedCount = 0;
  private failedCount = 0;

  constructor(config: Partial<OCRConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize OCR workers
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      console.log('🔍 Initializing Robust OCR Service...');

      for (let i = 0; i < this.config.workerCount; i++) {
        try {
          const worker = await createWorker('deu', 1, {
            logger: (m) => {
              if (m.status === 'recognizing text' && m.progress) {
                const percent = Math.round(m.progress * 100);
                if (percent % 25 === 0) {
                  console.log(`    Worker ${i}: ${percent}%`);
                }
              }
            }
          });

          this.workers.set(`worker-${i}`, worker);
          console.log(`✅ Worker ${i} initialized successfully`);
        } catch (workerError: any) {
          console.error(`❌ Failed to initialize worker ${i}:`, workerError);
          // Continue with remaining workers - service can work with fewer workers
        }
      }

      if (this.workers.size === 0) {
        throw new Error('Failed to initialize any OCR workers');
      }

      this.isInitialized = true;
      console.log(`✅ OCR Service initialized with ${this.workers.size}/${this.config.workerCount} workers`);

    } catch (error: any) {
      console.error('[RobustOCRService] CRITICAL ERROR in initialize():', error);
      this.isInitialized = false;
      throw error; // Re-throw to let caller handle critical initialization failure
    }
  }

  /**
   * Validate and normalize path for Windows
   */
  private normalizePath(inputPath: string): string {
    if (!inputPath) return '';

    // Convert backslashes to forward slashes
    let normalized = inputPath.replace(/\\/g, '/');

    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');

    // Resolve to absolute path
    return path.resolve(normalized);
  }

  /**
   * Validate screenshot file
   */
  private async validateFile(filePath: string): Promise<boolean> {
    try {
      // Normalize path for Windows
      const normalizedPath = this.normalizePath(filePath);

      // Check if file exists
      if (!existsSync(normalizedPath)) {
        console.log(`    ❌ File not found: ${normalizedPath}`);
        return false;
      }

      // Check file stats
      const stats = await fs.stat(normalizedPath);

      if (stats.size === 0) {
        console.log(`    ❌ File is empty: ${normalizedPath}`);
        return false;
      }

      if (stats.size > 50 * 1024 * 1024) { // 50MB limit
        console.log(`    ⚠️ File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${normalizedPath}`);
        return false;
      }

      return true;
    } catch (error: any) {
      console.log(`    ❌ Validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Process single screenshot with retry mechanism
   */
  private async processWithRetry(
    filePath: string,
    worker: Worker,
    retries: number = 0
  ): Promise<RecognizeResult> {
    try {
      // Validate file first
      if (!await this.validateFile(filePath)) {
        throw new Error(`Invalid file: ${filePath}`);
      }

      const normalizedPath = this.normalizePath(filePath);

      // Set timeout for OCR processing
      const timeoutPromise = new Promise<RecognizeResult>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout')), this.config.timeout);
      });

      // Process with timeout
      const result = await Promise.race([
        worker.recognize(normalizedPath),
        timeoutPromise
      ]);

      return result;
    } catch (error: any) {
      console.log(`    ⚠️ OCR attempt ${retries + 1} failed: ${error.message}`);

      if (retries < this.config.maxRetries) {
        console.log(`    🔄 Retrying... (${retries + 1}/${this.config.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
        return this.processWithRetry(filePath, worker, retries + 1);
      }

      throw error;
    }
  }

  /**
   * Process element screenshots for an article using HYBRID approach
   * 1. Try HTML data first (100% accurate)
   * 2. Fall back to OCR if HTML data is missing or low confidence
   * 3. Merge and validate results
   *
   * NOW WITH TYPE-SAFETY AND OPTIMIZED VALIDATION!
   */
  async processArticleElements(
    screenshotDir: string,
    articleNumber: string
  ): Promise<HybridExtractionResult> {
    try {
      const elementMappings = [
        { file: 'article-number.png', field: 'articleNumber' as const, required: true },
        { file: 'title.png', field: 'productName' as const, required: false },
        { file: 'description.png', field: 'description' as const, required: false },
        { file: 'price.png', field: 'price' as const, required: false },
        { file: 'price-table.png', field: 'tieredPrices' as const, required: false }
      ];

      // Initialize result with proper types
      const result: HybridExtractionResult = {
        articleNumber,
        success: false,
        data: {},
        ocrData: {},
        htmlData: undefined,
        confidence: {
          productName: 0,
          description: 0,
          articleNumber: 0,
          price: 0,
          tieredPrices: 0
        },
        source: {
          productName: 'none',
          description: 'none',
          articleNumber: 'none',
          price: 'none',
          tieredPrices: 'none'
        },
        errors: [],
        warnings: []
      };

    const articlePath = path.join(screenshotDir, articleNumber);

    // Check if directory exists
    if (!existsSync(articlePath)) {
      result.errors.push(`Article directory not found: ${articlePath}`);
      return result;
    }

    // STEP 1: Load HTML extracted data if available
    const htmlDataPath = path.join(articlePath, 'html-data.json');
    let htmlData: HtmlExtractedData | undefined = undefined;

    if (existsSync(htmlDataPath)) {
      try {
        const htmlDataContent = await fs.readFile(htmlDataPath, 'utf-8');
        const parsed = JSON.parse(htmlDataContent);

        // Convert extractionTimestamp back to Date object
        htmlData = {
          ...parsed,
          extractionTimestamp: new Date(parsed.extractionTimestamp)
        } as HtmlExtractedData;

        console.log(`    📄 Loaded HTML data for ${articleNumber}`);
        result.htmlData = htmlData;
      } catch (error: any) {
        console.log(`    ⚠️ Failed to load HTML data: ${error.message}`);
        result.warnings.push(`Failed to load HTML data: ${error.message}`);
      }
    }

    // STEP 2: Process with OCR (as fallback or verification)
    const workers = Array.from(this.workers.values());
    const worker = workers[this.processedCount % workers.length];

    const ocrData: OcrExtractedData = {};

    for (const mapping of elementMappings) {
      const filePath = path.join(articlePath, mapping.file);

      try {
        if (!existsSync(filePath)) {
          if (mapping.required && !htmlData) {
            result.errors.push(`Required file missing: ${mapping.file}`);
          }
          continue;
        }

        const ocrResult = await this.processWithRetry(filePath, worker);

        if (ocrResult && ocrResult.data && ocrResult.data.text) {
          let text = ocrResult.data.text.trim();

          // Clean up based on field type (using enhanced cleaning)
          if (mapping.field === 'articleNumber') {
            const match = text.match(/\d+/);
            text = match ? match[0] : text;
          } else if (mapping.field === 'price') {
            text = this.extractPrice(text);
          } else if (mapping.field === 'tieredPrices') {
            ocrData['tieredPricesText'] = text; // Store raw text
            text = JSON.stringify(this.parseTieredPrices(text));
          } else if (mapping.field === 'productName') {
            // Clean product name (remove line breaks, etc.)
            text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          } else if (mapping.field === 'description') {
            // Clean description
            text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          }

          ocrData[mapping.field] = text;
        }
      } catch (error: any) {
        result.errors.push(`OCR ${mapping.file}: ${error.message}`);
      }
    }

    result.ocrData = ocrData;

    // STEP 3: OPTIMIZED HYBRID SELECTION
    // FIX → VALIDATE → MERGE (ensures confidence scores match final data)
    console.log(`    🔀 Merging HTML + OCR data (OPTIMIZED)...`);

    // Build complete data objects from each source
    const htmlProductData: MergedProductData = htmlData ? {
      productName: htmlData.productName,
      description: htmlData.description,
      articleNumber: htmlData.articleNumber,
      price: htmlData.price,
      tieredPrices: htmlData.tieredPrices,
      tieredPricesText: htmlData.tieredPricesText
    } : {};

    // Parse OCR tieredPrices if it's stringified JSON
    let ocrTieredPrices: TieredPrice[] | undefined = undefined;
    if (ocrData.tieredPrices) {
      try {
        ocrTieredPrices = JSON.parse(ocrData.tieredPrices);
      } catch {
        // Not JSON, leave undefined
      }
    }

    const ocrProductData: MergedProductData = {
      productName: ocrData.productName,
      description: ocrData.description,
      articleNumber: ocrData.articleNumber,
      price: ocrData.price,
      tieredPrices: ocrTieredPrices,
      tieredPricesText: ocrData.tieredPricesText
    };

    // ✅ FIX THEN VALIDATE (ensures confidence matches fixed data!)
    // This is critical: confidence scores must reflect the FINAL data state
    const fixedHtmlData = htmlData ? dataValidationService.autoFixData(htmlProductData) : {};
    const fixedOcrData = Object.keys(ocrProductData).length > 0
      ? dataValidationService.autoFixData(ocrProductData)
      : {};

    // ✅ VALIDATE ONCE PER SOURCE (after fixes!)
    const htmlValidation = Object.keys(fixedHtmlData).length > 0
      ? dataValidationService.validateProductData(fixedHtmlData)
      : null;

    const ocrValidation = Object.keys(fixedOcrData).length > 0
      ? dataValidationService.validateProductData(fixedOcrData)
      : null;

    // SMART MERGE: Choose best source per field (using FIXED data)
    const mergedData: MergedProductData = {};
    const sources: FieldSourceTracking = {
      productName: 'none',
      description: 'none',
      articleNumber: 'none',
      price: 'none',
      tieredPrices: 'none'
    };

    // Define fields to merge
    type DataField = keyof typeof sources;
    const fields: DataField[] = ['productName', 'description', 'articleNumber', 'price', 'tieredPrices'];

    for (const field of fields) {
      const htmlValue = fixedHtmlData[field];
      const ocrValue = fixedOcrData[field];

      const htmlConf = htmlValidation?.confidence[field] || 0;
      const ocrConf = ocrValidation?.confidence[field] || 0;

      // Selection logic based on confidence
      if (htmlValue && htmlConf >= 0.8) {
        // Use HTML (high confidence)
        (mergedData as Record<string, unknown>)[field] = htmlValue;
        result.confidence[field] = htmlConf;
        sources[field] = 'html';
      } else if (ocrValue && ocrConf >= 0.6) {
        // Use OCR (acceptable confidence)
        (mergedData as Record<string, unknown>)[field] = ocrValue;
        result.confidence[field] = ocrConf;
        sources[field] = 'ocr';
        result.warnings.push(`Using OCR for ${field} (HTML unavailable or low confidence)`);
      } else if (htmlValue && htmlConf > ocrConf) {
        // HTML has better confidence than OCR
        (mergedData as Record<string, unknown>)[field] = htmlValue;
        result.confidence[field] = htmlConf;
        sources[field] = 'html-fallback';
        if (htmlConf < 0.8) {
          result.warnings.push(`Using HTML for ${field} with low confidence (${(htmlConf * 100).toFixed(0)}%)`);
        }
      } else if (ocrValue) {
        // OCR is best available option
        (mergedData as Record<string, unknown>)[field] = ocrValue;
        result.confidence[field] = ocrConf;
        sources[field] = 'ocr-fallback';
        result.warnings.push(`Using OCR for ${field} with low confidence (${(ocrConf * 100).toFixed(0)}%)`);
      }
      // else: field remains empty
    }

    // Special handling for tieredPricesText
    if (fixedHtmlData.tieredPricesText) {
      mergedData.tieredPricesText = fixedHtmlData.tieredPricesText;
    } else if (fixedOcrData.tieredPricesText) {
      mergedData.tieredPricesText = fixedOcrData.tieredPricesText;
    }

    // ✅ NO NEED for extra autoFix - data is already fixed!
    // Confidence scores now match the merged data perfectly
    result.data = mergedData;
    result.source = sources;

    // ✅ IMPROVED: Success based on critical fields presence
    // Note: "success" means "has minimum required fields", NOT "all fields are perfectly valid"
    // Data quality is indicated by: confidence scores + errors + warnings
    // Article needs: productName + articleNumber + (price OR tieredPrices)
    const hasCriticalFields = !!(
      mergedData.productName &&
      mergedData.articleNumber &&
      (mergedData.price || (mergedData.tieredPrices && mergedData.tieredPrices.length > 0))
    );
    result.success = hasCriticalFields;

    // Add validation errors/warnings to result
    if (htmlValidation) {
      result.warnings.push(...htmlValidation.warnings.map(w => `HTML: ${w}`));
    }
    if (ocrValidation) {
      result.warnings.push(...ocrValidation.warnings.map(w => `OCR: ${w}`));
    }

      // Log results
      console.log(`    📊 Sources: ${JSON.stringify(sources)}`);
      console.log(`    ✅ Confidence: ${Object.entries(result.confidence)
        .map(([field, conf]) => `${field}=${(conf * 100).toFixed(0)}%`)
        .join(', ')}`);

      return result;

    } catch (error: any) {
      console.error(`[RobustOCRService] CRITICAL ERROR processing article ${articleNumber}:`, error);

      // Return error result
      const errorResult: HybridExtractionResult = {
        articleNumber,
        success: false,
        data: {},
        ocrData: {},
        htmlData: undefined,
        confidence: {
          productName: 0,
          description: 0,
          articleNumber: 0,
          price: 0,
          tieredPrices: 0
        },
        source: {
          productName: 'none',
          description: 'none',
          articleNumber: 'none',
          price: 'none',
          tieredPrices: 'none'
        },
        errors: [`Critical processing error: ${error.message || 'Unknown error'}`],
        warnings: []
      };

      return errorResult;
    }
  }

  /**
   * Process batch of articles
   * NOW WITH TYPE-SAFE RESULTS!
   */
  async processBatch(
    screenshotDir: string,
    articleNumbers: string[]
  ): Promise<HybridExtractionResult[]> {
    try {
      const results = [];

      for (let i = 0; i < articleNumbers.length; i += this.config.batchSize) {
        const batch = articleNumbers.slice(i, i + this.config.batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(articleNumbers.length / this.config.batchSize)} (${batch.length} articles)`);

        const batchResults = await Promise.all(
          batch.map(async (articleNumber) => {
            try {
            this.processedCount++;
            console.log(`  📸 [${this.processedCount}/${articleNumbers.length}] Processing ${articleNumber}...`);

            const result = await this.processArticleElements(screenshotDir, articleNumber);

            if (result.success) {
              console.log(`    ✅ Success: ${articleNumber}`);
            } else {
              this.failedCount++;
              console.log(`    ❌ Failed: ${articleNumber}`);
            }

            return result;
          } catch (error: any) {
            this.failedCount++;
            console.log(`    ❌ Error processing ${articleNumber}: ${error.message}`);
            // Return properly typed error result
            return {
              articleNumber,
              success: false,
              data: {},
              ocrData: {},
              htmlData: undefined,
              confidence: {
                productName: 0,
                description: 0,
                articleNumber: 0,
                price: 0,
                tieredPrices: 0
              },
              source: {
                productName: 'none',
                description: 'none',
                articleNumber: 'none',
                price: 'none',
                tieredPrices: 'none'
              },
              errors: [error.message],
              warnings: []
            } as HybridExtractionResult;
          }
        })
      );

      results.push(...batchResults);

        // Memory cleanup every 10 batches
        if ((i / this.config.batchSize) % 10 === 0 && i > 0) {
          console.log('  🧹 Performing memory cleanup...');
          if (global.gc) {
            global.gc();
          }
        }

        // Progress report
        console.log(`  📊 Progress: ${this.processedCount}/${articleNumbers.length} processed, ${this.failedCount} failed`);
      }

      return results;

    } catch (error: any) {
      console.error('[RobustOCRService] CRITICAL ERROR in processBatch():', error);

      // Return empty results array with error indication
      // This allows the pipeline to continue even if batch processing fails
      console.error('Batch processing failed completely - returning empty results');
      return [];
    }
  }

  /**
   * Extract price from text
   */
  private extractPrice(text: string): string {
    const pricePattern = /(\d+[,.]?\d*)\s*€|EUR\s*(\d+[,.]?\d*)/gi;
    const match = pricePattern.exec(text);

    if (match) {
      const price = match[1] || match[2];
      return price.replace(',', '.');
    }

    return text.trim();
  }

  /**
   * Parse tiered prices
   */
  private parseTieredPrices(text: string): TieredPrice[] {
    const prices: TieredPrice[] = [];
    const lines = text.split('\n');

    const pricePattern = /(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/gi;

    for (const line of lines) {
      const match = pricePattern.exec(line);
      if (match) {
        prices.push({
          quantity: parseInt(match[1]),
          price: match[2].replace(',', '.')
        });
      }
    }

    return prices;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      processed: this.processedCount,
      failed: this.failedCount,
      successRate: this.processedCount > 0
        ? ((this.processedCount - this.failedCount) / this.processedCount * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    try {
      console.log('🔍 Shutting down OCR Service...');

      for (const [id, worker] of this.workers) {
        try {
          await worker.terminate();
          this.workers.delete(id);
          console.log(`✅ Worker ${id} terminated`);
        } catch (workerError: any) {
          console.error(`❌ Error terminating worker ${id}:`, workerError);
          // Continue with cleanup even if one worker fails
        }
      }

      this.isInitialized = false;
      this.processedCount = 0;
      this.failedCount = 0;

      console.log('✅ OCR Service shut down');

    } catch (error: any) {
      console.error('[RobustOCRService] CRITICAL ERROR in shutdown():', error);
      // Force cleanup even on error
      this.isInitialized = false;
      this.processedCount = 0;
      this.failedCount = 0;
      throw error; // Re-throw for caller awareness
    }
  }
}

export const robustOCRService = new RobustOCRService();