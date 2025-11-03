const puppeteer = require('puppeteer');

async function analyzeVariantSelectors() {
  console.log('🔍 Analyzing variant selectors on Shopware 6 page...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('📱 Navigating to Horizontalschäler product with variants...');

    await page.goto('https://shop.firmenich.de/detail/088dad9cfeac403cb7b26e88f1407dc5', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for page to load
    console.log('⏳ Waiting for page to fully load...');
    await new Promise(r => setTimeout(r, 5000));

    // Try to accept cookies
    try {
      const cookieButton = await page.$('button.js-cookie-configuration-button.cookie-permission--accept-button');
      if (cookieButton) {
        await cookieButton.click();
        console.log('✅ Accepted cookies');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {}

    console.log('\n📊 ANALYZING VARIANT SELECTORS:\n');

    // Check for all possible variant selectors
    const variantSelectors = [
      // Shopware 6 specific
      '.product-detail-configurator',
      '.product-detail-configurator-group',
      '.product-detail-configurator-group-title',
      '.product-detail-configurator-option',
      '.product-detail-configurator-option-label',
      '.product-detail-configurator-option-input',

      // Generic form elements
      'form.buy-widget',
      '#productDetailPageBuyProductForm',

      // Radio buttons
      'input[type="radio"]',
      'input[type="radio"][name*="group"]',
      'input[type="radio"][name*="option"]',

      // Select dropdowns
      'select',
      'select[name*="group"]',
      'select[name*="option"]',

      // Buttons with variant data
      'button[data-variant]',
      'button[data-product-option]',
      '[data-product-option]',

      // Link-based variants
      'a.product-variant',
      'a[data-variant]',

      // Other possible selectors
      '.product-options',
      '.product-variant',
      '.variant-selector',
      '.option-selector',
      '[class*="variant"]',
      '[class*="option"]'
    ];

    console.log('Checking for variant selectors:');
    const foundSelectors = [];

    for (const selector of variantSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`✅ Found: ${selector} (${elements.length} elements)`);
        foundSelectors.push({ selector, count: elements.length });
      }
    }

    if (foundSelectors.length === 0) {
      console.log('❌ No standard variant selectors found!');
    }

    // Deep DOM analysis
    console.log('\n🔬 Deep DOM Analysis:');
    const domInfo = await page.evaluate(() => {
      const result = {
        forms: [],
        radioButtons: [],
        selectElements: [],
        buttonsWithDataAttrs: [],
        linksWithDataAttrs: [],
        configuratorElements: []
      };

      // Find all forms
      document.querySelectorAll('form').forEach(form => {
        result.forms.push({
          id: form.id,
          className: form.className,
          action: form.action,
          hasRadios: form.querySelectorAll('input[type="radio"]').length > 0,
          hasSelects: form.querySelectorAll('select').length > 0
        });
      });

      // Find all radio buttons
      document.querySelectorAll('input[type="radio"]').forEach(radio => {
        const label = radio.labels?.[0] || document.querySelector(`label[for="${radio.id}"]`);
        result.radioButtons.push({
          name: radio.name,
          value: radio.value,
          id: radio.id,
          checked: radio.checked,
          label: label?.textContent?.trim() || '',
          parentClass: radio.parentElement?.className
        });
      });

      // Find all select elements
      document.querySelectorAll('select').forEach(select => {
        result.selectElements.push({
          name: select.name,
          id: select.id,
          className: select.className,
          optionCount: select.options.length,
          firstOption: select.options[0]?.textContent?.trim()
        });
      });

      // Find buttons with data attributes
      document.querySelectorAll('button[data-variant], button[data-option], button[data-product-option]').forEach(button => {
        result.buttonsWithDataAttrs.push({
          text: button.textContent.trim(),
          className: button.className,
          dataAttrs: Object.keys(button.dataset)
        });
      });

      // Find links with data attributes
      document.querySelectorAll('a[data-variant], a[data-option], a[data-product-option]').forEach(link => {
        result.linksWithDataAttrs.push({
          text: link.textContent.trim(),
          href: link.href,
          className: link.className,
          dataAttrs: Object.keys(link.dataset)
        });
      });

      // Look for any element with "configurator" in class
      document.querySelectorAll('[class*="configurator"]').forEach(el => {
        if (el.className && !el.className.includes('script')) {
          result.configuratorElements.push({
            tag: el.tagName,
            className: el.className,
            hasChildren: el.children.length > 0,
            text: el.textContent?.trim().substring(0, 50)
          });
        }
      });

      return result;
    });

    console.log('\nForms found:', domInfo.forms.length);
    domInfo.forms.forEach(form => {
      console.log(`  Form: ${form.id || form.className || 'unnamed'}`);
      console.log(`    Has radios: ${form.hasRadios}, Has selects: ${form.hasSelects}`);
    });

    console.log('\nRadio buttons found:', domInfo.radioButtons.length);
    domInfo.radioButtons.forEach(radio => {
      console.log(`  ${radio.checked ? '✓' : '○'} ${radio.name}: ${radio.value} (${radio.label})`);
    });

    console.log('\nSelect elements found:', domInfo.selectElements.length);
    domInfo.selectElements.forEach(select => {
      console.log(`  Select: ${select.name || select.id || 'unnamed'} (${select.optionCount} options)`);
    });

    console.log('\nButtons with data attributes:', domInfo.buttonsWithDataAttrs.length);
    domInfo.buttonsWithDataAttrs.forEach(button => {
      console.log(`  Button: "${button.text}" - data attrs: ${button.dataAttrs.join(', ')}`);
    });

    console.log('\nLinks with data attributes:', domInfo.linksWithDataAttrs.length);
    domInfo.linksWithDataAttrs.forEach(link => {
      console.log(`  Link: "${link.text}" - data attrs: ${link.dataAttrs.join(', ')}`);
    });

    console.log('\nConfigurator elements:', domInfo.configuratorElements.length);
    domInfo.configuratorElements.slice(0, 5).forEach(el => {
      console.log(`  <${el.tag}> ${el.className}`);
    });

    // Check for text content indicating variants
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('\n🔍 Checking for variant text patterns:');
    const variantKeywords = ['OMNI', 'Fruitmax', 'Aufdruck', 'Farbe', 'wählen', 'auswählen'];

    for (const keyword of variantKeywords) {
      if (pageText.includes(keyword)) {
        console.log(`✅ Found keyword: "${keyword}"`);

        // Find context
        const index = pageText.indexOf(keyword);
        const context = pageText.substring(Math.max(0, index - 30), Math.min(pageText.length, index + 30));
        console.log(`   Context: ...${context.replace(/\n/g, ' ')}...`);
      }
    }

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run analysis
analyzeVariantSelectors();