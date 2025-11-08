/**
 * Start a clean crawl with the FIXED code
 * This will crawl all articles and verify URL handling works correctly
 */

const fs = require('fs').promises;
const path = require('path');

async function startCleanCrawl() {
  console.log('\n🚀 Starting CLEAN crawl with FIXED code\n');
  console.log('='.repeat(70));

  try {
    // Read the articles export file
    const articlesData = JSON.parse(
      await fs.readFile(path.join(__dirname, '..', 'data', 'articles-export.json'), 'utf-8')
    );

    const articleNumbers = articlesData.articles.map(a => a.articleNumber);
    console.log(`📋 Found ${articleNumbers.length} articles to crawl`);
    console.log(`   First 10: ${articleNumbers.slice(0, 10).join(', ')}...`);

    // Call the API to start crawl
    const response = await fetch('http://localhost:5000/api/automation/crawl-and-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        articleNumbers: articleNumbers,
        config: {
          useRobustOCR: true,
          ocrMode: 'element' // Use HTML extraction
        }
      })
    });

    const result = await response.json();
    console.log('\n✅ Crawl started!');
    console.log(`   Job ID: ${result.jobId}`);
    console.log('='.repeat(70));
    console.log('\n📊 Monitor progress with:');
    console.log(`   docker exec screenshot-algo-backend node monitor-crawl.js`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error starting crawl:', error);
    throw error;
  }
}

startCleanCrawl()
  .then(() => {
    console.log('✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
