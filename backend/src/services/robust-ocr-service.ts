/**
 * Robust OCR Service - Handles 2000+ articles reliably
 * Features: Retry mechanism, batch processing, memory management, better error handling
 */

import { createWorker, Worker, RecognizeResult } from 'tesseract.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { HybridExtractionResult, HtmlExtractedData, TieredPrice } from '../types/extraction-types';

// Import from extracted modules
import { normalizePath, validateFile } from './ocr/file-utils';
import {
  cleanOcrText,
  getArticleNumberFromText,
  parsePrice,
  fixOCRNumberErrors,
} from './ocr/text-utils';

export interface OCRConfig {
  maxRetries: number;
  batchSize: number;
  workerCount: number;
  timeout: number;
}

const DEFAULT_CONFIG: OCRConfig = {
  maxRetries: 3,
  batchSize: 5,
  workerCount: 2,
  timeout: 30000,
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
            },
          });

          this.workers.set(`worker-${i}`, worker);
          console.log(`✅ Worker ${i} initialized successfully`);
        } catch (workerError: unknown) {
          console.error(`❌ Failed to initialize worker ${i}:`, workerError);
        }
      }

      if (this.workers.size === 0) {
        throw new Error('Failed to initialize any OCR workers');
      }

      this.isInitialized = true;
      console.log(
        `✅ OCR Service initialized with ${this.workers.size}/${this.config.workerCount} workers`
      );
    } catch (error: unknown) {
      console.error('[RobustOCRService] CRITICAL ERROR in initialize():', error);
      this.isInitialized = false;
      throw error;
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
      if (!(await validateFile(filePath))) {
        throw new Error(`Invalid file: ${filePath}`);
      }

      const normalizedPath = normalizePath(filePath);

      const timeoutPromise = new Promise<RecognizeResult>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout')), this.config.timeout);
      });

      const result = await Promise.race([worker.recognize(normalizedPath), timeoutPromise]);

      return result;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`    ⚠️ OCR attempt ${retries + 1} failed: ${errorMsg}`);

      if (retries < this.config.maxRetries) {
        console.log(`    🔄 Retrying... (${retries + 1}/${this.config.maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retries + 1)));
        return this.processWithRetry(filePath, worker, retries + 1);
      }

      throw error;
    }
  }

  /**
   * Process element screenshots for an article using HYBRID approach
   */
  async processArticleElements(
    screenshotDir: string,
    articleNumber: string
  ): Promise<HybridExtractionResult> {
    try {
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
          tieredPrices: 0,
        },
        source: {
          productName: 'none',
          description: 'none',
          articleNumber: 'none',
          price: 'none',
          tieredPrices: 'none',
        },
        errors: [],
        warnings: [],
      };

      // FUZZY MATCHING: Find matching directory
      console.log(`    🔍 Looking for article directories matching: ${articleNumber}`);

      const allDirs = await fs.readdir(screenshotDir);
      const variantPattern = new RegExp(`^${articleNumber}(-.*)?$`);
      const matchingDirs = allDirs.filter((dir: string) => variantPattern.test(dir));

      if (matchingDirs.length === 0) {
        console.log(`    ❌ No directories found matching ${articleNumber}`);
        result.errors.push(`Article directory not found: ${articleNumber}`);
        return result;
      }

      // Select best directory
      let articlePath: string;
      if (matchingDirs.length > 1) {
        console.log(
          `    🔍 Found ${matchingDirs.length} matching directories: ${matchingDirs.join(', ')}`
        );

        const dirsWithSuffix = matchingDirs.filter((dir) => dir !== articleNumber);
        const dirsWithoutSuffix = matchingDirs.filter((dir) => dir === articleNumber);

        if (dirsWithSuffix.length > 0) {
          articlePath = path.join(screenshotDir, dirsWithSuffix[0]);
          console.log(`    ✅ Using directory with suffix: ${dirsWithSuffix[0]} (has HTML data)`);
        } else {
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

          htmlData = {
            ...parsed,
            extractionTimestamp: new Date(parsed.extractionTimestamp),
          } as HtmlExtractedData;

          console.log(
            `    📄 Loaded HTML data for ${articleNumber} with ${parsed.tieredPrices?.length || 0} tiered prices`
          );
          result.htmlData = htmlData;
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(`    ⚠️ Failed to load HTML data: ${errorMsg}`);
          result.warnings.push(`Failed to load HTML data: ${errorMsg}`);
        }
      } else {
        console.log(`    ⚠️ HTML data file NOT found at: ${htmlDataPath}`);
        result.warnings.push(`HTML data missing for article ${articleNumber} - using fallback`);
      }

      // Process based on whether HTML data is available
      if (htmlData) {
        result.data = {
          productName: htmlData.productName || '',
          description: htmlData.description || '',
          articleNumber: htmlData.articleNumber || articleNumber,
          price: htmlData.price !== undefined ? htmlData.price : 0,
          priceType: htmlData.priceType || 'normal',
          tieredPrices: htmlData.tieredPrices || [],
          tieredPricesText: htmlData.tieredPricesText || '',
        };

        result.confidence = htmlData.confidence || {
          productName: 1,
          description: 1,
          articleNumber: 1,
          price: htmlData.price ? 1 : 0,
          tieredPrices: htmlData.tieredPrices ? 1 : 0,
        };

        result.source = {
          productName: 'html',
          description: 'html',
          articleNumber: 'html',
          price: htmlData.price ? 'html' : 'none',
          tieredPrices: htmlData.tieredPrices && htmlData.tieredPrices.length > 0 ? 'html' : 'none',
        };

        result.htmlData = htmlData;

        // Run OCR on description if HTML description is missing
        const needsDescriptionOcr = !htmlData.description || htmlData.description.trim() === '';

        if (needsDescriptionOcr) {
          await this.extractDescriptionOcr(articlePath, matchingDirs, screenshotDir, result);
        }
      } else {
        // Fallback: HTML data missing - run FULL OCR extraction
        await this.runFullOcrExtraction(articlePath, articleNumber, result);
      }

      result.success = true;

      console.log(`    ✅ Article ${articleNumber} processed:`);
      console.log(`       - Product: ${result.data.productName}`);
      console.log(`       - Tiered Prices: ${result.data.tieredPrices?.length || 0} tiers`);

      return result;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[RobustOCRService] CRITICAL ERROR processing article ${articleNumber}:`,
        error
      );

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
          tieredPrices: 0,
        },
        source: {
          productName: 'none',
          description: 'none',
          articleNumber: 'none',
          price: 'none',
          tieredPrices: 'none',
        },
        errors: [`Critical processing error: ${errorMsg}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract description via OCR when HTML is missing it
   */
  private async extractDescriptionOcr(
    articlePath: string,
    matchingDirs: string[],
    screenshotDir: string,
    result: HybridExtractionResult
  ): Promise<void> {
    console.log(`    🔍 HTML description is empty - running OCR on description.png`);

    let descPath = path.join(articlePath, 'description.png');

    if (!existsSync(descPath)) {
      console.log(
        `    🔍 description.png not in current dir, checking sibling dirs: ${matchingDirs.join(', ')}`
      );

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
        const worker = await createWorker('deu', 1, { logger: () => {} });
        const { data } = await worker.recognize(descPath);
        await worker.terminate();

        const descText = data.text || '';
        if (descText && descText.trim().length > 10) {
          result.data.description = descText.trim();
          result.confidence.description = 0.8;
          result.source.description = 'ocr';
          console.log(`    ✅ OCR description extracted: ${descText.substring(0, 100)}...`);
        } else {
          console.log(`    ⚠️ OCR result too short: "${descText}"`);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`    ⚠️ Failed to OCR description: ${errorMsg}`);
      }
    } else {
      console.log(`    ⚠️ description.png not found in any matching directory`);
    }
  }

  /**
   * Run full OCR extraction when HTML data is missing
   */
  private async runFullOcrExtraction(
    articlePath: string,
    articleNumber: string,
    result: HybridExtractionResult
  ): Promise<void> {
    console.log(`    ⚠️ HTML data missing - running FULL OCR extraction`);

    result.data = {
      productName: `Product ${articleNumber}`,
      description: '',
      articleNumber: articleNumber,
      price: null,
      priceType: 'unknown',
      tieredPrices: [],
      tieredPricesText: '',
    };

    result.confidence = {
      productName: 0,
      description: 0,
      articleNumber: 1,
      price: 0,
      tieredPrices: 0,
    };

    result.source = {
      productName: 'none',
      description: 'none',
      articleNumber: 'none',
      price: 'none',
      tieredPrices: 'none',
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
          console.log(
            `    ✅ OCR product name: "${cleanedTitle}" (confidence: ${Math.round(data.confidence)}%)`
          );
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
          console.log(
            `    ✅ OCR description: "${cleanedDesc.substring(0, 80)}..." (confidence: ${Math.round(data.confidence)}%)`
          );
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
            console.log(
              `    ✅ OCR price: ${priceNum} EUR (confidence: ${Math.round(data.confidence)}%)`
            );
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
          const extractedNum = getArticleNumberFromText(data.text);
          if (extractedNum && /\d/.test(extractedNum)) {
            result.data.articleNumber = extractedNum;
            result.source.articleNumber = 'ocr';
            console.log(
              `    ✅ OCR article number: "${extractedNum}" (confidence: ${Math.round(data.confidence)}%)`
            );
          }
        }
      }

      console.log(`    ✅ Full OCR extraction completed`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`    ⚠️ OCR extraction error: ${errorMsg}`);
    }
  }

  /**
   * Process batch of articles
   */
  async processBatch(
    screenshotDir: string,
    articleNumbers: string[]
  ): Promise<HybridExtractionResult[]> {
    try {
      const results = [];

      for (let i = 0; i < articleNumbers.length; i += this.config.batchSize) {
        const batch = articleNumbers.slice(i, i + this.config.batchSize);
        console.log(
          `\n📦 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(articleNumbers.length / this.config.batchSize)} (${batch.length} articles)`
        );

        const batchResults = await Promise.all(
          batch.map(async (articleNumber) => {
            try {
              this.processedCount++;
              console.log(
                `  📸 [${this.processedCount}/${articleNumbers.length}] Processing ${articleNumber}...`
              );

              const result = await this.processArticleElements(screenshotDir, articleNumber);

              if (result.success) {
                console.log(`    ✅ Success: ${articleNumber}`);
              } else {
                this.failedCount++;
                console.log(`    ❌ Failed: ${articleNumber}`);
              }

              return result;
            } catch (error: unknown) {
              this.failedCount++;
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              console.log(`    ❌ Error processing ${articleNumber}: ${errorMsg}`);
              return this.createErrorResult(articleNumber, errorMsg);
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

        console.log(
          `  📊 Progress: ${this.processedCount}/${articleNumbers.length} processed, ${this.failedCount} failed`
        );
      }

      return results;
    } catch (error: unknown) {
      console.error('[RobustOCRService] CRITICAL ERROR in processBatch():', error);
      return [];
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(articleNumber: string, errorMsg: string): HybridExtractionResult {
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
        tieredPrices: 0,
      },
      source: {
        productName: 'none',
        description: 'none',
        articleNumber: 'none',
        price: 'none',
        tieredPrices: 'none',
      },
      errors: [errorMsg],
      warnings: [],
    };
  }

  /**
   * Process Lexware screenshot pair
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

      const result: HybridExtractionResult = {
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
          tieredPrices: 0,
        },
        source: {
          productName: 'ocr',
          description: 'ocr',
          articleNumber: 'ocr',
          price: 'ocr',
          tieredPrices: 'ocr',
        },
        errors: [],
        warnings: [],
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
          const lines = text.split('\n').filter((line) => line.trim());

          console.log(`    📝 Extracted ${lines.length} lines of text`);

          // Extract article number
          let extractedArticleNum = '';
          for (let i = 0; i < Math.min(3, lines.length); i++) {
            const matches = lines[i].match(/\d+/g);
            if (matches) {
              extractedArticleNum += matches.join('');
            }
          }

          if (
            extractedArticleNum.includes(articleNumber) ||
            articleNumber.includes(extractedArticleNum)
          ) {
            result.data.articleNumber = articleNumber;
            result.confidence.articleNumber = screen1Data.confidence;
            console.log(`    ✅ Article number confirmed: ${articleNumber}`);
          } else {
            result.warnings.push(
              `Article number mismatch: extracted "${extractedArticleNum}", expected "${articleNumber}"`
            );
            result.data.articleNumber = articleNumber;
            result.confidence.articleNumber = 50;
          }

          // Extract product name
          let productName = '';
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 10 && !/^\d+$/.test(line)) {
              productName = line;
              break;
            }
          }

          if (productName) {
            productName = productName.replace(/\s+/g, ' ').trim();
            result.data.productName = productName;
            result.confidence.productName = screen1Data.confidence;
            console.log(`    ✅ Product name: "${productName}"`);
          }

          // Extract description
          const descriptionStartIndex = productName ? lines.indexOf(productName) + 1 : 4;
          if (descriptionStartIndex < lines.length) {
            const descriptionLines = lines.slice(descriptionStartIndex);
            const description = descriptionLines.join(' ').replace(/\s+/g, ' ').trim();

            if (description) {
              result.data.description = description;
              result.confidence.description = screen1Data.confidence;
              console.log(`    ✅ Description: "${description.substring(0, 50)}..."`);
            }
          }
        }
      } catch (ocrError: unknown) {
        const errorMsg = ocrError instanceof Error ? ocrError.message : 'Unknown error';
        console.error(`    ❌ OCR Error on Screen 1: ${errorMsg}`);
        result.errors.push(`Screen 1 OCR failed: ${errorMsg}`);
      }

      // Process Screen 2 (Price Info)
      if (screen2Path && existsSync(screen2Path)) {
        await this.processLexwareScreen2(screen2Path, result);
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

      const confidenceValues = Object.values(result.confidence).filter((c) => c > 0);
      const overallConfidence =
        confidenceValues.length > 0
          ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
          : 0;

      console.log(`  📊 Overall confidence: ${Math.round(overallConfidence)}%`);

      return result;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RobustOCRService] Error processing Lexware pair: ${error}`);

      return this.createErrorResult(articleNumber, `Critical error: ${errorMsg}`);
    }
  }

  /**
   * Process Lexware Screen 2 (Price Info)
   */
  private async processLexwareScreen2(
    screen2Path: string,
    result: HybridExtractionResult
  ): Promise<void> {
    console.log(`  🔍 Processing Screen 2 (Price Info)...`);
    const worker2 = await this.getAvailableWorker();

    try {
      const { data: screen2Data } = await worker2.recognize(screen2Path);

      if (screen2Data && screen2Data.text) {
        const text = screen2Data.text;
        const lines = text.split('\n').filter((line) => line.trim());

        console.log(`    📝 Extracted ${lines.length} lines from price screen`);

        const tieredPrices: TieredPrice[] = [];

        // Look for price patterns
        for (const line of lines) {
          const fixedLine = fixOCRNumberErrors(line);

          // Extract tiered prices
          const tieredMatch = fixedLine.match(
            /ab\s*(\d+)\s*(?:stück|stk|pc)?[:\s]*(\d+[.,]\d{2})\s*(?:€|eur)?/i
          );
          if (tieredMatch) {
            const quantity = parseInt(tieredMatch[1]);
            const price = parseFloat(tieredMatch[2].replace(',', '.'));

            tieredPrices.push({ quantity, price: price.toString() });
            console.log(`    ✅ Tier found: ${quantity} = ${price} €`);
          }

          // Alternative pattern
          const rangeMatch = fixedLine.match(
            /(\d+)\s*[-–]\s*(\d+)\s*(?:stück|stk|pc)?[:\s]*(\d+[.,]\d{2})\s*(?:€|eur)?/i
          );
          if (rangeMatch) {
            const minQty = parseInt(rangeMatch[1]);
            const price = parseFloat(rangeMatch[3].replace(',', '.'));

            tieredPrices.push({ quantity: minQty, price: price.toString() });
            console.log(`    ✅ Tier found: ${minQty}+ = ${price} €`);
          }
        }

        if (tieredPrices.length === 0) {
          // Look for single price
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
          result.data.tieredPrices = tieredPrices;
          result.data.priceType = 'tiered';
          result.data.tieredPricesText = tieredPrices
            .map((tp) => `ab ${tp.quantity}: ${tp.price} €`)
            .join(', ');
          result.confidence.tieredPrices = screen2Data.confidence;
          console.log(`    ✅ ${tieredPrices.length} price tiers extracted`);
        }

        // Check for "Auf Anfrage"
        const aufAnfrageFound = lines.some(
          (line) =>
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
    } catch (ocrError: unknown) {
      const errorMsg = ocrError instanceof Error ? ocrError.message : 'Unknown error';
      console.error(`    ❌ OCR Error on Screen 2: ${errorMsg}`);
      result.errors.push(`Screen 2 OCR failed: ${errorMsg}`);
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
      successRate:
        this.processedCount > 0
          ? (((this.processedCount - this.failedCount) / this.processedCount) * 100).toFixed(2) +
            '%'
          : '0%',
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
        } catch (workerError: unknown) {
          console.error(`❌ Error terminating worker ${id}:`, workerError);
        }
      }

      this.isInitialized = false;
      this.processedCount = 0;
      this.failedCount = 0;

      console.log('✅ OCR Service shut down');
    } catch (error: unknown) {
      console.error('[RobustOCRService] CRITICAL ERROR in shutdown():', error);
      this.isInitialized = false;
      this.processedCount = 0;
      this.failedCount = 0;
      throw error;
    }
  }
}

export const robustOCRService = new RobustOCRService();
