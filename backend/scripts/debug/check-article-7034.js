/**
 * Check article #7034 and crawl source URL
 */
const puppeteer = require('puppeteer');

async function checkArticle() {
  console.log('\n🔍 Analyzing Article #7034 from source URL...\n');

  const url = 'https://shop.firmenich.de/Sortierhandschuhe/Der-Pflanzenschutzhandschuh-33-cm';

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Find staffelpreise table
  const staffelpreise = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return null;

    const rows = Array.from(table.querySelectorAll('tr'));
    const data = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      return cells.map(cell => cell.textContent.trim());
    });

    return {
      html: table.outerHTML,
      rows: data
    };
  });

  console.log('📊 Staffelpreise Table:');
  console.log(JSON.stringify(staffelpreise, null, 2));

  await browser.close();
}

checkArticle().catch(console.error);
