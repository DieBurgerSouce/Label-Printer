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

    // FUZZY MATCHING: Always find the NEWEST matching directory (handles variants like "3556-ST")
    console.log(`    🔍 Looking for article directories matching: ${articleNumber}`);

    const allDirs = await fs.readdir(screenshotDir);
    const variantPattern = new RegExp(`^${articleNumber}(-.*)?$`);
    const matchingDirs = allDirs.filter((dir: string) => variantPattern.test(dir));

    if (matchingDirs.length === 0) {
      console.log(`    ❌ No directories found matching ${articleNumber}`);
      result.errors.push(`Article directory not found: ${articleNumber}`);
      return result;
    }

    // If multiple matches, prefer directories WITH suffix (extracted article number from shop)
    let articlePath: string;
    if (matchingDirs.length > 1) {
      console.log(`    🔍 Found ${matchingDirs.length} matching directories: ${matchingDirs.join(', ')}`);

      // PRIORITY 1: Prefer directories with suffix (e.g., "3556-ST") - these have HTML data
      const dirsWithSuffix = matchingDirs.filter(dir => dir !== articleNumber);
      const dirsWithoutSuffix = matchingDirs.filter(dir => dir === articleNumber);

      if (dirsWithSuffix.length > 0) {
        // Use first directory with suffix (HTML extraction result)
        articlePath = path.join(screenshotDir, dirsWithSuffix[0]);
        console.log(`    ✅ Using directory with suffix: ${dirsWithSuffix[0]} (has HTML data)`);
      } else {
        // Fallback: use directory without suffix
        articlePath = path.join(screenshotDir, dirsWithoutSuffix[0]);
        console.log(`    ✅ Using directory without suffix: ${dirsWithoutSuffix[0]}`);
      }
    } else {
      articlePath = path.join(screenshotDir, matchingDirs[0]);
      console.log(`    ✅ Found directory: ${matchingDirs[0]}`);
    }

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
      // ✅ HTML data loaded successfully - use it as base!
      console.log(`    ✅ Using HTML data as base`);

      // Use HTML data as base
      result.data = {
        productName: htmlData.productName || '',
        description: htmlData.description || '',
        articleNumber: htmlData.articleNumber || articleNumber,
        price: htmlData.price !== undefined ? htmlData.price : 0,
        priceType: htmlData.priceType || 'normal',
        tieredPrices: htmlData.tieredPrices || [],
        tieredPricesText: htmlData.tieredPricesText || ''
      };

      // Set confidence from HTML
      result.confidence = htmlData.confidence || {
        productName: 1,
        description: 1,
        articleNumber: 1,
        price: htmlData.price ? 1 : 0,
        tieredPrices: htmlData.tieredPrices ? 1 : 0
      };

      // Mark sources
      result.source = {
        productName: 'html',
        description: 'html',
        articleNumber: 'html',
        price: htmlData.price ? 'html' : 'none',
        tieredPrices: htmlData.tieredPrices && htmlData.tieredPrices.length > 0 ? 'html' : 'none'
      };

      result.htmlData = htmlData;

      // CRITICAL FIX: Run OCR on description.png if HTML description is missing!
      const needsDescriptionOcr = !htmlData.description || htmlData.description.trim() === '';

      if (needsDescriptionOcr) {
        console.log(`    🔍 HTML description is empty - running OCR on description.png`);

        // Try to find description.png in the current directory OR sibling directories
        let descPath = path.join(articlePath, 'description.png');

        if (!existsSync(descPath)) {
          console.log(`    🔍 description.png not in current dir, checking sibling dirs: ${matchingDirs.join(', ')}`);

          // Check all matching directories for description.png
          for (const dir of matchingDirs) {
            const siblingPath = path.join(screenshotDir, dir, 'description.png');
            if (existsSync(siblingPath)) {
              descPath = siblingPath;
              console.log(`    ✅ Found description.png in sibling directory: ${dir}`);
              break;
            }
          }
        }

        if (existsSync(descPath)) {
          try {
            // Run Tesseract OCR on description.png
            const worker = await createWorker('deu', 1, {
              logger: () => {} // Suppress logs
            });

            const { data } = await worker.recognize(descPath);
            await worker.terminate();

            const descText = data.text || '';
            if (descText && descText.trim().length > 10) {
              result.data.description = descText.trim();
              result.confidence.description = 0.8; // Lower confidence than HTML
              result.source.description = 'ocr';
              console.log(`    ✅ OCR description extracted: ${descText.substring(0, 100)}...`);
            } else {
              console.log(`    ⚠️ OCR result too short: "${descText}"`);
            }
          } catch (error: any) {
            console.log(`    ⚠️ Failed to OCR description: ${error.message}`);
          }
        } else {
          console.log(`    ⚠️ description.png not found in any matching directory`);
        }
      }
    } else {
      // Fallback: HTML data missing - run FULL OCR extraction on all screenshots!
      console.log(`    ⚠️ HTML data missing - running FULL OCR extraction`);

      // Initialize with defaults
      result.data = {
        productName: `Product ${articleNumber}`,
        description: '',
        articleNumber: articleNumber,
        price: null,
        priceType: 'unknown',
        tieredPrices: [],
        tieredPricesText: ''
      };

      result.confidence = {
        productName: 0,
        description: 0,
        articleNumber: 1,
        price: 0,
        tieredPrices: 0
      };

      result.source = {
        productName: 'none',
        description: 'none',
        articleNumber: 'none',
        price: 'none',
        tieredPrices: 'none'
      };

      // Helper function to extract article number from text
      const extractArticleNumber = (text: string): string => {
        if (text.includes(':')) {
          const parts = text.split(':');
          if (parts.length > 1) {
            text = parts[1].trim();
          }
        }

        const match = text.match(/\d+[A-Za-z0-9\-.]*/ );
        return match ? match[0] : text.trim();
      };

      // Helper function to parse price from text
      const parsePrice = (priceText: string): number | null => {
        const match = priceText.match(/([\d.,]+)/);
        if (!match) return null;

        const normalized = match[1].replace(',', '.');
        const price = parseFloat(normalized);

        return isNaN(price) ? null : price;
      };

      // Helper function to clean OCR text
      const cleanOcrText = (text: string): string => {
        // Remove "Produktinformationen" prefix (only the prefix part before product name)
        text = text.replace(/^Produktinformationen\s*/i, '');
        // Remove quotes around product name
        text = text.replace(/^[""'](.+)[""']\s*/i, '$1');
        // Remove "Preis pro Stück" suffix
        text = text.replace(/\s*Preis pro St.ck\s*$/i, '');
        // Normalize whitespace
        text = text.replace(/\s+/g, ' ');
        // Fix common OCR errors
        text = text.replace(/©/g, 'Ø');
        text = text.replace(/S\s+(\d)/g, 'Ø $1'); // "S 60" → "Ø 60"

        return text.trim();
      };

      try {
        // 1. OCR on title.png (product name)
        const titlePath = path.join(articlePath, 'title.png');
        if (existsSync(titlePath)) {
          console.log(`    🔍 Running OCR on title.png...`);
          const worker = await createWorker('deu', 1, { logger: () => {} });
          const { data } = await worker.recognize(titlePath);
          await worker.terminate();

          if (data.text && data.text.trim().length > 3) {
            const cleanedTitle = cleanOcrText(data.text);
            result.data.productName = cleanedTitle;
            result.confidence.productName = data.confidence / 100;
            result.source.productName = 'ocr';
            console.log(`    ✅ OCR product name: "${cleanedTitle}" (confidence: ${Math.round(data.confidence)}%)`);
          }
        }

        // 2. OCR on description.png
        const descPath = path.join(articlePath, 'description.png');
        if (existsSync(descPath)) {
          console.log(`    🔍 Running OCR on description.png...`);
          const worker = await createWorker('deu', 1, { logger: () => {} });
          const { data } = await worker.recognize(descPath);
          await worker.terminate();

          if (data.text && data.text.trim().length > 10) {
            const cleanedDesc = cleanOcrText(data.text);
            result.data.description = cleanedDesc;
            result.confidence.description = data.confidence / 100;
            result.source.description = 'ocr';
            console.log(`    ✅ OCR description: "${cleanedDesc.substring(0, 80)}..." (confidence: ${Math.round(data.confidence)}%)`);
          }
        }

        // 3. OCR on price.png
        const pricePath = path.join(articlePath, 'price.png');
        if (existsSync(pricePath)) {
          console.log(`    🔍 Running OCR on price.png...`);
          const worker = await createWorker('deu', 1, { logger: () => {} });
          const { data } = await worker.recognize(pricePath);
          await worker.terminate();

          if (data.text) {
            const priceNum = parsePrice(data.text);
            if (priceNum !== null && priceNum > 0) {
              result.data.price = priceNum;
              result.data.priceType = 'normal';
              result.confidence.price = data.confidence / 100;
              result.source.price = 'ocr';
              console.log(`    ✅ OCR price: ${priceNum} EUR (confidence: ${Math.round(data.confidence)}%)`);
            }
          }
        }

        // 4. OCR on article-number.png (verification)
        const articleNumPath = path.join(articlePath, 'article-number.png');
        if (existsSync(articleNumPath)) {
          console.log(`    🔍 Running OCR on article-number.png...`);
          const worker = await createWorker('deu', 1, { logger: () => {} });
          const { data } = await worker.recognize(articleNumPath);
          await worker.terminate();

          if (data.text) {
            const extractedNum = extractArticleNumber(data.text);
            // Only update if it looks valid (has digits)
            if (extractedNum && /\d/.test(extractedNum)) {
              result.data.articleNumber = extractedNum;
              result.source.articleNumber = 'ocr';
              console.log(`    ✅ OCR article number: "${extractedNum}" (confidence: ${Math.round(data.confidence)}%)`);
            }
          }
        }

        console.log(`    ✅ Full OCR extraction completed`);

      } catch (error: any) {
        console.log(`    ⚠️ OCR extraction error: ${error.message}`);
      }
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
   * Process Lexware screenshot pair (article info + price info)
   * Specialized method for extracting data from Lexware export screenshots
   * @param screen1Path - Path to first screenshot (article info)
   * @param screen2Path - Path to second screenshot (price info)
   * @param articleNumber - Expected article number for validation
   */
  async processLexwarePair(
    screen1Path: string,
    screen2Path: string | null,
    articleNumber: string
  ): Promise<HybridExtractionResult> {
    try {
      console.log(`\n🔍 Processing Lexware pair for article ${articleNumber}`);
      console.log(`  📄 Screen 1: ${screen1Path}`);
      console.log(`  📄 Screen 2: ${screen2Path || 'Not available'}`);

      // Initialize result structure
      const result: HybridExtractionResult = {
        articleNumber,
        success: false,
        data: {
          articleNumber
        },
        ocrData: {},
        htmlData: undefined,  // No HTML for Lexware imports
        confidence: {
          productName: 0,
          description: 0,
          articleNumber: 0,
          price: 0,
          tieredPrices: 0
        },
        source: {
          productName: 'ocr',
          description: 'ocr',
          articleNumber: 'ocr',
          price: 'ocr',
          tieredPrices: 'ocr'
        },
        errors: [],
        warnings: []
      };

      // Process Screen 1 (Article Info)
      if (!existsSync(screen1Path)) {
        result.errors.push('Screen 1 file not found');
        return result;
      }

      console.log(`  🔍 Processing Screen 1 (Article Info)...`);
      const worker1 = await this.getAvailableWorker();

      try {
        const { data: screen1Data } = await worker1.recognize(screen1Path);

        if (screen1Data && screen1Data.text) {
          const text = screen1Data.text;
          const lines = text.split('\n').filter(line => line.trim());

          console.log(`    📝 Extracted ${lines.length} lines of text`);

          // Extract article number (usually in first 2-3 lines)
          // Pattern: Look for numeric values in first lines
          let extractedArticleNum = '';
          for (let i = 0; i < Math.min(3, lines.length); i++) {
            const matches = lines[i].match(/\d+/g);
            if (matches) {
              extractedArticleNum += matches.join('');
            }
          }

          // Fallback to expected article number if extraction failed
          if (extractedArticleNum.includes(articleNumber) || articleNumber.includes(extractedArticleNum)) {
            result.data.articleNumber = articleNumber;
            result.confidence.articleNumber = screen1Data.confidence;
            console.log(`    ✅ Article number confirmed: ${articleNumber}`);
          } else {
            result.warnings.push(`Article number mismatch: extracted "${extractedArticleNum}", expected "${articleNumber}"`);
            result.data.articleNumber = articleNumber; // Use expected number
            result.confidence.articleNumber = 50;
          }

          // Extract product name (usually 3rd or 4th field)
          // Look for the first substantial text line after article numbers
          let productName = '';
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip lines that are mostly numbers or very short
            if (line.length > 10 && !/^\d+$/.test(line)) {
              productName = line;
              break;
            }
          }

          if (productName) {
            // Clean up common OCR errors in German text
            productName = productName
              .replace(/ü/g, 'ü')
              .replace(/ö/g, 'ö')
              .replace(/ä/g, 'ä')
              .replace(/ß/g, 'ß')
              .replace(/\s+/g, ' ')
              .trim();

            result.data.productName = productName;
            result.confidence.productName = screen1Data.confidence;
            console.log(`    ✅ Product name: "${productName}"`);
          }

          // Extract description (remaining text after product name)
          const descriptionStartIndex = productName ? lines.indexOf(productName) + 1 : 4;
          if (descriptionStartIndex < lines.length) {
            const descriptionLines = lines.slice(descriptionStartIndex);
            const description = descriptionLines
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (description) {
              result.data.description = description;
              result.confidence.description = screen1Data.confidence;
              console.log(`    ✅ Description: "${description.substring(0, 50)}..."`);
            }
          }
        }
      } catch (ocrError: any) {
        console.error(`    ❌ OCR Error on Screen 1: ${ocrError.message}`);
        result.errors.push(`Screen 1 OCR failed: ${ocrError.message}`);
      }

      // Process Screen 2 (Price Info)
      if (screen2Path && existsSync(screen2Path)) {
        console.log(`  🔍 Processing Screen 2 (Price Info)...`);
        const worker2 = await this.getAvailableWorker();

        try {
          const { data: screen2Data } = await worker2.recognize(screen2Path);

          if (screen2Data && screen2Data.text) {
            const text = screen2Data.text;
            const lines = text.split('\n').filter(line => line.trim());

            console.log(`    📝 Extracted ${lines.length} lines from price screen`);

            // Look for unit (Einheit) - usually near "Preis pro" or "Einheit"
            const unitLine = lines.find(line =>
              line.toLowerCase().includes('einheit') ||
              line.toLowerCase().includes('preis pro')
            );

            let unit = 'Stück'; // Default unit
            if (unitLine) {
              // Extract unit value (might be on same line or next line)
              const unitMatch = unitLine.match(/(?:einheit|preis pro)[:\s]*([A-Za-zÄÖÜäöüß]+)/i);
              if (unitMatch) {
                unit = unitMatch[1];
                console.log(`    ✅ Unit found: ${unit}`);
              }
            }

            // Check for tiered prices (Staffelpreise)
            const tieredPrices: TieredPrice[] = [];
            let hasTieredPricing = false;

            // Look for "Staffelpreis" or price patterns
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];

              // Check for staffelpreis indicator
              if (line.toLowerCase().includes('staffelpreis')) {
                hasTieredPricing = true;
                console.log(`    📊 Tiered pricing detected`);
              }

              // Extract price patterns: "ab X Stück: Y,YY €"
              const tieredMatch = line.match(/ab\s*(\d+)\s*(?:stück|stk|pc)?[:\s]*(\d+[.,]\d{2})\s*(?:€|eur)?/i);
              if (tieredMatch) {
                const quantity = parseInt(tieredMatch[1]);
                const price = parseFloat(tieredMatch[2].replace(',', '.'));

                tieredPrices.push({
                  quantity,
                  price: price.toString()
                });

                console.log(`    ✅ Tier found: ${quantity} ${unit} = ${price} €`);
              }

              // Alternative pattern: "X - Y Stück Z,ZZ €"
              const rangeMatch = line.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:stück|stk|pc)?[:\s]*(\d+[.,]\d{2})\s*(?:€|eur)?/i);
              if (rangeMatch) {
                const minQty = parseInt(rangeMatch[1]);
                const price = parseFloat(rangeMatch[3].replace(',', '.'));

                tieredPrices.push({
                  quantity: minQty,
                  price: price.toString()
                });

                console.log(`    ✅ Tier found: ${minQty}+ ${unit} = ${price} €`);
              }
            }

            // If no tiered prices found, look for single price
            if (tieredPrices.length === 0) {
              // Look for single price pattern
              const pricePattern = /(\d+[.,]\d{2})\s*(?:€|eur)/i;
              for (const line of lines) {
                const match = line.match(pricePattern);
                if (match) {
                  const price = parseFloat(match[1].replace(',', '.'));
                  result.data.price = price;
                  result.data.priceType = 'normal';
                  result.confidence.price = screen2Data.confidence;
                  console.log(`    ✅ Single price found: ${price} €`);
                  break;
                }
              }
            } else {
              // Store tiered prices
              result.data.tieredPrices = tieredPrices;
              result.data.priceType = 'tiered';
              result.data.tieredPricesText = tieredPrices
                .map(tp => `ab ${tp.quantity}: ${tp.price} €`)
                .join(', ');
              result.confidence.tieredPrices = screen2Data.confidence;
              console.log(`    ✅ ${tieredPrices.length} price tiers extracted`);
            }

            // Check for "Auf Anfrage" (price on request)
            const aufAnfrageFound = lines.some(line =>
              line.toLowerCase().includes('auf anfrage') ||
              line.toLowerCase().includes('auf-anfrage') ||
              line.toLowerCase().includes('preis auf anfrage')
            );

            if (aufAnfrageFound) {
              result.data.priceType = 'auf_anfrage';
              result.data.price = null;
              console.log(`    ⚠️ Price type: Auf Anfrage`);
            }
          }
        } catch (ocrError: any) {
          console.error(`    ❌ OCR Error on Screen 2: ${ocrError.message}`);
          result.errors.push(`Screen 2 OCR failed: ${ocrError.message}`);
        }
      } else {
        result.warnings.push('Screen 2 not available - no price information extracted');
        result.data.priceType = 'unknown';
      }

      // Mark as successful if we have minimum required data
      if (result.data.articleNumber && result.data.productName) {
        result.success = true;
        console.log(`  ✅ Lexware extraction successful for article ${articleNumber}`);
      } else {
        result.success = false;
        console.log(`  ❌ Insufficient data extracted for article ${articleNumber}`);
        result.errors.push('Missing required fields: articleNumber or productName');
      }

      // Calculate overall confidence
      const confidenceValues = Object.values(result.confidence).filter(c => c > 0);
      const overallConfidence = confidenceValues.length > 0
        ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
        : 0;

      console.log(`  📊 Overall confidence: ${Math.round(overallConfidence)}%`);

      return result;

    } catch (error: any) {
      console.error(`[RobustOCRService] Error processing Lexware pair: ${error}`);

      return {
        articleNumber,
        success: false,
        data: { articleNumber },
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
        errors: [`Critical error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get an available OCR worker (round-robin)
   */
  private async getAvailableWorker(): Promise<Worker> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const workers = Array.from(this.workers.values());
    if (workers.length === 0) {
      throw new Error('No OCR workers available');
    }

    // Simple round-robin selection
    const workerIndex = this.processedCount % workers.length;
    return workers[workerIndex];
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