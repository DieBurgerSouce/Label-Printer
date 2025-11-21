/**
 * Crawl Two Articles - Simple Version
 */

const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function crawlArticle(url) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Crawling: ${url}`);
  console.log('─'.repeat(80));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📱 Loading page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('🔍 Extracting data...');

    const data = await page.evaluate(() => {
      const cleanText = (text) => {
        if (!text) return '';
        let cleaned = text.trim();
        cleaned = cleaned.replace(/[\r\n]+/g, ' ');
        cleaned = cleaned.replace(/\s+/g, ' ');
        return cleaned;
      };

      const parsePrice = (priceText) => {
        const match = priceText.match(/([\d.,]+)/);
        if (!match) return null;
        const normalized = match[1].replace(',', '.');
        const price = parseFloat(normalized);
        return isNaN(price) ? null : price;
      };

      const result = {
        productName: '',
        description: '',
        articleNumber: '',
        price: null,
        imageUrl: ''
      };

      // Product name
      const nameEl = document.querySelector('h1.product-detail-name') ||
                     document.querySelector('h1[itemprop="name"]');
      if (nameEl) result.productName = cleanText(nameEl.textContent);

      // Description
      const descEl = document.querySelector('.product-detail-description-text') ||
                     document.querySelector('[itemprop="description"]');
      if (descEl) result.description = cleanText(descEl.textContent);

      // Article number
      const artEl = document.querySelector('.product-detail-ordernumber-container') ||
                    document.querySelector('[itemprop="sku"]');
      if (artEl) {
        const text = cleanText(artEl.textContent);
        const match = text.match(/:\s*([^\s]+)|(\d+[\w\-]*)/);
        result.articleNumber = match ? (match[1] || match[2]) : text;
      }

      // Price
      const priceEl = document.querySelector('.product-detail-price') ||
                      document.querySelector('[itemprop="price"]');
      if (priceEl) {
        result.price = parsePrice(cleanText(priceEl.textContent));
      }

      // Image
      const imgEl = document.querySelector('.product-detail-media img') ||
                    document.querySelector('.gallery-slider-item img');
      if (imgEl) result.imageUrl = imgEl.src;

      return result;
    });

    console.log(`\n✅ Extracted:`);
    console.log(`   Article Number: ${data.articleNumber}`);
    console.log(`   Product Name: ${data.productName}`);
    console.log(`   Price: ${data.price} EUR`);
    console.log(`   Description: ${data.description?.substring(0, 100)}...`);

    if (!data.articleNumber || !data.productName) {
      throw new Error('Missing required fields: articleNumber or productName');
    }

    // Save to database
    console.log('💾 Saving to database...');
    const article = await prisma.product.create({
      data: {
        id: uuidv4(),
        articleNumber: data.articleNumber,
        productName: data.productName,
        description: data.description || null,
        price: data.price,
        priceType: 'normal',
        tieredPrices: [],
        tieredPricesText: null,
        currency: 'EUR',
        imageUrl: data.imageUrl || null,
        thumbnailUrl: null,
        ean: null,
        category: null,
        manufacturer: null,
        sourceUrl: url,
        crawlJobId: uuidv4(),
        ocrConfidence: 100,
        verified: false,
        published: true,
      }
    });

    console.log(`✅ Saved to database with ID: ${article.id}`);
    return { success: true, article };

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return { success: false, url, error: error.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('Crawl Two Articles');
  console.log('='.repeat(80));

  const urls = [
    'https://shop.firmenich.de/Verpackungsmaschinen/Vakuumverpackungsmaschinen',
    'https://shop.firmenich.de/Druckminderer/Druckminderer-2-Gusseisen'
  ];

  const results = [];

  for (const url of urls) {
    const result = await crawlArticle(url);
    results.push(result);
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success).length;
  console.log(`✅ Successfully crawled: ${successful}/${urls.length}`);

  results.forEach((r, i) => {
    if (r.success) {
      console.log(`  ${i+1}. ✅ ${r.article.articleNumber} - ${r.article.productName}`);
    } else {
      console.log(`  ${i+1}. ❌ ${r.url} - Error: ${r.error}`);
    }
  });

  console.log('\n🎉 Done! Check http://localhost:3001/api/articles');
}

main()
  .then(() => {
    console.log('\n✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
