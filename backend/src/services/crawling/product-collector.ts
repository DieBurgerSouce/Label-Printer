/**
 * Product Collector for Web Crawler
 * Functions for collecting product URLs from category and listing pages
 */

import { Page } from 'puppeteer';
import { CrawlJob, ProductSelectors } from '../../types/crawler-types';
import { filterProductUrls } from './url-utils';

/**
 * Collect all product links from a category page (with pagination)
 */
export async function collectProductsFromCategory(
  page: Page,
  job: CrawlJob,
  selectors: ProductSelectors,
  _targetProducts: number
): Promise<string[]> {
  const productUrls: string[] = [];
  let categoryPage = 1;
  const maxCategoryPages = 50;

  console.log(`   📄 Collecting products from category (max pages: ${maxCategoryPages})...`);

  while (categoryPage <= maxCategoryPages) {
    try {
      // Collect products from current page
      const pageProducts = await collectProductLinksFromPage(page, job, selectors);
      productUrls.push(...pageProducts);

      console.log(
        `      Page ${categoryPage}: Found ${pageProducts.length} products (${productUrls.length} total in category)`
      );

      // Try to find next page button
      const paginationPatterns = [
        selectors.nextPageButton,
        'a.next',
        'a[rel="next"]',
        '.next',
        '[class*="next"]',
        'button.next',
        'button[aria-label*="next"]',
        'button[aria-label*="Next"]',
        '.pagination a:last-child',
        '.paging a:last-child',
        'a[title*="next"]',
        'a[title*="Next"]',
      ].filter(Boolean);

      let nextButton = null;
      for (const pattern of paginationPatterns) {
        try {
          const element = await page.$(pattern as string);
          if (element) {
            const isDisabled = await page.evaluate(
              (sel) => {
                const el = document.querySelector(sel);
                if (!el) return true;
                return (
                  el.classList.contains('disabled') ||
                  el.hasAttribute('disabled') ||
                  el.getAttribute('aria-disabled') === 'true'
                );
              },
              pattern as string
            );

            if (!isDisabled) {
              nextButton = element;
              break;
            }
          }
        } catch {
          // Continue to next pattern
        }
      }

      if (!nextButton) {
        console.log(`      ✅ No more pages in this category (page ${categoryPage})`);
        break;
      }

      // Click next page - FIX: Wait for content to CHANGE, not just exist!

      // 1. Save first product link BEFORE clicking (to detect change)
      const oldFirstProduct = await page
        .evaluate(() => {
          const el = document.querySelector(
            '[class*="product"] a[href*="/detail/"]'
          ) as HTMLAnchorElement;
          return el?.href || null;
        })
        .catch(() => null);

      console.log(`      ⏳ Clicking next page button...`);
      await nextButton.click();
      await new Promise((r) => setTimeout(r, 2000)); // Wait for AJAX to start

      try {
        // 2. Wait for content to CHANGE (not just for body to exist!)
        await page.waitForFunction(
          (oldHref: string | null) => {
            // Check if first product link changed
            const firstLink = document.querySelector(
              '[class*="product"] a[href*="/detail/"]'
            ) as HTMLAnchorElement;
            if (firstLink && firstLink.href !== oldHref) {
              return true; // Content changed!
            }

            // Alternative: Check if page number in pagination changed
            const pagination = document.querySelector('.pagination .page-item.active');
            if (pagination && parseInt(pagination.textContent || '0') > 1) {
              return true;
            }

            return false;
          },
          { timeout: 15000 },
          oldFirstProduct
        );

        // 3. Additional safety: Wait a bit more for all products to load
        await new Promise((r) => setTimeout(r, 1000));

        console.log(`      ✅ Page ${categoryPage + 1} loaded successfully`);
      } catch {
        console.log(`      ⚠️  Timeout waiting for products on page ${categoryPage + 1}`);
        console.log(`      💡 This might be the last page, or pagination failed`);
        break;
      }

      job.results.stats.totalPages++;
      categoryPage++;

      // Continue crawling all category pages - no artificial limits
    } catch (error) {
      console.log(
        `      ❌ Error on category page ${categoryPage}:`,
        error instanceof Error ? error.message : 'Unknown'
      );
      break;
    }
  }

  console.log(`   📦 Category total: ${productUrls.length} products from ${categoryPage} pages`);
  return productUrls;
}

/**
 * Collect product links from a single page (NO screenshots)
 */
export async function collectProductLinksFromPage(
  page: Page,
  _job: CrawlJob,
  selectors: ProductSelectors
): Promise<string[]> {
  try {
    // IMPROVED: Try multiple container patterns with fallback logic
    const containerPatterns = [
      selectors.productContainer,
      '.product',
      '.product-item',
      '.product-card',
      'li.product',
      'div.product',
      '[class*="product"]',
      '[data-product]',
      'article',
      'a[href*="/"]', // Last resort: all links
    ];

    let allUrls: string[] = [];
    let workingContainer: string | null = null;

    // Try each pattern until we find product links
    for (const containerPattern of containerPatterns) {
      try {
        // Check if container exists (but don't wait long)
        const containers = await page.$$(containerPattern);
        if (containers.length === 0) continue;

        console.log(`   🔍 Trying container: ${containerPattern} (${containers.length} found)`);

        // Try to get links from this container using page.evaluate
        const urls = await page.evaluate((pattern) => {
          const elements = document.querySelectorAll(`${pattern} a`);
          return Array.from(elements)
            .map((link) => (link as HTMLAnchorElement).href)
            .filter(Boolean);
        }, containerPattern);

        if (urls.length > 0) {
          allUrls = urls;
          workingContainer = containerPattern;
          console.log(`   ✅ Found ${urls.length} links using: ${containerPattern}`);
          break; // Success! Stop trying more patterns
        }
      } catch {
        // This pattern didn't work, try next one
        continue;
      }
    }

    if (!workingContainer || allUrls.length === 0) {
      throw new Error(`No product links found with any selector pattern`);
    }

    // Get base hostname for filtering
    const baseHostname = new URL(page.url()).hostname;

    // Filter to ONLY product pages (not categories, legal pages, account pages)
    const productUrls = filterProductUrls(allUrls, baseHostname);

    console.log(
      `✅ Found ${productUrls.length} products on page (filtered from ${allUrls.length} total links)`
    );
    return productUrls;
  } catch (error) {
    throw new Error(
      `Failed to collect product links: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
