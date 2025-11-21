const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('='.repeat(80));
  console.log('DELETE OLD PLACEHOLDER PRODUCTS');
  console.log('='.repeat(80));

  console.log('\nDeleting placeholder products from old job f38f...');

  const deleted = await prisma.product.deleteMany({
    where: {
      articleNumber: { in: ['5020', '7068', '7064', '1435', '5015'] }
    }
  });

  console.log(`✅ Deleted ${deleted.count} placeholder products`);

  await prisma.$disconnect();
})();
