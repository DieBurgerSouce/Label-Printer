/**
 * Delete ALL products from database
 * Use this to clean up before a fresh crawl
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllProducts() {
  console.log('\n🗑️  Deleting ALL products from database...\n');

  try {
    const result = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${result.count} products`);

    // Also delete labels since they reference products
    const labelResult = await prisma.label.deleteMany({});
    console.log(`✅ Deleted ${labelResult.count} labels`);

    console.log('\n✅ Database cleaned successfully\n');
  } catch (error) {
    console.error('❌ Error deleting products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllProducts()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
