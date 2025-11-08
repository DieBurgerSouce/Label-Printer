const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkArticles() {
  try {
    const total = await prisma.product.count();
    console.log(`Total articles: ${total}`);
    
    // Check for empty or problematic articles
    const emptyName = await prisma.product.count({
      where: { productName: '' }
    });
    
    const emptyArticleNumber = await prisma.product.count({
      where: { articleNumber: '' }
    });
    
    const noPrice = await prisma.product.count({
      where: { 
        AND: [
          { price: null },
          { tieredPrices: { equals: [] } }
        ]
      }
    });
    
    console.log(`\nProblematic Articles:`);
    console.log(`- Empty productName: ${emptyName}`);
    console.log(`- Empty articleNumber: ${emptyArticleNumber}`);
    console.log(`- No price (neither price nor tieredPrices): ${noPrice}`);
    
    // Get all articles to inspect
    const articles = await prisma.product.findMany({
      select: {
        id: true,
        articleNumber: true,
        productName: true,
        price: true,
        tieredPrices: true,
        imageUrl: true,
        published: true
      },
      take: 50
    });
    
    console.log(`\nFirst 50 Articles:`);
    articles.forEach((a, i) => {
      const hasPrice = a.price !== null || (Array.isArray(a.tieredPrices) && a.tieredPrices.length > 0);
      const hasImage = !!a.imageUrl;
      const status = hasPrice && hasImage && a.productName && a.articleNumber ? '✅' : '❌';
      console.log(`${status} ${i+1}. Article#: ${a.articleNumber || 'EMPTY'} | Name: ${(a.productName || 'EMPTY').substring(0, 40)} | Price: ${a.price || 'NO_PRICE'} | Published: ${a.published}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticles();
