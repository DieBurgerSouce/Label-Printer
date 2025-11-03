/**
 * Analyze job results
 */

const axios = require('axios');

const jobId = process.argv[2] || '8679b594-b348-452b-b5ac-eb9abcade56f';
const API_BASE = 'http://localhost:3001/api';

async function analyzeJob() {
  console.log('📊 ANALYZING JOB RESULTS');
  console.log('='.repeat(80));
  console.log(`Job ID: ${jobId}\n`);

  try {
    const response = await axios.get(`${API_BASE}/crawler/jobs/${jobId}`);
    const job = response.data.data;

    console.log(`Status: ${job.status}`);
    console.log(`Shop URL: ${job.shopUrl}`);
    console.log(`Products Found: ${job.results?.productsFound || 'N/A'}`);
    console.log(`Screenshots Captured: ${job.results?.screenshots?.length || 0}`);
    console.log('\n' + '='.repeat(80));

    if (!job.results?.screenshots) {
      console.log('No screenshots found in results');
      return;
    }

    // Analyze each screenshot
    let successfulImages = 0;
    let failedImages = 0;
    let largeImages = 0; // >= 400px
    let mediumImages = 0; // 200-399px
    let smallImages = 0; // < 200px

    console.log('📸 DETAILED SCREENSHOT ANALYSIS\n');

    job.results.screenshots.forEach((screenshot, index) => {
      // Extract article number from URL or path
      const urlParts = screenshot.productUrl.split('/');
      const articleMatch = screenshot.imagePath?.match(/\/(\d+)\//);
      const articleNumber = articleMatch ? articleMatch[1] : 'unknown';

      console.log(`${index + 1}. Article ${articleNumber}`);
      console.log(`   URL: ${screenshot.productUrl.substring(0, 80)}...`);

      // Find product image screenshot
      const productImage = screenshot.metadata?.targetedScreenshots?.find(
        s => s.type === 'product-image'
      );

      if (productImage && productImage.success) {
        successfulImages++;
        const width = productImage.dimensions?.width || 0;
        const height = productImage.dimensions?.height || 0;

        console.log(`   ✅ Image: ${width}x${height}px (${(productImage.fileSize / 1024).toFixed(1)} KB)`);

        // Categorize by size
        if (width >= 400) {
          largeImages++;
          console.log(`      👍 LARGE - Main product image (excellent!)`);
        } else if (width >= 200) {
          mediumImages++;
          console.log(`      ℹ️  MEDIUM - Acceptable size`);
        } else {
          smallImages++;
          console.log(`      ⚠️  SMALL - Might be thumbnail! (needs review)`);
        }

        // Show layout type
        const layoutType = screenshot.metadata?.layoutType || 'unknown';
        console.log(`      Layout: ${layoutType}`);

      } else if (productImage && !productImage.success) {
        failedImages++;
        console.log(`   ❌ Image: Failed - ${productImage.error || 'Unknown error'}`);
      } else {
        failedImages++;
        console.log(`   ❌ Image: Not captured`);
      }

      // Show all captured elements
      const captured = screenshot.metadata?.targetedScreenshots?.filter(s => s.success) || [];
      console.log(`   📋 Elements captured: ${captured.length}/5`);
      captured.forEach(el => {
        console.log(`      - ${el.type}: ${el.dimensions?.width}x${el.dimensions?.height}px`);
      });
      console.log('');
    });

    // Summary statistics
    console.log('='.repeat(80));
    console.log('📈 SUMMARY STATISTICS');
    console.log('='.repeat(80));

    const total = job.results.screenshots.length;
    console.log(`\n✅ Successful Images: ${successfulImages}/${total} (${((successfulImages/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed Images: ${failedImages}/${total} (${((failedImages/total)*100).toFixed(1)}%)`);

    console.log(`\n📏 Size Distribution:`);
    console.log(`   Large (≥400px): ${largeImages} (${((largeImages/successfulImages)*100).toFixed(1)}%)`);
    console.log(`   Medium (200-399px): ${mediumImages} (${((mediumImages/successfulImages)*100).toFixed(1)}%)`);
    console.log(`   Small (<200px): ${smallImages} (${((smallImages/successfulImages)*100).toFixed(1)}%)`);

    // Overall assessment
    console.log('\n🎯 ASSESSMENT:');
    if (successfulImages === total && smallImages === 0) {
      console.log('   ✅ PERFECT: All images captured successfully with good sizes!');
    } else if (successfulImages >= total * 0.9 && smallImages <= 1) {
      console.log('   ✅ EXCELLENT: 90%+ success rate with minimal thumbnail issues');
    } else if (successfulImages >= total * 0.7) {
      console.log('   ✅ GOOD: 70%+ success rate');
    } else if (successfulImages >= total * 0.5) {
      console.log('   ⚠️  FAIR: 50%+ success rate - needs improvement');
    } else {
      console.log('   ❌ POOR: <50% success rate - critical issues');
    }

    if (smallImages > 0) {
      console.log(`   ⚠️  WARNING: ${smallImages} image(s) appear to be thumbnails instead of main images`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('💾 SCREENSHOT LOCATION');
    console.log('='.repeat(80));
    console.log(`   Path: backend/data/screenshots/${jobId}/`);
    console.log(`   Each article has its own folder with screenshots`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

analyzeJob().catch(console.error);
