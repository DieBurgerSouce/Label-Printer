const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addColumn() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS "priceType" TEXT DEFAULT 'normal';
    `);
    console.log('✅ priceType column added successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addColumn();
