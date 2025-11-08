const fs = require('fs');
const path = require('path');

const labelsDir = '/app/data/labels';
const dirs = fs.readdirSync(labelsDir).filter(d => {
  const stat = fs.statSync(path.join(labelsDir, d));
  return stat.isDirectory();
});

console.log('\n🔍 Searching for articles...\n');

let staffelpreiseCount = 0;
let singlePriceCount = 0;
let singlePriceExample = null;
let staffelpreiseExample = null;

for (const dir of dirs) {
  try {
    const labelPath = path.join(labelsDir, dir, 'label.json');
    if (fs.existsSync(labelPath)) {
      const content = JSON.parse(fs.readFileSync(labelPath, 'utf-8'));
      
      if (content.priceInfo.staffelpreise && content.priceInfo.staffelpreise.length > 0) {
        staffelpreiseCount++;
        if (!staffelpreiseExample) {
          staffelpreiseExample = {
            id: content.id,
            articleNumber: content.articleNumber,
            productName: content.productName,
            tierCount: content.priceInfo.staffelpreise.length
          };
        }
      } else {
        singlePriceCount++;
        if (!singlePriceExample) {
          singlePriceExample = {
            id: content.id,
            articleNumber: content.articleNumber,
            productName: content.productName,
            price: content.priceInfo.price
          };
        }
      }
    }
  } catch (err) {
    // Skip invalid JSON files
  }
}

console.log(`📊 Found:`);
console.log(`   - Staffelpreise articles: ${staffelpreiseCount}`);
console.log(`   - Single price articles: ${singlePriceCount}`);

if (singlePriceExample) {
  console.log(`\n💰 Single price example:`);
  console.log(`   #${singlePriceExample.articleNumber}: ${singlePriceExample.productName}`);
  console.log(`   Price: ${singlePriceExample.price}€`);
  console.log(`   ID: ${singlePriceExample.id}`);
}

if (staffelpreiseExample) {
  console.log(`\n📊 Staffelpreise example:`);
  console.log(`   #${staffelpreiseExample.articleNumber}: ${staffelpreiseExample.productName}`);
  console.log(`   Tiers: ${staffelpreiseExample.tierCount}`);
  console.log(`   ID: ${staffelpreiseExample.id}\n`);
}
