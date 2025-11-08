const puppeteer = require('puppeteer');

async function analyzeShopwarePage() {
  console.log('🔍 Analyzing Shopware 6 Product Page (CORRECT URL!)...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('📱 Navigating to product with variants (Horizontalschäler)');

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

    console.log('\n📊 ANALYZING SHOPWARE 6 STRUCTURE:\n');

    // Shopware 6 specific selectors
    const shopwareSelectors = [
      // Product configurator
      '.product-detail-configurator',
      '.product-detail-configurator-group',
      '.product-detail-configurator-group-title',
      '.product-detail-configurator-option',
      '.product-detail-configurator-option-label',
      '.product-detail-configurator-option-input',

      // Product form
      '.product-detail-form',
      '.product-detail-form-container',
      'form.buy-widget',
      '#productDetailPageBuyProductForm',

      // Radio inputs
      'input[type="radio"][name^="group"]',
      'input[type="radio"][name*="option"]',
      '.product-detail-configurator input[type="radio"]',

      // Options
      '.product-detail-options',
      '.product-option',
      '.product-variants'
    ];

    console.log('Checking for Shopware 6 specific elements:');
    for (const selector of shopwareSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`✅ Found: ${selector} (${elements.length} elements)`);

        // Get more details for radio buttons
        if (selector.includes('radio')) {
          for (const element of elements.slice(0, 5)) {
            const name = await element.evaluate(el => el.name);
            const value = await element.evaluate(el => el.value);
            const id = await element.evaluate(el => el.id);
            const checked = await element.evaluate(el => el.checked);

            // Find associated label
            let label = '';
            try {
              const labelEl = await page.$(`label[for="${id}"]`);
              if (labelEl) {
                label = await labelEl.evaluate(el => el.textContent.trim());
              }
            } catch (e) {}

            console.log(`   📻 Radio: name="${name}" value="${value}" id="${id}" label="${label}" checked=${checked}`);
          }
        }
      }
    }

    // Use page.evaluate for deep DOM inspection
    const deepAnalysis = await page.evaluate(() => {
      const result = {
        shopwareVersion: null,
        configuratorGroups: [],
        radioInputs: [],
        selectDropdowns: [],
        productForm: null,
        configOptions: []
      };

      // Check for Shopware version
      const shopwareEl = document.querySelector('meta[name="shopware-version"]');
      if (shopwareEl) {
        result.shopwareVersion = shopwareEl.content;
      }

      // Check for configurator groups
      document.querySelectorAll('.product-detail-configurator-group').forEach(group => {
        const groupData = {
          title: group.querySelector('.product-detail-configurator-group-title')?.textContent?.trim(),
          options: []
        };

        group.querySelectorAll('.product-detail-configurator-option').forEach(option => {
          const input = option.querySelector('input');
          const label = option.querySelector('label');

          if (input) {
            groupData.options.push({
              type: input.type,
              name: input.name,
              value: input.value,
              id: input.id,
              checked: input.checked,
              label: label?.textContent?.trim() || option.textContent?.trim()
            });
          }
        });

        if (groupData.options.length > 0) {
          result.configuratorGroups.push(groupData);
        }
      });

      // Find all radio inputs on page
      document.querySelectorAll('input[type="radio"]').forEach(radio => {
        const label = radio.labels?.[0] || document.querySelector(`label[for="${radio.id}"]`);
        result.radioInputs.push({
          name: radio.name,
          value: radio.value,
          id: radio.id,
          checked: radio.checked,
          label: label?.textContent?.trim() || '',
          className: radio.className,
          parentClass: radio.parentElement?.className
        });
      });

      // Find all select dropdowns
      document.querySelectorAll('select').forEach(select => {
        const options = [];
        select.querySelectorAll('option').forEach(option => {
          options.push({
            value: option.value,
            text: option.textContent.trim(),
            selected: option.selected
          });
        });

        result.selectDropdowns.push({
          name: select.name,
          id: select.id,
          className: select.className,
          options: options
        });
      });

      // Check the main product form
      const form = document.querySelector('form.buy-widget, #productDetailPageBuyProductForm');
      if (form) {
        result.productForm = {
          id: form.id,
          className: form.className,
          action: form.action,
          hasInputs: form.querySelectorAll('input').length,
          hasRadios: form.querySelectorAll('input[type="radio"]').length,
          hasSelects: form.querySelectorAll('select').length
        };
      }

      // Look for any elements with "option" or "variant" in class
      document.querySelectorAll('[class*="option"], [class*="variant"], [class*="configurator"]').forEach(el => {
        if (el.textContent && el.textContent.trim().length < 100) {
          result.configOptions.push({
            tag: el.tagName,
            className: el.className,
            text: el.textContent.trim().substring(0, 50)
          });
        }
      });

      return result;
    });

    console.log('\n🔬 DEEP DOM ANALYSIS:');
    console.log('================\n');

    if (deepAnalysis.shopwareVersion) {
      console.log('Shopware Version:', deepAnalysis.shopwareVersion);
    }

    if (deepAnalysis.configuratorGroups.length > 0) {
      console.log('\n📦 Configurator Groups Found:');
      deepAnalysis.configuratorGroups.forEach((group, i) => {
        console.log(`\nGroup ${i + 1}: ${group.title || 'Unnamed'}`);
        group.options.forEach(opt => {
          console.log(`  ${opt.checked ? '✓' : '○'} ${opt.label} (value: ${opt.value})`);
        });
      });
    }

    if (deepAnalysis.radioInputs.length > 0) {
      console.log('\n📻 All Radio Inputs Found:');
      deepAnalysis.radioInputs.forEach(radio => {
        console.log(`  ${radio.checked ? '✓' : '○'} Name: ${radio.name}, Value: ${radio.value}, Label: ${radio.label}`);
      });
    }

    if (deepAnalysis.selectDropdowns.length > 0) {
      console.log('\n📝 Select Dropdowns Found:');
      deepAnalysis.selectDropdowns.forEach(select => {
        console.log(`  Select: ${select.name || select.id || 'unnamed'}`);
        select.options.slice(0, 5).forEach(opt => {
          console.log(`    ${opt.selected ? '✓' : '○'} ${opt.text} (value: ${opt.value})`);
        });
      });
    }

    if (deepAnalysis.productForm) {
      console.log('\n📄 Product Form Details:');
      console.log(`  ID: ${deepAnalysis.productForm.id}`);
      console.log(`  Class: ${deepAnalysis.productForm.className}`);
      console.log(`  Total Inputs: ${deepAnalysis.productForm.hasInputs}`);
      console.log(`  Radio Inputs: ${deepAnalysis.productForm.hasRadios}`);
      console.log(`  Select Elements: ${deepAnalysis.productForm.hasSelects}`);
    }

    if (deepAnalysis.configOptions.length > 0) {
      console.log('\n⚙️ Configuration Elements (first 10):');
      deepAnalysis.configOptions.slice(0, 10).forEach(opt => {
        console.log(`  <${opt.tag}> ${opt.text}`);
      });
    }

    // Check for text content
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('\n🔍 Checking for variant keywords in text:');
    const keywords = ['OMNI', 'Fruitmax', 'Variante', 'Ausführung', 'Größe', 'Farbe'];
    for (const keyword of keywords) {
      if (pageText.includes(keyword)) {
        console.log(`✅ Found "${keyword}"`);
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
analyzeShopwarePage();