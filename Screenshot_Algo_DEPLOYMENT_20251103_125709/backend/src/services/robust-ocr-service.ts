/**
 * Robust OCR Service - Handles 2000+ articles reliably
 * Features: Retry mechanism, batch processing, memory management, better error handling
 */

import { createWorker, Worker } from 'tesseract.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

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
    if (this.isInitialized) return;

    console.log('🔍 Initializing Robust OCR Service...');

    for (let i = 0; i < this.config.workerCount; i++) {
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
    }

    this.isInitialized = true;
    console.log(`✅ OCR Service initialized with ${this.config.workerCount} workers`);
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
  ): Promise<any> {
    try {
      // Validate file first
      if (!await this.validateFile(filePath)) {
        throw new Error(`Invalid file: ${filePath}`);
      }

      const normalizedPath = this.normalizePath(filePath);

      // Set timeout for OCR processing
      const timeoutPromise = new Promise((_, reject) => {
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
   * Process element screenshots for an article
   */
  async processArticleElements(
    screenshotDir: string,
    articleNumber: string
  ): Promise<any> {
    const elementMappings = [
      { file: 'article-number.png', field: 'articleNumber', required: true },
      { file: 'title.png', field: 'productName', required: false },
      { file: 'description.png', field: 'description', required: false },
      { file: 'price.png', field: 'price', required: false },
      { file: 'price-table.png', field: 'tieredPrices', required: false }
    ];

    const result: any = {
      articleNumber,
      success: false,
      data: {},
      errors: []
    };

    const articlePath = path.join(screenshotDir, articleNumber);

    // Check if directory exists
    if (!existsSync(articlePath)) {
      result.errors.push(`Article directory not found: ${articlePath}`);
      return result;
    }

    // Get available worker
    const workers = Array.from(this.workers.values());
    const worker = workers[this.processedCount % workers.length];

    for (const mapping of elementMappings) {
      const filePath = path.join(articlePath, mapping.file);

      try {
        if (!existsSync(filePath)) {
          if (mapping.required) {
            result.errors.push(`Required file missing: ${mapping.file}`);
          }
          continue;
        }

        const ocrResult = await this.processWithRetry(filePath, worker);

        if (ocrResult && ocrResult.data && ocrResult.data.text) {
          let text = ocrResult.data.text.trim();

          // Clean up based on field type
          if (mapping.field === 'articleNumber') {
            const match = text.match(/\d+/);
            text = match ? match[0] : text;
          } else if (mapping.field === 'price') {
            text = this.extractPrice(text);
          } else if (mapping.field === 'tieredPrices') {
            text = this.parseTieredPrices(text);
          }

          result.data[mapping.field] = text;
          result.success = true;
        }
      } catch (error: any) {
        result.errors.push(`${mapping.file}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Process batch of articles
   */
  async processBatch(
    screenshotDir: string,
    articleNumbers: string[]
  ): Promise<any[]> {
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
            return {
              articleNumber,
              success: false,
              data: {},
              errors: [error.message]
            };
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
  private parseTieredPrices(text: string): any[] {
    const prices: any[] = [];
    const lines = text.split('\n');

    const pricePattern = /(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/gi;

    for (const line of lines) {
      const match = pricePattern.exec(line);
      if (match) {
        prices.push({
          minQuantity: parseInt(match[1]),
          price: parseFloat(match[2].replace(',', '.'))
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
    console.log('🔍 Shutting down OCR Service...');

    for (const [id, worker] of this.workers) {
      await worker.terminate();
      this.workers.delete(id);
    }

    this.isInitialized = false;
    this.processedCount = 0;
    this.failedCount = 0;

    console.log('✅ OCR Service shut down');
  }
}

export const robustOCRService = new RobustOCRService();