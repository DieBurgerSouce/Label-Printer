/**
 * Find real, working product URLs from shop.firmenich.de
 */
import puppeteer from 'puppeteer';

const CATEGORY_URLS = [
  'https://shop.firmenich.de/Kartons',
  'https://shop.firmenich.de/Tueten-und-Beutel',
  'https://shop.firmenich.de/Kisten',
  'https://shop.firmenich.de/Folien',
  'https://shop.firmenich.de/Papier',
  'https://shop.firmenich.de/Klebeband',
];

async function findProductsInCategory(categoryUrl) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Finding products in: ${categoryUrl}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const productUrls = [];

  try {
    await page.goto(categoryUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find all product links
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href*="/"]'));
      return allLinks
        .map(a => a.href)
        .filter(href => {
          // Filter for product URLs (not categories, not external)
          return href.includes('shop.firmenich.de/') &&
                 !href.includes('?') &&
                 !href.endsWith('/Kartons') &&
                 !href.endsWith('/Tueten-und-Beutel') &&
                 !href.endsWith('/Kisten') &&
                 !href.endsWith('/Folien') &&
                 !href.endsWith('/Papier') &&
                 !href.endsWith('/Klebeband') &&
                 href.split('/').length > 4; // Has category + product
        });
    });

    // Deduplicate
    const uniqueLinks = [...new Set(links)];

    console.log(`Found ${uniqueLinks.length} potential product URLs`);

    // Test first 5 to see if they're valid
    for (let i = 0; i < Math.min(5, uniqueLinks.length); i++) {
      const testUrl = uniqueLinks[i];

      try {
        const testPage = await browser.newPage();
        const response = await testPage.goto(testUrl, { waitUntil: 'networkidle0', timeout: 15000 });

        const status = response.status();
        const title = await testPage.title();

        if (status === 200 && !title.includes('404') && title.length > 0) {
          console.log(`  ✓ ${testUrl} (${status}) - "${title.substring(0, 50)}"`);
          productUrls.push(testUrl);
        } else {
          console.log(`  ✗ ${testUrl} (${status}) - Invalid`);
        }

        await testPage.close();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log(`  ✗ ${testUrl} - Error: ${e.message}`);
      }
    }

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }

  await browser.close();
  return productUrls;
}

async function main() {
  console.log('Finding real product URLs from shop.firmenich.de...\n');

  const allProducts = [];

  for (const categoryUrl of CATEGORY_URLS) {
    const products = await findProductsInCategory(categoryUrl);
    allProducts.push(...products);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`SUMMARY: Found ${allProducts.length} valid product URLs`);
  console.log('='.repeat(80));

  if (allProducts.length > 0) {
    console.log('\nValid product URLs:');
    allProducts.forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });
  }
}

main().catch(console.error);
