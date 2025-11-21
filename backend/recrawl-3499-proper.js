/**
 * Re-crawl Article 3499 - PROPERLY
 * With cleanText fix AND auf_anfrage detection
 */

const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function recrawlArticle() {
  console.log('='.repeat(80));
  console.log('Re-crawl Article 3499 - PROPER Implementation');
  console.log('='.repeat(80));

  const url = 'https://shop.firmenich.de/Druckminderer/Druckminderer-2-Gusseisen';

  try {
    // Step 1: Delete existing article 3499
    console.log('\n🗑️  Step 1: Deleting existing article 3499...');
    const deleted = await prisma.product.deleteMany({
      where: { articleNumber: '3499' }
    });
    console.log(`   ✅ Deleted ${deleted.count} article(s)`);

    // Step 2: Launch browser
    console.log('\n🌐 Step 2: Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📱 Loading page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Step 3: Extract using PROPER logic
    console.log('\n🔍 Step 3: Extracting with PROPER cleanText + auf_anfrage detection...');
    const extractedData = await page.evaluate(() => {
      // ===== HELPER FUNCTIONS =====

      function cleanText(text) {
        if (!text) return '';
        let cleaned = text.trim();

        // FIX: Ensure line breaks always create spaces between words
        // Step 1: Replace all newlines/line breaks with a space
        cleaned = cleaned.replace(/[\r\n]+/g, ' ');
        // Step 2: Collapse multiple spaces into one
        cleaned = cleaned.replace(/\s+/g, ' ');

        return cleaned;
      }

      function parsePrice(priceText) {
        const match = priceText.match(/([\d.,]+)/);
        if (!match) return null;
        const normalized = match[1].replace(',', '.');
        const price = parseFloat(normalized);
        return isNaN(price) ? null : price;
      }

      function detectAufAnfrage() {
        const requestPatterns = [
          'produkt anfragen',
          'preis anfragen',
          'preis auf anfrage',
          'auf anfrage',
          'anfragen',
          'jetzt anfragen'
        ];

        // Check buttons
        const buttons = document.querySelectorAll('button, a.button, a.btn, [role="button"]');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase().trim() || '';
          if (requestPatterns.some(p => text.includes(p))) {
            console.log(`   ✓ Found "Auf Anfrage" button: "${text}"`);
            return true;
          }
        }

        // Check price fields
        const priceFields = document.querySelectorAll('.product-detail-price, .price-unit, .product-price');
        for (const field of priceFields) {
          const text = field.textContent?.toLowerCase().trim() || '';
          if (requestPatterns.some(p => text.includes(p))) {
            console.log(`   ✓ Found "Auf Anfrage" in price field: "${text}"`);
            return true;
          }
        }

        return false;
      }

      // ===== EXTRACT DATA =====
      const data = {
        productName: '',
        description: '',
        articleNumber: '',
        price: null,
        priceType: 'normal',
        tieredPricesText: null,
        imageUrl: ''
      };

      // Product name
      const nameEl = document.querySelector('h1.product-detail-name') ||
                     document.querySelector('h1[itemprop="name"]');
      if (nameEl) data.productName = cleanText(nameEl.innerText || nameEl.textContent);

      // Description - IMPORTANT: Use innerText to preserve <br> tags as newlines!
      const descEl = document.querySelector('.product-detail-description-text') ||
                     document.querySelector('[itemprop="description"]');
      if (descEl) data.description = cleanText(descEl.innerText || descEl.textContent);

      // Article number
      const artEl = document.querySelector('.product-detail-ordernumber-container') ||
                    document.querySelector('[itemprop="sku"]');
      if (artEl) {
        const text = cleanText(artEl.innerText || artEl.textContent);
        const match = text.match(/:\s*([^\s]+)|(\d+[\w\-]*)/);
        data.articleNumber = match ? (match[1] || match[2]) : text;
      }

      // Detect "Auf Anfrage"
      const isAufAnfrage = detectAufAnfrage();

      if (isAufAnfrage) {
        data.priceType = 'auf_anfrage';
        data.price = null;
        data.tieredPricesText = 'Preis auf Anfrage';
      } else {
        // Try to extract price
        const priceEl = document.querySelector('.product-detail-price') ||
                        document.querySelector('[itemprop="price"]');
        if (priceEl) {
          const priceNum = parsePrice(cleanText(priceEl.textContent));
          if (priceNum !== null && priceNum > 0) {
            data.price = priceNum;
            data.priceType = 'normal';
          }
        }
      }

      // Image
      const imgEl = document.querySelector('.product-detail-media img') ||
                    document.querySelector('.gallery-slider-item img');
      if (imgEl) data.imageUrl = imgEl.src;

      return data;
    });

    await browser.close();

    console.log('\n📊 Extracted Data:');
    console.log(`   Article Number: ${extractedData.articleNumber}`);
    console.log(`   Product Name: ${extractedData.productName}`);
    console.log(`   Price Type: ${extractedData.priceType}`);
    console.log(`   Price: ${extractedData.price}`);
    console.log(`   Tiered Prices Text: ${extractedData.tieredPricesText}`);
    console.log(`   Description (first 200 chars): ${extractedData.description?.substring(0, 200)}...`);

    // Step 4: Check for spacing issues
    console.log('\n🔍 Step 4: Checking description for spacing issues...');
    const desc = extractedData.description || '';

    const pattern1 = desc.match(/[a-z]\d/g);
    const pattern2 = desc.match(/\d[A-Z]/g);
    const pattern3 = desc.match(/\n/g);

    console.log(`   Lowercase+Digit patterns: ${pattern1?.length || 0} (${pattern1?.join(', ') || 'none'})`);
    console.log(`   Digit+Uppercase patterns: ${pattern2?.length || 0} (${pattern2?.join(', ') || 'none'})`);
    console.log(`   Newlines: ${pattern3?.length || 0}`);

    // Check around "Gusseisen"
    const index = desc.indexOf('Gusseisen');
    if (index !== -1) {
      const section = desc.substring(index, index + 40);
      console.log(`   Section around "Gusseisen": "${section}"`);
    }

    // Step 5: Save to database
    console.log('\n💾 Step 5: Saving to database...');
    const article = await prisma.product.create({
      data: {
        id: uuidv4(),
        articleNumber: extractedData.articleNumber || '3499',
        productName: extractedData.productName || '',
        description: extractedData.description || null,
        price: extractedData.price,
        priceType: extractedData.priceType,
        tieredPrices: [],
        tieredPricesText: extractedData.tieredPricesText,
        currency: 'EUR',
        imageUrl: extractedData.imageUrl || null,
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

    console.log(`   ✅ Saved with ID: ${article.id}`);

    // Step 6: Final Verification
    console.log('\n✅ Step 6: Final Verification');
    console.log(`   Article Number: ${article.articleNumber}`);
    console.log(`   Price Type: ${article.priceType}`);
    console.log(`   Price: ${article.price}`);
    console.log(`   Tiered Prices Text: ${article.tieredPricesText}`);

    console.log('\n' + '='.repeat(80));
    console.log('🎉 SUCCESS! Article 3499 re-crawled PROPERLY!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

recrawlArticle()
  .then(() => {
    console.log('\n✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
