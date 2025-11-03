/**
 * Pipeline Test: 10 Articles with Single and Multiple Images
 * Tests the screenshot fix comprehensively
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testFullPipeline() {
  console.log('🧪 FULL PIPELINE TEST: 10 Articles');
  console.log('Testing screenshot capture with mix of single/multiple images');
  console.log('='.repeat(80));

  try {
    // Start a crawl job for the shop to get 10 products
    console.log('\n📝 Starting crawl job for 10 products...');
    const startResponse = await axios.post(`${API_BASE}/crawler/start`, {
      shopUrl: 'https://shop.firmenich.de/',
      config: {
        maxProducts: 10,  // Get 10 products
        fullShopScan: false,
        crawlDelay: 1000
      }
    });

    const jobId = startResponse.data.data.jobId;
    console.log(`✅ Job started: ${jobId}`);

    // Poll for job completion
    console.log('⏳ Waiting for job to complete (this may take a few minutes)...\n');
    let job;
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes timeout
    let lastStatus = '';

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await axios.get(`${API_BASE}/crawler/jobs/${jobId}`);
      job = statusResponse.data.data;

      // Show progress
      const currentStatus = `${job.status} - Products: ${job.productsProcessed || 0}`;
      if (currentStatus !== lastStatus) {
        console.log(`   📊 Status: ${currentStatus}`);
        lastStatus = currentStatus;
      }

      if (job.status === 'completed') {
        console.log('\n✅ Job completed!');
        break;
      } else if (job.status === 'failed') {
        console.log('\n❌ Job failed!');
        console.log('Error:', job.error);
        return;
      }

      attempts++;
      if (attempts % 10 === 0) {
        process.stdout.write('.');
      }
    }

    if (attempts >= maxAttempts) {
      console.log('\n⚠️ Job timeout!');
      return;
    }

    // Analyze results
    console.log('\n' + '='.repeat(80));
    console.log('📊 PIPELINE RESULTS');
    console.log('='.repeat(80));

    console.log(`\n📦 Products Summary:`);
    console.log(`   Total products found: ${job.productsFound || 'N/A'}`);
    console.log(`   Products processed: ${job.productsProcessed || 0}`);
    console.log(`   Successful screenshots: ${job.results?.filter(r => r.screenshots?.some(s => s.success)).length || 0}`);

    if (!job.results || job.results.length === 0) {
      console.log('\n⚠️ No results to display');
      return;
    }

    // Detailed breakdown
    console.log(`\n📸 Screenshot Details:\n`);

    let totalProducts = 0;
    let successfulImages = 0;
    let failedImages = 0;
    let multiImageProducts = 0;

    job.results.forEach((result, index) => {
      totalProducts++;
      const imageScreenshot = result.screenshots?.find(s => s.type === 'product-image');

      console.log(`${index + 1}. Article ${result.articleNumber || 'N/A'}`);
      console.log(`   Title: ${result.title?.substring(0, 50) || 'N/A'}...`);

      if (imageScreenshot) {
        if (imageScreenshot.success) {
          successfulImages++;
          console.log(`   ✅ Image: ${imageScreenshot.dimensions?.width}x${imageScreenshot.dimensions?.height}px (${(imageScreenshot.fileSize / 1024).toFixed(1)} KB)`);

          // Check if dimensions suggest it's a main image (should be at least 400px)
          if (imageScreenshot.dimensions?.width >= 400) {
            console.log(`      👍 Main product image captured (good size)`);
          } else if (imageScreenshot.dimensions?.width < 200) {
            console.log(`      ⚠️  WARNING: Image too small - might be thumbnail!`);
          } else {
            console.log(`      ℹ️  Medium size image`);
          }
        } else {
          failedImages++;
          console.log(`   ❌ Image: Failed - ${imageScreenshot.error || 'Unknown error'}`);
        }
      } else {
        failedImages++;
        console.log(`   ❌ Image: No screenshot captured`);
      }

      // Show all captured elements
      const capturedElements = result.screenshots?.filter(s => s.success).map(s => s.type) || [];
      console.log(`   📋 Captured: ${capturedElements.join(', ')}`);
      console.log('');
    });

    // Success rate calculation
    console.log('='.repeat(80));
    console.log('📈 SUCCESS RATE');
    console.log('='.repeat(80));
    console.log(`   Products processed: ${totalProducts}/10`);
    console.log(`   Successful images: ${successfulImages}/${totalProducts} (${((successfulImages/totalProducts)*100).toFixed(1)}%)`);
    console.log(`   Failed images: ${failedImages}/${totalProducts}`);

    if (successfulImages >= 9) {
      console.log('\n   ✅ EXCELLENT: 90%+ success rate!');
    } else if (successfulImages >= 7) {
      console.log('\n   ✅ GOOD: 70%+ success rate');
    } else if (successfulImages >= 5) {
      console.log('\n   ⚠️  FAIR: 50%+ success rate - needs improvement');
    } else {
      console.log('\n   ❌ POOR: <50% success rate - critical issues');
    }

    console.log('\n='.repeat(80));
    console.log('💾 SCREENSHOT LOCATIONS');
    console.log('='.repeat(80));
    console.log(`   Check screenshots at: backend/data/screenshots/precise/${jobId}/`);
    console.log('   Each product has its own folder with article number');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testFullPipeline().catch(console.error);
