/**
 * Script to reprocess failed articles from existing screenshots
 */

import { PrismaClient } from '@prisma/client';
import { ocrService } from './src/services/ocr-service.js';
import { ProductService } from './src/services/product-service.js';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function reprocessFailedArticles() {
  try {
    console.log('🔄 Reprocessing failed articles...\n');

    // Get the latest job ID with screenshots
    const jobId = '20bf7884-1923-410b-b1bc-0af1c7959583'; // Your latest job
    const screenshotDir = path.join(process.cwd(), 'data/screenshots', jobId);

    // Get all article directories
    const articleDirs = await fs.readdir(screenshotDir);
    console.log(`Found ${articleDirs.length} article directories`);

    // Get existing articles
    const existingArticles = await prisma.product.findMany({
      select: { articleNumber: true }
    });

    const existingNumbers = new Set(existingArticles.map(a => a.articleNumber));
    console.log(`${existingNumbers.size} articles already in database`);

    // Find missing articles
    const missingArticles = articleDirs.filter(articleNum => !existingNumbers.has(articleNum));
    console.log(`\n📋 Missing articles to process: ${missingArticles.length}`);
    console.log('Articles:', missingArticles.join(', '));

    // Initialize OCR service
    console.log('\n🔍 Initializing OCR Service...');
    await ocrService.initialize();

    let processed = 0;
    let failed = 0;

    // Process each missing article
    for (const articleNumber of missingArticles) {
      console.log(`\n📸 Processing article: ${articleNumber}`);

      try {
        // Check if screenshots exist
        const articlePath = path.join(screenshotDir, articleNumber);
        const files = await fs.readdir(articlePath);
        console.log(`  Found ${files.length} screenshots`);

        // Process with OCR
        const ocrResult = await ocrService.processElementScreenshots(
          screenshotDir,
          articleNumber,
          jobId
        );

        if (ocrResult.status === 'completed' && ocrResult.extractedData.articleNumber) {
          console.log(`  ✅ OCR successful: ${JSON.stringify(ocrResult.extractedData.articleNumber)}`);

          // Save to database
          const results = await ProductService.processOcrResultsFromAutomation(
            [{
              screenshotId: ocrResult.screenshotId,
              ocrResultId: ocrResult.id,
              extractedData: ocrResult.extractedData,
              confidence: ocrResult.confidence.overall,
              success: true,
              productUrl: `https://shop.firmenich.de/product/${articleNumber}`
            }],
            jobId
          );

          console.log(`  ✅ Saved to database: ${results.created} created`);
          processed++;
        } else {
          console.log(`  ❌ OCR failed or no article number extracted`);
          failed++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${articleNumber}:`, error);
        failed++;
      }
    }

    console.log('\n📊 REPROCESSING COMPLETE:');
    console.log(`  ✅ Processed: ${processed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📈 Total in DB now: ${existingNumbers.size + processed}`);

  } catch (error) {
    console.error('❌ Reprocessing failed:', error);
  } finally {
    await ocrService.shutdown();
    await prisma.$disconnect();
  }
}

// Run the script
reprocessFailedArticles();