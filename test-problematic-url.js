/**
 * Test the originally problematic URL with multiple images
 */

const axios = require('axios');
const API_BASE = 'http://localhost:3001/api';

async function testProblematicURL() {
  console.log('🧪 TESTING PROBLEMATIC URL');
  console.log('Product: 1,5 kg Papiertragetasche Kartoffeln NEU (Article 8358)');
  console.log('Issue: This product has MULTIPLE images in a gallery');
  console.log('Expected: Should capture the MAIN image, not thumbnails');
  console.log('='.repeat(80));

  try {
    const url = 'https://shop.firmenich.de/Papier/1-5-kg-Papiertragetasche-Kartoffeln-NEU';

    console.log(`\n📝 Starting crawl for: ${url}`);
    const startResponse = await axios.post(`${API_BASE}/crawler/start`, {
      shopUrl: url,
      config: {
        maxProducts: 1,
        crawlDelay: 1000
      }
    });

    const jobId = startResponse.data.data.jobId;
    console.log(`✅ Job started: ${jobId}`);

    // Poll for completion
    console.log('⏳ Waiting...');
    let attempts = 0;
    let job;

    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 1000));
      const statusResponse = await axios.get(`${API_BASE}/crawler/jobs/${jobId}`);
      job = statusResponse.data.data;

      if (job.status === 'completed') {
        console.log('✅ Completed!\n');
        break;
      } else if (job.status === 'failed') {
        console.log('❌ Failed!');
        console.log('Error:', job.error);
        return;
      }

      attempts++;
      if (attempts % 5 === 0) process.stdout.write('.');
    }

    if (attempts >= 60) {
      console.log('⚠️ Timeout');
      return;
    }

    // Analyze result
    console.log('='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));

    const screenshot = job.results?.screenshots?.[0];
    if (!screenshot) {
      console.log('❌ No screenshot found!');
      return;
    }

    const productImage = screenshot.metadata?.targetedScreenshots?.find(
      s => s.type === 'product-image'
    );

    if (!productImage) {
      console.log('❌ No product image found!');
      return;
    }

    console.log('\n📸 Product Image Details:');
    console.log(`   Status: ${productImage.success ? '✅ Success' : '❌ Failed'}`);

    if (productImage.success) {
      const width = productImage.dimensions?.width || 0;
      const height = productImage.dimensions?.height || 0;
      const size = (productImage.fileSize / 1024).toFixed(1);

      console.log(`   Dimensions: ${width}x${height}px`);
      console.log(`   File Size: ${size} KB`);
      console.log(`   Path: ${productImage.path}`);

      // Assessment
      console.log('\n🎯 ASSESSMENT:');
      if (width >= 400 && height >= 400) {
        console.log('   ✅ EXCELLENT: Large main product image captured!');
        console.log('   ✅ NOT a thumbnail - this is the correct main image');
      } else if (width >= 200) {
        console.log('   ⚠️  MEDIUM: Image size is acceptable but could be larger');
      } else {
        console.log('   ❌ SMALL: This appears to be a thumbnail!');
        console.log('   ❌ The fix did NOT work correctly');
      }

      // Show all captured elements
      console.log('\n📋 All Captured Elements:');
      screenshot.metadata?.targetedScreenshots?.forEach(el => {
        if (el.success) {
          console.log(`   ✅ ${el.type}: ${el.dimensions?.width}x${el.dimensions?.height}px`);
        }
      });

    } else {
      console.log(`   Error: ${productImage.error || 'Unknown'}`);
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProblematicURL().catch(console.error);
