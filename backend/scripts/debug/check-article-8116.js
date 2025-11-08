const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.product.findUnique({
  where: { articleNumber: '8116' },
  select: {
    articleNumber: true,
    productName: true,
    tieredPrices: true,
    tieredPricesText: true
  }
}).then(article => {
  console.log('\n✅ Article #8116:');
  console.log('   Name:', article.productName);
  console.log('   Tiered Prices:', JSON.stringify(article.tieredPrices, null, 2));
  console.log('   Count:', article.tieredPrices.length, 'tiers\n');
  return prisma.$disconnect();
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
