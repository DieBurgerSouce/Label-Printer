const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/chromium'
  });

  const page = await browser.newPage();
  await page.goto('https://shop.firmenich.de/Papier/1-5-kg-Papiertragetasche-Kartoffeln-NEU', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Accept cookies
  try {
    const cookieButton = await page.$('button:has-text("alle cookies akzeptieren")');
    if (cookieButton) await cookieButton.click();
    await page.waitForTimeout(1000);
  } catch (e) {}

  // Test selectors
  const selectors = [
    '.gallery-slider-image',
    '.product-detail-media img[itemprop="image"]',
    '.product-detail-media .gallery-slider-image',
    '.product-detail-media img.gallery-slider-image',
    'img[itemprop="image"].gallery-slider-image',
    '.product-detail-media .base-slider-item img',
    '.product-detail-media img.magnifier-image'
  ];

  console.log('\n📊 SELECTOR TEST RESULTS:\n');

  for (const sel of selectors) {
    const elem = await page.$(sel);
    if (elem) {
      const box = await elem.boundingBox();
      const src = await elem.evaluate(e => e.src);
      const classes = await elem.evaluate(e => e.className);
      console.log(`✅ ${sel}`);
      console.log(`   Size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
      console.log(`   Classes: ${classes}`);
      console.log(`   Src: ${src.substring(src.lastIndexOf('/'))}`);
      console.log('');
    } else {
      console.log(`❌ ${sel} - NOT FOUND`);
    }
  }

  await browser.close();
})();
