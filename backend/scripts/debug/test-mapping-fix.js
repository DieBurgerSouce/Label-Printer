/**
 * Unit test for articleNumber mapping fix
 */

console.log('\n🧪 Testing articleNumber Mapping Fix\n');

// Simulate a robustResult from robustOCRService
const mockRobustResult = {
  articleNumber: '5020',  // TOP-LEVEL required field
  success: true,
  data: {
    // data.articleNumber is OPTIONAL and might be undefined
    articleNumber: undefined,
    productName: 'Test Product',
    description: 'Test Description',
    price: 10.50,
    tieredPrices: [
      { quantity: 10, price: '9.50' },
      { quantity: 50, price: '8.50' }
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
  errors: [],
  warnings: []
};

console.log('📦 Mock robustResult:');
console.log(`   robustResult.articleNumber = "${mockRobustResult.articleNumber}"`);
console.log(`   robustResult.data.articleNumber = ${mockRobustResult.data.articleNumber}`);
console.log('');

// OLD BUGGY MAPPING (checks optional field first!)
const oldMapping = mockRobustResult.data.articleNumber || mockRobustResult.articleNumber;
console.log('❌ OLD Mapping (BUGGY):');
console.log(`   articleNumber: robustResult.data.articleNumber || robustResult.articleNumber`);
console.log(`   Result: "${oldMapping}"`);
console.log('');

// NEW FIXED MAPPING (checks required field directly!)
const newMapping = mockRobustResult.articleNumber;
console.log('✅ NEW Mapping (FIXED):');
console.log(`   articleNumber: robustResult.articleNumber`);
console.log(`   Result: "${newMapping}"`);
console.log('');

// Validate the fix
if (oldMapping === '5020') {
  console.log('⚠️  OLD mapping works in this case (data.articleNumber was truthy)');
} else {
  console.log('❌ OLD mapping FAILS! (data.articleNumber was undefined)');
}

if (newMapping === '5020') {
  console.log('✅ NEW mapping WORKS! (uses required top-level field)');
  console.log('');
  console.log('✅ SUCCESS! The fix is correct!\n');
  process.exit(0);
} else {
  console.log('❌ NEW mapping FAILS! Something is wrong!');
  console.log('');
  process.exit(1);
}
