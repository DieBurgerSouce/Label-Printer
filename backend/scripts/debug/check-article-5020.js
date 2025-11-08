/**
 * Check article #5020
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkArticle() {
  console.log('\n🔍 Checking Article #5020...\n');

  const article = await prisma.product.findFirst({
    where: { articleNumber: '5020' }
  });

  if (!article) {
    console.log('❌ Article #5020 not found in database');
    await prisma.$disconnect();
    return;
  }

  console.log('📦 Article Details:');
  console.log(`   Article Number: ${article.articleNumber}`);
  console.log(`   Product Name: ${article.productName}`);
  console.log(`   Price: ${article.price || 0} ${article.currency}`);
  console.log(`   Source URL: ${article.sourceUrl}`);
  console.log(`\n💰 Tiered Prices:`);

  if (article.tieredPrices && article.tieredPrices.length > 0) {
    console.log(`   Count: ${article.tieredPrices.length}`);
    article.tieredPrices.forEach((tp, i) => {
      console.log(`   ${i + 1}. Quantity: ${tp.quantity}, Price: ${tp.price}`);
    });
  } else {
    console.log('   ❌ No tiered prices found!');
  }

  console.log(`\n📝 Tiered Prices Text (raw OCR):`);
  if (article.tieredPricesText) {
    console.log('---');
    console.log(article.tieredPricesText);
    console.log('---');
  } else {
    console.log('   ❌ No tiered prices text found!');
  }

  console.log(`\n🔎 OCR Confidence: ${article.ocrConfidence || 'N/A'}`);
  console.log(`   Verified: ${article.verified}`);
  console.log(`   Published: ${article.published}\n`);

  await prisma.$disconnect();
}

checkArticle().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
