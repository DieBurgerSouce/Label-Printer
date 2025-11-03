const puppeteer = require('puppeteer');

async function analyzeFirmenichPage() {
  console.log('🔍 Analyzing Firmenich Product Page Structure...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('📱 Navigating to Kistenwaschmaschine page...');

    await page.goto('https://shop.firmenich.de/produkt/kistenwaschmaschine/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Accept cookies if present
    try {
      const cookieButton = await page.$('button[class*="cookie"], a[class*="cookie"], button:has-text("akzeptieren")');
      if (cookieButton) {
        await cookieButton.click();
        console.log('✅ Accepted cookies');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Continue
    }

    console.log('\n📊 ANALYZING VARIANT STRUCTURE:\n');

    // Check for various variant selector patterns
    const variantPatterns = [
      // WooCommerce patterns
      '.variations_form',
      '.variations',
      '.variation',
      'table.variations',
      'select.variation',
      '.product-configurator',
      '.product-variation',

      // Radio button patterns
      'input[type="radio"][name*="variation"]',
      'input[type="radio"][name*="attribute"]',
      'input[type="radio"][name*="option"]',
      '.variation-radios',
      '.tm-extra-product-options',

      // Generic patterns
      '.product-options',
      '.product-variants',
      'form.cart .variations',
      '.single_variation_wrap'
    ];

    console.log('Checking for variant selectors:');
    for (const selector of variantPatterns) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`✅ Found: ${selector} (${elements.length} elements)`);

        // Get more details about the elements
        if (selector.includes('input[type="radio"]')) {
          for (const element of elements.slice(0, 3)) { // First 3 for brevity
            const name = await element.evaluate(el => el.name);
            const value = await element.evaluate(el => el.value);
            const id = await element.evaluate(el => el.id);
            const checked = await element.evaluate(el => el.checked);

            // Try to find label
            let label = '';
            try {
              if (id) {
                const labelEl = await page.$(`label[for="${id}"]`);
                if (labelEl) {
                  label = await labelEl.evaluate(el => el.textContent.trim());
                }
              }
            } catch (e) {}

            console.log(`   📻 Radio: name="${name}" value="${value}" label="${label}" checked=${checked}`);
          }
        }
      }
    }

    // Check for specific text patterns
    console.log('\n🔤 Checking for variant text patterns:');
    const variantTexts = ['OMNI', 'Fruitmax', 'Ausführung', 'Variante', 'Option'];

    for (const text of variantTexts) {
      const elements = await page.$$(`xpath=//*[contains(text(), "${text}")]`);
      if (elements.length > 0) {
        console.log(`✅ Found text "${text}" in ${elements.length} elements`);

        // Get parent structure
        for (const element of elements.slice(0, 2)) {
          const tagName = await element.evaluate(el => el.tagName);
          const className = await element.evaluate(el => el.className);
          const parentClass = await element.evaluate(el => el.parentElement?.className || '');
          console.log(`   Element: <${tagName} class="${className}"> Parent: "${parentClass}"`);
        }
      }
    }

    // Look for form elements
    console.log('\n📝 Analyzing form structure:');
    const forms = await page.$$('form');
    console.log(`Found ${forms.length} forms on page`);

    for (const form of forms) {
      const className = await form.evaluate(el => el.className);
      const id = await form.evaluate(el => el.id);
      const action = await form.evaluate(el => el.action);

      console.log(`\nForm: class="${className}" id="${id}"`);

      // Check for variations inside form
      const hasVariations = await form.evaluate(el => {
        return el.querySelector('.variations, .variation, input[type="radio"]') !== null;
      });

      if (hasVariations) {
        console.log('  ✅ This form contains variations!');

        // Get all inputs in the form
        const inputs = await form.$$('input[type="radio"], select');
        console.log(`  Found ${inputs.length} variant inputs`);

        for (const input of inputs.slice(0, 5)) {
          const type = await input.evaluate(el => el.type);
          const name = await input.evaluate(el => el.name);
          const value = await input.evaluate(el => el.value);
          console.log(`    Input: type="${type}" name="${name}" value="${value}"`);
        }
      }
    }

    // Use page.evaluate to check the actual DOM structure
    const domAnalysis = await page.evaluate(() => {
      const result = {
        hasJQuery: typeof jQuery !== 'undefined',
        hasWooCommerce: typeof wc_add_to_cart_variation_params !== 'undefined',
        variationForms: [],
        radioGroups: {}
      };

      // Check for variation forms
      document.querySelectorAll('form.variations_form, form.cart').forEach(form => {
        result.variationForms.push({
          className: form.className,
          hasVariations: form.querySelector('.variations') !== null,
          variationCount: form.querySelectorAll('.variations tr').length
        });
      });

      // Check all radio buttons
      document.querySelectorAll('input[type="radio"]').forEach(radio => {
        const name = radio.name;
        if (!result.radioGroups[name]) {
          result.radioGroups[name] = [];
        }

        // Try to find label text
        let labelText = '';
        const label = radio.labels?.[0] || document.querySelector(`label[for="${radio.id}"]`);
        if (label) {
          labelText = label.textContent.trim();
        }

        result.radioGroups[name].push({
          value: radio.value,
          checked: radio.checked,
          label: labelText,
          id: radio.id
        });
      });

      return result;
    });

    console.log('\n🔬 DOM Analysis Results:');
    console.log('Has jQuery:', domAnalysis.hasJQuery);
    console.log('Has WooCommerce:', domAnalysis.hasWooCommerce);
    console.log('\nVariation Forms:', JSON.stringify(domAnalysis.variationForms, null, 2));
    console.log('\nRadio Groups Found:', JSON.stringify(domAnalysis.radioGroups, null, 2));

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
analyzeFirmenichPage();