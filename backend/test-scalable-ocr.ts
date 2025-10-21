/**
 * Test Scalable OCR - Process all available screenshots with robust service
 */

import { robustOCRService } from './src/services/robust-ocr-service.js';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './src/services/product-service.js';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function testScalableOCR() {
  console.log('🚀 TESTING SCALABLE OCR SYSTEM\n');
  console.log('=' .repeat(60));

  try {
    // Find the job with most screenshots
    const screenshotsDir = path.join(process.cwd(), 'data/screenshots');
    const jobDirs = await fs.readdir(screenshotsDir);

    let largestJob = { id: '', count: 0 };

    for (const jobId of jobDirs) {
      const jobPath = path.join(screenshotsDir, jobId);
      try {
        const stats = await fs.stat(jobPath);
        if (stats.isDirectory()) {
          const articles = await fs.readdir(jobPath);
          const articleCount = articles.filter(async a => {
            const aPath = path.join(jobPath, a);
            const aStats = await fs.stat(aPath);
            return aStats.isDirectory();
          }).length;

          if (articleCount > largestJob.count) {
            largestJob = { id: jobId, count: articleCount };
          }
        }
      } catch (e) {
        // Skip invalid directories
      }
    }

    console.log(`📁 Found largest job: ${largestJob.id}`);
    console.log(`📊 Articles to process: ${largestJob.count}\n`);

    if (largestJob.count === 0) {
      console.log('❌ No articles found to process');
      return;
    }

    // Initialize robust OCR service
    await robustOCRService.initialize();

    // Get all article numbers
    const jobPath = path.join(screenshotsDir, largestJob.id);
    const allArticles = await fs.readdir(jobPath);
    const validArticles = [];

    for (const article of allArticles) {
      const articlePath = path.join(jobPath, article);
      const stats = await fs.stat(articlePath);
      if (stats.isDirectory()) {
        // Check if has at least article-number.png
        const requiredFile = path.join(articlePath, 'article-number.png');
        try {
          await fs.access(requiredFile);
          validArticles.push(article);
        } catch {
          console.log(`⚠️ Skipping ${article} - missing required files`);
        }
      }
    }

    console.log(`✅ Valid articles found: ${validArticles.length}\n`);

    // Process in batches
    const startTime = Date.now();
    console.log('🔄 Starting batch processing...\n');

    const results = await robustOCRService.processBatch(jobPath, validArticles);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESSING COMPLETE - RESULTS:\n');
    console.log(`⏱️ Total time: ${duration} seconds`);
    console.log(`📈 Processing rate: ${(validArticles.length / parseFloat(duration)).toFixed(2)} articles/second\n`);

    console.log('Success/Failure Breakdown:');
    console.log(`  ✅ Successful: ${successful.length} (${(successful.length / validArticles.length * 100).toFixed(2)}%)`);
    console.log(`  ❌ Failed: ${failed.length} (${(failed.length / validArticles.length * 100).toFixed(2)}%)`);

    // Error analysis
    if (failed.length > 0) {
      console.log('\n📋 Error Analysis:');
      const errorTypes = new Map();

      failed.forEach(f => {
        f.errors.forEach((error: string) => {
          const errorKey = error.split(':')[0];
          errorTypes.set(errorKey, (errorTypes.get(errorKey) || 0) + 1);
        });
      });

      errorTypes.forEach((count, type) => {
        console.log(`  - ${type}: ${count} occurrences`);
      });
    }

    // Save successful results to database
    console.log('\n💾 Saving to database...');
    let savedCount = 0;
    let skipCount = 0;

    for (const result of successful) {
      if (result.data.articleNumber) {
        try {
          // Check if already exists
          const existing = await prisma.product.findFirst({
            where: { articleNumber: result.data.articleNumber }
          });

          if (!existing) {
            const ocrResult = {
              screenshotId: result.articleNumber,
              ocrResultId: `test-${Date.now()}-${result.articleNumber}`,
              extractedData: result.data,
              confidence: 0.85,
              success: true,
              productUrl: `https://shop.firmenich.de/product/${result.data.articleNumber}`
            };

            await ProductService.processOcrResultsFromAutomation([ocrResult], largestJob.id);
            savedCount++;
          } else {
            skipCount++;
          }
        } catch (error) {
          console.log(`  ⚠️ Failed to save ${result.data.articleNumber}`);
        }
      }
    }

    console.log(`  ✅ Saved: ${savedCount} new articles`);
    console.log(`  ⏭️ Skipped: ${skipCount} (already exist)`);

    // Final statistics
    const stats = robustOCRService.getStats();
    const finalCount = await prisma.product.count();

    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL STATISTICS:\n');
    console.log(`📊 OCR Performance:`);
    console.log(`  - Processed: ${stats.processed}`);
    console.log(`  - Failed: ${stats.failed}`);
    console.log(`  - Success Rate: ${stats.successRate}`);
    console.log(`\n📈 Database Status:`);
    console.log(`  - Total Articles: ${finalCount}`);
    console.log(`  - New Articles Added: ${savedCount}`);

    console.log('\n✅ SCALABILITY TEST COMPLETE!');
    console.log(`The system can handle ${validArticles.length} articles with ${stats.successRate} success rate`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await robustOCRService.shutdown();
    await prisma.$disconnect();
  }
}

// Run the test
testScalableOCR();