const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Test URLs
const TEST_URLS = [
  {
    name: 'Staffelpreise',
    url: 'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
    expectedPrice: 'table.product-block-prices-grid'
  },
  {
    name: 'Einzelpreis',
    url: 'https://shop.firmenich.de/Grossbehaelter/Deckel-fuer-Big-Box-120-x-100-cm',
    expectedPrice: '.product-detail-price'
  }
];

async function testScreenshot(url, name) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${name} - ${url}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({
    headless: false, // WICHTIG: Erst mal mit UI testen!
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  try {
    const page = await browser.newPage();

    // Set viewport BEFORE navigating
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📱 Navigating to page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // STEP 1: Handle Cookie Banner PROPERLY
    console.log('🍪 Handling cookie banner...');
    const cookieHandled = await handleCookiesProperly(page);
    console.log(cookieHandled ? '✅ Cookies accepted' : '⚠️ No cookie banner found');

    // STEP 2: Wait for page to stabilize
    console.log('⏳ Waiting for page to stabilize...');
    await new Promise(r => setTimeout(r, 2000)); // Give time for animations to complete

    // STEP 3: Scroll to load lazy images
    console.log('📜 Scrolling to load lazy content...');
    await autoScroll(page);
    await new Promise(r => setTimeout(r, 1000));

    // STEP 4: Test element detection
    console.log('\n🔍 TESTING ELEMENT DETECTION:');
    const elements = await testElementDetection(page);

    // STEP 5: Take precise screenshots
    console.log('\n📸 TAKING SCREENSHOTS:');
    const timestamp = Date.now();
    const screenshotDir = `test-screenshots/${name.replace(/\s/g, '-')}-${timestamp}`;
    await fs.mkdir(screenshotDir, { recursive: true });

    // Full page screenshot for reference
    const fullPagePath = path.join(screenshotDir, 'full-page.png');
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });
    console.log(`✅ Full page saved: ${fullPagePath}`);

    // Element screenshots with validation
    for (const [elementType, selector] of Object.entries(elements)) {
      if (selector) {
        await captureElementProperly(page, selector, elementType, screenshotDir);
      }
    }

    // Test price extraction specifically
    console.log('\n💰 TESTING PRICE EXTRACTION:');
    await testPriceExtraction(page);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

async function handleCookiesProperly(page) {
  // Try multiple cookie selectors
  const cookieSelectors = [
    'button:has-text("alle cookies akzeptieren")',
    'button:has-text("Alle akzeptieren")',
    'button:has-text("Accept all")',
    '[data-testid="cookie-accept-all"]',
    '.cookie-consent-accept',
    '#acceptAllCookies'
  ];

  for (const selector of cookieSelectors) {
    try {
      // Use XPath for text-based search
      const [button] = await page.$x(`//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'alle cookies')]`);
      if (button) {
        await button.click();
        await new Promise(r => setTimeout(r, 1000));
        return true;
      }

      // Try CSS selector
      const cssButton = await page.$(selector);
      if (cssButton) {
        await cssButton.click();
        await new Promise(r => setTimeout(r, 1000));
        return true;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  // Last resort: look for any button with "akzeptieren"
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptButton = buttons.find(btn =>
        btn.textContent.toLowerCase().includes('akzeptieren') ||
        btn.textContent.toLowerCase().includes('accept')
      );
      if (acceptButton) {
        acceptButton.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 1000));
    return true;
  } catch (e) {
    return false;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          window.scrollTo(0, 0); // Scroll back to top
          resolve();
        }
      }, 100);
    });
  });
}

async function testElementDetection(page) {
  const selectors = {
    productImage: [
      'img[itemprop="image"]',
      '.product-image img',
      '.product-detail-media img',
      '.cms-element-image-gallery img'
    ],
    articleNumber: [
      '[itemprop="sku"]',
      '.product-detail-ordernumber',
      '.product-number'
    ],
    title: [
      'h1[itemprop="name"]',
      'h1.product-detail-name',
      'h1'
    ],
    priceTable: [
      'table.product-block-prices-grid'
    ],
    priceSingle: [
      '.product-detail-price',
      '[itemprop="price"]',
      '.product-price'
    ],
    description: [
      '[itemprop="description"]',
      '.product-detail-description',
      '.product-description-text'
    ]
  };

  const found = {};

  for (const [element, possibleSelectors] of Object.entries(selectors)) {
    for (const selector of possibleSelectors) {
      const exists = await page.$(selector);
      if (exists) {
        const isVisible = await page.evaluate((sel) => {
          const elem = document.querySelector(sel);
          if (!elem) return false;
          const rect = elem.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, selector);

        if (isVisible) {
          console.log(`✅ ${element}: Found with selector "${selector}"`);
          found[element] = selector;
          break;
        }
      }
    }
    if (!found[element]) {
      console.log(`❌ ${element}: NOT FOUND`);
    }
  }

  return found;
}

async function captureElementProperly(page, selector, elementType, screenshotDir) {
  try {
    const element = await page.$(selector);
    if (!element) {
      console.log(`❌ ${elementType}: Element not found`);
      return;
    }

    // Get element boundaries
    const box = await element.boundingBox();
    if (!box) {
      console.log(`❌ ${elementType}: No bounding box`);
      return;
    }

    // Add padding for better OCR
    const padding = 10;
    const clip = {
      x: Math.max(0, box.x - padding),
      y: Math.max(0, box.y - padding),
      width: box.width + (padding * 2),
      height: box.height + (padding * 2)
    };

    // Scroll element into view
    await element.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 500)); // Wait for scroll

    // Take screenshot
    const screenshotPath = path.join(screenshotDir, `${elementType}.png`);
    await page.screenshot({
      path: screenshotPath,
      clip: clip
    });

    // Validate screenshot
    const stats = await fs.stat(screenshotPath);
    const sizeKB = (stats.size / 1024).toFixed(1);

    if (stats.size < 100) {
      console.log(`⚠️ ${elementType}: Screenshot too small (${sizeKB} KB) - might be empty`);
    } else {
      console.log(`✅ ${elementType}: Captured (${sizeKB} KB) - ${Math.round(box.width)}x${Math.round(box.height)}px`);
    }

    // Also capture with element.screenshot() for comparison
    const elementScreenshotPath = path.join(screenshotDir, `${elementType}-element.png`);
    await element.screenshot({ path: elementScreenshotPath });
    console.log(`   📸 Alternative capture saved as ${elementType}-element.png`);

  } catch (error) {
    console.log(`❌ ${elementType}: Failed to capture - ${error.message}`);
  }
}

async function testPriceExtraction(page) {
  // Test for tiered prices
  const tieredPriceTable = await page.$('table.product-block-prices-grid');
  if (tieredPriceTable) {
    const priceText = await page.evaluate(el => el.textContent, tieredPriceTable);
    console.log('✅ Found tiered prices:');
    console.log(priceText.replace(/\s+/g, ' ').trim().substring(0, 200));
  }

  // Test for single price
  const singlePrice = await page.$('.product-detail-price');
  if (singlePrice) {
    const priceText = await page.evaluate(el => el.textContent, singlePrice);
    console.log('✅ Found single price:', priceText.trim());
  }

  // Test all price-related classes
  const priceClasses = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const priceClasses = new Set();
    allElements.forEach(el => {
      const classes = Array.from(el.classList);
      classes.forEach(cls => {
        if (cls.toLowerCase().includes('price')) {
          priceClasses.add(cls);
        }
      });
    });
    return Array.from(priceClasses);
  });

  console.log('\n📋 All price-related CSS classes found:');
  console.log(priceClasses.join(', '));
}

// Run tests
async function runAllTests() {
  for (const test of TEST_URLS) {
    await testScreenshot(test.url, test.name);
    console.log('\n⏳ Waiting before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  console.log('\n✅ All tests completed! Check the test-screenshots folder.');
}

runAllTests();