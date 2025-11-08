/**
 * Monitor specific job: b8fc706a-e25f-4763-8e68-05374f5a9b6e
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JOB_ID = 'b8fc706a-e25f-4763-8e68-05374f5a9b6e';

async function monitor() {
  console.log(`\n🔍 Monitoring Job: ${JOB_ID}\n`);

  let previousStatus = null;
  let iteration = 0;

  while (true) {
    iteration++;

    try {
      // Try to get job from Redis via backend logs or check database
      const response = await fetch(`http://localhost:3001/api/automation/status/${JOB_ID}`);

      if (!response.ok) {
        console.log(`[${iteration}] ⏳ Waiting for job data...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      const data = await response.json();
      const job = data.data;

      if (!job) {
        console.log(`[${iteration}] ❌ Job not found`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      const status = job.status;
      const found = job.metrics?.productsFound || 0;
      const processed = job.metrics?.productsProcessed || 0;
      const saved = job.metrics?.productsSaved || 0;
      const labels = job.metrics?.labelsGenerated || 0;

      // Only print if status changed or every 5 iterations
      if (status !== previousStatus || iteration % 5 === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Status: ${status}`);
        console.log(`   Products: Found ${found} | Processed ${processed} | Saved ${saved}`);
        console.log(`   Labels: ${labels}`);
        console.log('');
      }

      previousStatus = status;

      // Check if completed
      if (status === 'completed' || status === 'failed') {
        console.log(`\n✅ Job ${status}!\n`);
        console.log('📊 Final Metrics:');
        console.log(`   Products Found: ${found}`);
        console.log(`   Products Processed: ${processed}`);
        console.log(`   Products Saved: ${saved}`);
        console.log(`   Labels Generated: ${labels}`);
        console.log('');

        // Verify in database
        console.log('🔍 Verifying database...\n');

        const productCount = await prisma.product.count();
        console.log(`✅ Total Products in DB: ${productCount}\n`);

        if (productCount > 0) {
          const samples = await prisma.product.findMany({
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              articleNumber: true,
              productName: true,
              tieredPrices: true
            }
          });

          console.log('📦 Sample Products:\n');
          samples.forEach(p => {
            const tiers = JSON.parse(p.tieredPrices || '[]');
            console.log(`#${p.articleNumber}: ${p.productName}`);
            console.log(`  Tiered Prices: ${tiers.length} tiers`);
            if (tiers.length > 0) {
              tiers.forEach(t => console.log(`    - Qty ${t.quantity}: ${t.price}€`));
            }
            console.log('');
          });

          console.log('✅ SUCCESS! Products are being saved!\n');
        } else {
          console.log('❌ FAILED! No products in database!\n');
        }

        await prisma.$disconnect();
        process.exit(0);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.log(`[${iteration}] ⚠️ Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

monitor().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
