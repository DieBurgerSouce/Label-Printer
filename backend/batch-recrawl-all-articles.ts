/**
 * Batch Re-Crawl ALL Articles
 * Crawls all articles from the database and downloads their images
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_URL = 'http://backend:3001'; // Internal Docker network URL
const BATCH_SIZE = 10; // Process 10 articles at a time
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds between batches

async function main() {
  console.log('\n🚀 Batch Re-Crawl - Starting...\n');

  // Get all articles
  const articles = await prisma.product.findMany({
    select: {
      articleNumber: true,
      productName: true,
      imageUrl: true
    },
    orderBy: {
      articleNumber: 'asc'
    }
  });

  console.log(`📊 Found ${articles.length} articles in database\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  // Process in batches
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 Batch ${batchNumber}/${totalBatches} (Articles ${i + 1}-${Math.min(i + BATCH_SIZE, articles.length)})`);
    console.log('='.repeat(70));

    // Process articles in parallel within batch
    const promises = batch.map(async (article, batchIndex) => {
      const globalIndex = i + batchIndex + 1;
      const url = `https://shop.firmenich.de/artikel/${article.articleNumber}`;

      console.log(`\n[${globalIndex}/${articles.length}] ${article.articleNumber} - ${article.productName}`);
      console.log(`   URL: ${url}`);

      try {
        // Start crawl job
        const response = await fetch(`${API_URL}/api/automation/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopUrl: url,
            templateId: 'firmenich-standard',
            config: {
              mode: 'single-product',
              maxProducts: 1,
              useHtmlExtraction: true,
              skipScreenshots: false
            }
          })
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const job = await response.json();
        console.log(`   ✅ Job started: ${job.jobId}`);

        // Wait for completion (max 60 seconds)
        let complete = false;
        let attempts = 0;
        const maxAttempts = 60;

        while (!complete && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;

          const statusRes = await fetch(`${API_URL}/api/automation/jobs/${job.jobId}`);
          const status = await statusRes.json();

          if (status.status === 'completed') {
            complete = true;
            successCount++;
            console.log(`   ✅ Completed in ${attempts}s`);
            return { success: true, article };
          } else if (status.status === 'failed') {
            complete = true;
            failCount++;
            console.log(`   ❌ Failed: ${status.error || 'Unknown error'}`);
            return { success: false, article, error: status.error };
          }
        }

        if (!complete) {
          failCount++;
          console.log(`   ⏱️  Timeout after ${maxAttempts}s`);
          return { success: false, article, error: 'Timeout' };
        }

      } catch (error: any) {
        failCount++;
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, article, error: error.message };
      }
    });

    // Wait for batch to complete
    await Promise.all(promises);

    // Progress summary
    console.log(`\n📊 Progress after batch ${batchNumber}:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📈 Total processed: ${Math.min(i + BATCH_SIZE, articles.length)}/${articles.length}`);

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < articles.length) {
      console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Batch Re-Crawl Complete!\n');
  console.log(`📊 Final Results:`);
  console.log(`   Total articles: ${articles.length}`);
  console.log(`   ✅ Successfully crawled: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Success rate: ${Math.round((successCount / articles.length) * 100)}%`);
  console.log('\n' + '='.repeat(70) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
