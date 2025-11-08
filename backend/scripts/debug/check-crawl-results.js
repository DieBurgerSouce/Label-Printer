const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n📊 Checking crawl results...\n');

  const count = await prisma.product.count();
  console.log(`✅ Total products in DB: ${count}\n`);

  const products = await prisma.product.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  console.log('📦 Sample products:\n');

  products.forEach(prod => {
    const tiers = JSON.parse(prod.tieredPrices || '[]');
    console.log(`#${prod.articleNumber}: ${prod.productName}`);
    console.log(`  Price: ${prod.price} ${prod.currency}`);
    console.log(`  Tiered Prices: ${tiers.length} tiers`);
    if (tiers.length > 0) {
      tiers.forEach(t => console.log(`    - Qty ${t.quantity}: ${t.price}€`));
    }
    console.log('');
  });

  await prisma.$disconnect();
}

check();
