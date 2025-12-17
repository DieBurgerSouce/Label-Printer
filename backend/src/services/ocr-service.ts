/**
 * OCR Service
 * Extracts text from screenshots using Tesseract.js with intelligent field detection
 */

import { createWorker, Worker } from 'tesseract.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  OCRResult,
  ExtractedData,
  BoundingBox,
  TieredPrice,
  OCRConfig,
  ConfidenceScores,
  FIELD_PATTERNS,
  ImagePreprocessingOptions,
  DEFAULT_PREPROCESSING,
} from '../types/ocr-types';
import { cloudVisionService } from './cloud-vision-service';

class OCRService {
  private workers: Map<string, Worker> = new Map();
  private processingQueue: Map<string, OCRResult> = new Map();
  private readonly maxWorkers = 2; // Reduced for Docker stability (was 8 - caused crashes)
  private _processedCount = 0;
  private readonly _maxProcessedBeforeCleanup = 20; // Clean up workers more frequently in Docker

  /**
   * Initialize OCR workers
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing OCR Service...');

    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = await createWorker('deu+eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Worker ${i}: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });

      // Configure Tesseract for better results
      await worker.setParameters({
        tessedit_pageseg_mode: 6, // Assume uniform block of text
        tessedit_ocr_engine_mode: 1, // Use LSTM engine
        preserve_interword_spaces: 0, // Reduce garbage spaces
      } as any);

      this.workers.set(`worker-${i}`, worker);
    }

    console.log(`✅ OCR Service initialized with ${this.maxWorkers} workers`);
  }

  /**
   * Process individual element screenshots from precise screenshot service
   */
  async processElementScreenshots(
    screenshotDir: string,
    articleNumber: string,
    jobId?: string
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const resultId = uuidv4();

    console.log(`🔍 Processing element screenshots for article: ${articleNumber}`);

    const result: OCRResult = {
      id: resultId,
      screenshotId: articleNumber,
      jobId,
      status: 'processing',
      extractedData: {},
      confidence: { overall: 0 },
      rawText: '',
      boundingBoxes: [],
      processingTime: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const elementPath = path.join(screenshotDir, articleNumber);

      // Process each element screenshot
      const elementResults: { [key: string]: string } = {};

      // Define which files to process and their field mappings
      const elementMappings = [
        { file: 'article-number.png', field: 'articleNumber', clean: true },
        { file: 'title.png', field: 'productName', clean: false },
        { file: 'description.png', field: 'description', clean: false },
        { file: 'price.png', field: 'price', clean: true },
        { file: 'price-table.png', field: 'tieredPrices', table: true }
      ];

      let confidenceSum = 0;
      let confidenceCount = 0;

      for (const mapping of elementMappings) {
        const filePath = path.join(elementPath, mapping.file);

        try {
          await fs.access(filePath);
          console.log(`  📄 Processing ${mapping.file}...`);

          const worker = await this.getAvailableWorker();
          const { data } = await worker.recognize(filePath);

          let extractedText = data.text.trim();
          let confidence = data.confidence;

          // Check if we should use Cloud Vision as fallback
          if (cloudVisionService.shouldUseFallback(confidence / 100)) {
            console.log(`    ☁️ Using Cloud Vision fallback for ${mapping.file} (low confidence: ${Math.round(confidence)}%)`);
            const cloudData = await cloudVisionService.processImage(filePath);
            if (cloudData) {
              // Use cloud data if available
              if (mapping.field === 'articleNumber' && cloudData.articleNumber) {
                extractedText = cloudData.articleNumber;
                confidence = 95; // Cloud Vision typically has high accuracy
              } else if (mapping.field === 'productName' && cloudData.productName) {
                extractedText = cloudData.productName;
                confidence = 95;
              } else if (mapping.field === 'price' && cloudData.price) {
                extractedText = cloudData.price;
                confidence = 95;
              } else if (mapping.field === 'tieredPrices' && cloudData.tieredPrices) {
                extractedText = cloudData.tieredPrices.map(t =>
                  `${t.quantity}: ${t.price}`
                ).join('\n');
                confidence = 95;
              }
            }
          }

          // Clean up based on field type
          if (mapping.clean) {
            if (mapping.field === 'articleNumber') {
              // Extract just the number from "Produktnummer: 8805"
              const match = extractedText.match(/\d+/);
              extractedText = match ? match[0] : extractedText;
            } else if (mapping.field === 'price') {
              // Clean up price format
              extractedText = this.extractPrice(extractedText);
            }
          }

          // Apply post-processing based on field type
          if (mapping.field === 'productName') {
            extractedText = this.cleanProductName(extractedText);
          } else if (mapping.field === 'description') {
            extractedText = this.cleanDescription(extractedText);
          }

          if (mapping.table) {
            // Save both raw text for labels AND structured data
            elementResults['tieredPricesText'] = extractedText; // Raw text for labels (e.g., "ab 7 Stück: 190,92 EUR\nab 24 Stück: 180,60 EUR")
            elementResults[mapping.field] = JSON.stringify(this.parseTieredPriceTable(extractedText)); // Structured data for calculations
          } else {
            elementResults[mapping.field] = extractedText;
          }

          confidenceSum += confidence;
          confidenceCount++;

          console.log(`    ✅ ${mapping.field}: ${extractedText.substring(0, 50)}...`);
        } catch (error) {
          console.log(`    ⚠️ ${mapping.file} not found or could not be processed`);
        }
      }

      // Combine results
      result.extractedData = elementResults as ExtractedData;
      result.confidence.overall = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
      result.status = 'completed';
      result.processingTime = Date.now() - startTime;

      console.log(`✅ OCR completed for article ${articleNumber} (${result.processingTime}ms)`);
      return result;

    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Process a screenshot and extract text
   */
  async processScreenshot(
    screenshotPath: string,
    config: Partial<OCRConfig> = {},
    jobId?: string
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const resultId = uuidv4();
    const screenshotId = path.basename(screenshotPath, path.extname(screenshotPath));

    console.log(`🔍 Processing screenshot: ${screenshotPath}`);

    const result: OCRResult = {
      id: resultId,
      screenshotId,
      jobId,
      status: 'processing',
      extractedData: {},
      confidence: { overall: 0 },
      rawText: '',
      boundingBoxes: [],
      processingTime: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.processingQueue.set(resultId, result);

    try {
      // Preprocess image for better OCR accuracy
      const processedImagePath = await this.preprocessImage(
        screenshotPath,
        config.preprocessImage !== false ? DEFAULT_PREPROCESSING : {}
      );

      // Validate the processed image path
      if (!processedImagePath || processedImagePath === '') {
        throw new Error(`Invalid image path: "${processedImagePath}"`);
      }

      // Check if file exists and is not empty
      const fileStats = await fs.stat(processedImagePath).catch(err => {
        throw new Error(`Cannot access image file: ${processedImagePath} - ${err.message}`);
      });

      if (fileStats.size === 0) {
        throw new Error(`Image file is empty: ${processedImagePath}`);
      }

      // Get available worker
      const worker = await this.getAvailableWorker();

      // Perform OCR
      // Note: Configuration is handled during worker creation
      const { data } = await worker.recognize(processedImagePath);

      // Extract text and bounding boxes
      result.rawText = data.text;
      result.boundingBoxes = this.extractBoundingBoxes(data);

      // Extract structured data using patterns
      result.extractedData = this.extractStructuredData(
        data.text,
        result.boundingBoxes
      );

      // Calculate confidence scores
      result.confidence = this.calculateConfidence(data, result.extractedData);

      // Clean up processed image if it's different from original
      if (processedImagePath !== screenshotPath) {
        await fs.unlink(processedImagePath).catch(() => {});
      }

      result.status = 'completed';
      result.processingTime = Date.now() - startTime;
      result.updatedAt = new Date();

      console.log(`✅ OCR completed in ${result.processingTime}ms`);
      console.log(`   Article Number: ${result.extractedData.articleNumber || 'N/A'}`);
      console.log(`   Price: ${result.extractedData.price || 'N/A'}`);
      console.log(`   Confidence: ${Math.round(result.confidence.overall * 100)}%`);

      return result;
    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      result.status = 'failed';
      result.processingTime = Date.now() - startTime;
      result.updatedAt = new Date();
      throw error;
    } finally {
      this.processingQueue.delete(resultId);
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   */
  private async preprocessImage(
    imagePath: string,
    options: ImagePreprocessingOptions
  ): Promise<string> {
    if (Object.keys(options).length === 0) {
      return imagePath;
    }

    const outputPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '_processed.png');

    let pipeline = sharp(imagePath);

    // Remove alpha channel and set white background
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });

    // Convert to grayscale
    if (options.grayscale) {
      pipeline = pipeline.grayscale();
    }

    // Resize if needed
    if (options.resize) {
      pipeline = pipeline.resize(options.resize);
    }

    // Normalize (auto-adjust levels)
    if (options.normalize) {
      pipeline = pipeline.normalize();
    }

    // Sharpen more aggressively
    if (options.sharpen) {
      pipeline = pipeline.sharpen({ sigma: 1.5, m1: 0.7, m2: 0.5 });
    }

    // Apply threshold for better text recognition (more aggressive)
    if (options.threshold) {
      pipeline = pipeline.threshold(options.threshold || 180); // Default to 180 if true
    }

    // Add contrast boost
    pipeline = pipeline.linear(1.2, 0); // Increase contrast

    await pipeline.toFile(outputPath);

    return outputPath;
  }

  /**
   * Extract bounding boxes from Tesseract result
   */
  private extractBoundingBoxes(data: any): BoundingBox[] {
    const boxes: BoundingBox[] = [];

    if (data.words) {
      for (const word of data.words) {
        boxes.push({
          text: word.text,
          confidence: word.confidence / 100,
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
        });
      }
    }

    return boxes;
  }

  /**
   * Extract structured data from raw OCR text using patterns
   */
  private extractStructuredData(
    text: string,
    boundingBoxes: BoundingBox[]
  ): ExtractedData {
    const data: ExtractedData = {};

    // Extract article number
    for (const pattern of FIELD_PATTERNS.articleNumber) {
      const match = text.match(pattern);
      if (match) {
        data.articleNumber = match[1] || match[0];
        this.markBoundingBoxType(boundingBoxes, data.articleNumber, 'articleNumber');
        break;
      }
    }

    // Extract price
    for (const pattern of FIELD_PATTERNS.price) {
      const match = text.match(pattern);
      if (match) {
        data.price = match[1] || match[0];
        this.markBoundingBoxType(boundingBoxes, data.price, 'price');
        break;
      }
    }

    // Extract EAN
    for (const pattern of FIELD_PATTERNS.ean) {
      const match = text.match(pattern);
      if (match) {
        data.ean = match[1] || match[0];
        break;
      }
    }

    // Extract tiered prices
    data.tieredPrices = this.extractTieredPrices(text, boundingBoxes);

    // Extract product name (heuristic: longest capitalized line)
    const lines = text.split('\n').filter(line => line.trim().length > 3);
    const capitalizedLines = lines.filter(line => /^[A-ZÄÖÜ]/.test(line.trim()));
    if (capitalizedLines.length > 0) {
      data.productName = capitalizedLines.reduce((a, b) => a.length > b.length ? a : b).trim();
      this.markBoundingBoxType(boundingBoxes, data.productName, 'productName');
    }

    return data;
  }

  /**
   * Extract tiered prices from text
   */
  private extractTieredPrices(text: string, boundingBoxes: BoundingBox[]): TieredPrice[] {
    const tiers: TieredPrice[] = [];

    for (const pattern of FIELD_PATTERNS.tieredPrice) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const quantity = parseInt(match[1], 10);
        const price = match[2];

        if (!isNaN(quantity) && price) {
          tiers.push({ quantity, price });
          this.markBoundingBoxType(boundingBoxes, price, 'tieredPrice');
        }
      }
    }

    return tiers.sort((a, b) => a.quantity - b.quantity);
  }

  /**
   * Mark bounding box field type
   */
  private markBoundingBoxType(
    boxes: BoundingBox[],
    text: string,
    fieldType: BoundingBox['fieldType']
  ): void {
    const cleanText = text.replace(/[^\w]/g, '').toLowerCase();

    for (const box of boxes) {
      const boxText = box.text.replace(/[^\w]/g, '').toLowerCase();
      if (cleanText.includes(boxText) || boxText.includes(cleanText)) {
        box.fieldType = fieldType;
      }
    }
  }

  /**
   * Calculate confidence scores
   */
  private calculateConfidence(
    tesseractData: any,
    extractedData: ExtractedData
  ): ConfidenceScores {
    const scores: ConfidenceScores = {
      overall: tesseractData.confidence / 100 || 0,
    };

    // Calculate field-specific confidence based on pattern matches
    if (extractedData.articleNumber) {
      scores.articleNumber = this.calculateFieldConfidence(
        extractedData.articleNumber,
        FIELD_PATTERNS.articleNumber
      );
    }

    if (extractedData.price) {
      scores.price = this.calculateFieldConfidence(
        extractedData.price,
        FIELD_PATTERNS.price
      );
    }

    // Product name confidence (based on length and capitalization)
    if (extractedData.productName) {
      const name = extractedData.productName;
      const lengthScore = Math.min(name.length / 50, 1);
      const capitalScore = /^[A-ZÄÖÜ]/.test(name) ? 1 : 0.5;
      scores.productName = (lengthScore + capitalScore) / 2;
    }

    return scores;
  }

  /**
   * Calculate confidence for a specific field based on pattern matching
   */
  private calculateFieldConfidence(value: string, patterns: RegExp[]): number {
    let maxConfidence = 0;

    for (const pattern of patterns) {
      if (pattern.test(value)) {
        // Stronger patterns (more specific) get higher confidence
        const patternComplexity = pattern.source.length / 50;
        const confidence = Math.min(0.7 + patternComplexity * 0.3, 1);
        maxConfidence = Math.max(maxConfidence, confidence);
      }
    }

    return maxConfidence;
  }

  /**
   * Get available OCR worker
   */
  private async getAvailableWorker(): Promise<Worker> {
    // DISABLED: Cleanup causes crashes when workers are null during re-init
    // With only 2 workers, cleanup is not necessary anymore
    // this.processedCount++;
    // if (this.processedCount >= this.maxProcessedBeforeCleanup) {
    //   console.log(`🧹 Cleaning up OCR workers after ${this.processedCount} images...`);
    //   await this.cleanupWorkers();
    //   this.processedCount = 0;
    // }

    // Simple round-robin for now
    const workerIds = Array.from(this.workers.keys());
    const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
    return this.workers.get(workerId)!;
  }

  /**
   * Clean up and recreate workers to free memory
   * @deprecated Currently unused - implement periodic cleanup if memory issues arise
   */
  private async _cleanupWorkers(): Promise<void> {
    try {
      // Terminate all existing workers
      for (const [id, worker] of this.workers) {
        try {
          await worker.terminate();
          console.log(`   ✅ Terminated worker ${id}`);
        } catch (error) {
          console.error(`   ❌ Error terminating worker ${id}:`, error);
        }
      }

      // Clear the workers map
      this.workers.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('   🧹 Forced garbage collection');
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Re-initialize workers
      await this.initialize();
      console.log('   ✅ Workers re-initialized');
    } catch (error) {
      console.error('❌ Error during worker cleanup:', error);
      // Re-initialize even if cleanup failed
      await this.initialize();
    }
  }

  /**
   * Batch process multiple screenshots
   */
  async processScreenshots(
    screenshotPaths: string[],
    config: Partial<OCRConfig> = {},
    jobId?: string
  ): Promise<OCRResult[]> {
    console.log(`🔍 Batch processing ${screenshotPaths.length} screenshots...`);

    const results = await Promise.all(
      screenshotPaths.map(path =>
        this.processScreenshot(path, config, jobId).catch(error => {
          console.error(`Failed to process ${path}:`, error);
          return null;
        })
      )
    );

    return results.filter((r): r is OCRResult => r !== null);
  }

  /**
   * Get processing status
   */
  getProcessingStatus(resultId: string): OCRResult | undefined {
    return this.processingQueue.get(resultId);
  }

  /**
   * Parse tiered price table from OCR text
   */
  private parseTieredPriceTable(text: string): TieredPrice[] {
    const prices: TieredPrice[] = [];

    // First, clean the text from obvious garbage
    const cleanedLines = text.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Filter out garbage patterns
        if (!trimmed) return false;
        if (trimmed.includes('©')) return false;
        if (trimmed.includes('Service')) return false;
        if (trimmed.includes('Hilfe')) return false;
        if (trimmed.includes('Goooe')) return false;
        if (trimmed.includes('eingeben')) return false;
        if (trimmed.includes('@')) return false;
        // Only keep lines that look like prices
        return /\d/.test(trimmed) && (trimmed.includes('€') || trimmed.includes('EUR') || /\d+[,\.]\d+/.test(trimmed));
      });

    // Pattern to match price table rows: "ab X Stück Y,ZZ €" or "Bis X Y,ZZ €"
    const pricePattern = /(ab|bis)\s+(\d+)\s+(?:Stück|St\.|Stk\.?)?\s*([\d,]+)\s*€/gi;

    // Alternative patterns for different formats
    const altPattern1 = /(\d+)\s*(?:Stück|St\.|Stk\.?|\+)?\s*([\d,]+)\s*€/gi;
    const altPattern2 = /(ab|bis)\s+(\d+)[:\s]+([\d,]+)\s*€/gi;

    for (const line of cleanedLines) {
      // Reset regex lastIndex
      pricePattern.lastIndex = 0;
      altPattern1.lastIndex = 0;
      altPattern2.lastIndex = 0;

      let match = pricePattern.exec(line);
      if (match) {
        const quantity = parseInt(match[2]);
        const price = match[3].replace(',', '.');
        if (!isNaN(quantity) && !isNaN(parseFloat(price))) {
          prices.push({ quantity, price });
        }
        continue;
      }

      // Try alternative pattern with ab/bis prefix
      match = altPattern2.exec(line);
      if (match) {
        const quantity = parseInt(match[2]);
        const price = match[3].replace(',', '.');
        if (!isNaN(quantity) && !isNaN(parseFloat(price))) {
          prices.push({ quantity, price });
        }
        continue;
      }

      // Try simple pattern
      match = altPattern1.exec(line);
      if (match) {
        const quantity = parseInt(match[1]);
        const price = match[2].replace(',', '.');
        if (!isNaN(quantity) && !isNaN(parseFloat(price))) {
          prices.push({ quantity, price });
        }
      }
    }

    // Sort by quantity and remove duplicates
    prices.sort((a, b) => a.quantity - b.quantity);

    // Remove duplicates with same quantity
    const uniquePrices = prices.filter((price, index, arr) =>
      index === 0 || price.quantity !== arr[index - 1].quantity
    );

    console.log(`    📊 Parsed ${uniquePrices.length} price tiers from ${cleanedLines.length} cleaned lines`);
    return uniquePrices;
  }

  /**
   * Extract price from OCR text with advanced validation and fixing
   */
  private extractPrice(text: string): string {
    // Match various price formats: "45,41 €", "EUR 45.41", etc.
    const pricePattern = /(\d+[,.]?\d*)\s*€|EUR\s*(\d+[,.]?\d*)/gi;
    const match = pricePattern.exec(text);

    if (match) {
      let price = match[1] || match[2];

      // Normalize comma to period
      price = price.replace(',', '.');

      // Fix missing decimal point (OCR error: "2545" instead of "25.45")
      const priceNum = parseFloat(price);
      if (!price.includes('.') && priceNum > 100) {
        // Assume last 2 digits are cents
        const fixedPrice = (priceNum / 100).toFixed(2);
        console.log(`    🔧 Fixed price: ${price} → ${fixedPrice}`);
        return fixedPrice;
      }

      return price;
    }

    return text.trim();
  }

  /**
   * Clean and normalize product name (remove OCR artifacts)
   */
  private cleanProductName(productName: string): string {
    let cleaned = productName;

    // Remove line breaks (major OCR artifact)
    cleaned = cleaned.replace(/\n/g, ' ');

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Fix common OCR errors
    cleaned = cleaned.replace(/Fir\s/g, 'Für ');
    cleaned = cleaned.replace(/eisgehärtet/g, 'eisgehärtet'); // Preserve correct spelling

    // If all uppercase and long, convert to title case
    if (cleaned === cleaned.toUpperCase() && cleaned.length > 15) {
      cleaned = cleaned
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      console.log(`    🔧 Converted from all-caps to title case`);
    }

    return cleaned;
  }

  /**
   * Clean and normalize description text
   */
  private cleanDescription(description: string): string {
    let cleaned = description;

    // Remove line breaks for better readability
    cleaned = cleaned.replace(/\n/g, ' ');

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove common OCR artifacts
    cleaned = cleaned.replace(/[©@]/g, '');

    return cleaned;
  }

  /**
   * Shutdown OCR service
   */
  async shutdown(): Promise<void> {
    console.log('🔍 Shutting down OCR Service...');

    for (const [id, worker] of this.workers) {
      await worker.terminate();
      this.workers.delete(id);
    }

    console.log('✅ OCR Service shut down');
  }
}

// Export singleton instance
export const ocrService = new OCRService();
