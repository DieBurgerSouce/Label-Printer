const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function cleanAndReimport() {
  try {
    // Step 1: Delete ALL articles
    console.log('🗑️  Step 1: Deleting ALL articles from database...');
    const deleted = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} articles\n`);
    
    // Step 2: Load clean articles from JSON
    console.log('📂 Step 2: Loading articles from data/articles-export-2025-11-02.json...');
    const jsonPath = path.join(__dirname, '../data/articles-export-2025-11-02.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Error: File not found: ${jsonPath}`);
      process.exit(1);
    }
    
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const articles = jsonData.articles || jsonData;
    
    console.log(`✅ Loaded ${articles.length} articles from JSON`);
    if (jsonData.metadata) {
      console.log(`   Metadata: Total ${jsonData.metadata.totalArticles}\n`);
    }
    
    // Step 3: Import clean articles
    console.log('📥 Step 3: Importing clean articles to database...');
    
    let imported = 0;
    let skipped = 0;
    
    for (const article of articles) {
      try {
        if (!article.articleNumber || !article.productName) {
          skipped++;
          continue;
        }
        
        if (article.productName.startsWith('Product ')) {
          skipped++;
          continue;
        }
        
        await prisma.product.create({
          data: {
            articleNumber: article.articleNumber,
            productName: article.productName,
            description: article.description || null,
            price: article.price || null,
            priceType: article.priceType || 'normal',
            tieredPrices: article.tieredPrices || [],
            tieredPricesText: article.tieredPricesText || null,
            currency: article.currency || 'EUR',
            imageUrl: article.imageUrl || null,
            thumbnailUrl: article.thumbnailUrl || null,
            ean: article.ean || null,
            category: article.category || null,
            manufacturer: article.manufacturer || null,
            sourceUrl: article.sourceUrl || '',
            crawlJobId: article.crawlJobId || null,
            ocrConfidence: article.ocrConfidence || 0.8,
            verified: article.verified || false,
            published: article.published !== false
          }
        });
        
        imported++;
        
        if (imported % 100 === 0) {
          console.log(`   Imported ${imported} articles...`);
        }
      } catch (error) {
        console.error(`   Error: ${article.articleNumber}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`\n✅ Import complete!`);
    console.log(`   - Imported: ${imported} articles`);
    console.log(`   - Skipped: ${skipped} articles`);
    
    const total = await prisma.product.count();
    console.log(`\n📊 Total articles in database: ${total}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndReimport();
