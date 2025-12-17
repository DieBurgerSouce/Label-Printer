/**
 * Crawling Services Module
 * Re-exports all crawling-related functionality
 */

// URL utilities
export { extractArticleNumberFromUrl, cleanArticleNumber, filterProductUrls } from './url-utils';

// Page analysis
export { isProductPage, detectProductSelectors, detectGenericSelectors, getFallbackSelectors } from './page-analyzer';

// Cookie handling
export { acceptCookies } from './cookie-handler';

// Category navigation
export { findCategoryLinks } from './category-navigator';

// Product collection
export { collectProductsFromCategory, collectProductLinksFromPage } from './product-collector';
