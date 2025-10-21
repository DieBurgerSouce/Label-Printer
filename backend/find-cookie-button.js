/**
 * Find the exact selector for the cookie button on shop.firmenich.de
 */
import puppeteer from 'puppeteer';

const URL = 'https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt';

async function findCookieButton() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n=== ANALYZING COOKIE BANNER ===\n');

  // Get all buttons on page
  const buttons = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    return allButtons.map(btn => ({
      text: btn.textContent?.trim().substring(0, 50) || '',
      className: btn.className,
      id: btn.id,
      ariaLabel: btn.getAttribute('aria-label'),
      visible: btn.offsetParent !== null,
    }));
  });

  console.log(`Found ${buttons.length} buttons on page\n`);

  // Filter for cookie-related buttons
  const cookieButtons = buttons.filter(btn =>
    btn.text.toLowerCase().includes('cookie') ||
    btn.text.toLowerCase().includes('akzeptieren') ||
    btn.className.toLowerCase().includes('cookie') ||
    btn.id.toLowerCase().includes('cookie')
  );

  console.log('Cookie-related buttons:');
  cookieButtons.forEach((btn, i) => {
    console.log(`\n${i + 1}.`);
    console.log(`  Text: "${btn.text}"`);
    console.log(`  Class: "${btn.className}"`);
    console.log(`  ID: "${btn.id}"`);
    console.log(`  Aria-label: "${btn.ariaLabel}"`);
    console.log(`  Visible: ${btn.visible}`);
  });

  // Try to find cookie banner container
  console.log('\n=== COOKIE BANNER CONTAINER ===\n');
  const cookieContainer = await page.evaluate(() => {
    const selectors = [
      '#cookie-banner',
      '.cookie-banner',
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const el = els[0];
        return {
          selector: sel,
          tag: el.tagName,
          className: el.className,
          id: el.id,
          text: el.textContent?.substring(0, 100) || '',
          visible: el.offsetParent !== null,
        };
      }
    }
    return null;
  });

  if (cookieContainer) {
    console.log('Found cookie container:');
    console.log(`  Selector: ${cookieContainer.selector}`);
    console.log(`  Tag: ${cookieContainer.tag}`);
    console.log(`  Class: ${cookieContainer.className}`);
    console.log(`  ID: ${cookieContainer.id}`);
    console.log(`  Visible: ${cookieContainer.visible}`);
    console.log(`  Text preview: ${cookieContainer.text}`);
  } else {
    console.log('No cookie container found');
  }

  console.log('\n=== TESTING CLICK ===\n');

  // Try to click "Alle Cookies akzeptieren"
  const textSearches = ['Alle Cookies akzeptieren', 'Alle akzeptieren', 'Accept all'];

  for (const text of textSearches) {
    const xpath = `//*[self::button or self::a][contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
    const elements = await page.$x(xpath);

    if (elements.length > 0) {
      console.log(`✓ Found button via XPath: "${text}"`);
      console.log(`  Found ${elements.length} element(s)`);

      for (const el of elements) {
        const box = await el.boundingBox();
        if (box) {
          console.log(`  Clicking element...`);
          await el.click();
          await new Promise(r => setTimeout(r, 1000));
          console.log(`  ✓ Clicked!`);
          break;
        }
      }
      break;
    }
  }

  console.log('\n=== TAKING SCREENSHOT AFTER CLICK ===\n');
  await page.screenshot({ path: 'after-cookie-click.png', fullPage: false });
  console.log('✓ Screenshot saved: after-cookie-click.png');

  await browser.close();
}

findCookieButton().catch(console.error);
