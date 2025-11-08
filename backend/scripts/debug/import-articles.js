const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function importArticles() {
  console.log('📥 Importing articles from export...\n');

  // Read export file
  const exportData = JSON.parse(fs.readFileSync('/app/data/articles-export.json', 'utf-8'));
  const articles = exportData.articles || [];

  console.log(`📦 Found ${articles.length} articles to import\n`);

  let imported = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      await prisma.product.create({
        data: {
          articleNumber: article.articleNumber,
          productName: article.productName,
          description: article.description,
          price: article.price,
          tieredPrices: article.tieredPrices,
          tieredPricesText: article.tieredPricesText,
          currency: article.currency || 'EUR',
          imageUrl: article.imageUrl,
          thumbnailUrl: article.thumbnailUrl,
          sourceUrl: article.sourceUrl,
          ocrConfidence: article.ocrConfidence,
          verified: article.verified || false,
          published: article.published !== false,
        },
      });
      imported++;
      console.log(`   ✅ #${article.articleNumber}: ${article.productName}`);
    } catch (error) {
      skipped++;
      console.log(`   ⚠️  Skipped #${article.articleNumber}: ${error.message}`);
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);

  await prisma.$disconnect();
}

importArticles().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
