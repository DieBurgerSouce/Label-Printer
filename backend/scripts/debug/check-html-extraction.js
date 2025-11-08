/**
 * Check HTML extraction for article #5020
 */

const puppeteer = require('puppeteer');

async function checkHtmlExtraction() {
  console.log('\n🔍 Analyzing HTML extraction for Article #5020...\n');

  const url = 'https://shop.firmenich.de/Solinger-Messerwelten/Bandstahlputzmesser-gelb-gelb-ohne-Aufdruck';

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Extract tiered prices using the same selectors as HtmlExtractionService
  const result = await page.evaluate(() => {
    const tableSelectors = [
      '.product-detail-price-table',
      'table.price-table',
      'table[class*="price"]',
      '.price-table',
      '.staffelpreise'
    ];

    let priceTable = null;
    for (const selector of tableSelectors) {
      priceTable = document.querySelector(selector);
      if (priceTable) {
        console.log(`Found table with selector: ${selector}`);
        break;
      }
    }

    if (!priceTable) {
      return { error: 'No price table found', html: document.body.innerHTML.substring(0, 1000) };
    }

    const rows = priceTable.querySelectorAll('tr');
    const extractedPrices = [];
    const allRows = [];

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td, th');
      const rowText = Array.from(cells).map(c => c.textContent.trim()).join(' | ');
      allRows.push(`Row ${index}: ${rowText}`);

      if (cells.length >= 2) {
        const quantityText = cells[0].textContent.trim();
        const priceText = cells[1].textContent.trim();

        extractedPrices.push({
          quantityText,
          priceText,
          cellCount: cells.length
        });
      }
    });

    return {
      selector: tableSelectors.find(s => document.querySelector(s)),
      rowCount: rows.length,
      extractedPrices,
      allRows,
      tableHTML: priceTable.outerHTML
    };
  });

  console.log('📊 Extraction Results:');
  console.log(`   Selector: ${result.selector}`);
  console.log(`   Total rows: ${result.rowCount}`);
  console.log(`\n📋 All Rows:`);
  result.allRows.forEach(row => console.log(`   ${row}`));
  console.log(`\n💰 Extracted Prices (${result.extractedPrices.length}):`);
  result.extractedPrices.forEach((p, i) => {
    console.log(`   ${i + 1}. Quantity: "${p.quantityText}" | Price: "${p.priceText}"`);
  });

  console.log(`\n📄 Table HTML:`);
  console.log(result.tableHTML);

  await browser.close();
}

checkHtmlExtraction().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
