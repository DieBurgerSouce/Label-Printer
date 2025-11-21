import { v4 as uuidv4 } from 'uuid';
import { RobustOCRService } from './robust-ocr-service';
import lexwareImportService, { ImagePair, ImportManifest } from './lexware-import-service';
import lexwareValidationService, { ValidationReport } from './lexware-validation-service';
import { HybridExtractionResult } from '../types/extraction-types';
import prisma from '../lib/supabase';
import { Product } from '@prisma/client';

/**
 * Lexware Batch Processor
 * Orchestrates the complete import process for Lexware screenshot pairs
 * Handles 38 articles (76 screenshots) with error recovery and progress tracking
 */

export interface ProcessingOptions {
  batchSize?: number;
  maxConcurrent?: number;
  overwriteExisting?: boolean;
  skipLowConfidence?: boolean;
  autoReviewThreshold?: number;
  dryRun?: boolean;
}

export interface FailedItem {
  articleNumber: string;
  reason: string;
  errors: string[];
  pair: ImagePair;
}

export interface ReviewItem {
  articleNumber: string;
  extractedData: HybridExtractionResult;
  validationReport: ValidationReport;
  reviewReasons: string[];
}

export interface ProcessingStats {
  totalPairs: number;
  processed: number;
  successful: number;
  failed: number;
  reviewNeeded: number;
  skipped: number;
  duplicates: number;
  timeElapsed: number;
  avgTimePerArticle: number;
}

export interface BatchProcessingResult {
  jobId: string;
  successful: HybridExtractionResult[];
  failed: FailedItem[];
  flaggedForReview: ReviewItem[];
  stats: ProcessingStats;
  manifest: ImportManifest;
}

export interface ImportResult {
  jobId: string;
  imported: number;
  updated: number;
  failed: number;
  products: Product[];
  errors: Array<{ articleNumber: string; error: string }>;
}

export class LexwareBatchProcessor {
  private ocrService: RobustOCRService | null = null;
  private readonly DEFAULT_OPTIONS: ProcessingOptions = {
    batchSize: 5,
    maxConcurrent: 2,
    overwriteExisting: false,
    skipLowConfidence: false,
    autoReviewThreshold: 0.70,
    dryRun: false
  };

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Lexware Batch Processor...');
    this.ocrService = new RobustOCRService();
    await this.ocrService.initialize();
    console.log('✅ Batch Processor initialized');
  }

  /**
   * Process a batch of image pairs
   */
  async processBatch(
    pairs: ImagePair[],
    options: ProcessingOptions = {}
  ): Promise<BatchProcessingResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    const jobId = uuidv4();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 LEXWARE BATCH PROCESSING JOB: ${jobId}`);
    console.log(`📊 Processing ${pairs.length} article pairs`);
    console.log(`⚙️  Options:`, opts);
    console.log(`${'='.repeat(60)}\n`);

    // Initialize results
    const successful: HybridExtractionResult[] = [];
    const failed: FailedItem[] = [];
    const flaggedForReview: ReviewItem[] = [];
    const stats: ProcessingStats = {
      totalPairs: pairs.length,
      processed: 0,
      successful: 0,
      failed: 0,
      reviewNeeded: 0,
      skipped: 0,
      duplicates: 0,
      timeElapsed: 0,
      avgTimePerArticle: 0
    };

    // Create import manifest
    const manifest = await lexwareImportService.createImportManifest(pairs);

    // Check for duplicates if not overwriting
    let duplicateMap = new Map<string, boolean>();
    if (!opts.overwriteExisting) {
      const articleNumbers = pairs.map(p => p.articleNumber);
      duplicateMap = await lexwareValidationService.checkForDuplicatesBatch(articleNumbers);
      stats.duplicates = Array.from(duplicateMap.values()).filter(isDup => isDup).length;

      if (stats.duplicates > 0) {
        console.log(`⚠️  Found ${stats.duplicates} existing articles in database`);
      }
    }

    // Process in batches
    for (let i = 0; i < pairs.length; i += opts.batchSize!) {
      const batchPairs = pairs.slice(i, i + opts.batchSize!);
      const batchNum = Math.floor(i / opts.batchSize!) + 1;
      const totalBatches = Math.ceil(pairs.length / opts.batchSize!);

      console.log(`\n📦 Processing Batch ${batchNum}/${totalBatches}`);
      console.log(`   Articles: ${batchPairs.map(p => p.articleNumber).join(', ')}`);

      // Process each pair in the batch
      const batchPromises = batchPairs.map(async (pair) => {
        try {
          // Skip if duplicate and not overwriting
          if (!opts.overwriteExisting && duplicateMap.get(pair.articleNumber)) {
            console.log(`   ⏭️  Skipping ${pair.articleNumber} (already exists)`);
            stats.skipped++;
            return;
          }

          // Skip invalid pairs
          if (pair.status === 'invalid' || pair.status === 'missing_screen1') {
            failed.push({
              articleNumber: pair.articleNumber,
              reason: `Invalid pair status: ${pair.status}`,
              errors: [`Missing required screenshot(s)`],
              pair
            });
            stats.failed++;
            return;
          }

          console.log(`   🔍 Processing ${pair.articleNumber}...`);

          // Perform OCR extraction
          const extractionResult = await this.ocrService!.processLexwarePair(
            pair.screen1Path,
            pair.screen2Path,
            pair.articleNumber
          );

          stats.processed++;

          if (!extractionResult.success) {
            failed.push({
              articleNumber: pair.articleNumber,
              reason: 'OCR extraction failed',
              errors: extractionResult.errors,
              pair
            });
            stats.failed++;
            console.log(`   ❌ Failed: ${pair.articleNumber}`);
            return;
          }

          // Validate the extraction
          const validationReport = lexwareValidationService.validateProduct(extractionResult);

          // Check if needs review
          if (validationReport.requiresManualReview) {
            const confidencePercent = Math.round(validationReport.confidenceScore * 100);

            if (opts.skipLowConfidence && validationReport.confidenceScore < opts.autoReviewThreshold!) {
              console.log(`   ⏭️  Skipping ${pair.articleNumber} (confidence ${confidencePercent}% < threshold)`);
              stats.skipped++;
              return;
            }

            flaggedForReview.push({
              articleNumber: pair.articleNumber,
              extractedData: extractionResult,
              validationReport,
              reviewReasons: validationReport.reviewReasons
            });
            stats.reviewNeeded++;
            console.log(`   ⚠️  Review needed: ${pair.articleNumber} (confidence: ${confidencePercent}%)`);
          }

          if (validationReport.isValid) {
            successful.push(extractionResult);
            stats.successful++;
            console.log(`   ✅ Success: ${pair.articleNumber}`);
          } else {
            failed.push({
              articleNumber: pair.articleNumber,
              reason: 'Validation failed',
              errors: validationReport.errors.map(e => e.message),
              pair
            });
            stats.failed++;
            console.log(`   ❌ Invalid: ${pair.articleNumber}`);
          }

        } catch (error: any) {
          console.error(`   ❌ Error processing ${pair.articleNumber}:`, error);
          failed.push({
            articleNumber: pair.articleNumber,
            reason: 'Processing error',
            errors: [error.message || 'Unknown error'],
            pair
          });
          stats.failed++;
        }
      });

      // Wait for batch to complete
      await Promise.allSettled(batchPromises);

      // Progress update
      const progress = Math.round((stats.processed / pairs.length) * 100);
      console.log(`   📊 Progress: ${progress}% (${stats.processed}/${pairs.length})`);
    }

    // Calculate final statistics
    stats.timeElapsed = Date.now() - startTime;
    stats.avgTimePerArticle = stats.processed > 0 ? stats.timeElapsed / stats.processed : 0;

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 BATCH PROCESSING COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⚠️  Needs Review: ${stats.reviewNeeded}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`📁 Duplicates: ${stats.duplicates}`);
    console.log(`⏱️  Time: ${(stats.timeElapsed / 1000).toFixed(2)} seconds`);
    console.log(`⚡ Avg per article: ${(stats.avgTimePerArticle / 1000).toFixed(2)} seconds`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      jobId,
      successful,
      failed,
      flaggedForReview,
      stats,
      manifest
    };
  }

  /**
   * Import processed products to database
   */
  async importToDatabase(
    products: HybridExtractionResult[],
    importJobId: string,
    options: ProcessingOptions = {}
  ): Promise<ImportResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    if (opts.dryRun) {
      console.log('🔍 DRY RUN - No database changes will be made');
      return {
        jobId: importJobId,
        imported: 0,
        updated: 0,
        failed: 0,
        products: [],
        errors: []
      };
    }

    console.log(`\n💾 Importing ${products.length} products to database...`);

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const importedProducts: Product[] = [];
    const errors: Array<{ articleNumber: string; error: string }> = [];

    for (const extraction of products) {
      try {
        const productData = extraction.data;

        // Prepare data for database
        const dbData: any = {
          articleNumber: productData.articleNumber!,
          productName: productData.productName || 'Unknown Product',
          description: productData.description || null,
          price: typeof productData.price === 'string'
            ? parseFloat(productData.price) || null
            : productData.price || null,
          priceType: productData.priceType || 'unknown',
          tieredPrices: productData.tieredPrices ? JSON.parse(JSON.stringify(productData.tieredPrices)) : null,
          tieredPricesText: productData.tieredPricesText || null,
          imageUrl: null,  // No images for Lexware imports
          thumbnailUrl: null,
          ean: null,  // Not available in Lexware imports
          category: null,  // Not available in Lexware imports
          sourceUrl: 'lexware-import',
          crawlJobId: importJobId,
          ocrConfidence: extraction.confidence.productName || 0,
          verified: false,
          published: false
        };

        // Upsert to database
        const product = await prisma.product.upsert({
          where: { articleNumber: dbData.articleNumber },
          create: dbData,
          update: opts.overwriteExisting ? dbData : {}
        });

        if (product) {
          importedProducts.push(product);
          // Check if it was an update or insert
          const wasUpdate = product.updatedAt > product.createdAt;
          if (wasUpdate) {
            updated++;
            console.log(`   📝 Updated: ${product.articleNumber}`);
          } else {
            imported++;
            console.log(`   ✅ Imported: ${product.articleNumber}`);
          }
        }

      } catch (error: any) {
        failed++;
        const errorMsg = error.message || 'Unknown database error';
        errors.push({
          articleNumber: extraction.articleNumber,
          error: errorMsg
        });
        console.error(`   ❌ Failed to import ${extraction.articleNumber}: ${errorMsg}`);
      }
    }

    console.log(`\n💾 Database Import Complete:`);
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   📝 Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);

    return {
      jobId: importJobId,
      imported,
      updated,
      failed,
      products: importedProducts,
      errors
    };
  }

  /**
   * Complete pipeline: Discovery -> Processing -> Import
   */
  async runCompletePipeline(
    folderPath?: string,
    options: ProcessingOptions = {}
  ): Promise<{
    processingResult: BatchProcessingResult;
    importResult: ImportResult;
  }> {
    console.log('\n🚀 STARTING COMPLETE LEXWARE IMPORT PIPELINE');

    // 1. Initialize services
    if (!this.ocrService) {
      await this.initialize();
    }

    // 2. Discover image pairs
    console.log('\n📁 Phase 1: Discovery');
    const pairs = await lexwareImportService.discoverImagePairs(folderPath);

    if (pairs.length === 0) {
      throw new Error('No image pairs found in the specified folder');
    }

    // 3. Validate pairs
    console.log('\n✔️ Phase 2: Validation');
    const validationResults = await lexwareImportService.validateImagePairs(pairs);
    const validPairs = validationResults
      .filter(v => v.isValid)
      .map(v => v.pair);

    console.log(`   Found ${validPairs.length} valid pairs out of ${pairs.length}`);

    // 4. Process pairs
    console.log('\n🔍 Phase 3: OCR Processing');
    const processingResult = await this.processBatch(validPairs, options);

    // 5. Import to database
    console.log('\n💾 Phase 4: Database Import');
    const importResult = await this.importToDatabase(
      processingResult.successful,
      processingResult.jobId,
      options
    );

    // 6. Handle review items (if not dry run)
    if (processingResult.flaggedForReview.length > 0 && !options.dryRun) {
      console.log('\n⚠️  Phase 5: Manual Review Queue');
      console.log(`   ${processingResult.flaggedForReview.length} items need manual review:`);

      for (const item of processingResult.flaggedForReview) {
        console.log(`   - ${item.articleNumber}: ${item.reviewReasons.join(', ')}`);
      }
    }

    console.log('\n✅ PIPELINE COMPLETE!');

    return {
      processingResult,
      importResult
    };
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.ocrService) {
      await this.ocrService.shutdown();
      this.ocrService = null;
    }
    console.log('✅ Batch Processor shut down');
  }
}

// Export singleton instance
const batchProcessor = new LexwareBatchProcessor();
export default batchProcessor;