/**
 * Test HTML Extraction Service with the fix
 */

import puppeteer from 'puppeteer';
import { HtmlExtractionService } from './dist/services/html-extraction-service.js';

async function testHtmlService() {
  console.log('\n🧪 Testing HTML Extraction Service for Article #5020...\n');

  const url = 'https://shop.firmenich.de/Solinger-Messerwelten/Bandstahlputzmesser-gelb-gelb-ohne-Aufdruck';

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const service = new HtmlExtractionService();
  const result = await service.extractProductData(page);

  console.log('📦 Extracted Product Data:');
  console.log(`   Product Name: ${result.productName}`);
  console.log(`   Article Number: ${result.articleNumber}`);
  console.log(`   Price: ${result.price || 'N/A'}`);
  console.log(`\n💰 Tiered Prices (${result.tieredPrices?.length || 0}):`);

  if (result.tieredPrices && result.tieredPrices.length > 0) {
    result.tieredPrices.forEach((tp, i) => {
      console.log(`   ${i + 1}. Quantity: ${tp.quantity}, Price: ${tp.price}`);
    });
  } else {
    console.log('   ❌ No tiered prices extracted!');
  }

  console.log(`\n📊 Confidence:`);
  console.log(`   Product Name: ${(result.confidence.productName * 100).toFixed(0)}%`);
  console.log(`   Article Number: ${(result.confidence.articleNumber * 100).toFixed(0)}%`);
  console.log(`   Price: ${(result.confidence.price * 100).toFixed(0)}%`);
  console.log(`   Tiered Prices: ${(result.confidence.tieredPrices * 100).toFixed(0)}%`);

  const validation = service.validateExtractedData(result);
  console.log(`\n✅ Validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
  if (validation.warnings.length > 0) {
    console.log(`   Warnings: ${validation.warnings.join(', ')}`);
  }

  await browser.close();

  if (result.tieredPrices?.length === 4) {
    console.log('\n✅ SUCCESS: All 4 tiered prices extracted!\n');
  } else {
    console.log(`\n❌ FAILED: Expected 4 tiered prices, got ${result.tieredPrices?.length || 0}\n`);
    process.exit(1);
  }
}

testHtmlService().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
