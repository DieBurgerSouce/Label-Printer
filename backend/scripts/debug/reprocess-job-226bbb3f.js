/**
 * Re-process Job 226bbb3f (c1ebc5c1) - Create products from existing html-data.json files
 *
 * This script reads all html-data.json files and creates products in the database
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CRAWL_JOB_ID = 'c1ebc5c1-fd0f-4815-8567-16735dd18e8d';
const SCREENSHOTS_DIR = path.join(__dirname, 'data', 'screenshots', CRAWL_JOB_ID);

async function reprocessJob() {
  console.log(`\n🔄 Re-processing Job 226bbb3f (crawlJobId: ${CRAWL_JOB_ID})`);
  console.log(`📂 Screenshots dir: ${SCREENSHOTS_DIR}\n`);

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.error(`❌ Screenshots directory not found: ${SCREENSHOTS_DIR}`);
    return;
  }

  // Find all html-data.json files
  const articleDirs = fs.readdirSync(SCREENSHOTS_DIR).filter(dir => {
    const fullPath = path.join(SCREENSHOTS_DIR, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(`📊 Found ${articleDirs.length} article directories\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const articleDir of articleDirs) {
    const htmlDataPath = path.join(SCREENSHOTS_DIR, articleDir, 'html-data.json');

    if (!fs.existsSync(htmlDataPath)) {
      console.log(`⏭️  No html-data.json in ${articleDir}`);
      skipped++;
      continue;
    }

    try {
      // Load HTML data
      const htmlData = JSON.parse(fs.readFileSync(htmlDataPath, 'utf-8'));

      if (!htmlData.articleNumber) {
        console.log(`⚠️  No articleNumber in ${articleDir}`);
        skipped++;
        continue;
      }

      // Prepare product data
      const productData = {
        articleNumber: htmlData.articleNumber,
        productName: htmlData.productName || `Product ${htmlData.articleNumber}`,
        description: htmlData.description?.substring(0, 500) || null,
        price: htmlData.price !== undefined && htmlData.price !== null ? htmlData.price : null,
        priceType: htmlData.priceType || 'normal',
        tieredPrices: htmlData.tieredPrices || [],
        tieredPricesText: htmlData.tieredPricesText || null,
        imageUrl: htmlData.imageUrl || null,
        sourceUrl: '', // Empty string for reprocessed products
        crawlJobId: CRAWL_JOB_ID,
        ocrConfidence: 1.0, // HTML extraction has 100% confidence
        verified: false,
        published: true
      };

      // Check if product exists
      const existing = await prisma.product.findUnique({
        where: { articleNumber: htmlData.articleNumber }
      });

      if (existing) {
        // Update existing
        await prisma.product.update({
          where: { id: existing.id },
          data: productData
        });
        console.log(`✅ Updated: ${htmlData.articleNumber} - ${htmlData.productName}`);
        updated++;
      } else {
        // Create new
        await prisma.product.create({
          data: productData
        });
        console.log(`✨ Created: ${htmlData.articleNumber} - ${htmlData.productName}`);
        created++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${articleDir}:`);
      console.error(error); // Full error object
      errors++;
    }
  }

  console.log(`\n📊 REPROCESSING COMPLETE:`);
  console.log(`   ✨ Created: ${created}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Total processed: ${created + updated}\n`);

  await prisma.$disconnect();
}

reprocessJob().catch(console.error);
