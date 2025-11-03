/**
 * Quick test for single product crawl with variants
 */
const axios = require('axios');

async function testSingleProduct() {
  console.log('🧪 TESTING SINGLE PRODUCT CRAWL WITH VARIANTS');
  console.log('===========================================\n');

  try {
    // Test with article 1313 (has Fruitmax/OMNI variants)
    const testUrl = 'https://shop.firmenich.de/Holzschliff/Beerenobstschalen-500-g-Holzschliff-OMNI-Fruitmax';

    console.log(`Testing URL: ${testUrl}`);
    console.log('Expected: Should find Fruitmax and OMNI variants\n');

    // Start crawl job
    const response = await axios.post('http://localhost:3001/api/crawler/start', {
      shopUrl: testUrl,  // API expects shopUrl, not urls
      config: {
        captureSelectors: true,
        headless: true,
        scrollDelay: 1500,
        pageLoadDelay: 2000,
        enableVariantDetection: true,
        maxProducts: 1  // Only crawl this one product
      }
    });

    const jobId = response.data.data?.jobId || response.data.id;
    console.log(`✅ Job started: ${jobId}`);

    // Poll for completion
    let attempts = 0;
    while (attempts < 30) { // Max 2.5 minutes
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await axios.get(`http://localhost:3001/api/crawler/jobs/${jobId}`);
      const job = statusResponse.data.data || statusResponse.data;

      console.log(`Status: ${job.status} | Products: ${job.results?.productsFound || 0}`);

      if (job.status === 'completed') {
        console.log('\n✅ SUCCESS! Job completed');
        console.log('Results:', JSON.stringify(job.results, null, 2));

        // Check if variants were detected
        if (job.results?.variantsFound) {
          console.log(`\n🎉 VARIANTS DETECTED: ${job.results.variantsFound}`);
        } else {
          console.log('\n⚠️ WARNING: No variants detected');
        }

        return job;
      } else if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error}`);
      }

      attempts++;
    }

    throw new Error('Job timeout after 2.5 minutes');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.response?.data) {
      console.error('Server response:', error.response.data);
    }

    process.exit(1);
  }
}

// Run test
testSingleProduct()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });