const puppeteer = require('puppeteer');

const testUrls = [
  'https://shop.firmenich.de/Klebeband/Packband-PP-transparent',
  'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt',
  'https://shop.firmenich.de/Grossbehaelter/Big-Box-Masse-120-x-100-x-79-cm-D-F',
  'https://shop.firmenich.de/Tueten-und-Beutel/Hemdchenbeutel-28-cm-x-17-cm-x-48-cm-fuer-Lebensmittel-geeignet'
];

(async () => {
  const browser = await puppeteer.launch({ headless: true });

  console.log('Testing title lengths across different products:\n');

  for (const url of testUrls) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Accept cookies
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes('akzeptieren'));
      if (acceptBtn) acceptBtn.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    // Check title dimensions
    const titleInfo = await page.evaluate(() => {
      const title = document.querySelector('h1.product-detail-name');
      if (!title) return null;
      const rect = title.getBoundingClientRect();
      return {
        text: title.textContent?.trim(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        lines: Math.ceil(rect.height / 24) // ~24px per line
      };
    });

    console.log('---');
    console.log('Product:', url.split('/').pop());
    console.log('Title:', titleInfo?.text);
    console.log('Dimensions:', titleInfo ? `${titleInfo.width}x${titleInfo.height}px` : 'N/A');
    console.log('Lines:', titleInfo?.lines || 0);

    await page.close();
  }

  await browser.close();
})();