const axios = require('axios');

async function testFirmenichVariants() {
  console.log('🧪 Testing variant detection on Firmenich shop with CORRECT URL...\n');

  try {
    // The correct URL with actual variants (Horizontalschäler with OMNI and Fruitmax options)
    const url = 'https://shop.firmenich.de/detail/088dad9cfeac403cb7b26e88f1407dc5';

    console.log('📍 Testing URL:', url);
    console.log('✅ This product has variants: Aufdruck (OMNI, Fruitmax) and Farbe options\n');

    // Start crawl job
    console.log('🚀 Starting crawl job...');
    const crawlResponse = await axios.post('http://localhost:3001/api/crawler/start', {
      shopUrl: url,
      config: {
        detectVariants: true,
        maxVariants: 10,
        captureImages: true,
        useAI: false,
        maxProducts: 1  // Only crawl this single product
      }
    });

    const jobId = crawlResponse.data.data.jobId;
    console.log('📋 Job ID:', jobId);

    // Poll for job completion
    console.log('⏳ Waiting for job completion...');
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));

      const statusResponse = await axios.get(`http://localhost:3001/api/crawler/jobs/${jobId}`);
      const job = statusResponse.data.data || statusResponse.data;

      // Check if job has results field
      const resultsCount = job.results?.screenshots ? job.results.screenshots.length :
                          (job.results ? job.results.length :
                          (job.screenshots ? job.screenshots.length : 0));

      process.stdout.write(`\r   Status: ${job.status} | Progress: ${job.progress}% | Results: ${resultsCount}`);

      if (job.status === 'completed' || job.status === 'failed') {
        console.log('\n');

        if (job.status === 'failed') {
          console.error('❌ Job failed:', job.error);
          return;
        }

        console.log('✅ Job completed successfully!\n');
        console.log('📊 Results Summary:');
        const results = job.results?.screenshots || job.results || job.screenshots || [];
        console.log('   Total results:', results.length);

        // Analyze variant statistics
        if (job.variantStats) {
          console.log('\n🎯 Variant Statistics:');
          console.log('   Base products:', job.variantStats.totalProducts);
          console.log('   Variants detected:', job.variantStats.totalVariants);
          console.log('   Total screenshots:', job.variantStats.totalScreenshots);

          if (job.variantStats.variantsByProduct) {
            console.log('\n📦 Variants by Product:');
            job.variantStats.variantsByProduct.forEach(product => {
              console.log(`   ${product.url.split('/').pop()}: ${product.variantCount} variants`);
            });
          }
        }

        // Check the results in detail
        console.log('\n🔍 Detailed Results:');
        results.forEach((result, index) => {
          console.log(`\n   Result ${index + 1}:`);
          console.log(`   - URL: ${result.productUrl || result.url || 'N/A'}`);
          console.log(`   - Screenshots: ${result.screenshots ? result.screenshots.length : 'N/A'}`);
          console.log(`   - Article number: ${result.metadata?.articleNumber || result.articleNumber || 'N/A'}`);

          const variantInfo = result.metadata?.variantInfo || result.variantInfo;
          if (variantInfo) {
            console.log(`   - Variant: ${variantInfo.label}`);
            console.log(`   - Type: ${variantInfo.type}`);
            console.log(`   - Is base: ${variantInfo.isBaseProduct}`);
          }
        });

        // Check if we detected the expected variants
        const variantLabels = results
          .filter(r => {
            const variantInfo = r.metadata?.variantInfo || r.variantInfo;
            return variantInfo && !variantInfo.isBaseProduct;
          })
          .map(r => {
            const variantInfo = r.metadata?.variantInfo || r.variantInfo;
            return variantInfo.label;
          });

        console.log('\n🏷️ Detected Variant Labels:', variantLabels);

        // Check for expected variants
        const expectedVariants = ['OMNI', 'Fruitmax'];
        const foundExpected = expectedVariants.filter(v =>
          variantLabels.some(label => label.includes(v))
        );

        if (foundExpected.length > 0) {
          console.log('✅ Successfully detected expected variants:', foundExpected);
        } else {
          console.log('⚠️ Expected variants not found. Looking for OMNI and Fruitmax variants.');
        }

        break;
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('\n⏱️ Job timed out after', maxAttempts * 2, 'seconds');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run test
testFirmenichVariants();