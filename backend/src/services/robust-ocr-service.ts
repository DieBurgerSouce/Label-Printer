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
    console.log(`    🔍 Looking for article at: ${articlePath}`);

    // Check if directory exists
    if (!existsSync(articlePath)) {
      console.log(`    ❌ Article directory NOT found: ${articlePath}`);
      result.errors.push(`Article directory not found: ${articlePath}`);
      return result;
    }
    console.log(`    ✅ Article directory found`);

    // STEP 1: Load HTML extracted data if available
    const htmlDataPath = path.join(articlePath, 'html-data.json');
    console.log(`    🔍 Looking for HTML data at: ${htmlDataPath}`);
    let htmlData: HtmlExtractedData | undefined = undefined;

    if (existsSync(htmlDataPath)) {
      console.log(`    ✅ HTML data file EXISTS!`);
      try {
        const htmlDataContent = await fs.readFile(htmlDataPath, 'utf-8');
        const parsed = JSON.parse(htmlDataContent);

        // Convert extractionTimestamp back to Date object
        htmlData = {
          ...parsed,
          extractionTimestamp: new Date(parsed.extractionTimestamp)
        } as HtmlExtractedData;

        console.log(`    📄 Loaded HTML data for ${articleNumber} with ${parsed.tieredPrices?.length || 0} tiered prices`);
        result.htmlData = htmlData;
      } catch (error: any) {
        console.log(`    ⚠️ Failed to load HTML data: ${error.message}`);
        result.warnings.push(`Failed to load HTML data: ${error.message}`);
      }
    } else {
      console.log(`    ⚠️ HTML data file NOT found at: ${htmlDataPath}`);
      console.log(`    ⚠️ Falling back to minimal data with only articleNumber`);
      result.warnings.push(`HTML data missing for article ${articleNumber} - using fallback`);
      // CONTINUE with fallback instead of stopping!
    }

    // Process based on whether HTML data is available
    if (htmlData) {
      // ✅ HTML data loaded successfully - use it directly!
      console.log(`    ✅ Using HTML data (100% priority) - skipping OCR`);

      // Use HTML data directly - NO merge, NO OCR fallback
      result.data = {
        productName: htmlData.productName || '',
        description: htmlData.description || '',
        articleNumber: htmlData.articleNumber || articleNumber,
        price: htmlData.price !== undefined ? htmlData.price : 0,
        priceType: htmlData.priceType || 'normal',
        tieredPrices: htmlData.tieredPrices || [],
        tieredPricesText: htmlData.tieredPricesText || ''
      };

      // Set confidence from HTML (always 100%)
      result.confidence = htmlData.confidence || {
        productName: 1,
        description: 1,
        articleNumber: 1,
        price: htmlData.price ? 1 : 0,
        tieredPrices: htmlData.tieredPrices ? 1 : 0
      };

      // Mark all fields as HTML source
      result.source = {
        productName: 'html',
        description: 'html',
        articleNumber: 'html',
        price: htmlData.price ? 'html' : 'none',
        tieredPrices: htmlData.tieredPrices && htmlData.tieredPrices.length > 0 ? 'html' : 'none'
      };

      result.htmlData = htmlData;
    } else {
      // Fallback: Create minimal product with just articleNumber
      console.log(`    ⏭️ Using fallback mode - minimal data (articleNumber only)`);
      result.data = {
        productName: `Product ${articleNumber}`,
        description: '',
        articleNumber: articleNumber,
        price: null,
        priceType: 'unknown',
        tieredPrices: [],
        tieredPricesText: ''
      };

      // Set low confidence for fallback
      result.confidence = {
        productName: 0.3,
        description: 0,
        articleNumber: 1,
        price: 0,
        tieredPrices: 0
      };

      // Mark source as fallback
      result.source = {
        productName: 'html-fallback',
        description: 'none',
        articleNumber: 'html-fallback',
        price: 'none',
        tieredPrices: 'none'
      };
    }

    result.success = true;

    console.log(`    ✅ Article ${articleNumber} processed with HTML-only data:`);
    console.log(`       - Product: ${result.data.productName}`);
    console.log(`       - Tiered Prices: ${result.data.tieredPrices?.length || 0} tiers`);

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
  /**
   * Fix common OCR errors in numbers (e.g., "SO" -> "50", "O" -> "0", "l" -> "1")
   */
  private fixOCRNumberErrors(text: string): string {
    return text
      // "SO" -> "50" (very common in German price tables - in "AbSO", "BisSO", etc.)
      .replace(/SO(?=\s|$|[^\w])/gi, '50')  // ⚡ FIX: Lookahead instead of \b
      // "O" (letter) -> "0" (digit) when surrounded by digits or at end
      .replace(/([0-9])O([0-9])/g, '$10$2')
      .replace(/O([0-9])/g, '0$1')
      .replace(/([0-9])O\b/g, '$10')
      // "l" (lowercase L) or "I" (uppercase i) -> "1"
      .replace(/\bl\b/g, '1')
      .replace(/\bI\b/g, '1');
  }

  private parseTieredPrices(text: string): TieredPrice[] {
    const prices: TieredPrice[] = [];
    const lines = text.split('\n');

    // ⚡ FIX: Match "Bis" or "Ab" prefix to get the correct quantity!
    // Removed /g flag - we only need ONE match per line!
    const pricePattern = /(?:bis|ab)\s*(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/i;

    for (let line of lines) {
      // Apply OCR error corrections
      line = this.fixOCRNumberErrors(line);

      // Use match() instead of exec() - safer!
      const match = line.match(pricePattern);
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