/**
 * Smart Shop Crawler for Firmenich
 * This crawler understands the shop structure and crawls ALL products efficiently
 *
 * STRATEGY:
 * 1. First crawl all category pages to find ALL product URLs
 * 2. Then process products in smart batches
 * 3. Handle variants when they exist
 * 4. Track everything for complete coverage
 */

const axios = require('axios');
const fs = require('fs').promises;
const cheerio = require('cheerio');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

class SmartShopCrawler {
  constructor(config = {}) {
    this.shopUrl = config.shopUrl || 'https://shop.firmenich.de';
    this.batchSize = config.batchSize || 25;
    this.delayBetweenRequests = config.delayBetweenRequests || 2000;
    this.maxRetries = config.maxRetries || 3;

    this.discoveredProducts = new Set();
    this.processedProducts = new Set();
    this.categoryUrls = new Set();
    this.stats = {
      categoriesFound: 0,
      productsFound: 0,
      variantsFound: 0,
      processed: 0,
      failed: 0
    };
  }

  /**
   * Phase 1: Discover ALL categories and subcategories
   */
  async discoverCategories() {
    console.log('\n🔍 PHASE 1: Discovering all categories...');

    try {
      // Start with main navigation
      const mainPage = await this.fetchPage(this.shopUrl);
      const $ = cheerio.load(mainPage);

      // Find all category links
      const categorySelectors = [
        '.navigation-flyout a',
        '.main-navigation a',
        '.category-navigation a',
        '.sidebar-navigation a',
        '.footer-navigation a',
        'a[href*="/Verpackung/"]',
        'a[href*="/Holzschliff/"]',
        'a[href*="/Obstschalen/"]',
        'a[href*="/Verkauf/"]'
      ];

      for (const selector of categorySelectors) {
        $(selector).each((i, el) => {
          const href = $(el).attr('href');
          if (href && !href.includes('#') && !href.includes('javascript')) {
            const fullUrl = this.resolveUrl(href);
            if (this.isValidCategoryUrl(fullUrl)) {
              this.categoryUrls.add(fullUrl);
            }
          }
        });
      }

      // Recursively crawl subcategories
      const processedCategories = new Set();
      const categoriesToProcess = Array.from(this.categoryUrls);

      while (categoriesToProcess.length > 0) {
        const categoryUrl = categoriesToProcess.shift();

        if (processedCategories.has(categoryUrl)) continue;
        processedCategories.add(categoryUrl);

        console.log(`   📂 Exploring category: ${this.getPathFromUrl(categoryUrl)}`);

        try {
          const categoryPage = await this.fetchPage(categoryUrl);
          const $cat = cheerio.load(categoryPage);

          // Find subcategories
          $cat('a[href*="/"]').each((i, el) => {
            const href = $cat(el).attr('href');
            if (href) {
              const fullUrl = this.resolveUrl(href);
              if (this.isValidCategoryUrl(fullUrl) && !processedCategories.has(fullUrl)) {
                categoriesToProcess.push(fullUrl);
                this.categoryUrls.add(fullUrl);
              }
            }
          });

          await this.sleep(500); // Be nice to the server
        } catch (error) {
          console.log(`   ⚠️ Error exploring category: ${error.message}`);
        }
      }

      this.stats.categoriesFound = this.categoryUrls.size;
      console.log(`✅ Found ${this.stats.categoriesFound} categories`);

    } catch (error) {
      console.error('❌ Error discovering categories:', error);
    }
  }

  /**
   * Phase 2: Discover ALL products from all categories
   */
  async discoverProducts() {
    console.log('\n🔍 PHASE 2: Discovering all products...');

    for (const categoryUrl of this.categoryUrls) {
      console.log(`   📦 Scanning: ${this.getPathFromUrl(categoryUrl)}`);

      let page = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        try {
          // Handle pagination
          const pageUrl = `${categoryUrl}${categoryUrl.includes('?') ? '&' : '?'}p=${page}`;
          const html = await this.fetchPage(pageUrl);
          const $ = cheerio.load(html);

          // Find product links
          const productSelectors = [
            '.product-box a.product-link',
            '.product-item a',
            '.product-info a',
            'a[href*="/"][href$="-"][href*="-"]', // Products often have hyphens
            '.cms-listing-product-box a',
            '[class*="product"] a[href]'
          ];

          let productsFoundOnPage = 0;

          for (const selector of productSelectors) {
            $(selector).each((i, el) => {
              const href = $(el).attr('href');
              if (href && this.isValidProductUrl(href)) {
                const fullUrl = this.resolveUrl(href);
                if (!this.discoveredProducts.has(fullUrl)) {
                  this.discoveredProducts.add(fullUrl);
                  productsFoundOnPage++;

                  // Extract article number if visible
                  const text = $(el).text();
                  const articleMatch = text.match(/\b\d{3,4}(?:-[A-Z]+)?\b/);
                  if (articleMatch) {
                    console.log(`      ✅ Found: ${articleMatch[0]} - ${fullUrl}`);
                  }
                }
              }
            });
          }

          // Check for pagination
          const hasNextPage = $('.pagination-next:not(.disabled)').length > 0 ||
                            $('a[rel="next"]').length > 0 ||
                            $(`.pagination a:contains("${page + 1}")`).length > 0;

          if (!hasNextPage || productsFoundOnPage === 0 || page > 100) {
            hasMorePages = false;
          } else {
            page++;
            await this.sleep(1000);
          }

        } catch (error) {
          console.log(`   ⚠️ Error on page ${page}: ${error.message}`);
          hasMorePages = false;
        }
      }
    }

    // Also check sitemap if available
    await this.checkSitemap();

    this.stats.productsFound = this.discoveredProducts.size;
    console.log(`✅ Found ${this.stats.productsFound} unique products!`);

    // Save discovered URLs for backup
    await this.saveDiscoveredUrls();
  }

  /**
   * Check sitemap for additional products
   */
  async checkSitemap() {
    try {
      console.log('   🗺️ Checking sitemap...');
      const sitemapUrls = [
        `${this.shopUrl}/sitemap.xml`,
        `${this.shopUrl}/sitemap_index.xml`,
        `${this.shopUrl}/sitemap/products.xml`
      ];

      for (const sitemapUrl of sitemapUrls) {
        try {
          const sitemap = await this.fetchPage(sitemapUrl);

          // Extract URLs from sitemap
          const urlMatches = sitemap.match(/<loc>(.*?)<\/loc>/g);
          if (urlMatches) {
            urlMatches.forEach(match => {
              const url = match.replace(/<\/?loc>/g, '');
              if (this.isValidProductUrl(url)) {
                this.discoveredProducts.add(url);
              }
            });
          }
        } catch (error) {
          // Sitemap might not exist, that's okay
        }
      }
    } catch (error) {
      console.log('   ℹ️ No sitemap found');
    }
  }

  /**
   * Phase 3: Process all products with smart variant detection
   */
  async processAllProducts() {
    console.log('\n🚀 PHASE 3: Processing all products...');

    const productUrls = Array.from(this.discoveredProducts);
    const batches = [];

    // Create batches
    for (let i = 0; i < productUrls.length; i += this.batchSize) {
      batches.push(productUrls.slice(i, i + this.batchSize));
    }

    console.log(`📦 Processing ${productUrls.length} products in ${batches.length} batches`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNum = batchIndex + 1;

      console.log(`\n📦 BATCH ${batchNum}/${batches.length} (${batch.length} products)`);

      // Check system health
      await this.checkHealth();

      for (const productUrl of batch) {
        try {
          await this.processProduct(productUrl);
          this.processedProducts.add(productUrl);
          this.stats.processed++;

          // Progress update
          if (this.stats.processed % 10 === 0) {
            console.log(`   📊 Progress: ${this.stats.processed}/${productUrls.length} (${Math.round(this.stats.processed / productUrls.length * 100)}%)`);
          }

          await this.sleep(this.delayBetweenRequests);
        } catch (error) {
          console.error(`   ❌ Failed: ${productUrl} - ${error.message}`);
          this.stats.failed++;
        }
      }

      // Save progress after each batch
      await this.saveProgress();

      // Cooldown between batches
      if (batchIndex < batches.length - 1) {
        console.log(`   ⏸️ Cooling down for 30 seconds...`);
        await this.sleep(30000);
      }
    }
  }

  /**
   * Process a single product with variant detection
   */
  async processProduct(productUrl) {
    console.log(`   🔄 Processing: ${this.getPathFromUrl(productUrl)}`);

    const response = await this.withRetry(async () => {
      return await axios.post(`${API_URL}/crawler/start`, {
        urls: [productUrl],
        config: {
          captureSelectors: true,
          headless: true,
          scrollDelay: 1500,
          pageLoadDelay: 2000,
          enableVariantDetection: true,
          maxVariantsPerProduct: 20,
          // Special handling for Firmenich shop
          customSelectors: {
            variantRadios: 'input[type="radio"][name*="group"], input[type="radio"][name*="option"]',
            variantDropdowns: 'select[name*="group"], select[name*="option"]',
            articleNumber: '.product-detail-ordernumber, .product-number, [class*="article"]',
            bulkOption: '[class*="karton"], [class*="bulk"], label:contains("Karton")'
          }
        }
      }, { timeout: 120000 });
    });

    const jobId = response.data.data?.jobId || response.data.id;

    // Wait for completion
    let attempts = 0;
    while (attempts < 60) {
      await this.sleep(5000);

      const statusResponse = await axios.get(`${API_URL}/crawler/jobs/${jobId}`);
      const job = statusResponse.data.data || statusResponse.data;

      if (job.status === 'completed') {
        if (job.results?.variantsFound) {
          this.stats.variantsFound += job.results.variantsFound;
          console.log(`      ✅ Found ${job.results.variantsFound} variants`);
        }
        return job;
      } else if (job.status === 'failed') {
        throw new Error(job.error || 'Job failed');
      }

      attempts++;
    }

    throw new Error('Job timeout');
  }

  /**
   * Helper: Fetch page with retry
   */
  async fetchPage(url) {
    return await this.withRetry(async () => {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      return response.data;
    });
  }

  /**
   * Helper: Retry mechanism
   */
  async withRetry(fn, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.sleep(2000 * Math.pow(2, i));
      }
    }
  }

  /**
   * Helper: Check if URL is a valid category
   */
  isValidCategoryUrl(url) {
    // Categories usually don't have product-like endings
    return url.includes(this.shopUrl) &&
           !url.includes('/checkout') &&
           !url.includes('/account') &&
           !url.includes('/cart') &&
           !url.match(/\d{3,4}(?:-[A-Z]+)?$/); // Not ending with article number
  }

  /**
   * Helper: Check if URL is a valid product
   */
  isValidProductUrl(url) {
    // Products often have article numbers or specific patterns
    return url.includes(this.shopUrl) &&
           (url.match(/\d{3,4}(?:-[A-Z]+)?/) || // Has article number
            url.match(/\/[^\/]+-[^\/]+$/) || // Has hyphenated name
            url.includes('/product/'));
  }

  /**
   * Helper: Resolve relative URLs
   */
  resolveUrl(url) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${this.shopUrl}${url}`;
    return `${this.shopUrl}/${url}`;
  }

  /**
   * Helper: Get path from URL
   */
  getPathFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  /**
   * Helper: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Check system health
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${API_URL}/health`);
      const health = response.data;

      if (health.memory?.system?.percentage > 85) {
        console.log('   ⚠️ High memory usage, waiting 60 seconds...');
        await this.sleep(60000);
      }
    } catch (error) {
      // Health check failed, continue anyway
    }
  }

  /**
   * Save discovered URLs
   */
  async saveDiscoveredUrls() {
    const data = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      categories: Array.from(this.categoryUrls),
      products: Array.from(this.discoveredProducts)
    };

    await fs.writeFile('discovered-urls.json', JSON.stringify(data, null, 2));
    console.log('   💾 Saved discovered URLs to discovered-urls.json');
  }

  /**
   * Save progress
   */
  async saveProgress() {
    const data = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      processed: Array.from(this.processedProducts),
      remaining: Array.from(this.discoveredProducts).filter(url => !this.processedProducts.has(url))
    };

    await fs.writeFile('crawl-progress.json', JSON.stringify(data, null, 2));
  }

  /**
   * Main execution
   */
  async run() {
    console.log('🚀 SMART SHOP CRAWLER FOR FIRMENICH');
    console.log('=====================================');
    console.log(`Shop URL: ${this.shopUrl}`);
    console.log(`Batch Size: ${this.batchSize}`);
    console.log('');

    const startTime = Date.now();

    try {
      // Phase 1: Discover categories
      await this.discoverCategories();

      // Phase 2: Discover all products
      await this.discoverProducts();

      // Phase 3: Process all products
      await this.processAllProducts();

      // Final report
      const duration = Math.round((Date.now() - startTime) / 1000 / 60);

      console.log('\n' + '='.repeat(50));
      console.log('✅ CRAWL COMPLETED!');
      console.log('='.repeat(50));
      console.log(`📊 Final Statistics:`);
      console.log(`   - Categories Found: ${this.stats.categoriesFound}`);
      console.log(`   - Products Found: ${this.stats.productsFound}`);
      console.log(`   - Variants Found: ${this.stats.variantsFound}`);
      console.log(`   - Successfully Processed: ${this.stats.processed}`);
      console.log(`   - Failed: ${this.stats.failed}`);
      console.log(`   - Duration: ${duration} minutes`);
      console.log(`   - Average: ${(this.stats.processed / duration * 60).toFixed(1)} products/minute`);

    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  const config = {
    shopUrl: 'https://shop.firmenich.de',
    batchSize: 25,
    delayBetweenRequests: 2000
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-size' && args[i + 1]) {
      config.batchSize = parseInt(args[i + 1]);
    } else if (args[i] === '--delay' && args[i + 1]) {
      config.delayBetweenRequests = parseInt(args[i + 1]) * 1000;
    } else if (args[i] === '--shop-url' && args[i + 1]) {
      config.shopUrl = args[i + 1];
    }
  }

  const crawler = new SmartShopCrawler(config);

  try {
    await crawler.run();
  } catch (error) {
    console.error('Crawl failed:', error);
    process.exit(1);
  }
}

// Check for required dependencies
try {
  require('cheerio');
} catch (error) {
  console.error('Missing dependency: cheerio');
  console.log('Please run: npm install cheerio');
  process.exit(1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SmartShopCrawler;