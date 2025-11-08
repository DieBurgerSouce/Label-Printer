/**
 * Monitor crawl job progress
 */

const JOB_ID = '10309661-b10e-4ffa-b48a-cd1c1bff00a4';

async function checkProgress() {
  const response = await fetch(`http://localhost:3001/api/automation/jobs/${JOB_ID}`);
  const result = await response.json();

  if (result.success && result.data) {
    const job = result.data;
    const progress = job.progress || {};

    console.log(`\n📊 Job Status: ${job.status}`);
    console.log(`   Step: ${progress.currentStep} (${progress.currentStepProgress || 0}%)`);
    console.log(`   Products Found: ${progress.productsFound || 0}`);
    console.log(`   Products Processed: ${progress.productsProcessed || 0}`);
    console.log(`   Labels Generated: ${progress.labelsGenerated || 0}`);

    if (progress.errors && progress.errors.length > 0) {
      console.log(`   Errors: ${progress.errors.length}`);
    }

    if (job.status === 'completed') {
      console.log('\n✅ Job completed!');
      return true;
    } else if (job.status === 'failed') {
      console.log('\n❌ Job failed!');
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
  console.log('🔍 Monitoring crawl job progress...');

  const interval = setInterval(async () => {
    const done = await checkProgress();
    if (done) {
      clearInterval(interval);
    }
  }, 5000); // Check every 5 seconds
}

monitor().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
