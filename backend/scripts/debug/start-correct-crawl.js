/**
 * Start crawl with CORRECT URL
 */

async function startCorrectCrawl() {
  console.log('\n🚀 Starting crawl with CORRECT URL and HTML Fix...\n');

  const response = await fetch('http://localhost:3001/api/automation/start-simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'HTML Fix Test - Correct URL',
      shopUrl: 'https://shop.firmenich.de/Erntekoerbe/',
      templateId: 'normal-price-auto-match',
      maxProducts: 50,
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Crawl job started!');
    console.log(`   Job ID: ${result.jobId || result.job?.id || 'unknown'}`);
    console.log(`   Shop URL: https://shop.firmenich.de/Erntekoerbe/`);
    console.log('\n🔍 Monitor progress with:');
    console.log(`   docker exec screenshot-algo-backend curl http://localhost:3001/api/automation/jobs/${result.jobId || result.job?.id}`);
  } else {
    console.error('❌ Failed to start crawl:', result.error);
    process.exit(1);
  }
}

startCorrectCrawl().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
