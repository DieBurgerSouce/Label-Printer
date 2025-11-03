const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://shop.firmenich.de/Papier/1-5-kg-Papiertragetasche-Kartoffeln-NEU', {
    waitUntil: 'networkidle2'
  });

  // Find all IMG elements and their attributes
  const images = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.product-detail-media img'));
    return imgs.map((img, idx) => ({
      index: idx,
      src: img.src,
      currentSrc: img.currentSrc,
      dataSrc: img.getAttribute('data-src'),
      srcset: img.srcset,
      className: img.className,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    }));
  });

  console.log(JSON.stringify(images, null, 2));

  await browser.close();
})();
