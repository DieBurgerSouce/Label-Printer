/**
 * Test Script for Supabase + ImageKit Integration
 * Run this after setting up the database tables
 */

import {
  crawlJobService,
  screenshotService,
  ocrResultService,
  automationJobService,
} from './src/services/database-service.js';
import { imageStorageService } from './src/services/image-storage-service.js';
import sharp from 'sharp';

async function testIntegration() {
  console.log('\n🚀 Testing Supabase + ImageKit Integration\n');
  console.log('='.repeat(50));

  try {
    // ============================================
    // 1. TEST DATABASE - Create Crawl Job
    // ============================================
    console.log('\n📦 1. Testing Database (Supabase)...\n');

    const crawlJob = await crawlJobService.create({
      name: 'Test Integration Job',
      targetUrl: 'https://example.com/products',
      maxProducts: 10,
      status: 'pending',
    });

    console.log('✅ Created crawl job:', {
      id: crawlJob.id,
      name: crawlJob.name,
      status: crawlJob.status,
    });

    // ============================================
    // 2. TEST IMAGE UPLOAD - Create Test Image
    // ============================================
    console.log('\n🖼️  2. Testing Image Upload (ImageKit)...\n');

    // Create a test image (500x500 red square)
    const testImageBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const imageResult = await imageStorageService.uploadScreenshot(
      testImageBuffer,
      'https://example.com/product/123',
      crawlJob.id
    );

    console.log('✅ Uploaded image to ImageKit:', {
      fileId: imageResult.fileId,
      url: imageResult.url.substring(0, 60) + '...',
      size: `${(imageResult.size / 1024).toFixed(2)} KB`,
      dimensions: `${imageResult.width}x${imageResult.height}`,
      hasThumbnail: !!imageResult.thumbnailUrl,
    });

    // ============================================
    // 3. TEST DATABASE - Save Screenshot Record
    // ============================================
    console.log('\n💾 3. Saving screenshot to database...\n');

    const screenshot = await screenshotService.create({
      crawlJobId: crawlJob.id,
      imageUrl: imageResult.url,
      thumbnailUrl: imageResult.thumbnailUrl,
      width: imageResult.width,
      height: imageResult.height,
      fileSize: imageResult.size,
      format: imageResult.format,
      productUrl: 'https://example.com/product/123',
      productName: 'Test Product',
    });

    console.log('✅ Saved screenshot:', {
      id: screenshot.id,
      imageUrl: screenshot.imageUrl.substring(0, 60) + '...',
      productName: screenshot.productName,
    });

    // ============================================
    // 4. TEST DATABASE - Create OCR Result
    // ============================================
    console.log('\n🔍 4. Creating OCR result...\n');

    const ocrResult = await ocrResultService.create({
      screenshotId: screenshot.id,
      status: 'completed',
      confidence: 0.95,
      fullText: 'Art.Nr. 12345\nPreis: 49.99 EUR\nStaffelpreis: 10 Stk. = 45.99 EUR',
      articleNumber: '12345',
      price: 49.99,
      productName: 'Test Product',
      tieredPrices: [
        { quantity: 1, price: 49.99 },
        { quantity: 10, price: 45.99 },
      ],
    });

    console.log('✅ Created OCR result:', {
      id: ocrResult.id,
      articleNumber: ocrResult.articleNumber,
      price: ocrResult.price,
      confidence: ocrResult.confidence,
    });

    // ============================================
    // 5. TEST DATABASE - Query Data
    // ============================================
    console.log('\n📊 5. Querying data...\n');

    const jobs = await crawlJobService.list({ limit: 5 });
    console.log(`✅ Found ${jobs.length} crawl jobs`);

    const screenshots = await screenshotService.getByJobId(crawlJob.id);
    console.log(`✅ Found ${screenshots.length} screenshots for job`);

    const retrievedOcr = await ocrResultService.getByScreenshotId(screenshot.id);
    console.log(`✅ Retrieved OCR result: ${retrievedOcr?.articleNumber}`);

    // ============================================
    // 6. TEST UPDATE
    // ============================================
    console.log('\n✏️  6. Testing updates...\n');

    const updatedJob = await crawlJobService.update(crawlJob.id, {
      status: 'completed',
      productsFound: 1,
      productsScraped: 1,
      completedAt: new Date().toISOString(),
    });

    console.log('✅ Updated job status:', updatedJob.status);

    // ============================================
    // 7. CLEANUP
    // ============================================
    console.log('\n🧹 7. Cleaning up test data...\n');

    // Delete image from ImageKit
    if (imageResult.fileId) {
      await imageStorageService.deleteImage(imageResult.fileId);
      console.log('✅ Deleted image from ImageKit');
    }

    if (imageResult.thumbnailFileId) {
      await imageStorageService.deleteImage(imageResult.thumbnailFileId);
      console.log('✅ Deleted thumbnail from ImageKit');
    }

    // Delete from database (cascade will delete related records)
    await crawlJobService.delete(crawlJob.id);
    console.log('✅ Deleted crawl job and related records from database');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('\n✨ ALL TESTS PASSED!\n');
    console.log('✅ Supabase database: Working');
    console.log('✅ ImageKit CDN: Working');
    console.log('✅ Database queries: Working');
    console.log('✅ Image upload/delete: Working');
    console.log('✅ Data persistence: Working\n');
    console.log('🎉 Integration is complete and ready to use!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nError details:', error);

    if (error.message.includes('Could not find the table')) {
      console.log('\n📝 Next step: Run the SQL script in Supabase Dashboard');
      console.log('   https://supabase.com/dashboard/project/jctdnesaafgncovopnyx/sql/new');
      console.log('   Copy content from: backend/prisma/migrations/init.sql\n');
    }

    process.exit(1);
  }
}

// Run test
testIntegration();
