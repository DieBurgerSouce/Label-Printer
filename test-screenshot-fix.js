/**
 * Test script to verify screenshot fix for products with multiple images
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test URLs
const TEST_CASES = [
  {
    name: 'Problematic: Multiple images (Kartoffeln Tasche)',
    url: 'https://shop.firmenich.de/Papier/1-5-kg-Papiertragetasche-Kartoffeln-NEU',
    expectedArticle: '8358'
  },
  {
    name: 'Working: Single image (Spargelkarton)',
    url: 'https://shop.firmenich.de/Behaelter-Kisten/Spargelkarton-5-kg-gefaltet-neutral-bedruckt',
    expectedArticle: '8457'
  }
];

async function testScreenshot(testCase) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing: ${testCase.name}`);
  console.log(`URL: ${testCase.url}`);
  console.log('='.repeat(80));

  try {
    // Start crawl job for single product
    console.log('\n📝 Starting screenshot capture...');
    const startResponse = await axios.post(`${API_BASE}/crawler/start`, {
      shopUrl: testCase.url,
      config: {
        maxProducts: 1,
        crawlDelay: 1000
      }
    });

    const jobId = startResponse.data.data.jobId;
    console.log(`✅ Job started: ${jobId}`);

    // Poll for job completion
    console.log('⏳ Waiting for job to complete...');
    let job;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await axios.get(`${API_BASE}/crawler/jobs/${jobId}`);
      job = statusResponse.data.data;

      if (job.status === 'completed') {
        console.log('✅ Job completed!');
        break;
      } else if (job.status === 'failed') {
        console.log('❌ Job failed!');
        console.log('Error:', job.error);
        return;
      }

      attempts++;
      process.stdout.write('.');
    }

    if (attempts >= maxAttempts) {
      console.log('\n⚠️ Job timeout!');
      return;
    }

    // Check results
    console.log('\n📊 Results:');
    console.log(`   Products found: ${job.productsFound}`);
    console.log(`   Products processed: ${job.productsProcessed}`);

    if (job.results && job.results.length > 0) {
      const result = job.results[0];
      console.log(`\n   Article: ${result.articleNumber || 'N/A'}`);
      console.log(`   Title: ${result.title || 'N/A'}`);

      if (result.screenshots) {
        console.log(`\n   Screenshots captured:`);
        result.screenshots.forEach(screenshot => {
          if (screenshot.success) {
            console.log(`   ✅ ${screenshot.type}: ${screenshot.dimensions?.width}x${screenshot.dimensions?.height}px`);
            if (screenshot.type === 'product-image') {
              console.log(`      Path: ${screenshot.path}`);
            }
          } else {
            console.log(`   ❌ ${screenshot.type}: ${screenshot.error || 'Failed'}`);
          }
        });
      }

      // Verify article number
      if (testCase.expectedArticle && result.articleNumber === testCase.expectedArticle) {
        console.log(`\n✅ Article number matches: ${testCase.expectedArticle}`);
      } else if (testCase.expectedArticle) {
        console.log(`\n⚠️ Article number mismatch: expected ${testCase.expectedArticle}, got ${result.articleNumber}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

async function runTests() {
  console.log('🧪 Screenshot Fix Test Suite');
  console.log('Testing products with single and multiple images\n');

  for (const testCase of TEST_CASES) {
    await testScreenshot(testCase);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed!');
  console.log('='.repeat(80));
  console.log('\nℹ️ Check the screenshots in backend/data/screenshots/precise/');
}

runTests().catch(console.error);
