/**
 * WebSocket Test Client
 * Tests real-time event broadcasting
 */

import { io, Socket } from 'socket.io-client';
import { crawlJobService, screenshotService, ocrResultService } from './src/services/database-service.js';
import { imageStorageService } from './src/services/image-storage-service.js';
import sharp from 'sharp';

const SERVER_URL = 'http://localhost:3001';

interface ReceivedEvents {
  jobCreated: number;
  jobUpdated: number;
  jobProgress: number;
  jobCompleted: number;
  jobFailed: number;
  screenshotCaptured: number;
  ocrCompleted: number;
  ocrFailed: number;
}

async function testWebSocket() {
  console.log('\n🚀 WebSocket Real-Time Updates Test\n');
  console.log('='.repeat(50));

  const receivedEvents: ReceivedEvents = {
    jobCreated: 0,
    jobUpdated: 0,
    jobProgress: 0,
    jobCompleted: 0,
    jobFailed: 0,
    screenshotCaptured: 0,
    ocrCompleted: 0,
    ocrFailed: 0,
  };

  // Connect to WebSocket server
  console.log(`\n📡 Connecting to WebSocket server at ${SERVER_URL}...`);
  const socket: Socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  // Setup event listeners
  socket.on('connect', () => {
    console.log(`✅ Connected to WebSocket server (ID: ${socket.id})\n`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from WebSocket server');
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  // Job events
  socket.on('job:created', (data) => {
    receivedEvents.jobCreated++;
    console.log('📦 [WebSocket] Job Created:', {
      jobId: data.jobId,
      name: data.name,
      type: data.jobType,
    });
  });

  socket.on('job:updated', (data) => {
    receivedEvents.jobUpdated++;
    console.log('🔄 [WebSocket] Job Updated:', {
      jobId: data.jobId,
      status: data.status,
    });
  });

  socket.on('job:progress', (data) => {
    receivedEvents.jobProgress++;
    console.log('📊 [WebSocket] Job Progress:', {
      jobId: data.jobId,
      progress: `${data.progress}%`,
      step: data.currentStep,
    });
  });

  socket.on('job:completed', (data) => {
    receivedEvents.jobCompleted++;
    console.log('✅ [WebSocket] Job Completed:', {
      jobId: data.jobId,
      duration: `${data.duration}ms`,
    });
  });

  socket.on('job:failed', (data) => {
    receivedEvents.jobFailed++;
    console.log('❌ [WebSocket] Job Failed:', {
      jobId: data.jobId,
      error: data.error,
    });
  });

  // Screenshot events
  socket.on('screenshot:captured', (data) => {
    receivedEvents.screenshotCaptured++;
    console.log('📸 [WebSocket] Screenshot Captured:', {
      screenshotId: data.screenshotId,
      productName: data.productName || 'N/A',
    });
  });

  // OCR events
  socket.on('ocr:started', (data) => {
    console.log('🔍 [WebSocket] OCR Started:', {
      screenshotId: data.screenshotId,
    });
  });

  socket.on('ocr:completed', (data) => {
    receivedEvents.ocrCompleted++;
    console.log('✅ [WebSocket] OCR Completed:', {
      articleNumber: data.data.articleNumber || 'N/A',
      confidence: `${(data.data.confidence * 100).toFixed(1)}%`,
    });
  });

  socket.on('ocr:failed', (data) => {
    receivedEvents.ocrFailed++;
    console.log('❌ [WebSocket] OCR Failed:', {
      screenshotId: data.screenshotId,
      error: data.error,
    });
  });

  // Wait for connection
  await new Promise((resolve) => {
    socket.on('connect', resolve);
  });

  console.log('='.repeat(50));
  console.log('\n🧪 Running Test Workflow...\n');

  try {
    // 1. Create a crawl job
    console.log('1️⃣  Creating crawl job...');
    const crawlJob = await crawlJobService.create({
      name: 'WebSocket Test Job',
      targetUrl: 'https://example.com/products',
      maxProducts: 5,
      status: 'pending',
    });
    console.log(`   ✅ Created job: ${crawlJob.id}\n`);

    // Subscribe to job updates
    socket.emit('job:subscribe', crawlJob.id);
    console.log(`   📡 Subscribed to job updates\n`);

    // Wait for job:created event
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2. Create a screenshot
    console.log('2️⃣  Creating screenshot with image upload...');
    const testImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 0, g: 128, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const imageResult = await imageStorageService.uploadScreenshot(
      testImageBuffer,
      'https://example.com/product/test-123',
      crawlJob.id
    );

    const screenshot = await screenshotService.create({
      crawlJobId: crawlJob.id,
      imageUrl: imageResult.url,
      thumbnailUrl: imageResult.thumbnailUrl,
      width: imageResult.width,
      height: imageResult.height,
      fileSize: imageResult.size,
      format: imageResult.format,
      productUrl: 'https://example.com/product/test-123',
      productName: 'Test Product',
    });
    console.log(`   ✅ Created screenshot: ${screenshot.id}\n`);

    // Wait for screenshot:captured event
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Update job status (simulate progress)
    console.log('3️⃣  Simulating job progress...');
    await crawlJobService.update(crawlJob.id, {
      status: 'running',
      productsFound: 1,
      productsScraped: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    await crawlJobService.update(crawlJob.id, {
      productsScraped: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('   ✅ Job progress updated\n');

    // 4. Create OCR result
    console.log('4️⃣  Creating OCR result...');
    const ocrResult = await ocrResultService.create({
      screenshotId: screenshot.id,
      status: 'completed',
      confidence: 0.95,
      fullText: 'Art.Nr. WS-12345\nPreis: 99.99 EUR',
      articleNumber: 'WS-12345',
      price: 99.99,
      productName: 'Test Product',
    });
    console.log(`   ✅ Created OCR result: ${ocrResult.id}\n`);

    // Wait for ocr:completed event
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 5. Complete job
    console.log('5️⃣  Completing job...');
    await crawlJobService.update(crawlJob.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    console.log('   ✅ Job completed\n');

    // Wait for events to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 6. Cleanup
    console.log('6️⃣  Cleaning up test data...');
    if (imageResult.fileId) {
      await imageStorageService.deleteImage(imageResult.fileId);
    }
    if (imageResult.thumbnailFileId) {
      await imageStorageService.deleteImage(imageResult.thumbnailFileId);
    }
    await crawlJobService.delete(crawlJob.id);
    console.log('   ✅ Cleanup complete\n');

    // Results
    console.log('='.repeat(50));
    console.log('\n📊 Test Results:\n');
    console.log(`✅ Job Created Events:       ${receivedEvents.jobCreated}`);
    console.log(`✅ Job Updated Events:       ${receivedEvents.jobUpdated}`);
    console.log(`✅ Job Completed Events:     ${receivedEvents.jobCompleted}`);
    console.log(`✅ Screenshot Captured:      ${receivedEvents.screenshotCaptured}`);
    console.log(`✅ OCR Completed Events:     ${receivedEvents.ocrCompleted}`);

    const totalEvents =
      receivedEvents.jobCreated +
      receivedEvents.jobUpdated +
      receivedEvents.jobCompleted +
      receivedEvents.screenshotCaptured +
      receivedEvents.ocrCompleted;

    console.log(`\n📡 Total Events Received:    ${totalEvents}`);

    if (totalEvents >= 5) {
      console.log('\n✨ WebSocket Integration: SUCCESS!');
      console.log('   All real-time events are working correctly.\n');
    } else {
      console.log('\n⚠️  WebSocket Integration: INCOMPLETE');
      console.log(`   Expected at least 5 events, got ${totalEvents}\n`);
    }

    console.log('='.repeat(50));
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    socket.disconnect();
    console.log('\n🔌 Disconnected from WebSocket server');
    process.exit(0);
  }
}

// Run test
console.log('\n⏳ Starting server and waiting for WebSocket connection...');
console.log('   Make sure the backend server is running (npm run dev)\n');

setTimeout(() => {
  testWebSocket();
}, 2000);
