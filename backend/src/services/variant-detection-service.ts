/**
 * Variant Detection Service
 * Detects and handles product variants (radio buttons, dropdowns, etc.)
 * Fixes the missing variant problem for articles like 1313-F, 1313-O, 1313-FSH, 1313-OSH
 */

import { Page, ElementHandle } from 'puppeteer';

export interface ProductVariant {
  label: string; // e.g., "Fruitmax", "OMNI"
  value: string; // Value attribute
  selector: string; // CSS selector to click
  isSelected: boolean; // Currently selected
  articleNumber?: string; // Article number for this variant (e.g., 1313-F)
}

export interface VariantGroup {
  type: 'radio' | 'dropdown' | 'button';
  label: string; // e.g., "Ausführung auswählen"
  variants: ProductVariant[];
  containerSelector: string;
}

export class VariantDetectionService {
  /**
   * Detect all variant groups on a product page
   */
  async detectVariants(page: Page): Promise<VariantGroup[]> {
    const variantGroups: VariantGroup[] = [];
    const processedGroupSignatures = new Set<string>(); // Track processed groups with better signatures

    try {
      // Wait for page to be fully loaded
      await page.waitForSelector('body', { timeout: 5000 }).catch(() => {});

      // Helper function to create unique group signature
      const createGroupSignature = (group: VariantGroup): string => {
        const variantValues = group.variants
          .map((v) => v.value)
          .sort()
          .join(',');
        return `${group.type}:${group.label}:${variantValues}`;
      };

      // 1. Check for radio button variants (most common on Firmenich shop)
      const radioGroups = await this.detectRadioVariants(page);
      for (const group of radioGroups) {
        const signature = createGroupSignature(group);
        if (!processedGroupSignatures.has(signature)) {
          variantGroups.push(group);
          processedGroupSignatures.add(signature);
        }
      }

      // 2. Check for dropdown variants
      const dropdownGroups = await this.detectDropdownVariants(page);
      for (const group of dropdownGroups) {
        const signature = createGroupSignature(group);
        if (!processedGroupSignatures.has(signature)) {
          variantGroups.push(group);
          processedGroupSignatures.add(signature);
        }
      }

      // 3. Check for button variants (color/size selectors)
      const buttonGroups = await this.detectButtonVariants(page);
      for (const group of buttonGroups) {
        const signature = createGroupSignature(group);
        if (!processedGroupSignatures.has(signature)) {
          variantGroups.push(group);
          processedGroupSignatures.add(signature);
        }
      }

      // 4. Special handling for Firmenich "Karton" options
      const kartonOptions = await this.detectKartonOptions(page);
      if (kartonOptions) {
        variantGroups.push(kartonOptions);
      }

      if (variantGroups.length > 0) {
        console.log(
          `🎯 Found ${variantGroups.length} variant group(s) with total ${variantGroups.reduce(
            (sum, g) => sum + g.variants.length,
            0
          )} variants`
        );

        for (const group of variantGroups) {
          console.log(`   📦 ${group.label}: ${group.variants.map((v) => v.label).join(', ')}`);
        }
      } else {
        console.log('   ℹ️ No variants found on this product page');
      }
    } catch (error) {
      console.error('❌ Error detecting variants:', error);
    }

    return variantGroups;
  }

  /**
   * Special detection for "Karton à X Stück" options (Firmenich specific)
   */
  private async detectKartonOptions(page: Page): Promise<VariantGroup | null> {
    try {
      // Look for "Karton" options which are bulk packaging options
      const kartonSelectors = [
        'label:has-text("Karton")',
        'input[type="radio"] + label:has-text("Karton")',
        '.product-detail-configurator:has-text("Karton")',
        '[class*="bulk"]:has-text("Karton")',
      ];

      for (const selector of kartonSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          const variants: ProductVariant[] = [];

          for (const element of elements) {
            const text = await element.evaluate((el) => el.textContent || '');
            if (text && text.includes('Karton')) {
              // Extract quantity from text like "Karton à 400 Stück"
              const quantityMatch = text.match(/(\d+)\s*Stück/);
              const quantity = quantityMatch ? quantityMatch[1] : '';

              variants.push({
                label: text.trim(),
                value: `karton-${quantity}`,
                selector: selector,
                isSelected: false,
                articleNumber: undefined,
              });
            }
          }

          if (variants.length > 0) {
            return {
              type: 'radio',
              label: 'Packaging Options',
              variants,
              containerSelector: selector,
            };
          }
        }
      }
    } catch (error) {
      console.log('   ℹ️ No Karton options found');
    }

    return null;
  }

  /**
   * Detect radio button variants (like OMNI/Fruitmax)
   */
  private async detectRadioVariants(page: Page): Promise<VariantGroup[]> {
    const groups: VariantGroup[] = [];
    const processedGroups = new Set<string>(); // Track processed groups to avoid duplicates

    try {
      // Common selectors for radio button groups - ORDERED BY SPECIFICITY
      const radioGroupSelectors = [
        '.product-detail-configurator-group', // Most specific - Shopware 6 default
        '.product-option-group',
        '.variant-selection',
        'fieldset[class*="product"]',
        '.form-group:has(input[type="radio"])',
        // Removed overly generic selectors that cause duplicates
      ];

      // First, collect all radio inputs to track which ones we've processed
      const allProcessedRadioIds = new Set<string>();

      for (const selector of radioGroupSelectors) {
        const containers = await page.$$(selector);

        for (const container of containers) {
          // Check if this container has radio inputs
          const radioInputs = await container.$$('input[type="radio"]');

          if (radioInputs.length > 0) {
            // Get unique identifier for this group (based on radio input names and values)
            const radioName = await radioInputs[0].evaluate((el) => (el as HTMLInputElement).name);

            // Create a unique signature based on all radio values in this group
            const radioValues = await Promise.all(
              radioInputs.map((input) => input.evaluate((el) => el.value))
            );
            const groupSignature = `${radioName}:${radioValues.sort().join(',')}`;

            // Skip if we already processed this exact group
            if (processedGroups.has(groupSignature)) {
              continue;
            }

            // Check if any of these radio inputs were already processed
            let alreadyProcessed = false;
            for (const input of radioInputs) {
              const inputId = await input.evaluate((el) => el.id);
              if (inputId && allProcessedRadioIds.has(inputId)) {
                alreadyProcessed = true;
                break;
              }
              if (inputId) allProcessedRadioIds.add(inputId);
            }

            if (alreadyProcessed) {
              continue;
            }

            processedGroups.add(groupSignature);

            // Get group label - check for Shopware 6 specific selectors first
            const labelElement = await container.$(
              '.product-detail-configurator-group-title, legend, .form-label, .group-label, label:first-child'
            );
            const groupLabel = labelElement
              ? await labelElement.evaluate((el) => el.textContent?.trim() || '')
              : 'Variant Selection';

            const variants: ProductVariant[] = [];

            for (const input of radioInputs) {
              // Get the label for this radio button
              const inputId = await input.evaluate((el) => el.id);

              // Try standard label
              const labelText = await page
                .$eval(`label[for="${inputId}"]`, (el) => el.textContent?.trim() || '')
                .catch(() => '');

              // Try Shopware 6 specific: find parent option and get label
              const shopwareLabel = await input.evaluateHandle((el: Element) => {
                const option = el.closest('.product-detail-configurator-option');
                if (option) {
                  const label = option.querySelector('.product-detail-configurator-option-label');
                  return label ? label.textContent?.trim() || '' : '';
                }
                return '';
              });
              const shopwareLabelText = (await shopwareLabel.jsonValue()) as string;

              // Alternative: label wrapping the input
              const parentLabel = await input.evaluateHandle((el: Element) => el.closest('label'));
              const altLabelText = parentLabel
                ? await (parentLabel as any).evaluate(
                    (el: HTMLElement | null) => el?.textContent?.trim() || ''
                  )
                : '';

              const finalLabel = shopwareLabelText || labelText || altLabelText || 'Unknown';
              const value = await input.evaluate((el) => el.value);
              const isChecked = await input.evaluate((el) => el.checked);

              variants.push({
                label: finalLabel,
                value: value,
                selector: inputId ? `#${inputId}` : `input[type="radio"][value="${value}"]`,
                isSelected: isChecked,
              });
            }

            if (variants.length > 0) {
              groups.push({
                type: 'radio',
                label: groupLabel,
                variants: variants,
                containerSelector: selector,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error detecting radio variants:', error);
    }

    return groups;
  }

  /**
   * Detect dropdown/select variants
   */
  private async detectDropdownVariants(page: Page): Promise<VariantGroup[]> {
    const groups: VariantGroup[] = [];

    try {
      // Find all select elements that look like variant selectors
      const selects = await page.$$(
        'select[class*="variant"], select[class*="option"], select[name*="variant"], select[name*="option"]'
      );

      for (const select of selects) {
        const label = await this.getSelectLabel(page, select);
        const options = await select.$$('option');

        if (options.length > 1) {
          // Ignore if only has placeholder option
          const variants: ProductVariant[] = [];

          for (const option of options) {
            const optionText = await option.evaluate((el) => el.textContent?.trim() || '');
            const optionValue = await option.evaluate((el) => (el as HTMLOptionElement).value);
            const isSelected = await option.evaluate((el) => (el as HTMLOptionElement).selected);

            // Skip empty/placeholder options
            if (optionValue && optionText && !optionText.toLowerCase().includes('wählen')) {
              variants.push({
                label: optionText,
                value: optionValue,
                selector: `option[value="${optionValue}"]`,
                isSelected: isSelected,
              });
            }
          }

          if (variants.length > 0) {
            groups.push({
              type: 'dropdown',
              label: label,
              variants: variants,
              containerSelector: 'select',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error detecting dropdown variants:', error);
    }

    return groups;
  }

  /**
   * Detect button-based variants (color swatches, size buttons, etc.)
   */
  private async detectButtonVariants(page: Page): Promise<VariantGroup[]> {
    const groups: VariantGroup[] = [];

    try {
      // Common selectors for button variant groups
      const buttonGroupSelectors = [
        '.product-detail-configurator-option',
        '.variant-buttons',
        '.size-selector',
        '.color-selector',
        '[class*="swatch"]',
      ];

      for (const selector of buttonGroupSelectors) {
        const containers = await page.$$(selector);

        for (const container of containers) {
          const buttons = await container.$$('button, a[role="button"], .option-button');

          if (buttons.length > 0) {
            const variants: ProductVariant[] = [];

            for (const button of buttons) {
              const buttonText = await button.evaluate((el) => el.textContent?.trim() || '');
              const isSelected = await button.evaluate(
                (el) =>
                  el.classList.contains('active') ||
                  el.classList.contains('selected') ||
                  el.getAttribute('aria-pressed') === 'true'
              );

              variants.push({
                label: buttonText,
                value: buttonText,
                selector: '', // Will be set dynamically
                isSelected: isSelected,
              });
            }

            if (variants.length > 0) {
              groups.push({
                type: 'button',
                label: 'Options',
                variants: variants,
                containerSelector: selector,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error detecting button variants:', error);
    }

    return groups;
  }

  /**
   * Select a specific variant and wait for page update
   */
  async selectVariant(page: Page, variant: ProductVariant, group: VariantGroup): Promise<boolean> {
    try {
      console.log(`   🔄 Selecting variant: ${variant.label}`);

      // Store current article number before selection
      const beforeArticleNumber = await this.extractArticleNumber(page);

      if (group.type === 'radio') {
        // Fix: Use attribute selector for IDs that start with numbers
        const id = variant.selector.replace('#', '');
        const optionSelector = `[id="${id}"]`;

        // For Shopware 6: Try clicking the option container first (more reliable)
        try {
          const radioElement = await page.$(optionSelector);

          if (radioElement) {
            // Find and click the parent option container
            const clicked = await page.evaluate((selector) => {
              const element = document.querySelector(selector);
              if (element) {
                const option = element.closest('.product-detail-configurator-option');
                if (option) {
                  (option as HTMLElement).click();
                  return true;
                }
              }
              return false;
            }, optionSelector);

            if (clicked) {
              await new Promise((r) => setTimeout(r, 500)); // Wait for UI update
            }
          }
        } catch (e) {
          // Continue with fallback methods
        }

        // Fallback: Click the radio button directly
        if (await page.$(optionSelector)) {
          await page.click(optionSelector).catch(() => {});
        }

        // Also try clicking the label (sometimes more reliable)
        const labelSelector = `label[for="${id}"]`;
        if (await page.$(labelSelector)) {
          await page.click(labelSelector).catch(() => {});
        }
      } else if (group.type === 'dropdown') {
        // Select from dropdown
        await page.select(group.containerSelector, variant.value);
      } else if (group.type === 'button') {
        // Click the button
        const button = await page.evaluateHandle(
          (label) =>
            Array.from(document.querySelectorAll('button, a[role="button"]')).find(
              (el) => el.textContent?.trim() === label
            ),
          variant.label
        );
        if (button) {
          const element = (button as any).asElement ? (button as any).asElement() : button;
          if (element) {
            await element.click();
          }
        }
      }

      // Wait for potential AJAX update
      await this.waitForVariantUpdate(page, beforeArticleNumber);

      // Extract the new article number for this variant
      const newArticleNumber = await this.extractArticleNumber(page);
      if (newArticleNumber && newArticleNumber !== beforeArticleNumber) {
        variant.articleNumber = newArticleNumber;
        console.log(`   ✅ Variant ${variant.label} has article number: ${newArticleNumber}`);
      }

      return true;
    } catch (error) {
      console.error(`   ❌ Failed to select variant ${variant.label}:`, error);
      return false;
    }
  }

  /**
   * Wait for page to update after variant selection
   */
  private async waitForVariantUpdate(
    page: Page,
    previousArticleNumber: string | null
  ): Promise<void> {
    try {
      // Wait for one of these conditions:
      // 1. Article number changes
      // 2. Price updates
      // 3. Image changes
      // 4. Or just wait a bit for AJAX

      await Promise.race([
        // Wait for article number to change
        page
          .waitForFunction(
            (prevNum) => {
              const currentNum = document.querySelector(
                '.product-detail-ordernumber-container'
              )?.textContent;
              return currentNum && currentNum !== prevNum;
            },
            { timeout: 3000 },
            previousArticleNumber
          )
          .catch(() => {}),

        // Wait for price container to update (class change, content change, etc.)
        page
          .waitForFunction(
            () => {
              const price = document.querySelector('.product-detail-price');
              return price?.getAttribute('data-updated') === 'true';
            },
            { timeout: 3000 }
          )
          .catch(() => {}),

        // Just wait a fixed time as fallback
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      // Additional small wait for stabilization
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      // Ignore timeout errors, just continue
    }
  }

  /**
   * Extract article number from current page state
   */
  private async extractArticleNumber(page: Page): Promise<string | null> {
    try {
      const selectors = [
        '.product-detail-ordernumber-container',
        '[class*="article-number"]',
        '[class*="product-number"]',
        '[class*="sku"]',
        '[itemprop="sku"]',
      ];

      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) {
          const text = await element.evaluate((el) => el.textContent?.trim() || '');
          // Extract article number pattern (e.g., 1313-F, 1313-FSH)
          const match = text.match(/\d{3,}(?:-[A-Z]+)?/);
          if (match) {
            return match[0];
          }
        }
      }
    } catch (error) {
      console.error('Error extracting article number:', error);
    }

    return null;
  }

  /**
   * Get label for a select element
   */
  private async getSelectLabel(page: Page, select: ElementHandle): Promise<string> {
    try {
      // Try to find associated label
      const selectId = await select.evaluate((el) => el.id);
      if (selectId) {
        const label = await page.$(`label[for="${selectId}"]`);
        if (label) {
          return await label.evaluate((el) => el.textContent?.trim() || 'Selection');
        }
      }

      // Try to find label in parent
      const parentLabel = await select.evaluateHandle((el: Element) =>
        el.closest('label, .form-group')?.querySelector('label, .form-label')
      );
      if (parentLabel) {
        return await (parentLabel as any).evaluate(
          (el: HTMLElement | null) => el?.textContent?.trim() || 'Selection'
        );
      }
    } catch (error) {
      // Ignore errors
    }

    return 'Selection';
  }
}
