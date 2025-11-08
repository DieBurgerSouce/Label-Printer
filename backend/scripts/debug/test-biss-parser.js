/**
 * Test the BiSS/Biss parser fix
 */

// Simulate the fixOCRNumberErrors function
function fixOCRNumberErrors(text) {
  return text
    // "SO" -> "50"
    .replace(/SO(?=\s|$|[^\w])/gi, '50')
    // "O" -> "0"
    .replace(/([0-9])O([0-9])/g, '$10$2')
    .replace(/O([0-9])/g, '0$1')
    .replace(/([0-9])O\b/g, '$10')
    // "l" or "I" -> "1"
    .replace(/\bl\b/g, '1')
    .replace(/\bI\b/g, '1')
    // ⚡ NEW: "BiSS" or "Biss" -> "Bis"
    .replace(/BiSS\b/gi, 'Bis')
    .replace(/Biss\b/gi, 'Bis');
}

// Simulate parseTieredPrices
function parseTieredPrices(text) {
  const prices = [];
  const lines = text.split('\n');

  const pricePattern = /(?:bis|ab)\s*(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/i;

  for (let line of lines) {
    // Apply OCR error corrections
    line = fixOCRNumberErrors(line);

    const match = line.match(pricePattern);
    if (match) {
      prices.push({
        quantity: parseInt(match[1]),
        price: match[2].replace(',', '.')
      });
    }
  }

  return prices;
}

// Test #4631
console.log('\n📦 Testing Article #4631 (ACCUSHARP):');
const text4631 = `Anzahl Stückpreis
BiSS 12,61 €*
Bis 11 11,53 €&*
Bis 23 11,01 €*
Ab24 10,24 €&*`;

const result4631 = parseTieredPrices(text4631);
console.log(`   Found ${result4631.length} tiers (expected 4)`);
console.log(`   Tiers:`, JSON.stringify(result4631, null, 2));

// Test #8358
console.log('\n📦 Testing Article #8358 (Papiertragetasche):');
const text8358 = `Anzahl Stückpreis Grundpreis

Biss 35,60 €* 0,14 €*/ 1 Stück
Bis 11 33,54 €* 0,13 €*/1 Stück
Bis 49 22,70 €* 0,09 €*/ 1 Stück
Ab 50 20,59 €* 0,08 €*/ 1 Stück`;

const result8358 = parseTieredPrices(text8358);
console.log(`   Found ${result8358.length} tiers (expected 4)`);
console.log(`   Tiers:`, JSON.stringify(result8358, null, 2));

console.log('\n');
