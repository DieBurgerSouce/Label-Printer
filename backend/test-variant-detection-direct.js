const puppeteer = require('puppeteer');

// Import the variant detection service
const { VariantDetectionService } = require('./dist/services/variant-detection-service');

async function testVariantDetectionDirect() {
  console.log('🔬 Testing variant detection service directly...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser to see what's happening
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('📱 Navigating to Horizontalschäler product...');

    await page.goto('https://shop.firmenich.de/detail/088dad9cfeac403cb7b26e88f1407dc5', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('⏳ Waiting for page to stabilize...');
    await new Promise(r => setTimeout(r, 3000));

    // Try to accept cookies
    try {
      const cookieButton = await page.$('button.js-cookie-configuration-button.cookie-permission--accept-button');
      if (cookieButton) {
        await cookieButton.click();
        console.log('✅ Accepted cookies');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {}

    // Scroll to load lazy content
    console.log('📜 Scrolling to load lazy content...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n🔍 Running variant detection...\n');

    // Create instance of variant detection service
    const variantService = new VariantDetectionService();

    // Call detect variants
    const variantGroups = await variantService.detectVariants(page);

    console.log('\n📊 VARIANT DETECTION RESULTS:\n');
    console.log('Total variant groups found:', variantGroups.length);

    if (variantGroups.length > 0) {
      console.log('\n✅ Successfully detected variants!\n');

      for (const group of variantGroups) {
        console.log(`\n📦 Group: ${group.label}`);
        console.log(`   Type: ${group.type}`);
        console.log(`   Container: ${group.containerSelector}`);
        console.log(`   Variants (${group.variants.length}):`);

        for (const variant of group.variants) {
          console.log(`   ${variant.isSelected ? '✓' : '○'} ${variant.label}`);
          console.log(`      Value: ${variant.value}`);
          console.log(`      Selector: ${variant.selector}`);
          if (variant.articleNumber) {
            console.log(`      Article#: ${variant.articleNumber}`);
          }
        }
      }

      // Try selecting a variant
      if (variantGroups[0] && variantGroups[0].variants.length > 1) {
        const firstUnselected = variantGroups[0].variants.find(v => !v.isSelected);
        if (firstUnselected) {
          console.log(`\n🔄 Testing variant selection: "${firstUnselected.label}"...`);

          const selected = await variantService.selectVariant(page, firstUnselected, variantGroups[0]);

          if (selected) {
            console.log('✅ Successfully selected variant!');

            // Wait for page update
            await new Promise(r => setTimeout(r, 2000));

            // Check if article number changed
            const articleNumber = await page.evaluate(() => {
              const el = document.querySelector('.product-detail-ordernumber-container');
              return el ? el.textContent?.trim() : null;
            });

            console.log('   New article number:', articleNumber || 'N/A');
          } else {
            console.log('❌ Failed to select variant');
          }
        }
      }
    } else {
      console.log('❌ No variants detected!');

      // Debug: Check what's actually on the page
      console.log('\n🔍 Debugging - checking for configurator elements...');

      const debugInfo = await page.evaluate(() => {
        const result = {
          hasConfigurator: document.querySelector('.product-detail-configurator') !== null,
          configuratorGroups: document.querySelectorAll('.product-detail-configurator-group').length,
          radioButtons: document.querySelectorAll('input[type="radio"]').length,
          selects: document.querySelectorAll('select').length
        };
        return result;
      });

      console.log('Debug info:', debugInfo);
    }

    console.log('\n⏸️ Browser will stay open for 10 seconds for manual inspection...');
    await new Promise(r => setTimeout(r, 10000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run test
testVariantDetectionDirect();