const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testWithCustomSelectors() {
  console.log('🔬 Testing with explicit custom selectors for Firmenich shop\n');

  try {
    console.log('📋 Starting crawl with custom selectors...');

    // Explicitly provide custom selectors for Firmenich shop
    const response = await axios.post(`${API_URL}/crawler/start`, {
      shopUrl: 'https://shop.firmenich.de/produkt/kistenwaschmaschine/',
      config: {
        maxProducts: 1,
        followPagination: false,
        // Provide explicit selectors for Firmenich/WooCommerce
        customSelectors: {
          productContainer: 'body',  // Single product page
          productLink: 'a',
          productImage: '.woocommerce-product-gallery__image img, .wp-post-image',
          price: '.price, .woocommerce-Price-amount',
          articleNumber: '.product-detail-ordernumber-container, .sku_wrapper .sku',
          productName: '.product_title, h1.entry-title',
          nextPageButton: ''  // No pagination on product page
        }
      }
    });

    const jobId = response.data.data.jobId;
    console.log(`✅ Job started: ${jobId}\n`);

    // Poll for completion
    console.log('⏳ Processing...');
    let job;
    let attempts = 0;

    while (attempts < 90) {  // 90 seconds max
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const statusResponse = await axios.get(`${API_URL}/crawler/jobs/${jobId}`);
        job = statusResponse.data.data;

        const dots = '.'.repeat((attempts % 3) + 1);
        process.stdout.write(`\r⏳ Processing${dots.padEnd(4)} | Status: ${job.status} | Screenshots: ${job.results.screenshots.length}`);

        if (job.status === 'completed' || job.status === 'failed') {
          console.log('\n');
          break;
        }
      } catch (err) {
        // Continue polling
      }
      attempts++;
    }

    if (!job) {
      console.error('❌ Job not found');
      return;
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
    console.log('✅ Job completed successfully!\n');
    console.log('📊 ANALYSIS:');
    console.log('============\n');

    // Count base products and variants
    const baseProducts = job.results.screenshots.filter(
      s => s.metadata?.variantInfo?.isBaseProduct === true
    );
    const variants = job.results.screenshots.filter(
      s => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
    );

    console.log(`📸 Total Screenshots: ${job.results.screenshots.length}`);
    console.log(`🎯 Base Products: ${baseProducts.length}`);
    console.log(`🔄 Variants: ${variants.length}`);

    // Show variant statistics if available
    if (job.variantStats) {
      console.log('\n📈 Variant Statistics (from API):');
      console.log(`   Total Products: ${job.variantStats.totalProducts}`);
      console.log(`   Total Variants: ${job.variantStats.totalVariants}`);
      console.log(`   Total Screenshots: ${job.variantStats.totalScreenshots}`);

      if (job.variantStats.variantsByProduct) {
        console.log('\n📦 Variants by Product:');
        job.variantStats.variantsByProduct.forEach(product => {
          console.log(`   Product: ${product.productUrl}`);
          if (product.variants) {
            product.variants.forEach(v => {
              console.log(`     • ${v.label} (Article: ${v.articleNumber})`);
            });
          }
        });
      }
    }

    // List each screenshot
    if (job.results.screenshots.length > 0) {
      console.log('\n📋 Screenshot Details:');
      job.results.screenshots.forEach((s, i) => {
        const info = s.metadata?.variantInfo;
        const article = s.metadata?.articleNumber;
        const type = info ? (info.isBaseProduct ? '🎯 BASE' : '🔄 VAR ') : '❓ UNKN';
        const label = info?.label || 'Unknown';

        console.log(`   ${i + 1}. ${type} | Article: ${article || 'N/A'} | Label: ${label}`);
        if (s.url !== s.productUrl) {
          console.log(`      URL: ${s.url}`);
        }
      });
    }

    // Final verdict
    console.log('\n' + '='.repeat(50));
    if (variants.length > 0) {
      console.log('🎉 SUCCESS! Variants detected and captured!');
      console.log('✅ The complete variant capture system is working!');
      console.log(`   • Base product captured: ${baseProducts.length}`);
      console.log(`   • Variants captured: ${variants.length}`);
      console.log('   • Expected: 1 base + 2 variants (OMNI, Fruitmax) = 3 total');

      if (job.results.screenshots.length === 3) {
        console.log('\n🎯 PERFECT! All expected variants were captured!');
      }
    } else if (job.results.screenshots.length > 1) {
      console.log('⚠️ PARTIAL: Multiple screenshots but no variant metadata');
    } else if (job.results.screenshots.length === 1) {
      console.log('ℹ️ Only base product captured');
      console.log('   Variants might not have been detected');
    } else {
      console.log('❌ No screenshots captured');
    }

  } catch (error) {
    console.error('\n❌ Test error:', error.response?.data || error.message);
  }
}

// Run test
testWithCustomSelectors();