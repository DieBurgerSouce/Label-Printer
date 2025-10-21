/**
 * Test Precise Screenshot Service
 * Validates that screenshots match SS_Pos reference screenshots
 */

import puppeteer from 'puppeteer';
import { PreciseScreenshotService, LayoutType } from './src/services/precise-screenshot-service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test URLs
const TEST_CASES = [
  {
    name: 'Einzelpreis - Deckel für Big Box',
    url: 'https://shop.firmenich.de/Grossbehaelter/Deckel-fuer-Big-Box-120-x-100-cm',
    expectedLayout: LayoutType.SINGLE_PRICE,
    expectedElements: ['product-image', 'title', 'article-number', 'price', 'description']
  },
  {
    name: 'Staffelpreis - Spargelkarton',
    url: 'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
    expectedLayout: LayoutType.TIERED_PRICE,
    expectedElements: ['product-image', 'title', 'article-number', 'price-table', 'description']
  }
];

async function runTests() {
  console.log('🚀 Starting Precise Screenshot Tests');
  console.log('=' .repeat(80));

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  const service = new PreciseScreenshotService('./test-screenshots-precise');
  let allTestsPassed = true;

  try {
    for (const testCase of TEST_CASES) {
      console.log(`\n📋 Testing: ${testCase.name}`);
      console.log('-'.repeat(60));

      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Run screenshot capture
      const jobId = `test-${Date.now()}`;
      const results = await service.captureProductScreenshots(
        page,
        testCase.url,
        jobId
      );

      // Validate results
      console.log('\n📊 Validation Results:');

      // 1. Check layout detection
      if (results.layoutType === testCase.expectedLayout) {
        console.log(`✅ Layout detection: ${results.layoutType}`);
      } else {
        console.log(`❌ Layout detection: Expected ${testCase.expectedLayout}, got ${results.layoutType}`);
        allTestsPassed = false;
      }

      // 2. Check captured elements
      const capturedTypes = results.screenshots
        .filter(s => s.success)
        .map(s => s.type);

      console.log('\n📸 Captured Elements:');
      for (const expectedElement of testCase.expectedElements) {
        if (capturedTypes.includes(expectedElement)) {
          const screenshot = results.screenshots.find(s => s.type === expectedElement);
          if (screenshot?.fileSize && screenshot.fileSize > 100) {
            console.log(`✅ ${expectedElement}: ${(screenshot.fileSize / 1024).toFixed(1)} KB - ${screenshot.dimensions?.width}x${screenshot.dimensions?.height}px`);
          } else {
            console.log(`⚠️ ${expectedElement}: Captured but possibly empty (${screenshot?.fileSize} bytes)`);
            allTestsPassed = false;
          }
        } else {
          console.log(`❌ ${expectedElement}: Not captured`);
          allTestsPassed = false;
        }
      }

      // 3. Check for unexpected elements
      const unexpectedElements = capturedTypes.filter(
        type => !testCase.expectedElements.includes(type)
      );
      if (unexpectedElements.length > 0) {
        console.log(`⚠️ Unexpected elements captured: ${unexpectedElements.join(', ')}`);
      }

      // 4. Display errors
      const errors = results.screenshots.filter(s => !s.success);
      if (errors.length > 0) {
        console.log('\n⚠️ Errors:');
        errors.forEach(e => {
          console.log(`  - ${e.type}: ${e.error}`);
        });
      }

      // 5. File size analysis
      console.log('\n📏 File Size Analysis:');
      const totalSize = results.screenshots
        .filter(s => s.success && s.fileSize)
        .reduce((sum, s) => sum + (s.fileSize || 0), 0);
      console.log(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);

      await page.close();

      // Wait before next test
      await new Promise(r => setTimeout(r, 2000));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED!');
    } else {
      console.log('❌ SOME TESTS FAILED - Check the output above');
    }

    // Show where screenshots were saved
    console.log('\n📁 Screenshots saved in: ./test-screenshots-precise/');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

// Comparison with SS_Pos reference screenshots
async function compareWithReference() {
  console.log('\n🔍 Comparing with SS_Pos reference screenshots...');

  const referencePath = './data/screenshots/SS_Pos';

  // Map reference files to element types
  const referenceMapping = {
    'Screenshot 2025-10-20 000500.png': 'product-image',
    'Screenshot 2025-10-20 000511.png': 'title',
    'Screenshot 2025-10-20 000520.png': 'article-number',
    'Screenshot 2025-10-20 000527.png': 'price',
    'Screenshot 2025-10-20 000534.png': 'description',
    'Screenshot 2025-10-20 000546.png': 'price-table'
  };

  // This would compare the captured screenshots with references
  // Implementation depends on how you want to compare (size, pixels, etc.)

  console.log('📊 Reference comparison not yet implemented');
  console.log('   Please manually compare screenshots in test-screenshots-precise/');
  console.log('   with references in data/screenshots/SS_Pos/');
}

// Run tests
runTests()
  .then(() => compareWithReference())
  .catch(console.error);