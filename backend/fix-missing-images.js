const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

/**
 * Fix missing imageUrl for products by scanning screenshot directories
 */
async function fixMissingImages() {
  try {
    console.log('🔍 Finding products without images...');

    // Get all products without imageUrl
    const productsWithoutImages = await prisma.product.findMany({
      where: {
        imageUrl: null
      },
      select: {
        id: true,
        articleNumber: true,
        productName: true
      }
    });

    console.log(`📊 Found ${productsWithoutImages.length} products without images\n`);

    if (productsWithoutImages.length === 0) {
      console.log('✅ All products already have images!');
      return;
    }

    // Get all screenshot directories
    const screenshotsBase = path.join(__dirname, 'data', 'screenshots');

    if (!fs.existsSync(screenshotsBase)) {
      console.error(`❌ Screenshots directory not found: ${screenshotsBase}`);
      return;
    }

    const crawlJobIds = fs.readdirSync(screenshotsBase).filter(item => {
      const itemPath = path.join(screenshotsBase, item);
      return fs.statSync(itemPath).isDirectory();
    });

    console.log(`📂 Found ${crawlJobIds.length} crawl job directories\n`);

    let updated = 0;
    let notFound = 0;

    // For each product, search in all crawl job directories
    for (const product of productsWithoutImages) {
      let foundImage = false;

      for (const crawlJobId of crawlJobIds) {
        const articleDir = path.join(screenshotsBase, crawlJobId, product.articleNumber);
        const productImagePath = path.join(articleDir, 'product-image.png');
        const articleNumberImagePath = path.join(articleDir, 'article-number.png');

        // Check if product-image.png exists
        if (fs.existsSync(productImagePath)) {
          // Update product with imageUrl and crawlJobId
          await prisma.product.update({
            where: { id: product.id },
            data: {
              imageUrl: `/api/images/screenshots/${crawlJobId}/${product.articleNumber}/product-image.png`,
              thumbnailUrl: fs.existsSync(articleNumberImagePath)
                ? `/api/images/screenshots/${crawlJobId}/${product.articleNumber}/article-number.png`
                : null,
              crawlJobId: crawlJobId
            }
          });

          console.log(`✅ ${product.articleNumber}: ${product.productName.substring(0, 50)}...`);
          updated++;
          foundImage = true;
          break; // Found image, no need to check other crawl jobs
        }
      }

      if (!foundImage) {
        console.log(`⚠️  ${product.articleNumber}: No screenshot found`);
        notFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated} products`);
    console.log(`   ⚠️  Not found: ${notFound} products`);
    console.log(`   📁 Total crawl jobs scanned: ${crawlJobIds.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingImages();
