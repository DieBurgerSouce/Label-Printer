/**
 * Test two specific products
 */

import puppeteer from 'puppeteer';
import { PreciseScreenshotService } from './src/services/precise-screenshot-service';

const TEST_URLS = [
  {
    name: 'Big-Box',
    url: 'https://shop.firmenich.de/Grossbehaelter/Big-Box-Masse-120-x-100-x-79-cm-D-F'
  },
  {
    name: 'Spargelkarton',
    url: 'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt'
  }
];

async function testProducts() {
  console.log('🚀 Testing specific products');
  console.log('=' .repeat(80));

  const browser = await puppeteer.launch({
    headless: false, // Show browser
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

  const service = new PreciseScreenshotService('./test-two-products');

  try {
    for (const test of TEST_URLS) {
      console.log(`\n📋 Testing: ${test.name}`);
      console.log(`📍 URL: ${test.url}`);
      console.log('-'.repeat(60));

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      const jobId = `test-articlenumber`;
      const results = await service.captureProductScreenshots(
        page,
        test.url,
        jobId
      );

      console.log(`\n📊 Results for ${test.name}:`);
      console.log(`Layout: ${results.layoutType}`);
      console.log(`Screenshots captured: ${results.screenshots.filter(s => s.success).length}`);

      console.log('\n📸 Screenshot details:');
      results.screenshots.forEach(screenshot => {
        if (screenshot.success) {
          console.log(`✅ ${screenshot.type}: ${(screenshot.fileSize! / 1024).toFixed(1)} KB - ${screenshot.dimensions?.width}x${screenshot.dimensions?.height}px`);
        } else {
          console.log(`❌ ${screenshot.type}: ${screenshot.error}`);
        }
      });

      await page.close();
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed!');
    console.log('📁 Screenshots saved in: ./test-two-products/');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

testProducts();