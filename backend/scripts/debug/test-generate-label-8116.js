const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGenerate() {
  // Get article #8116
  const article = await prisma.product.findUnique({
    where: { articleNumber: '8116' }
  });

  if (!article) {
    console.log('❌ Article #8116 not found');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found article #8116 (ID: ${article.id})`);
  console.log(`   Name: ${article.productName}`);
  console.log(`   Tiers: ${article.tieredPrices ? article.tieredPrices.length : 0}`);

  // Call the API
  console.log('\n🔄 Calling label generation API...');
  const response = await fetch('http://localhost:3001/api/labels/generate-from-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId: article.id,
      templateId: null
    })
  });

  const result = await response.json();
  console.log('\n📊 API Response:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success && result.data) {
    console.log(`\n✅ Label generated!`);
    console.log(`   Article: ${result.data.articleNumber}`);
    console.log(`   Staffelpreise: ${result.data.priceInfo.staffelpreise ? result.data.priceInfo.staffelpreise.length : 0} tiers`);
    if (result.data.priceInfo.staffelpreise) {
      result.data.priceInfo.staffelpreise.forEach((tier, i) => {
        console.log(`   Tier ${i+1}: Bis ${tier.quantity} → ${tier.price}€`);
      });
    }
  }

  await prisma.$disconnect();
}

testGenerate().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
