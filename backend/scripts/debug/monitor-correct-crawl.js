/**
 * Monitor the correct crawl job
 */

const JOB_ID = '4c68e0f9-c369-4a4c-9c05-3c194e11528b';

async function checkProgress() {
  const response = await fetch(`http://localhost:3001/api/automation/jobs/${JOB_ID}`);
  const result = await response.json();

  if (result.success && result.job) {
    const job = result.job;
    const progress = job.progress || {};

    console.log(`\n📊 Status: ${job.status}`);
    console.log(`   Step: ${progress.currentStep}`);
    console.log(`   Products Found: ${progress.productsFound || 0}`);
    console.log(`   Products Processed: ${progress.productsProcessed || 0}`);
    console.log(`   Labels Generated: ${progress.labelsGenerated || 0}`);

    if (progress.errors && progress.errors.length > 0) {
      console.log(`   Errors: ${progress.errors.length}`);
    }

    if (job.status === 'completed') {
      console.log('\n✅ Crawl completed!');
      console.log(`\n📊 Final Results:`);
      console.log(`   - Products Found: ${progress.productsFound || 0}`);
      console.log(`   - Products Processed: ${progress.productsProcessed || 0}`);
      console.log(`   - Labels Generated: ${progress.labelsGenerated || 0}`);

      if (progress.errors && progress.errors.length > 0) {
        console.log(`   - Errors: ${progress.errors.length}`);
        progress.errors.slice(0, 3).forEach((err, i) => {
          console.log(`     ${i + 1}. ${err}`);
        });
      }

      return true;
    } else if (job.status === 'failed') {
      console.log('\n❌ Crawl failed!');
      if (job.error) console.log(`   Error: ${job.error}`);
      return true;
    }

    return false;
  } else {
    console.log('❌ Failed to fetch job status');
    return true;
  }
}

async function monitor() {
  console.log('🔍 Monitoring crawl job with HTML Fix...');
  console.log(`   Job ID: ${JOB_ID}\n`);

  const interval = setInterval(async () => {
    const done = await checkProgress();
    if (done) {
      clearInterval(interval);
    }
  }, 10000); // Check every 10 seconds
}

monitor().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
