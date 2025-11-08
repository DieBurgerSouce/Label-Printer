/**
 * Test if HTML data is actually loaded and used
 */
const { robustOCRService } = require('./dist/services/robust-ocr-service.js');

async function test() {
  console.log('\n🧪 Testing HTML-only data loading...\n');

  // Use existing screenshot dir with html-data.json
  const screenshotDir = '/app/data/screenshots/736500ee-f015-477f-a2aa-3dfd40150687';
  const articleNumber = '7034';

  console.log(`📂 Testing with: ${screenshotDir}/${articleNumber}`);
  console.log(`   (This directory has html-data.json with 4 tiered prices)\n`);

  try {
    const result = await robustOCRService.processArticleElements(screenshotDir, articleNumber);

    console.log('\n✅ Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Article: ${result.data.articleNumber}`);
    console.log(`   Product: ${result.data.productName}`);
    console.log(`   Tiered Prices: ${result.data.tieredPrices?.length || 0} tiers`);

    if (result.data.tieredPrices && result.data.tieredPrices.length > 0) {
      console.log('\n📊 Tiered Prices:');
      result.data.tieredPrices.forEach((tier, i) => {
        console.log(`   ${i+1}. Qty ${tier.quantity}: ${tier.price}€`);
      });
    }

    console.log(`\n🎯 Source: ${result.source.tieredPrices}`);
    console.log(`📈 Confidence: ${(result.confidence.tieredPrices * 100).toFixed(0)}%`);

    if (result.data.tieredPrices && result.data.tieredPrices.length === 4) {
      console.log('\n✅ SUCCESS! HTML data loaded with all 4 tiered prices!\n');
    } else {
      console.log('\n❌ FAILED! Expected 4 tiered prices\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

test();
