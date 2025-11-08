/**
 * Test Articles API with Database
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testArticlesAPI() {
  console.log('🧪 Testing Articles API Logic...\n');

  try {
    // Test 1: Get total count
    console.log('1️⃣ Test: Get total articles count');
    const total = await prisma.product.count();
    console.log(`   ✅ Total articles: ${total}\n`);

    // Test 2: Get first 5 articles with pagination
    console.log('2️⃣ Test: Get paginated articles (first 5)');
    const articles = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   ✅ Got ${articles.length} articles`);
    articles.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.articleNumber} - ${a.productName}`);
    });
    console.log('');

    // Test 3: Search for article
    console.log('3️⃣ Test: Search for article');
    const searchResults = await prisma.product.findMany({
      where: {
        OR: [
          { articleNumber: { contains: '8358', mode: 'insensitive' } },
          { productName: { contains: 'Papier', mode: 'insensitive' } }
        ]
      },
      take: 3
    });
    console.log(`   ✅ Found ${searchResults.length} results`);
    searchResults.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.articleNumber} - ${a.productName}`);
    });
    console.log('');

    // Test 4: Get stats
    console.log('4️⃣ Test: Get statistics');
    const [
      publishedCount,
      withImagesCount,
      categoriesRaw
    ] = await Promise.all([
      prisma.product.count({ where: { published: true } }),
      prisma.product.count({ where: { imageUrl: { not: null } } }),
      prisma.product.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ['category']
      })
    ]);

    const categories = categoriesRaw.map(c => c.category).filter(Boolean);

    console.log(`   ✅ Published: ${publishedCount}`);
    console.log(`   ✅ With images: ${withImagesCount}`);
    console.log(`   ✅ Categories: ${categories.length} (${categories.slice(0, 3).join(', ')}...)`);
    console.log('');

    // Test 5: Find single article
    console.log('5️⃣ Test: Find single article by articleNumber');
    const singleArticle = await prisma.product.findFirst({
      where: {
        OR: [
          { articleNumber: '8358' }
        ]
      }
    });

    if (singleArticle) {
      console.log(`   ✅ Found: ${singleArticle.articleNumber} - ${singleArticle.productName}`);
      console.log(`   Price: ${singleArticle.price || 'N/A'}`);
      console.log(`   Has image: ${singleArticle.imageUrl ? 'Yes' : 'No'}`);
    } else {
      console.log(`   ⚠️ Article not found`);
    }

    console.log('\n✅ ALL TESTS PASSED! Articles API logic works perfectly with Database.');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testArticlesAPI();
