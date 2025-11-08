const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function fixImagePaths() {
  try {
    console.log('🔍 Finding available crawlJobIds...\n');
    
    const screenshotsDir = path.join(__dirname, 'data', 'screenshots');
    const crawlJobIds = fs.readdirSync(screenshotsDir);
    
    console.log(`Found ${crawlJobIds.length} crawlJobIds:`);
    crawlJobIds.forEach(id => console.log(`  - ${id}`));
    
    console.log('\n🔧 Fixing image paths...\n');
    
    let fixed = 0;
    let notFound = 0;
    
    const articles = await prisma.product.findMany({
      where: {
        imageUrl: { not: null }
      }
    });
    
    console.log(`Processing ${articles.length} articles with images...\n`);
    
    for (const article of articles) {
      let foundPath = null;
      
      // Try to find the article in any crawlJobId folder
      for (const crawlJobId of crawlJobIds) {
        const testPath = path.join(screenshotsDir, crawlJobId, article.articleNumber);
        if (fs.existsSync(testPath)) {
          foundPath = crawlJobId;
          break;
        }
      }
      
      if (foundPath) {
        await prisma.product.update({
          where: { id: article.id },
          data: {
            imageUrl: `/api/images/screenshots/${foundPath}/${article.articleNumber}/product-image.png`,
            thumbnailUrl: `/api/images/screenshots/${foundPath}/${article.articleNumber}/article-number.png`,
            crawlJobId: foundPath
          }
        });
        fixed++;
        
        if (fixed % 100 === 0) {
          console.log(`  Fixed ${fixed} articles...`);
        }
      } else {
        notFound++;
      }
    }
    
    console.log(`\n✅ Image path fix complete!`);
    console.log(`   - Fixed: ${fixed}`);
    console.log(`   - Not found: ${notFound}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixImagePaths();
