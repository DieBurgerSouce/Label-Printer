/**
 * Check both price layouts on shop.firmenich.de
 */
import puppeteer from 'puppeteer';

const KNOWN_WORKING_URL = 'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt';

async function analyzePage(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`\nAnalyzing: ${url}`);
    console.log('='.repeat(80));

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Check for tiered price table
    const tieredPriceTable = await page.$('table.product-block-prices-grid');
    console.log(`\n✓ Tiered price table: ${tieredPriceTable ? 'FOUND' : 'NOT FOUND'}`);

    if (tieredPriceTable) {
      const tableInfo = await tieredPriceTable.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          rows: el.rows?.length || 0,
          visible: rect.width > 0 && rect.height > 0,
          position: { x: Math.round(rect.x), y: Math.round(rect.y) },
          size: { width: Math.round(rect.width), height: Math.round(rect.height) },
          text: el.textContent?.substring(0, 200),
        };
      });
      console.log(`  Rows: ${tableInfo.rows}`);
      console.log(`  Visible: ${tableInfo.visible}`);
      console.log(`  Position: (${tableInfo.position.x}, ${tableInfo.position.y})`);
      console.log(`  Size: ${tableInfo.size.width}x${tableInfo.size.height}`);
      console.log(`  Text preview: ${tableInfo.text?.trim().substring(0, 100)}`);
    }

    // Check for simple price
    const simplePrice = await page.$('.product-price');
    console.log(`\n✓ Simple price element: ${simplePrice ? 'FOUND' : 'NOT FOUND'}`);

    if (simplePrice) {
      const priceInfo = await simplePrice.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          visible: rect.width > 0 && rect.height > 0,
          text: el.textContent?.substring(0, 100),
        };
      });
      console.log(`  Visible: ${priceInfo.visible}`);
      console.log(`  Text: ${priceInfo.text?.trim()}`);
    }

    // Find ALL elements with "price" in class
    console.log(`\n✓ All price-related selectors:`);
    const priceSelectors = [
      '.product-detail-price',
      '.product-price-info',
      '.buy-widget',
      '.product-detail-buy',
      '.product-block-prices',
    ];

    for (const sel of priceSelectors) {
      const elem = await page.$(sel);
      if (elem) {
        const info = await elem.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            visible: rect.width > 0 && rect.height > 0,
          };
        });
        console.log(`  - ${sel}: ${info.tag} (visible: ${info.visible})`);
      }
    }

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }

  await browser.close();
}

async function main() {
  // Test the one URL we know works
  await analyzePage(KNOWN_WORKING_URL);

  // Now let's find more products by crawling the category page
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('Finding more product URLs from category page...');
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://shop.firmenich.de/Kartons', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Find product links
    const productLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a.product-box-link, a.product-link, a[href*="/Kartons/"]').forEach(a => {
        if (a.href && a.href.includes('shop.firmenich.de/Kartons/') && !a.href.endsWith('/Kartons')) {
          links.push(a.href);
        }
      });
      return links;
    });

    const uniqueLinks = [...new Set(productLinks)].slice(0, 5);
    console.log(`\nFound ${uniqueLinks.length} product URLs:`);
    uniqueLinks.forEach((url, i) => console.log(`${i + 1}. ${url}`));

    // Test first 2 products
    for (let i = 0; i < Math.min(2, uniqueLinks.length); i++) {
      await analyzePage(uniqueLinks[i]);
    }

  } catch (error) {
    console.error(`ERROR crawling category: ${error.message}`);
  }

  await browser.close();
}

main().catch(console.error);
