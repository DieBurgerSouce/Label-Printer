/**
 * COMPLETE REPROCESS SCRIPT - Job 226bbb3f
 * Imports ALL products with correct data mapping
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const JOB_ID = '226bbb3f-d859-45eb-9d31-2e9832d024f3';
const CRAWL_JOB_ID = 'c1ebc5c1-fd0f-4815-8567-16735dd18e8d';
const SCREENSHOTS_DIR = `/app/data/screenshots/${CRAWL_JOB_ID}`;

async function reprocessComplete() {
  console.log('🚀 COMPLETE REPROCESSING STARTING...');
  console.log(`📂 Job ID: ${JOB_ID}`);
  console.log(`📂 Crawl Job ID: ${CRAWL_JOB_ID}`);

  // Step 1: Get ALL screenshots with URLs from DB
  const screenshots = await prisma.screenshot.findMany({
    where: { crawlJobId: CRAWL_JOB_ID },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`📸 Found ${screenshots.length} screenshots in DB`);

  // Step 2: Map screenshots to article folders
  const articleDirs = fs.readdirSync(SCREENSHOTS_DIR)
    .filter(dir => /^\d+/.test(dir)); // Only numeric folders

  console.log(`📁 Found ${articleDirs.length} article directories`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const articleDir of articleDirs) {
    try {
      const articlePath = path.join(SCREENSHOTS_DIR, articleDir);
      const htmlDataPath = path.join(articlePath, 'html-data.json');

      // Check if HTML data exists
      if (!fs.existsSync(htmlDataPath)) {
        console.log(`⚠️ No html-data.json for ${articleDir}`);
        skipped++;
        continue;
      }

      // Load HTML extracted data
      const htmlData = JSON.parse(fs.readFileSync(htmlDataPath, 'utf8'));

      if (!htmlData.articleNumber) {
        console.log(`⚠️ No article number in html-data for ${articleDir}`);
        skipped++;
        continue;
      }

      // Find matching screenshot(s) for this article
      // Match by checking if productUrl contains the article number
      const matchingScreenshots = screenshots.filter(s => {
        // Multiple matching strategies
        return s.productUrl.includes(articleDir) ||
               s.productUrl.includes(htmlData.productName) ||
               s.productName?.includes(htmlData.productName);
      });

      const sourceUrl = matchingScreenshots[0]?.productUrl || '';
      const imageUrl = matchingScreenshots[0]?.imageUrl || null;

      if (!sourceUrl) {
        console.log(`⚠️ No URL found for ${articleDir} - ${htmlData.productName}`);
      }

      // Determine price based on priceType
      let finalPrice = 0;
      if (htmlData.priceType === 'auf_anfrage') {
        finalPrice = null; // NULL for "auf Anfrage"
      } else if (htmlData.priceType === 'tiered' && htmlData.tieredPrices?.length > 0) {
        // Use first tier price as base price
        finalPrice = htmlData.tieredPrices[0].price;
      } else {
        finalPrice = htmlData.price || 0;
      }

      // Check if product exists
      const existing = await prisma.product.findFirst({
        where: {
          articleNumber: htmlData.articleNumber,
          crawlJobId: CRAWL_JOB_ID
        }
      });

      const productData = {
        articleNumber: htmlData.articleNumber,
        productName: htmlData.productName || 'Unknown Product',
        description: htmlData.description || null,
        price: finalPrice,
        priceType: htmlData.priceType || 'normal',
        tieredPrices: htmlData.tieredPrices || [],
        tieredPricesText: htmlData.tieredPricesText || null,
        imageUrl: imageUrl,
        sourceUrl: sourceUrl,
        crawlJobId: CRAWL_JOB_ID,
        ocrConfidence: htmlData.confidence?.overall || 1.0,
        verified: false,
      };

      if (existing) {
        // Update existing product
        await prisma.product.update({
          where: { id: existing.id },
          data: productData
        });
        console.log(`✅ Updated: ${htmlData.articleNumber} - ${htmlData.productName} (${htmlData.priceType})`);
        updated++;
      } else {
        // Create new product
        await prisma.product.create({
          data: productData
        });
        console.log(`✨ Created: ${htmlData.articleNumber} - ${htmlData.productName} (${htmlData.priceType})`);
        created++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${articleDir}:`, error.message);
      errors++;
    }
  }

  // Step 3: Import products from OCR results that don't have html-data.json
  console.log('\n📋 Checking for additional products in OCR results...');

  const ocrResults = await prisma.ocrResult.findMany({
    where: {
      screenshot: {
        crawlJobId: CRAWL_JOB_ID
      }
    },
    include: {
      screenshot: true
    }
  });

  console.log(`🔍 Found ${ocrResults.length} OCR results in DB`);

  for (const ocr of ocrResults) {
    try {
      if (!ocr.extractedData?.articleNumber) continue;

      // Check if already imported
      const existing = await prisma.product.findFirst({
        where: {
          articleNumber: ocr.extractedData.articleNumber,
          crawlJobId: CRAWL_JOB_ID
        }
      });

      if (existing) continue;

      // Import from OCR
      await prisma.product.create({
        data: {
          articleNumber: ocr.extractedData.articleNumber,
          productName: ocr.extractedData.productName || ocr.screenshot.productName || 'Unknown',
          description: ocr.extractedData.description || null,
          price: ocr.extractedData.price || 0,
          priceType: ocr.extractedData.priceType || 'normal',
          tieredPrices: ocr.extractedData.tieredPrices || [],
          tieredPricesText: ocr.extractedData.tieredPricesText || null,
          imageUrl: ocr.screenshot.imageUrl,
          sourceUrl: ocr.screenshot.productUrl,
          crawlJobId: CRAWL_JOB_ID,
          ocrConfidence: ocr.confidence || 0.5,
          verified: false
        }
      });

      console.log(`🆕 Created from OCR: ${ocr.extractedData.articleNumber}`);
      created++;

    } catch (error) {
      console.error(`❌ Error processing OCR ${ocr.id}:`, error.message);
      errors++;
    }
  }

  // Final stats
  console.log('\n📊 REPROCESSING COMPLETE:');
  console.log(`   ✨ Created: ${created}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Total processed: ${created + updated}`);

  // Verify final count
  const finalCount = await prisma.product.count({
    where: { crawlJobId: CRAWL_JOB_ID }
  });

  const withPrices = await prisma.product.count({
    where: {
      crawlJobId: CRAWL_JOB_ID,
      price: { not: null, gt: 0 }
    }
  });

  const aufAnfrage = await prisma.product.count({
    where: {
      crawlJobId: CRAWL_JOB_ID,
      priceType: 'auf_anfrage'
    }
  });

  const withUrls = await prisma.product.count({
    where: {
      crawlJobId: CRAWL_JOB_ID,
      sourceUrl: { not: '' }
    }
  });

  console.log('\n📈 FINAL DATABASE STATS:');
  console.log(`   📦 Total products: ${finalCount}`);
  console.log(`   💰 With prices: ${withPrices}`);
  console.log(`   📞 Auf Anfrage: ${aufAnfrage}`);
  console.log(`   🔗 With URLs: ${withUrls}`);

  await prisma.$disconnect();
}

reprocessComplete().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});