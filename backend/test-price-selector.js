/**
 * Test if table.product-block-prices-grid selector works
 */
import puppeteer from 'puppeteer';

const TEST_URLS = [
  'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
  'https://shop.firmenich.de/CAS/Akku-fuer-PR-II-und-SW-II',
];

async function testSelector(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${url}`);
    console.log('='.repeat(80));

    // Test primary selector (table)
    const table = await page.$('table.product-block-prices-grid');
    if (table) {
      const box = await table.boundingBox();
      console.log('✓ Found table.product-block-prices-grid');
      console.log(`  Position: (${Math.round(box.x)}, ${Math.round(box.y)})`);
      console.log(`  Size: ${Math.round(box.width)}x${Math.round(box.height)}`);

      const rows = await table.evaluate(t => t.rows?.length || 0);
      console.log(`  Rows: ${rows}`);
    } else {
      console.log('❌ table.product-block-prices-grid NOT FOUND');
    }

    // Test fallback selector
    const price = await page.$('.product-detail-price');
    if (price) {
      const box = await price.boundingBox();
      const text = await price.evaluate(el => el.textContent?.trim() || '');
      console.log('\n✓ Found .product-detail-price');
      console.log(`  Position: (${Math.round(box.x)}, ${Math.round(box.y)})`);
      console.log(`  Size: ${Math.round(box.width)}x${Math.round(box.height)}`);
      console.log(`  Text: "${text}"`);
    } else {
      console.log('\n❌ .product-detail-price NOT FOUND');
    }

    // Test what the CODE would actually select
    console.log('\n--- WHAT THE CODE SELECTS ---');
    let element = await page.$('table.product-block-prices-grid');
    if (!element) {
      element = await page.$('.product-detail-price');
      console.log('Using FALLBACK: .product-detail-price');
    } else {
      console.log('Using PRIMARY: table.product-block-prices-grid');
    }

    if (element) {
      const box = await element.boundingBox();
      console.log(`Final screenshot would be: ${Math.round(box.width)}x${Math.round(box.height)} px`);
    }

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }

  await browser.close();
}

async function main() {
  for (const url of TEST_URLS) {
    await testSelector(url);
  }
}

main().catch(console.error);
