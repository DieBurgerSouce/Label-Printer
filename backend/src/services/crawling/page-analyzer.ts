/**
 * Page Analyzer for Web Crawler
 * Functions for detecting page types and product selectors
 */

import { Page } from 'puppeteer';
import { ProductSelectors, COMMON_PRODUCT_SELECTORS } from '../../types/crawler-types';

/**
 * Check if current page is a product page
 */
export async function isProductPage(page: Page): Promise<boolean> {
  try {
    // Check URL patterns first
    const url = page.url();
    if (url.includes('/produkt/') || url.includes('/product/')) {
      console.log('✅ Product URL pattern detected');
      return true;
    }

    // Check for key product page elements
    const productIndicators = [
      // Shopware 6 selectors
      '.product-detail-media img[itemprop="image"]',
      '.product-detail-ordernumber',
      '.product-detail-name',
      '.product-detail-description-text',
      // WooCommerce/Firmenich selectors
      'div.product.type-product',
      '.product-detail-ordernumber-container',
      '.summary.entry-summary',
      '.product-configurator-group',
      // Generic selectors
      'meta[property="product:price:amount"]',
      '[itemprop="offers"]',
      '.product-gallery',
      '.product-info',
      'body.single-product',
    ];

    let found = 0;
    for (const selector of productIndicators) {
      const exists = await page.$(selector);
      if (exists) found++;
    }

    // If at least 2 product indicators are found, it's likely a product page
    const isProduct = found >= 2;
    if (isProduct) {
      console.log(`✅ Product page detected (${found} indicators found)`);
    }
    return isProduct;
  } catch {
    return false;
  }
}

/**
 * Detect product selectors automatically
 */
export async function detectProductSelectors(
  page: Page,
  customSelectors?: ProductSelectors
): Promise<ProductSelectors | null> {
  if (customSelectors) {
    return customSelectors;
  }

  // Check URL for known shops
  const url = page.url();
  if (url.includes('firmenich.de')) {
    console.log('🎯 Detected Firmenich shop - using specific selectors');
    return COMMON_PRODUCT_SELECTORS.firmenich;
  }

  // Check if we're on a single product page
  const isProduct = await isProductPage(page);
  if (isProduct) {
    console.log('📦 Single product page detected - using direct capture mode');
    // Return minimal selectors for single product
    return {
      productContainer: 'body', // Use entire page
      productLink: 'a',
      productImage: '.product-image, img[class*="product"]',
      price: '.price, .product-price',
      articleNumber: '.sku, .product-sku',
      productName: '.product-title, h1',
      nextPageButton: '', // No pagination on product pages
    };
  }

  // Try common e-commerce platforms
  for (const [platform, selectors] of Object.entries(COMMON_PRODUCT_SELECTORS)) {
    try {
      const container = await page.$(selectors.productContainer);
      if (container) {
        console.log(`Detected ${platform} platform`);
        return selectors;
      }
    } catch {
      // Continue to next platform
    }
  }

  // Try generic detection
  const genericSelectors = await detectGenericSelectors(page);
  return genericSelectors;
}

/**
 * Generic product selector detection
 */
export async function detectGenericSelectors(page: Page): Promise<ProductSelectors | null> {
  try {
    // Common product container patterns
    const containerPatterns = [
      'li.product', // WooCommerce list items
      '.product',
      '.product-item',
      '.product-card',
      '[class*="product"]',
      '[data-product]',
      'article',
      '.item',
      '.card',
    ];

    for (const pattern of containerPatterns) {
      const containers = await page.$$(pattern);
      // Accept 1 or more products (was 3 before)
      if (containers.length >= 1) {
        // Try to detect pagination button
        const paginationPatterns = [
          'a.next',
          'a[rel="next"]',
          '.next',
          '.pagination a:last-child',
          '[class*="next"]',
          '[class*="pagination"] a:last-child',
          'a:has-text("Next")',
          'a:has-text("Weiter")',
          'a:has-text("›")',
          '.paging a:last-child',
          '.pages a:last-child',
        ];

        let nextButton: string | undefined;
        for (const paginationPattern of paginationPatterns) {
          try {
            const button = await page.$(paginationPattern);
            if (button) {
              nextButton = paginationPattern;
              console.log(`✅ Detected pagination button: ${nextButton}`);
              break;
            }
          } catch {
            // Continue to next pattern
          }
        }

        return {
          productContainer: pattern,
          productLink: 'a',
          productImage: 'img',
          price: '[class*="price"], .price',
          articleNumber: '[class*="sku"], .sku',
          productName: '[class*="title"], [class*="name"], h2, h3',
          nextPageButton: nextButton,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Generic detection failed:', error);
    return null;
  }
}

/**
 * Get fallback selectors for product pages based on URL
 */
export function getFallbackSelectors(url: string): ProductSelectors | null {
  if (url.includes('/produkt/') || url.includes('/product/')) {
    console.log('⚠️ Using fallback selectors for product page');
    return {
      productContainer: 'body',
      productLink: 'a',
      productImage: 'img[src*="product"], img[class*="product"], .product-image img',
      price: '.price, .product-price, .woocommerce-Price-amount',
      articleNumber: '.sku, .product-sku, .product-detail-ordernumber',
      productName: 'h1, .product-title, .product-name',
      nextPageButton: '',
    };
  }
  return null;
}
