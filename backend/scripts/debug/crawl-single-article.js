/**
 * Crawl a single article to test HTML extraction fix
 */

async function crawlSingle() {
  console.log('\n🚀 Testing HTML Extraction Fix with Article #5020...\n');

  const response = await fetch('http://localhost:3001/api/automation/start-simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test HTML Fix - Article 5020',
      shopUrl: 'https://shop.firmenich.de/Solinger-Messerwelten/Bandstahlputzmesser-gelb-gelb-ohne-Aufdruck',
      templateId: 'tiered-price-auto-match',
      maxProducts: 1,
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Crawl job started!');
    console.log(`   Job ID: ${result.jobId || result.job?.id || 'unknown'}`);
    console.log('\n⏳ Waiting 10 seconds for crawl to complete...\n');

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check job status
    const jobId = result.jobId || result.job?.id;
    const statusResponse = await fetch(`http://localhost:3001/api/automation/jobs/${jobId}`);
    const statusResult = await statusResponse.json();

    console.log('📊 Job Status:', statusResult.job?.status);
    console.log('   Products Found:', statusResult.job?.progress?.productsFound || 0);
    console.log('   Products Processed:', statusResult.job?.progress?.productsProcessed || 0);

  } else {
    console.error('❌ Failed to start crawl:', result.error);
    process.exit(1);
  }
}

crawlSingle().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
