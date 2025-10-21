/**
 * Final analysis of BOTH price layouts
 */
import puppeteer from 'puppeteer';

const LAYOUTS = [
  {
    name: 'Simple Price',
    url: 'https://shop.firmenich.de/CAS/Akku-fuer-PR-II-und-SW-II',
  },
  {
    name: 'Tiered Price Table',
    url: 'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
  },
];

async function analyzeLayout(layout) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`LAYOUT: ${layout.name}`);
  console.log(`URL: ${layout.url}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(layout.url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Test all possible price selectors
    const selectors = [
      'table.product-block-prices-grid',
      '.product-price',
      '.product-detail-price',
      '[data-product-price]',
      '.buy-widget .price',
      '.product-block-prices',
    ];

    console.log('\n--- PRICE ELEMENT DETECTION ---');
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        const info = await element.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            className: el.className,
            visible: rect.width > 0 && rect.height > 0,
            position: { x: Math.round(rect.x), y: Math.round(rect.y) },
            size: { width: Math.round(rect.width), height: Math.round(rect.height) },
            text: el.textContent?.trim().substring(0, 150),
          };
        });

        console.log(`\n✓ ${selector}`);
        console.log(`  Tag: ${info.tag}`);
        console.log(`  Class: ${info.className}`);
        console.log(`  Visible: ${info.visible}`);
        console.log(`  Position: (${info.position.x}, ${info.position.y})`);
        console.log(`  Size: ${info.size.width}x${info.size.height}`);
        console.log(`  Text: ${info.text}`);
      }
    }

    // Get page structure
    console.log('\n--- PAGE STRUCTURE ---');
    const structure = await page.evaluate(() => {
      const detail = document.querySelector('.product-detail-buy');
      if (detail) {
        const children = Array.from(detail.children).map(c => ({
          tag: c.tagName,
          class: c.className,
        }));
        return {
          found: true,
          children: children,
        };
      }
      return { found: false };
    });

    if (structure.found) {
      console.log('Product detail buy container children:');
      structure.children.forEach((c, i) => {
        console.log(`  ${i + 1}. <${c.tag}> class="${c.class}"`);
      });
    }

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }

  await browser.close();
}

async function main() {
  for (const layout of LAYOUTS) {
    await analyzeLayout(layout);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
