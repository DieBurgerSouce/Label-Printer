const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const count = await prisma.product.count();
  console.log('\n✅ PostgreSQL Articles:', count);
  await prisma.$disconnect();
})();
