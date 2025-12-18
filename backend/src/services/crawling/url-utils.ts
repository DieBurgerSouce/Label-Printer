/**
 * URL Utilities for Web Crawler
 * Helper functions for URL parsing and article number extraction
 */

/**
 * Extract article number from URL (fallback when HTML extraction fails)
 */
export function extractArticleNumberFromUrl(url: string): string {
  try {
    // Try to extract from URL path (common patterns)
    const match = url.match(/\/produkt\/([^/?#]+)|\/product\/([^/?#]+)|\/p\/([^/?#]+)/i);
    if (match) {
      const slug = match[1] || match[2] || match[3];
      // Extract numbers from slug
      const numbers = slug.match(/\d+/);
      if (numbers) {
        return numbers[0];
      }
      return slug;
    }

    // Fallback: use URL hash or last segment
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      const numbers = lastSegment.match(/\d+/);
      if (numbers) {
        return numbers[0];
      }
      return lastSegment;
    }

    // Last resort: use timestamp
    return `article-${Date.now()}`;
  } catch {
    return `article-${Date.now()}`;
  }
}

/**
 * Clean article number by removing common prefixes and colons
 */
export function cleanArticleNumber(raw: string): string {
  if (!raw) return '';

  // Remove common prefixes (case insensitive)
  const prefixes = [
    'Artikel-Nr.',
    'Artikelnr.',
    'Artikel Nr.',
    'Art.-Nr.',
    'Art.Nr.',
    'Art Nr.',
    'SKU',
    'Produktnummer',
    'Product Number',
    'Item Number',
    'Item No.',
  ];

  let cleaned = raw.trim();

  // Remove prefixes
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s*:?\\s*`, 'i');
    cleaned = cleaned.replace(regex, '');
  }

  // Remove standalone colons at the beginning
  cleaned = cleaned.replace(/^:\s*/, '');

  // Remove any remaining leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Filter URLs to only include product pages (not categories, legal pages, etc.)
 */
export function filterProductUrls(urls: string[], baseHostname: string): string[] {
  return urls.filter((url) => {
    try {
      // Skip non-HTTP protocols (tel:, mailto:, javascript:, etc.)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
      }

      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const hostname = urlObj.hostname;

      // Skip external domains like PDF viewers
      if (!hostname.includes(baseHostname)) {
        return false;
      }

      // Skip PDF/document links
      if (url.includes('yumpu.com') || url.includes('.pdf') || url.includes('/document/')) {
        return false;
      }

      // Skip common non-product paths
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
        '/Informationen/',
        '/Shop-Service/',
        '/Newsletter/',
        '/#', // Hash links (navigation)
        '/widgets/cms/', // CMS widgets (not products!)
        '/widgets/', // All widgets
      ];

      if (skipPatterns.some((pattern) => pathname.toLowerCase().includes(pattern.toLowerCase()))) {
        return false;
      }

      // KEY DIFFERENCE: Product pages have NO trailing slash!
      // Products: /Spargelschaeler/Der-Griffige-rot-ohne-Aufdruck (no trailing /)
      // Categories: /Ernte/Stechmesser/ (with trailing /)
      if (pathname.endsWith('/')) {
        return false; // Skip category pages
      }

      // Must have at least 2 path parts (category + product name)
      const pathParts = pathname.split('/').filter((p) => p.length > 0);
      return pathParts.length >= 2;
    } catch {
      return false;
    }
  });
}
