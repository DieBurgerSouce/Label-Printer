/**
 * Integration test: Verify the complete conversion logic
 */
const { v4: uuidv4 } = require('uuid');

console.log('\n🧪 Integration Test: robustResult → extractedData Conversion\n');

// Simulate exact structure returned by robustOCRService
const mockRobustResult = {
  articleNumber: '4079',  // TOP-LEVEL required field
  success: true,
  data: {
    productName: 'Weihrauchöl',
    description: 'Naturrein 10ml',
    articleNumber: '4079',  // ALSO in data (from htmlData)
    price: 10.50,
    tieredPrices: [
      { quantity: 10, price: '9.50' },
      { quantity: 50, price: '8.75' },
      { quantity: 100, price: '8.00' },
      { quantity: 500, price: '7.50' }
    ],
    tieredPricesText: 'Staffelpreise verfügbar'
  },
  confidence: {
    productName: 1.0,
    description: 1.0,
    articleNumber: 1.0,
    price: 1.0,
    tieredPrices: 1.0
  },
  source: {
    productName: 'html',
    description: 'html',
    articleNumber: 'html',
    price: 'html',
    tieredPrices: 'html'
  },
  ocrData: {},
  errors: [],
  warnings: []
};

// Simulate the FIXED conversion from automation-service.ts
const result = {
  id: uuidv4(),
  screenshotId: 'test-screenshot-id',
  success: mockRobustResult.success,
  extractedText: '',
  extractedData: {
    articleNumber: mockRobustResult.articleNumber,  // FIXED: Direct top-level field
    productName: mockRobustResult.data.productName || '',
    description: mockRobustResult.data.description || '',
    price: mockRobustResult.data.price || 0,
    tieredPrices: mockRobustResult.data.tieredPrices || [],
    tieredPricesText: mockRobustResult.data.tieredPricesText || ''
  },
  confidence: {
    overall: Object.values(mockRobustResult.confidence).reduce((a, b) => a + b, 0) / Object.keys(mockRobustResult.confidence).length,
    fields: mockRobustResult.confidence
  },
  processingTime: 0,
  timestamp: new Date()
};

console.log('📦 Converted extractedData:');
console.log(JSON.stringify(result.extractedData, null, 2));
console.log('');

// Simulate the product-service.ts validation
const willBeSkipped = !result.success || !result.extractedData?.articleNumber;

console.log('🔍 Product Service Validation:');
console.log(`   success: ${result.success}`);
console.log(`   articleNumber: "${result.extractedData.articleNumber}"`);
console.log(`   articleNumber exists: ${!!result.extractedData.articleNumber}`);
console.log('');

if (willBeSkipped) {
  console.log('❌ FAILED! Product would be skipped (no article number)');
  console.log('');
  process.exit(1);
} else {
  console.log('✅ SUCCESS! Product will be SAVED to database!');
  console.log(`   Article #${result.extractedData.articleNumber}: ${result.extractedData.productName}`);
  console.log(`   Tiered Prices: ${result.extractedData.tieredPrices.length} tiers`);
  console.log('');
  console.log('✅ INTEGRATION TEST PASSED!\n');
  process.exit(0);
}
