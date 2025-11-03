/**
 * Test script for variant crawling - Article 1313
 * This tests the new variant detection for Beerenobstschalen with OMNI/Fruitmax variants
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testVariantCrawl() {
  console.log('🧪 TESTING VARIANT CRAWLING FOR ARTICLE 1313');
  console.log('=' . repeat(50));

  const productUrl = 'https://shop.firmenich.de/Holzschliff/Beerenobstschalen-500-g-Holzschliff-OMNI-Fruitmax';

  console.log('\n📍 Target URL:', productUrl);
  console.log('\nExpected variants:');
  console.log('  - 1313 (Base/Stammartikel)');
  console.log('  - 1313-F (Fruitmax)');
  console.log('  - 1313-O (OMNI)');
  console.log('  - 1313-FSH (Fruitmax SH)');
  console.log('  - 1313-OSH (OMNI SH)');
  console.log('  - 1313-I (mit i...)');

  try {
    // Start a crawl job for just this one product
    console.log('\n🚀 Starting crawl job...');
    const crawlResponse = await axios.post(`${API_URL}/crawler/start`, {
      shopUrl: productUrl,
      config: {
        maxProducts: 10,  // Set higher to capture all variants
        fullShopScan: false,
        captureSelectors: true,
        headless: true,  // Must be true in Docker
        scrollDelay: 2000,
        pageLoadDelay: 3000
      }
    });

    console.log('Response:', crawlResponse.data);
    const jobId = crawlResponse.data.data?.jobId || crawlResponse.data.id;
    console.log('✅ Crawl job started:', jobId);

    if (!jobId) {
      throw new Error('No job ID received from server');
    }

    // Poll for job completion
    console.log('\n⏳ Waiting for job to complete...');
    let job = crawlResponse.data.data || crawlResponse.data;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (job.status !== 'completed' && job.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

      const statusResponse = await axios.get(`${API_URL}/crawler/jobs/${jobId}`);
      job = statusResponse.data.data || statusResponse.data;

      console.log(`   Status: ${job.status} | Products found: ${job.results?.productsFound || 0} | Time: ${attempts * 5}s`);
      attempts++;
    }

    if (job.status === 'completed') {
      console.log('\n✅ CRAWL COMPLETED!');
      console.log('=' . repeat(50));

      console.log('\n📊 Results:');
      console.log(`  Total products found: ${job.results.productsFound}`);
      console.log(`  Screenshots captured: ${job.results.screenshots.length}`);
      console.log(`  Duration: ${(job.results.duration / 1000).toFixed(2)}s`);

      // List all captured products/variants
      console.log('\n📦 Captured article numbers:');
      const articleNumbers = new Set();

      for (const screenshot of job.results.screenshots) {
        // Extract article number from the screenshot folder path
        const pathParts = screenshot.path.split(/[\/\\]/);
        const folderName = pathParts[pathParts.length - 2];

        if (folderName && folderName.match(/\d{3,}/)) {
          articleNumbers.add(folderName);
        }
      }

      const sortedNumbers = Array.from(articleNumbers).sort();
      sortedNumbers.forEach(num => {
        console.log(`  - ${num}`);
      });

      // Check if all expected variants were found
      const expectedVariants = ['1313', '1313-F', '1313-O', '1313-FSH', '1313-OSH', '1313-I'];
      const missingVariants = expectedVariants.filter(v => !sortedNumbers.includes(v));

      if (missingVariants.length > 0) {
        console.log('\n⚠️ MISSING VARIANTS:');
        missingVariants.forEach(v => console.log(`  - ${v}`));
      } else {
        console.log('\n🎉 SUCCESS! All expected variants were captured!');
      }

      // Show screenshot details
      console.log('\n📸 Screenshot details:');
      job.results.screenshots.slice(0, 10).forEach(screenshot => {
        console.log(`  ${screenshot.type}: ${screenshot.path}`);
      });

    } else if (job.status === 'failed') {
      console.error('\n❌ CRAWL FAILED!');
      console.error('Error:', job.error);
      if (job.results.errors.length > 0) {
        console.error('\nErrors encountered:');
        job.results.errors.forEach(err => {
          console.error(`  - ${err.timestamp}: ${err.error}`);
        });
      }
    } else {
      console.error('\n⏰ TIMEOUT! Job did not complete in 5 minutes');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testVariantCrawl().catch(console.error);