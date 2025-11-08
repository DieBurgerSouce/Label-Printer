/**
 * Check source URLs from articles
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUrls() {
  console.log('\n🔍 Checking source URLs...\n');

  const articles = await prisma.product.findMany({
    select: {
      articleNumber: true,
      productName: true,
      sourceUrl: true
    },
    take: 5
  });

  console.log('📋 Sample URLs:');
  articles.forEach(a => {
    console.log(`   #${a.articleNumber}: ${a.sourceUrl}`);
  });

  // Extract base URL
  if (articles.length > 0) {
    const url = new URL(articles[0].sourceUrl);
    console.log(`\n🏪 Shop Base URL: ${url.origin}`);
  }

  await prisma.$disconnect();
}

checkUrls().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
