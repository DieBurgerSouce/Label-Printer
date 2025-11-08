import puppeteer from 'puppeteer';

const TEST_URLS = [
  'https://shop.firmenich.de/Kartons/Spargelkarton-10-kg-neutral-bedruckt',
  'https://shop.firmenich.de/Tueten-und-Beutel/Obsttute-2-kg',
];

async function screenshotPage(url, index) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const filename = `test-screenshot-${index}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`✓ Screenshot saved: ${filename}`);

    // Check page title and URL
    const title = await page.title();
    const currentUrl = page.url();
    console.log(`  Title: ${title}`);
    console.log(`  URL: ${currentUrl}`);

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }

  await browser.close();
}

async function main() {
  for (let i = 0; i < TEST_URLS.length; i++) {
    console.log(`\nScreenshotting: ${TEST_URLS[i]}`);
    await screenshotPage(TEST_URLS[i], i + 1);
  }
}

main().catch(console.error);
