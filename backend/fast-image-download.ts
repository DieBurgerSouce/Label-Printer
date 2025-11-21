/**
 * Fast Image Download - No Puppeteer!
 * Uses simple fetch + HTML parsing with cheerio
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { ImageDownloadService } from './src/services/image-download-service';

const prisma = new PrismaClient();

async function extractImageUrlFromHTML(html: string): string | null {
  const $ = cheerio.load(html);

  // Try different selectors
  const selectors = [
    '.product-detail-media img',
    '.gallery-slider-item img',
    '[itemprop="image"]',
    '.product-image img',
    'img.product-image'
  ];

  for (const selector of selectors) {
    const src = $(selector).first().attr('src');
    if (src) {
      // Make absolute URL if needed
      if (src.startsWith('//')) {
        return 'https:' + src;
      } else if (src.startsWith('/')) {
        return 'https://shop.firmenich.de' + src;
      } else if (src.startsWith('http')) {
        return src;
      }
    }
  }

  return null;
}

async function main() {
  console.log('\n🚀 Fast Image Download - Starting...\n');

  // Get all articles (TESTING: Only 10 for now)
  const articles = await prisma.product.findMany({
    select: {
      id: true,
      articleNumber: true,
      productName: true,
      imageUrl: true
    },
    orderBy: {
      articleNumber: 'asc'
    },
    take: 10 // TEST: Only first 10 articles
  });

  console.log(`📊 Found ${articles.length} articles\n`);

  const imageDownloadService = new ImageDownloadService();

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const url = `https://shop.firmenich.de/artikel/${article.articleNumber}`;

    console.log(`\n[${i + 1}/${articles.length}] ${article.articleNumber} - ${article.productName.substring(0, 50)}`);

    try {
      // 1. Fetch HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      if (!response.ok) {
        console.log(`   ⚠️  HTTP ${response.status}`);
        failCount++;
        continue;
      }

      const html = await response.text();

      // 2. Extract image URL
      const imageUrl = extractImageUrlFromHTML(html);

      if (!imageUrl) {
        console.log(`   ⚠️  No image found`);
        failCount++;
        continue;
      }

      console.log(`   📷 ${imageUrl.substring(0, 60)}...`);

      // 3. Download image
      const localUrl = await imageDownloadService.downloadImage(imageUrl, article.articleNumber);

      if (!localUrl) {
        console.log(`   ❌ Download failed`);
        failCount++;
        continue;
      }

      // 4. Update database
      await prisma.product.update({
        where: { id: article.id },
        data: { imageUrl: localUrl }
      });

      console.log(`   ✅ ${localUrl}`);
      successCount++;

    } catch (error: any) {
      console.log(`   ❌ ${error.message}`);
      failCount++;
    }

    // Progress summary every 50 articles
    if ((i + 1) % 50 === 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📊 Progress: ${i + 1}/${articles.length}`);
      console.log(`   ✅ Success: ${successCount}`);
      console.log(`   ❌ Failed: ${failCount}`);
      console.log(`   Success rate: ${Math.round((successCount / (i + 1)) * 100)}%`);
      console.log('='.repeat(70));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Fast Image Download Complete!\n');
  console.log(`📊 Final Results:`);
  console.log(`   Total articles: ${articles.length}`);
  console.log(`   ✅ Successfully downloaded: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Success rate: ${Math.round((successCount / articles.length) * 100)}%`);
  console.log('\n' + '='.repeat(70) + '\n');
}

main()
  .catch(error => {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
