/**
 * Test if articleNumber mapping is now fixed
 */
const { automationService } = require('./dist/services/automation-service.js');

async function test() {
  console.log('\n🧪 Testing articleNumber Fix...\n');

  try {
    // Start a small test crawl with just 2 articles
    const job = await automationService.startAutomation({
      startPage: 1,
      maxPages: 1, // Just first page
      targetArticles: ['5020', '7034'], // These have tiered prices
      batchSize: 5,
      enableScreenshots: true,
      enableOCR: true,
      enableLabels: false, // Skip labels for faster test
      skipExisting: false
    });

    console.log(`✅ Started test job: ${job.id}\n`);
    console.log('Waiting for crawl to complete...\n');

    // Wait for completion
    let status = job.status;
    let attempts = 0;
    while (status !== 'completed' && status !== 'failed' && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const currentJob = await automationService.getJobStatus(job.id);
      status = currentJob.status;
      console.log(`[${++attempts}] Status: ${status} | Found: ${currentJob.metrics.productsFound} | Processed: ${currentJob.metrics.productsProcessed}`);
    }

    const finalJob = await automationService.getJobStatus(job.id);
    console.log('\n📊 Final Results:');
    console.log(`   Status: ${finalJob.status}`);
    console.log(`   Products Found: ${finalJob.metrics.productsFound}`);
    console.log(`   Products Processed: ${finalJob.metrics.productsProcessed}`);
    console.log(`   Products Saved: ${finalJob.metrics.productsSaved || 0}`);

    // Check if products were actually saved
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const savedProducts = await prisma.product.findMany({
      where: {
        articleNumber: { in: ['5020', '7034'] }
      },
      select: {
        articleNumber: true,
        productName: true,
        tieredPrices: true
      }
    });

    console.log(`\n✅ Products in Database: ${savedProducts.length}\n`);

    savedProducts.forEach(p => {
      const tiers = JSON.parse(p.tieredPrices || '[]');
      console.log(`#${p.articleNumber}: ${p.productName}`);
      console.log(`  Tiered Prices: ${tiers.length} tiers`);
      if (tiers.length > 0) {
        tiers.forEach(t => console.log(`    - Qty ${t.quantity}: ${t.price}€`));
      }
      console.log('');
    });

    await prisma.$disconnect();

    if (savedProducts.length > 0) {
      console.log('✅ SUCCESS! ArticleNumber mapping is FIXED!\n');
      process.exit(0);
    } else {
      console.log('❌ FAILED! Products still not being saved!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
