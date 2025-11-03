// Script to fix missing OCR for specific articles
const API_URL = 'http://localhost:3001';

async function fixMissingOCR() {
  const missingArticles = ['1339', '8396', '3788'];
  const crawlJobId = '24385feb-1b0b-436d-9426-f35da90e7f7c';

  console.log('🔧 Fixing missing OCR for articles:', missingArticles);

  for (const articleId of missingArticles) {
    console.log(`\n📦 Processing article ${articleId}...`);

    try {
      // Trigger OCR for specific screenshot
      const ocrResponse = await fetch(`${API_URL}/api/ocr/process-screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crawlJobId: crawlJobId,
          screenshotId: articleId,
          screenshotPath: `data/screenshots/${crawlJobId}/${articleId}/product-image.png`
        })
      });

      const ocrResult = await ocrResponse.json();

      if (ocrResult.success) {
        console.log(`✅ OCR successful for ${articleId}`);
        console.log(`   Product: ${ocrResult.data.productName}`);
        console.log(`   Price: ${ocrResult.data.price || 'Auf Anfrage'}`);
      } else {
        console.log(`❌ OCR failed for ${articleId}:`, ocrResult.error);
      }
    } catch (error) {
      console.log(`❌ Error processing ${articleId}:`, error.message);
    }
  }
}

// Check for duplicates
async function analyzeDuplicates() {
  console.log('\n📊 Analyzing duplicates in database...');

  const response = await fetch(`${API_URL}/api/articles`);
  const data = await response.json();

  if (data.success) {
    const articles = data.data;
    const articleNumbers = {};

    // Count occurrences
    articles.forEach(article => {
      const num = article.articleNumber;
      articleNumbers[num] = (articleNumbers[num] || 0) + 1;
    });

    // Find duplicates
    const duplicates = Object.entries(articleNumbers)
      .filter(([num, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (duplicates.length > 0) {
      console.log(`\n⚠️ Found ${duplicates.length} duplicate article numbers:`);
      duplicates.slice(0, 10).forEach(([num, count]) => {
        console.log(`   Article ${num}: ${count} times`);
      });
    } else {
      console.log('✅ No duplicates found in database');
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting OCR fix process...\n');
  await fixMissingOCR();
  await analyzeDuplicates();
  console.log('\n✨ Process complete!');
}

main().catch(console.error);