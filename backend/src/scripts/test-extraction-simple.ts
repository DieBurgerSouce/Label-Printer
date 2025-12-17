import { HtmlExtractionService } from '../services/html-extraction-service';
import puppeteer from 'puppeteer';

async function testProduct(url: string, expectedArticleNumber: string, expectedPriceType: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Testing: ${url}`);
  console.log('='.repeat(80) + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const htmlService = new HtmlExtractionService();

    // Navigate
    console.log('🌐 Navigating to page...');
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    console.log('✓ Page loaded\n');

    // Extract
    console.log('📊 Extracting data...');
    const result = await htmlService.extractProductData(page);
    console.log('✓ Extraction complete\n');

    await page.close();

    // Display
    console.log('📋 Extraction Result:');
    console.log('─'.repeat(80));
    console.log(`Product Name:       ${result.productName || '❌'}`);
    console.log(`Article Number:     ${result.articleNumber || '❌'}`);
    console.log(`Price:              ${result.price !== undefined ? result.price : '❌'}`);
    console.log(`Price Type:         ${result.priceType || '❌'}`);
    console.log(`Tiered Prices Text: ${result.tieredPricesText || '(none)'}`);

    // Validate
    console.log('\n🎯 Validation:');
    console.log('─'.repeat(80));

    let allCorrect = true;

    if (result.articleNumber === expectedArticleNumber) {
      console.log(`✅ Article Number: CORRECT ("${result.articleNumber}")`);
    } else {
      console.log(`❌ Article Number: WRONG`);
      console.log(`   Expected: "${expectedArticleNumber}"`);
      console.log(`   Got:      "${result.articleNumber || 'nothing'}"`);
      allCorrect = false;
    }

    if (result.priceType === expectedPriceType) {
      console.log(`✅ Price Type: CORRECT ("${result.priceType}")`);
    } else {
      console.log(`❌ Price Type: WRONG`);
      console.log(`   Expected: "${expectedPriceType}"`);
      console.log(`   Got:      "${result.priceType || 'nothing'}"`);
      allCorrect = false;
    }

    if (result.priceType === 'auf_anfrage') {
      if (result.price === null && result.tieredPricesText === 'Preis auf Anfrage') {
        console.log(`✅ "Auf Anfrage" fields: ALL CORRECT!`);
      } else {
        console.log(`⚠️ "Auf Anfrage" fields: Some issues`);
        console.log(`   price: ${result.price} (expected: null)`);
        console.log(
          `   tieredPricesText: ${result.tieredPricesText} (expected: "Preis auf Anfrage")`
        );
        allCorrect = false;
      }
    } else if (expectedPriceType === 'normal') {
      // For normal products, check that we actually have a price
      if (result.price !== null && result.price !== undefined) {
        console.log(`✅ Normal product has price: ${result.price} EUR`);
      } else {
        console.log(`❌ Normal product should have price, but got: ${result.price}`);
        allCorrect = false;
      }
    }

    if (
      result.articleNumber &&
      (result.articleNumber.includes('-') || result.articleNumber.includes('.'))
    ) {
      console.log(`✅ Special chars in article number: "${result.articleNumber}"`);
    }

    return allCorrect;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🧪 Testing HTML extraction with fixed code...\n');

  let allTestsPassed = true;

  try {
    // Test 1: "Auf Anfrage" product
    const test1 = await testProduct(
      'https://shop.firmenich.de/Tape-Verbinder/Verbinder-Tape-16-mm-x-3-4-Aussengewinde',
      '3513',
      'auf_anfrage'
    );
    if (!test1) allTestsPassed = false;

    // Test 2: "Auf Anfrage" product with hyphen
    const test2 = await testProduct(
      'https://shop.firmenich.de/IrritecTape/Troepfchenschlauch-Irritec-Tape-5082027L',
      '3547-2',
      'auf_anfrage'
    );
    if (!test2) allTestsPassed = false;

    // Test 3: NORMAL product with PRICE (to ensure no false positive)
    console.log('\n📌 Testing NORMAL product with price (should NOT be "auf_anfrage"):');
    const test3 = await testProduct(
      'https://shop.firmenich.de/Banderolen-Raschelsaecke-Einschlagpapier/Raschelsaecke-fuer-5-kg-mit-Zugband-Mit-Zugband-5kg',
      '7900',
      'normal'
    );
    if (!test3) allTestsPassed = false;

    console.log('\n' + '='.repeat(80));
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED!');
    } else {
      console.log('❌ SOME TESTS FAILED!');
    }
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
