/**
 * Batch Image Download Script
 * Downloads images for all existing articles in the database that have remote URLs
 */

import { PrismaClient } from '@prisma/client';
import { ImageDownloadService } from './src/services/image-download-service';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🚀 Batch Image Download - Starting...\n');

  // Get all articles with remote imageUrls (starting with http)
  const articles = await prisma.product.findMany({
    where: {
      imageUrl: {
        startsWith: 'http'
      }
    },
    select: {
      id: true,
      articleNumber: true,
      productName: true,
      imageUrl: true
    },
    orderBy: {
      articleNumber: 'asc'
    }
  });

  console.log(`📊 Found ${articles.length} articles with remote image URLs\n`);

  if (articles.length === 0) {
    console.log('✅ No articles need image download. All done!');
    return;
  }

  const imageDownloadService = new ImageDownloadService();

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const progress = `[${i + 1}/${articles.length}]`;

    console.log(`\n${progress} Processing: ${article.articleNumber} - ${article.productName}`);
    console.log(`   Remote URL: ${article.imageUrl}`);

    try {
      // Download the image
      const localUrl = await imageDownloadService.downloadImage(
        article.imageUrl,
        article.articleNumber
      );

      if (localUrl) {
        // Update database with local URL
        await prisma.product.update({
          where: { id: article.id },
          data: { imageUrl: localUrl }
        });

        successCount++;
        console.log(`   ✅ Downloaded and updated: ${localUrl}`);
      } else {
        failCount++;
        console.log(`   ❌ Download failed (see logs above)`);
      }

    } catch (error: any) {
      failCount++;
      console.error(`   ❌ Error: ${error.message}`);
    }

    // Progress summary every 10 articles
    if ((i + 1) % 10 === 0) {
      console.log(`\n📈 Progress: ${i + 1}/${articles.length} processed`);
      console.log(`   ✅ Success: ${successCount}`);
      console.log(`   ❌ Failed: ${failCount}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Batch Download Complete!\n');
  console.log(`📊 Final Results:`);
  console.log(`   Total articles: ${articles.length}`);
  console.log(`   ✅ Successfully downloaded: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Success rate: ${Math.round((successCount / articles.length) * 100)}%`);
  console.log('\n' + '='.repeat(70) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
