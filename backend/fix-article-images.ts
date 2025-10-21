/**
 * Script to fix image URLs in the database for all articles
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function fixArticleImages() {
  try {
    console.log('🔄 Fixing article image URLs...\n');

    // Get all articles
    const articles = await prisma.product.findMany();
    console.log(`Found ${articles.length} articles to check`);

    let updatedCount = 0;

    for (const article of articles) {
      // Skip if no crawlJobId
      if (!article.crawlJobId || !article.articleNumber) {
        console.log(`⚠️ Skipping article ${article.id} - missing crawlJobId or articleNumber`);
        continue;
      }

      // Build the expected paths
      const screenshotDir = path.join(
        process.cwd(),
        'data/screenshots',
        article.crawlJobId,
        article.articleNumber
      );

      // Check if directory exists
      if (!fs.existsSync(screenshotDir)) {
        console.log(`⚠️ No screenshots for article ${article.articleNumber} (job: ${article.crawlJobId})`);
        continue;
      }

      // Build URLs for images
      const imageUrl = `/api/images/screenshots/${article.crawlJobId}/${article.articleNumber}/product-image.png`;
      const thumbnailUrl = `/api/images/screenshots/${article.crawlJobId}/${article.articleNumber}/article-number.png`;

      // Check if actual files exist
      const productImageExists = fs.existsSync(path.join(screenshotDir, 'product-image.png'));
      const thumbnailExists = fs.existsSync(path.join(screenshotDir, 'article-number.png'));

      // Update database with correct URLs
      const updates: any = {};

      if (productImageExists) {
        updates.imageUrl = imageUrl;
      }

      if (thumbnailExists) {
        updates.thumbnailUrl = thumbnailUrl;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.product.update({
          where: { id: article.id },
          data: updates
        });
        updatedCount++;
        console.log(`✅ Updated article ${article.articleNumber} with image URLs`);
      }
    }

    console.log(`\n✅ Fixed ${updatedCount} articles with image URLs`);
  } catch (error) {
    console.error('❌ Error fixing article images:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixArticleImages();