/**
 * DELETE ALL PRODUCTS - Use with caution!
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllProducts() {
  console.log('⚠️  WARNING: Deleting ALL products from database!\n');

  const count = await prisma.product.count();
  console.log(`Found ${count} products to delete\n`);

  console.log('🗑️  Deleting...');
  const result = await prisma.product.deleteMany({});

  console.log(`✅ Deleted ${result.count} products\n`);

  await prisma.$disconnect();
}

deleteAllProducts()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
