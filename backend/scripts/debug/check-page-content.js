const puppeteer = require('puppeteer');
const fs = require('fs');

async function checkPageContent() {
  console.log('📸 Taking screenshot and checking page content...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser to see what's happening
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('📱 Navigating to Kistenwaschmaschine page...');

    await page.goto('https://shop.firmenich.de/produkt/kistenwaschmaschine/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('⏳ Waiting for page to stabilize...');
    await new Promise(r => setTimeout(r, 5000));

    // Take screenshot
    await page.screenshot({ path: 'firmenich-page.png', fullPage: true });
    console.log('📸 Screenshot saved as firmenich-page.png');

    // Get page HTML
    const html = await page.content();
    fs.writeFileSync('firmenich-page.html', html);
    console.log('📄 HTML saved as firmenich-page.html');

    // Check page title and URL
    const title = await page.title();
    const url = page.url();
    console.log('\n📋 Page Info:');
    console.log('   Title:', title);
    console.log('   URL:', url);

    // Look for any text mentioning OMNI or Fruitmax
    const pageText = await page.evaluate(() => document.body.innerText);

    console.log('\n🔍 Searching for variant keywords in page text...');
    const keywords = ['OMNI', 'Fruitmax', 'Variante', 'Ausführung', 'Option', 'wählen'];

    for (const keyword of keywords) {
      if (pageText.includes(keyword)) {
        console.log(`✅ Found "${keyword}" in page text`);

        // Find context around the keyword
        const index = pageText.indexOf(keyword);
        const context = pageText.substring(Math.max(0, index - 50), Math.min(pageText.length, index + 50));
        console.log(`   Context: ...${context.replace(/\n/g, ' ')}...`);
      }
    }

    // Check for images
    const images = await page.$$eval('img', imgs => imgs.map(img => ({
      src: img.src,
      alt: img.alt,
      className: img.className
    })));

    console.log(`\n🖼️ Found ${images.length} images`);
    images.slice(0, 5).forEach(img => {
      console.log(`   • ${img.alt || 'No alt'} - ${img.src.substring(img.src.lastIndexOf('/') + 1)}`);
    });

    // Check for product configurator elements
    console.log('\n🔧 Checking for configurator elements...');

    const configuratorSelectors = [
      '.product-configurator',
      '.configurator',
      '[class*="config"]',
      '[class*="option"]',
      '[class*="variant"]',
      '.product-options',
      '.product-variations'
    ];

    for (const selector of configuratorSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
      }
    }

    console.log('\n⏸️ Browser will stay open for manual inspection.');
    console.log('   Close the browser window when done.');

    // Wait for browser to be closed manually
    await page.waitForFunction(() => false, { timeout: 0 });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run check
checkPageContent();