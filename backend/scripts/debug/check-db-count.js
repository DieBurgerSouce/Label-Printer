const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.product.count();
  console.log('📊 Products in database:', count);
  await prisma.$disconnect();
}

check();
