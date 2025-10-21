/**
 * Process ALL screenshots from all jobs to fill missing articles
 */

import { PrismaClient } from '@prisma/client';
import { ocrService } from './src/services/ocr-service.js';
import { ProductService } from './src/services/product-service.js';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function processAllScreenshots() {
  try {
    console.log('🔄 Processing ALL screenshots to find missing articles...\n');

    const screenshotsDir = path.join(process.cwd(), 'data/screenshots');

    // Get all job directories
    const jobDirs = await fs.readdir(screenshotsDir);
    console.log(`Found ${jobDirs.length} job directories`);

    // Get existing articles
    const existingArticles = await prisma.product.findMany({
      select: { articleNumber: true }
    });

    const existingNumbers = new Set(existingArticles.map(a => a.articleNumber));
    console.log(`${existingNumbers.size} articles already in database\n`);

    // Initialize OCR service
    console.log('🔍 Initializing OCR Service...');
    await ocrService.initialize();

    let totalProcessed = 0;
    let totalFailed = 0;
    const allArticles: Map<string, string> = new Map(); // articleNumber -> jobId

    // Scan all jobs for article directories
    for (const jobId of jobDirs) {
      const jobPath = path.join(screenshotsDir, jobId);

      try {
        const stats = await fs.stat(jobPath);
        if (!stats.isDirectory()) continue;

        const articleDirs = await fs.readdir(jobPath);
        console.log(`Job ${jobId.substring(0, 8)}: ${articleDirs.length} articles`);

        for (const articleNum of articleDirs) {
          const articlePath = path.join(jobPath, articleNum);
          const articleStats = await fs.stat(articlePath);

          if (articleStats.isDirectory() && !existingNumbers.has(articleNum)) {
            // Check if we have the required screenshots
            const requiredFiles = ['article-number.png', 'title.png', 'price.png'];
            let hasRequiredFiles = true;

            for (const file of requiredFiles) {
              try {
                await fs.access(path.join(articlePath, file));
              } catch {
                hasRequiredFiles = false;
                break;
              }
            }

            if (hasRequiredFiles && !allArticles.has(articleNum)) {
              allArticles.set(articleNum, jobId);
            }
          }
        }
      } catch (error) {
        console.log(`  Skipping ${jobId}: ${error}`);
      }
    }

    console.log(`\n📋 Found ${allArticles.size} new articles to process`);

    // Process each missing article
    for (const [articleNumber, jobId] of allArticles) {
      console.log(`\n📸 Processing article ${articleNumber} from job ${jobId.substring(0, 8)}`);

      try {
        // Process with OCR
        const screenshotDir = path.join(screenshotsDir, jobId);
        const ocrResult = await ocrService.processElementScreenshots(
          screenshotDir,
          articleNumber,
          jobId
        );

        if (ocrResult.status === 'completed' && ocrResult.extractedData.articleNumber) {
          console.log(`  ✅ OCR successful`);

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

          if (results.created > 0) {
            console.log(`  ✅ Saved to database`);
            totalProcessed++;
          } else {
            console.log(`  ⚠️ Article might already exist or failed to save`);
          }
        } else {
          console.log(`  ❌ OCR failed`);
          totalFailed++;
        }
      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        totalFailed++;
      }
    }

    // Final summary
    const finalCount = await prisma.product.count();

    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL RESULTS:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully processed: ${totalProcessed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📈 Total articles in database: ${finalCount}`);
    console.log(`🎯 Success rate: ${Math.round((totalProcessed / (totalProcessed + totalFailed)) * 100)}%`);

  } catch (error) {
    console.error('❌ Processing failed:', error);
  } finally {
    await ocrService.shutdown();
    await prisma.$disconnect();
  }
}

// Run the script
processAllScreenshots();