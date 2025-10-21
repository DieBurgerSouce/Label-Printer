/**
 * Script to update existing products with their image URLs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateProductImages() {
  try {
    console.log('🔄 Updating product image URLs...\n');

    // Get all products
    const products = await prisma.product.findMany();
    console.log(`Found ${products.length} products to update\n`);

    let updated = 0;

    for (const product of products) {
      if (product.crawlJobId && product.articleNumber) {
        const imageUrl = `/api/images/screenshots/${product.crawlJobId}/${product.articleNumber}/product-image.png`;
        const thumbnailUrl = `/api/images/screenshots/${product.crawlJobId}/${product.articleNumber}/article-number.png`;

        await prisma.product.update({
          where: { id: product.id },
          data: {
            imageUrl,
            thumbnailUrl
          }
        });

        console.log(`✅ Updated ${product.articleNumber} - ${product.productName}`);
        updated++;
      } else {
        console.log(`⏭️  Skipped ${product.articleNumber} - No crawlJobId`);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} products!`);
  } catch (error) {
    console.error('❌ Error updating products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateProductImages();