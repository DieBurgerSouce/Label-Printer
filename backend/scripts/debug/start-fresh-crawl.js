/**
 * Start a fresh crawl job for 50 products
 */

async function startCrawl() {
  console.log('🚀 Starting fresh crawl for 50 products...\n');

  const response = await fetch('http://localhost:3001/api/automation/start-simple', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Fresh Crawl - Test Preview Fix',
      shopUrl: 'https://www.firmenich-shop.com/shop/Kueche-und-Gastronomie/',
      templateId: 'normal-price-auto-match',
      maxProducts: 50,
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Crawl job started!');
    console.log(`   Job ID: ${result.jobId || result.job?.id || 'unknown'}`);
    console.log(`   Result:`, JSON.stringify(result, null, 2));
    console.log('\n🔍 Monitor progress in frontend');
  } else {
    console.error('❌ Failed to start crawl:', result.error);
    process.exit(1);
  }
}

startCrawl().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
