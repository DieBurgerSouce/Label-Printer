/**
 * Test WebSocket Integration
 * API endpoint to test WebSocket events within the Express server context
 */

import express from 'express';
import {
  crawlJobService,
  screenshotService,
  ocrResultService,
} from '../../services/database-service.js';
import { imageStorageService } from '../../services/image-storage-service.js';
import sharp from 'sharp';

const router = express.Router();

/**
 * POST /api/test-websocket/run
 * Run a full WebSocket integration test
 */
router.post('/run', async (_req, res) => {
  try {
    console.log('\n🧪 [TEST] Starting WebSocket Integration Test...\n');

    const results = {
      jobCreated: false,
      screenshotCreated: false,
      ocrCreated: false,
      jobUpdated: false,
      jobCompleted: false,
    };

    // 1. Create crawl job
    console.log('1️⃣  [TEST] Creating crawl job...');
    const job = await crawlJobService.create({
      name: 'WebSocket Test Job',
      targetUrl: 'https://example.com/products',
      maxProducts: 10,
    });
    console.log(`   ✅ Created job: ${job.id}`);
    results.jobCreated = true;

    // 2. Create screenshot with image
    console.log('2️⃣  [TEST] Creating screenshot with image upload...');

    // Create a test image (100x100 blue square)
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 100, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const imageUpload = await imageStorageService.uploadScreenshot(
      testImageBuffer,
      'https://example.com/product/123',
      job.id
    );

    const screenshot = await screenshotService.create({
      crawlJobId: job.id,
      imageUrl: imageUpload.url,
      thumbnailUrl: imageUpload.thumbnailUrl,
      width: 100,
      height: 100,
      fileSize: testImageBuffer.length,
      format: 'png',
      productUrl: 'https://example.com/product/123',
      productName: 'Test Product',
    });
    console.log(`   ✅ Created screenshot: ${screenshot.id}`);
    results.screenshotCreated = true;

    // 3. Update job progress
    console.log('3️⃣  [TEST] Updating job progress...');
    await crawlJobService.update(job.id, {
      status: 'running',
      productsFound: 5,
      productsScraped: 3,
    });
    console.log(`   ✅ Job progress updated`);
    results.jobUpdated = true;

    // 4. Create OCR result
    console.log('4️⃣  [TEST] Creating OCR result...');
    const ocrResult = await ocrResultService.create({
      screenshotId: screenshot.id,
      status: 'completed',
      articleNumber: 'TEST-123',
      price: 29.99,
      productName: 'Test Product',
      confidence: 95.5,
      fullText: 'TEST-123 Test Product €29.99',
    });
    console.log(`   ✅ Created OCR result: ${ocrResult.id}`);
    results.ocrCreated = true;

    // 5. Complete job
    console.log('5️⃣  [TEST] Completing job...');
    await crawlJobService.update(job.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    console.log(`   ✅ Job completed`);
    results.jobCompleted = true;

    // 6. Cleanup
    console.log('6️⃣  [TEST] Cleaning up test data...');
    await imageStorageService.deleteImage(imageUpload.fileId);
    await crawlJobService.delete(job.id);
    console.log(`   ✅ Cleanup complete\n`);

    console.log('✨ [TEST] WebSocket Integration Test Complete!\n');

    res.json({
      success: true,
      message: 'WebSocket integration test completed successfully',
      results,
      jobId: job.id,
      screenshotId: screenshot.id,
      ocrResultId: ocrResult.id,
    });
  } catch (error: any) {
    console.error('❌ [TEST] WebSocket test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
