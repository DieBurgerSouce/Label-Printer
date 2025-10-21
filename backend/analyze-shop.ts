/**
 * Shop Analyzer Script
 * Analyzes shop.firmenich.de product pages to find precise CSS selectors
 */

import puppeteer from 'puppeteer';

interface ProductSelectors {
  productImage: string;
  productTitle: string;
  articleNumber: string;
  price: string;
  tieredPrices: string;
  description: string;
}

async function analyzeProductPage(url: string) {
  console.log(`\n🔍 Analyzing: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Go to product page
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Accept cookies first
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const cookieButtons = await page.$x('//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "alle cookies akzeptieren")]');
      if (cookieButtons.length > 0) {
        await (cookieButtons[0] as any).click();
        console.log('✅ Cookies accepted');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      console.log('ℹ️  No cookie banner');
    }

    // Extract HTML structure
    const analysis = await page.evaluate(() => {
      const result: any = {};

      // Find product image
      const imgSelectors = [
        '.product-image img',
        '.product-detail-image img',
        '.product-main-image img',
        '[class*="product"][class*="image"] img',
        '.main-image img',
        '#product-image img',
        'img[alt*="Produkt"]',
        'img[itemprop="image"]',
        '.product-gallery img:first-child',
        '.product-photo img'
      ];

      for (const sel of imgSelectors) {
        const el = document.querySelector(sel);
        if (el && (el as HTMLImageElement).src) {
          result.productImage = {
            selector: sel,
            src: (el as HTMLImageElement).src,
            html: el.outerHTML.substring(0, 200)
          };
          break;
        }
      }

      // Find product title - try ALL h1 elements and meta tags
      const titleSelectors = [
        'h1.product-title',
        'h1.product-name',
        '.product-detail h1',
        '[itemprop="name"]',
        '.product-info h1',
        'h1',
        '.page-title'
      ];

      // Collect ALL h1 elements
      const allH1s = Array.from(document.querySelectorAll('h1')).map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        id: el.id,
        html: el.outerHTML.substring(0, 200)
      }));

      result.allH1Elements = allH1s;

      // Try schema.org name
      const schemaName = document.querySelector('[itemprop="name"]');
      if (schemaName) {
        result.productTitleSchema = {
          selector: '[itemprop="name"]',
          text: schemaName.textContent?.trim(),
          html: schemaName.outerHTML.substring(0, 200)
        };
      }

      // Try the first h1 that's NOT "Produktinformationen"
      for (const h1 of allH1s) {
        if (h1.text && !h1.text.includes('Produktinformationen') && h1.text.length > 5) {
          result.productTitle = {
            selector: 'h1 (filtered)',
            text: h1.text,
            html: h1.html
          };
          break;
        }
      }

      // Fallback to any h1
      if (!result.productTitle && allH1s.length > 0) {
        result.productTitle = {
          selector: 'h1',
          text: allH1s[0].text,
          html: allH1s[0].html
        };
      }

      // Find article number
      const articleSelectors = [
        '[class*="article"][class*="number"]',
        '[class*="sku"]',
        '[itemprop="sku"]',
        '.product-number',
        '.article-nr',
        '.art-nr',
        'span:contains("Art")',
        'div:contains("Artikel")',
        '[data-product-id]',
        '.product-id'
      ];

      for (const sel of articleSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el && el.textContent && el.textContent.trim().length > 0) {
            result.articleNumber = {
              selector: sel,
              text: el.textContent.trim(),
              html: el.outerHTML.substring(0, 200)
            };
            break;
          }
        } catch (e) {
          // Skip invalid selectors
        }
      }

      // Find price (single)
      const priceSelectors = [
        '.product-price',
        '.price',
        '[itemprop="price"]',
        '[class*="price"]:not([class*="old"]):not([class*="was"])',
        '.current-price',
        '.product-detail-price',
        'span.price-value'
      ];

      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.includes('€')) {
          result.price = {
            selector: sel,
            text: el.textContent.trim(),
            html: el.outerHTML.substring(0, 200)
          };
          break;
        }
      }

      // Find tiered prices (Staffelpreise)
      const tieredPriceSelectors = [
        '.tiered-prices',
        '.staffelpreise',
        '[class*="tier"][class*="price"]',
        '.price-tier',
        '.bulk-price',
        '[class*="staffel"]',
        'table.prices',
        '.price-table'
      ];

      for (const sel of tieredPriceSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          result.tieredPrices = {
            selector: sel,
            text: el.textContent?.trim().substring(0, 300),
            html: el.outerHTML.substring(0, 500)
          };
          break;
        }
      }

      // If no tiered price container, try to find multiple price elements
      if (!result.tieredPrices) {
        const allPrices = Array.from(document.querySelectorAll('[class*="price"]'))
          .filter(el => el.textContent?.includes('€'))
          .map(el => ({
            text: el.textContent?.trim(),
            className: el.className,
            html: el.outerHTML.substring(0, 100)
          }));

        if (allPrices.length > 1) {
          result.tieredPrices = {
            selector: 'Multiple price elements found',
            prices: allPrices
          };
        }
      }

      // Find description
      const descSelectors = [
        '.product-description',
        '[itemprop="description"]',
        '.description',
        '.product-info .description',
        '#product-description',
        '.product-detail-description',
        '[class*="product"][class*="description"]'
      ];

      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 20) {
          result.description = {
            selector: sel,
            text: el.textContent.trim().substring(0, 200) + '...',
            html: el.outerHTML.substring(0, 300)
          };
          break;
        }
      }

      // Also capture the full page structure for manual inspection
      result.pageStructure = {
        bodyClasses: document.body.className,
        mainContainers: Array.from(document.querySelectorAll('main, [role="main"], .main-content, .product-detail, .product-page'))
          .map(el => ({
            tag: el.tagName,
            classes: el.className,
            id: el.id
          }))
      };

      return result;
    });

    console.log('📊 Analysis Results:');
    console.log(JSON.stringify(analysis, null, 2));

    // Take a full screenshot for manual inspection
    await page.screenshot({
      path: `backend/shop-analysis-${Date.now()}.png`,
      fullPage: true
    });

    console.log('\n✅ Screenshot saved to backend/shop-analysis-*.png');

    return analysis;

  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🚀 Shop Analyzer starting...\n');

  // First, crawl the category page to find real product URLs
  console.log('📦 Finding product URLs from category page...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://shop.firmenich.de/Kartons', { waitUntil: 'networkidle0' });

  // Accept cookies
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const cookieButtons = await page.$x('//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "alle cookies akzeptieren")]');
    if (cookieButtons.length > 0) {
      await (cookieButtons[0] as any).click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) {}

  // Find product links
  const productUrls = await page.$$eval('a[href*="/Kartons/"]', links =>
    links
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => href.includes('/Kartons/') && !href.endsWith('/Kartons'))
      .slice(0, 5) // Test first 5 products
  );

  await browser.close();

  console.log(`Found ${productUrls.length} product URLs:\n`);
  productUrls.forEach(url => console.log(`  - ${url}`));
  console.log('\n');

  const testUrls = productUrls.length > 0 ? productUrls : [
    'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
  ];

  const results: any = {};

  for (const url of testUrls) {
    try {
      results[url] = await analyzeProductPage(url);
    } catch (error) {
      console.error(`❌ Error analyzing ${url}:`, error);
    }
  }

  console.log('\n\n📋 FINAL SUMMARY:');
  console.log('================\n');

  // Extract the best selectors from all analyzed pages
  const bestSelectors: any = {
    productImage: null,
    productTitle: null,
    articleNumber: null,
    price: null,
    tieredPrices: null,
    description: null
  };

  for (const [url, analysis] of Object.entries(results)) {
    console.log(`\nFrom ${url}:`);
    for (const key of Object.keys(bestSelectors)) {
      if (analysis[key]) {
        console.log(`  ${key}: ${analysis[key].selector}`);
        if (!bestSelectors[key]) {
          bestSelectors[key] = analysis[key].selector;
        }
      }
    }
  }

  console.log('\n\n✅ RECOMMENDED SELECTORS:');
  console.log(JSON.stringify(bestSelectors, null, 2));
}

main().catch(console.error);
