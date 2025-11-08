/**
 * TEST SCRIPT - Test the fixed tiered price parser
 * This runs LOCALLY without touching the database!
 */

// Simulate the fixOCRNumberErrors function
function fixOCRNumberErrors(text) {
  return text
    // "SO" -> "50" (very common in German price tables - in "AbSO", "BisSO", etc.)
    .replace(/SO(?=\s|$|[^\w])/gi, '50')  // ⚡ FIX: Lookahead instead of \b
    // "O" (letter) -> "0" (digit) when surrounded by digits or at end
    .replace(/([0-9])O([0-9])/g, '$10$2')
    .replace(/O([0-9])/g, '0$1')
    .replace(/([0-9])O\b/g, '$10')
    // "l" (lowercase L) or "I" (uppercase i) -> "1"
    .replace(/\bl\b/g, '1')
    .replace(/\bI\b/g, '1');
}

// Fixed parser
function parseTieredPrices(text) {
  const prices = [];
  const lines = text.split('\n');

  // ⚡ FIX: Match "Bis" or "Ab" prefix to get the right quantity!
  const pricePattern = /(?:bis|ab)\s*(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/i;

  for (let line of lines) {
    const originalLine = line;
    // Apply OCR error corrections
    line = fixOCRNumberErrors(line);

    console.log(`Line: "${originalLine}" → "${line}"`);

    // Use match() instead of exec()
    const match = line.match(pricePattern);
    if (match) {
      console.log(`  ✅ Matched: quantity=${match[1]}, price=${match[2]}`);
      prices.push({
        quantity: parseInt(match[1]),
        price: match[2].replace(',', '.')
      });
    } else {
      console.log(`  ❌ No match!`);
    }
  }

  return prices;
}

// TEST DATA from article #8116
const testInput = "Anzahl Stückpreis\nBis9 11,96 €&*\nBis 19 10,64 €*\nBis 49 9,96 €*\nAbSO 9,30 €*";

console.log('🧪 TESTING PARSER FIX\n');
console.log('Input:');
console.log(testInput);
console.log('\n---\n');

const result = parseTieredPrices(testInput);

console.log('Result:');
console.log(JSON.stringify(result, null, 2));
console.log('\n---\n');

console.log(`✅ Found ${result.length} tiers (expected: 4)`);

if (result.length === 4) {
  console.log('✅ TEST PASSED!');
  process.exit(0);
} else {
  console.log('❌ TEST FAILED!');
  process.exit(1);
}
