// Quick script to delete all products from database
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clearProducts() {
  try {
    const result = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${result.count} products from database`);
  } catch (error) {
    console.error('❌ Error clearing products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearProducts();
