/**
 * Category Navigator for Web Crawler
 * Functions for finding and navigating category pages
 */

import { Page } from 'puppeteer';

/**
 * Find all category links from the entire page (including dropdowns/mega-menus)
 * This captures ALL category levels (main categories + subcategories)
 */
export async function findCategoryLinks(page: Page, shopUrl: string): Promise<string[]> {
  try {
    const baseUrl = new URL(shopUrl);
    const baseDomain = baseUrl.hostname;

    // IMPORTANT: Get ALL links from the page, not just visible navigation
    // This ensures we capture dropdown/mega-menu subcategories!
    console.log(`🔍 Searching for category links across entire page (including dropdowns)...`);

    // Hover over navigation items to trigger dropdowns
    const navSelectors = [
      'nav',
      'header nav',
      '.navigation',
      '.main-navigation',
      '.nav',
      '[role="navigation"]',
      '.menu',
      '.main-menu',
      '#navigation',
      '.navbar',
      '.nav-main',
      '.primary-navigation',
    ];

    let navElement = null;
    for (const selector of navSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          navElement = element;
          console.log(`✅ Found navigation: ${selector}`);
          break;
        }
      } catch {
        // Continue to next selector
      }
    }

    // Try to trigger all dropdowns by hovering over main nav items
    if (navElement) {
      try {
        const mainNavItems = await navElement.$$('a, button');
        console.log(
          `🖱️  Hovering over ${mainNavItems.length} navigation items to reveal dropdowns...`
        );

        for (const item of mainNavItems.slice(0, 20)) {
          // Limit to first 20 to avoid timeout
          try {
            await item.hover();
            await new Promise((r) => setTimeout(r, 300)); // Wait for dropdown to appear
          } catch {
            // Continue with next item
          }
        }

        console.log(`✅ Dropdowns revealed`);
      } catch {
        console.log(`⚠️  Could not hover over navigation items`);
      }
    }

    // Get ALL links from the entire page (now that dropdowns are visible)
    const allLinks: Array<{ href: string; text: string }> = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map((link) => ({
          href: link.href,
          text: link.textContent?.trim() || '',
        }))
        .filter((l) => l.href);
    });

    console.log(`📋 Found ${allLinks.length} total links on page`);

    // Filter to category links only
    const categoryLinks = allLinks.filter((link) => {
      try {
        const linkUrl = new URL(link.href);

        // Must be same domain
        if (!linkUrl.hostname.includes(baseDomain)) {
          return false;
        }

        const pathname = linkUrl.pathname;

        // Skip common non-category pages
        const skipPatterns = [
          '/account',
          '/login',
          '/register',
          '/cart',
          '/checkout',
          '/AGB',
          '/Datenschutz',
          '/Impressum',
          '/Kontakt',
          '/Versand',
          '/search',
          '/suche',
          '/about',
          '/ueber-uns',
          '/#', // Hash links
          '/widgets/cms/', // CMS widgets
        ];

        if (skipPatterns.some((pattern) => pathname.toLowerCase().includes(pattern.toLowerCase()))) {
          return false;
        }

        // Skip external links (PDFs, documents)
        if (link.href.includes('.pdf') || link.href.includes('yumpu.com')) {
          return false;
        }

        const pathParts = pathname.split('/').filter((p) => p.length > 0);

        // Category links: End with / (category indicator) and are not the homepage
        // REMOVED length restriction to capture ALL category levels (main + subcategories)
        if (pathname.endsWith('/') && pathParts.length >= 1 && pathname !== '/') {
          console.log(`   ✓ Category found: ${link.text} → ${link.href}`);
          return true;
        }

        return false;
      } catch {
        return false;
      }
    });

    // Return unique category URLs
    const uniqueCategories = Array.from(new Set(categoryLinks.map((l) => l.href)));

    console.log(`\n📊 Category Discovery Summary:`);
    console.log(`   Total categories found: ${uniqueCategories.length}`);

    return uniqueCategories;
  } catch (error) {
    console.error(
      'Failed to find category links:',
      error instanceof Error ? error.message : 'Unknown'
    );
    return [];
  }
}
