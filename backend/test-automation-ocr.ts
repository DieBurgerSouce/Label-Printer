/**
 * Test automation OCR integration
 */
import { automationService } from './src/services/automation-service';

async function test() {
  console.log('🧪 Testing Automation OCR Integration...\n');

  try {
    // Start simple automation with single product
    const jobResponse = await automationService.startSimpleAutomation(
      'https://shop.firmenich.de/Grossbehaelter/Big-Box-Masse-120-x-100-x-79-cm-D-F',
      '60579d69-61b8-450c-94ac-7ce27c117a8e'
    );

    console.log(`📋 Job started: ${jobResponse.jobId}`);
    console.log('⏳ Waiting for completion...\n');

    // Wait for job to complete
    let job;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      job = automationService.getJob(jobResponse.jobId);

      if (!job) {
        console.log('❌ Job not found!');
        break;
      }

      console.log(`Status: ${job.status} | Step: ${job.progress.currentStep} | Progress: ${job.progress.currentStepProgress}%`);

      if (job.status === 'completed' || job.status === 'failed') {
        break;
      }

      attempts++;
    }

    if (job?.status === 'completed') {
      console.log('\n✅ Job completed successfully!');
      console.log(`📊 Results:`);
      console.log(`  - Products found: ${job.progress.productsFound}`);
      console.log(`  - Products processed (OCR): ${job.progress.productsProcessed}`);
      console.log(`  - Labels generated: ${job.progress.labelsGenerated}`);

      if (job.results.ocrResults.length > 0) {
        console.log('\n📝 OCR Results:');
        for (const ocr of job.results.ocrResults) {
          console.log(`  Article: ${ocr.extractedData?.articleNumber || 'N/A'}`);
          console.log(`  Name: ${ocr.extractedData?.productName || 'N/A'}`);
          console.log(`  Success: ${ocr.success}`);
        }
      }
    } else {
      console.log(`\n❌ Job failed or timed out: ${job?.status}`);
      if (job?.progress.errors.length > 0) {
        console.log('Errors:', job.progress.errors);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});