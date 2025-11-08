/**
 * Test complete flow: RobustOCR -> Conversion -> ProductService
 * This tests the EXACT flow from automation-service.ts with the fixed data structure
 */

const { RobustOCRService } = require('./dist/services/robust-ocr-service.js');
const { ProductService } = require('./dist/services/product-service.js');
const { v4: uuidv4 } = require('uuid');

async function testCompleteFlow() {
  console.log('\n🧪 Testing COMPLETE flow with product-service\n');
  console.log('='.repeat(60));

  const screenshotDir = 'data/screenshots/2e8ae9c6-86b8-435d-b84c-3068eb25257f';
  const articleNumber = '8116';

  try {
    // Step 1: Extract data using RobustOCRService
    console.log('\n📸 Step 1: Extract data from screenshots');
    console.log('  Directory:', screenshotDir);
    console.log('  Article:', articleNumber);

    const robustOCRService = new RobustOCRService();
    await robustOCRService.initialize();

    const robustResult = await robustOCRService.processArticleElements(screenshotDir, articleNumber);

    console.log('\n📦 Extraction result:');
    console.log('  articleNumber:', robustResult.articleNumber);
    console.log('  success:', robustResult.success);
    console.log('  productName:', robustResult.data.productName);
    console.log('  price:', robustResult.data.price);
    console.log('  tieredPrices:', JSON.stringify(robustResult.data.tieredPrices, null, 2));

    // Step 2: Convert to format expected by product-service (FIXED VERSION)
    console.log('\n🔧 Step 2: Convert to product-service format');
    console.log('  Using NEW structure with extractedData wrapper');

    const ocrResult = {
      id: uuidv4(),
      screenshotId: uuidv4(),
      success: robustResult.success,
      productUrl: 'https://shop.firmenich.de/test',
      confidence: robustResult.confidence?.overall || 0,
      extractedData: {
        articleNumber: robustResult.articleNumber,
        productName: robustResult.data.productName || '',
        description: robustResult.data.description || '',
        price: robustResult.data.price || 0,
        tieredPrices: robustResult.data.tieredPrices || [],
        tieredPricesText: robustResult.data.tieredPricesText || '',
        ean: robustResult.data.ean || null,
        sourceUrl: 'https://shop.firmenich.de/test'
      }
    };

    console.log('\n📋 Converted ocrResult:');
    console.log('  success:', ocrResult.success);
    console.log('  extractedData.articleNumber:', ocrResult.extractedData.articleNumber);
    console.log('  extractedData.productName:', ocrResult.extractedData.productName);
    console.log('  extractedData.tieredPrices:', JSON.stringify(ocrResult.extractedData.tieredPrices, null, 2));

    // Step 3: Save using ProductService
    console.log('\n💾 Step 3: Save to database using ProductService');

    const results = await ProductService.processOcrResultsFromAutomation(
      [ocrResult],
      '2e8ae9c6-86b8-435d-b84c-3068eb25257f'
    );

    console.log('\n📊 Product processing results:');
    console.log('  Created:', results.created);
    console.log('  Updated:', results.updated);
    console.log('  Skipped:', results.skipped);
    console.log('  Errors:', results.errors);

    if (results.created > 0 || results.updated > 0) {
      console.log('\n✅ SUCCESS: Product was saved to database!');
    } else if (results.skipped > 0) {
      console.log('\n❌ FAILED: Product was skipped');
    } else {
      console.log('\n⚠️  WARNING: Unexpected result');
    }

    await robustOCRService.cleanup();

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    throw error;
  }

  console.log('\n' + '='.repeat(60));
}

testCompleteFlow()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
