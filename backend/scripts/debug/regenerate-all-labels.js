/**
 * Regenerate ALL labels for ALL articles
 * This will delete old labels and create new ones with fixed prices
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function regenerateAllLabels() {
  console.log('🔄 Starting label regeneration...\n');

  // Step 1: Get all articles
  const articles = await prisma.product.findMany({
    select: {
      id: true,
      articleNumber: true,
      productName: true,
      price: true,
      tieredPrices: true
    }
  });

  console.log(`📦 Found ${articles.length} articles\n`);

  // Step 2: Delete ALL existing labels
  console.log('🗑️  Deleting old labels...');
  const deletedCount = await prisma.label.deleteMany({});
  console.log(`   Deleted ${deletedCount.count} old labels\n`);

  // Step 3: Generate labels for each article via API
  console.log('🏷️  Generating new labels...\n');

  let successCount = 0;
  let failCount = 0;

  for (const article of articles) {
    try {
      const response = await fetch('http://localhost:3001/api/labels/generate-from-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: article.id,
          // templateId: null - will use auto-match
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        const label = result.data;
        const priceDisplay = label.priceInfo.staffelpreise && label.priceInfo.staffelpreise.length > 0
          ? `${label.priceInfo.staffelpreise.length} tiers`
          : `${label.priceInfo.price} ${label.priceInfo.currency}`;

        console.log(`   ✅ #${article.articleNumber}: ${priceDisplay}`);
        successCount++;
      } else {
        console.log(`   ❌ #${article.articleNumber}: ${result.error}`);
        failCount++;
      }
    } catch (error) {
      console.log(`   ❌ #${article.articleNumber}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n✅ Regeneration complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${articles.length}`);

  await prisma.$disconnect();
}

regenerateAllLabels()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
