/**
 * Analyze price structure on shop.firmenich.de product pages
 */
import puppeteer from 'puppeteer';

const TEST_URLS = [
  'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
  'https://shop.firmenich.de/Kartons/Spargelkarton-10-kg-neutral-bedruckt',
  'https://shop.firmenich.de/Tueten-und-Beutel/Obsttute-2-kg',
  'https://shop.firmenich.de/Tueten-und-Beutel/Kartoffeltute-5-kg',
  'https://shop.firmenich.de/Kisten/Apfelkiste-10-kg',
  'https://shop.firmenich.de/Folien/Stretchfolie-23-my',
  'https://shop.firmenich.de/Papier/Packpapier-50-g',
];

async function analyzePage(url) {
  console.log('\n' + '='.repeat(80));
  console.log(`Analyzing: ${url}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find all possible price-related elements
    console.log('\n--- SEARCHING FOR PRICE ELEMENTS ---');

    // Test different selectors
    const selectors = [
      'table.product-block-prices-grid',
      '.product-price',
      '.product-block-prices',
      '[class*="price"]',
      'table[class*="price"]',
      '.price',
      '[data-price]',
      '.product-detail-price',
      '.product-price-info',
      '.price-table',
      '.tiered-price',
      '.staffelpreis',
      '.product-detail-buy',
      '.buy-widget',
      'table',
    ];

    for (const selector of selectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`\n✓ Found ${elements.length} element(s) with selector: "${selector}"`);

        // Get details of first element
        const details = await elements[0].evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            textContent: el.textContent?.substring(0, 200) || '',
            isVisible: rect.width > 0 && rect.height > 0,
            position: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          };
        });

        console.log(`  Tag: ${details.tagName}`);
        console.log(`  Class: ${details.className}`);
        console.log(`  ID: ${details.id}`);
        console.log(`  Visible: ${details.isVisible}`);
        console.log(`  Text: ${details.textContent.trim().substring(0, 100)}`);
        console.log(`  Position: (${details.position.x}, ${details.position.y}) Size: ${details.position.width}x${details.position.height}`);
      }
    }

    // Get all unique classes that contain "price"
    console.log('\n--- ALL CLASSES CONTAINING "PRICE" ---');
    const priceClasses = await page.evaluate(() => {
      const classes = new Set();
      document.querySelectorAll('[class*="price" i]').forEach(el => {
        el.className.split(' ').forEach(c => {
          if (c.toLowerCase().includes('price')) classes.add(c);
        });
      });
      return Array.from(classes).sort();
    });
    console.log(priceClasses.join(', ') || 'None found');

    // Get all table elements (might be price tables)
    console.log('\n--- ALL TABLES ON PAGE ---');
    const tables = await page.$$('table');
    console.log(`Found ${tables.length} table(s)`);

    for (let i = 0; i < Math.min(tables.length, 5); i++) {
      const tableInfo = await tables[i].evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          className: el.className,
          rowCount: el.rows?.length || 0,
          isVisible: rect.width > 0 && rect.height > 0,
          text: el.textContent?.substring(0, 150) || '',
        };
      });
      console.log(`\nTable ${i + 1}:`);
      console.log(`  Class: ${tableInfo.className}`);
      console.log(`  Rows: ${tableInfo.rowCount}`);
      console.log(`  Visible: ${tableInfo.isVisible}`);
      console.log(`  Text preview: ${tableInfo.text.trim().substring(0, 100)}`);
    }

    // Check specific product detail structure
    console.log('\n--- PRODUCT DETAIL CONTAINER ---');
    const productDetailClasses = await page.evaluate(() => {
      const productDetail = document.querySelector('.product-detail') || document.querySelector('[class*="product-detail"]');
      if (productDetail) {
        return {
          found: true,
          className: productDetail.className,
          childrenCount: productDetail.children.length,
          firstChildClasses: Array.from(productDetail.children).slice(0, 5).map(c => c.className),
        };
      }
      return { found: false };
    });

    if (productDetailClasses.found) {
      console.log(`Found product-detail container:`);
      console.log(`  Class: ${productDetailClasses.className}`);
      console.log(`  Children: ${productDetailClasses.childrenCount}`);
      console.log(`  First child classes:`, productDetailClasses.firstChildClasses);
    } else {
      console.log('No product-detail container found');
    }

  } catch (error) {
    console.error(`ERROR analyzing ${url}:`, error.message);
  }

  await browser.close();
}

async function main() {
  console.log('Starting price structure analysis...\n');

  for (const url of TEST_URLS) {
    await analyzePage(url);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Analysis complete!');
  console.log('='.repeat(80));
}

main().catch(console.error);
