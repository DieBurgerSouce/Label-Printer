const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testVariantDirectly() {
  console.log('🔬 Testing Variant Detection with Custom Selectors...\n');

  try {
    // Start a crawl job with custom selectors for Firmenich shop
    console.log('📋 Starting crawl job with custom selectors...');

    const response = await axios.post(`${API_URL}/crawler/start`, {
      shopUrl: 'https://shop.firmenich.de/produktkategorie/reinigungsmaschinen/',
      maxProducts: 1,
      followPagination: false,
      customSelectors: {
        // Firmenich shop specific selectors
        productContainer: '.product',
        productLink: 'a.woocommerce-LoopProduct-link',
        productImage: 'img.attachment-woocommerce_thumbnail',
        price: '.price',
        articleNumber: '.sku',
        productName: '.woocommerce-loop-product__title'
      }
    });

    const jobId = response.data.data.jobId;
    console.log(`✅ Job started: ${jobId}\n`);

    // Wait for completion
    console.log('⏳ Waiting for job to complete (this may take a minute)...');
    let job;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes timeout

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await axios.get(`${API_URL}/crawler/jobs/${jobId}`);
      job = statusResponse.data.data;

      process.stdout.write(`\r   Status: ${job.status} | Screenshots: ${job.results.screenshots.length}`);

      if (job.status === 'completed' || job.status === 'failed') {
        console.log('\n');
        break;
      }
      attempts++;
    }

    if (job.status === 'failed') {
      console.error('❌ Job failed:', job.error);
      return;
    }

    if (job.status !== 'completed') {
      console.error('❌ Job timed out');
      return;
    }

    // Analyze results
    console.log('\n📊 RESULTS ANALYSIS:');
    console.log('==================\n');

    // Check variant statistics
    if (job.variantStats) {
      console.log('📈 Variant Statistics:');
      console.log(`   • Base Products: ${job.variantStats.totalProducts}`);
      console.log(`   • Variants: ${job.variantStats.totalVariants}`);
      console.log(`   • Total Screenshots: ${job.variantStats.totalScreenshots}`);

      if (job.variantStats.variantsByProduct && job.variantStats.variantsByProduct.length > 0) {
        console.log('\n📦 Variants by Product:');
        job.variantStats.variantsByProduct.forEach(product => {
          console.log(`\n   Product URL: ${product.productUrl}`);
          console.log(`   Variant Count: ${product.variantCount}`);
          if (product.variants && product.variants.length > 0) {
            product.variants.forEach(variant => {
              console.log(`     • ${variant.label || 'Unknown'} (Article: ${variant.articleNumber || 'N/A'})`);
            });
          }
        });
      }
    }

    // Check individual screenshots
    console.log('\n\n🖼️ Screenshot Details:');
    console.log('=====================\n');

    job.results.screenshots.forEach((screenshot, index) => {
      const variantInfo = screenshot.metadata?.variantInfo;
      const articleNumber = screenshot.metadata?.articleNumber;

      console.log(`Screenshot ${index + 1}:`);
      console.log(`  • URL: ${screenshot.url}`);
      console.log(`  • Article: ${articleNumber || 'N/A'}`);

      if (variantInfo) {
        console.log(`  • Type: ${variantInfo.isBaseProduct ? '🎯 BASE PRODUCT' : '🔄 VARIANT'}`);
        console.log(`  • Label: ${variantInfo.label}`);
        console.log(`  • Variant Type: ${variantInfo.type}`);
        if (variantInfo.parentUrl) {
          console.log(`  • Parent URL: ${variantInfo.parentUrl}`);
        }
      } else {
        console.log(`  • Type: UNKNOWN (no variant info)`);
      }
      console.log('');
    });

    // Final summary
    console.log('\n✅ TEST SUMMARY:');
    console.log('================\n');

    const baseCount = job.results.screenshots.filter(
      s => s.metadata?.variantInfo?.isBaseProduct
    ).length;
    const variantCount = job.results.screenshots.filter(
      s => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
    ).length;

    console.log(`Total Screenshots: ${job.results.screenshots.length}`);
    console.log(`Base Products: ${baseCount}`);
    console.log(`Variants: ${variantCount}`);

    // Check success
    if (variantCount > 0) {
      console.log('\n🎉 SUCCESS: Variants are now being properly captured and returned!');
      console.log('✨ The variant return bug has been FIXED!');
    } else if (job.results.screenshots.length > 1) {
      console.log('\n⚠️ PARTIAL SUCCESS: Multiple screenshots captured but variant metadata might be missing');
    } else {
      console.log('\n❌ FAILED: No variants detected or returned');
      console.log('ℹ️ Note: The product might not have variants, or detection needs improvement');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testVariantDirectly();