/**
 * Test OCR on element screenshots
 */
import { ocrService } from './src/services/ocr-service';
import * as path from 'path';

async function testOCR() {
  console.log('🧪 Testing OCR on element screenshots...\n');

  try {
    // Initialize OCR service
    await ocrService.initialize();

    // Test with existing screenshots from our test
    const screenshotDir = path.join(process.cwd(), 'data', 'screenshots', '6a557d40-5d97-4c08-87e5-e0d6a08ffead');
    const articleNumber = '8803';

    console.log(`📍 Testing with directory: ${screenshotDir}`);
    console.log(`📦 Article number: ${articleNumber}\n`);

    // Process element screenshots
    const result = await ocrService.processElementScreenshots(
      screenshotDir,
      articleNumber,
      'test-job'
    );

    console.log('\n📊 OCR Results:');
    console.log('================');

    if (result.status === 'completed') {
      console.log('✅ Status: SUCCESS');
      console.log(`⏱️  Processing time: ${result.processingTime}ms`);
      console.log(`🎯 Confidence: ${Math.round(result.confidence.overall)}%`);

      console.log('\n📝 Extracted Data:');
      for (const [field, value] of Object.entries(result.extractedData)) {
        const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
        console.log(`  ${field}: "${displayValue}"`);
      }
    } else {
      console.log('❌ Status: FAILED');
      console.log(`Error: ${result.error}`);
    }

    // Shutdown OCR service
    await ocrService.shutdown();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testOCR().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});