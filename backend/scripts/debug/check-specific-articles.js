const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkArticles() {
  const articleNumbers = ['4631', '8358', '7034', '8116'];

  console.log('\n🔍 Checking articles with different tier counts:\n');

  for (const articleNumber of articleNumbers) {
    const article = await prisma.product.findUnique({
      where: { articleNumber },
      select: {
        articleNumber: true,
        productName: true,
        tieredPrices: true,
        tieredPricesText: true
      }
    });

    if (article) {
      console.log(`📦 Article #${article.articleNumber}: ${article.productName}`);
      console.log(`   Tiers: ${article.tieredPrices ? article.tieredPrices.length : 0}`);
      console.log(`   Data: ${JSON.stringify(article.tieredPrices, null, 2)}`);
      console.log(`   OCR Text:`);
      console.log(`   ${article.tieredPricesText}`);
      console.log('');
    }
  }

  await prisma.$disconnect();
}

checkArticles().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
