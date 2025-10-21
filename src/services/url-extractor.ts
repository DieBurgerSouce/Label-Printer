import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import config from '../config';
import { createLogger } from '../utils/logger';
import { SitemapEntry, URLSource } from '../types';

const logger = createLogger('URLExtractor');

/**
 * URL Extractor Service
 * Extracts product URLs from sitemaps and other sources
 */
export class URLExtractor {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Extract URLs from sitemap
   */
  async extractFromSitemap(sitemapUrl: string = config.shop.sitemapUrl): Promise<URLSource[]> {
    logger.info('Extracting URLs from sitemap', { sitemapUrl });

    try {
      // Fetch sitemap
      const response = await axios.get(sitemapUrl, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const xmlContent = response.data as string;
      const parsedData = this.xmlParser.parse(xmlContent);

      // Handle sitemap index (contains multiple sitemaps)
      if (parsedData.sitemapindex) {
        logger.info('Detected sitemap index, fetching child sitemaps');
        return this.extractFromSitemapIndex(parsedData.sitemapindex);
      }

      // Handle regular sitemap
      if (parsedData.urlset) {
        return this.parseUrlset(parsedData.urlset);
      }

      logger.warn('Unknown sitemap format', { sitemapUrl });
      return [];
    } catch (error) {
      logger.error('Failed to extract URLs from sitemap', {
        sitemapUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Extract URLs from sitemap index
   */
  private async extractFromSitemapIndex(
    sitemapIndex: Record<string, unknown>
  ): Promise<URLSource[]> {
    const sitemaps = Array.isArray(sitemapIndex.sitemap)
      ? sitemapIndex.sitemap
      : [sitemapIndex.sitemap];

    const allUrls: URLSource[] = [];

    for (const sitemap of sitemaps) {
      const sitemapUrl = (sitemap as { loc: string }).loc;
      if (sitemapUrl) {
        logger.debug('Fetching child sitemap', { sitemapUrl });
        const urls = await this.extractFromSitemap(sitemapUrl);
        allUrls.push(...urls);
      }
    }

    return allUrls;
  }

  /**
   * Parse urlset from sitemap
   */
  private parseUrlset(urlset: Record<string, unknown>): URLSource[] {
    const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
    const sources: URLSource[] = [];

    for (const urlEntry of urls) {
      const entry = urlEntry as SitemapEntry;
      if (entry.loc) {
        // Filter for product URLs (customize based on shop structure)
        if (this.isProductUrl(entry.loc)) {
          sources.push({
            url: entry.loc,
            discoveredAt: new Date(),
            status: 'pending',
          });
        }
      }
    }

    logger.info('Extracted product URLs from sitemap', { count: sources.length });
    return sources;
  }

  /**
   * Check if URL is a product URL
   * Customize this method based on your shop's URL structure
   */
  private isProductUrl(url: string): boolean {
    // Common product URL patterns
    const productPatterns = [
      /\/product\//i,
      /\/p\//i,
      /\/detail\//i,
      /\/item\//i,
      /\.html$/i,
    ];

    // Exclude non-product pages
    const excludePatterns = [
      /\/category\//i,
      /\/cart/i,
      /\/checkout/i,
      /\/account/i,
      /\/login/i,
      /\/register/i,
      /\/search/i,
      /\/sitemap/i,
    ];

    // Check exclusions first
    for (const pattern of excludePatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }

    // Check if matches product patterns
    for (const pattern of productPatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract URLs from a list
   */
  extractFromList(urls: string[]): URLSource[] {
    return urls.map((url) => ({
      url,
      discoveredAt: new Date(),
      status: 'pending' as const,
    }));
  }

  /**
   * Filter URLs by pattern
   */
  filterUrls(urls: URLSource[], pattern: RegExp): URLSource[] {
    return urls.filter((source) => pattern.test(source.url));
  }

  /**
   * Deduplicate URLs
   */
  deduplicateUrls(urls: URLSource[]): URLSource[] {
    const seen = new Set<string>();
    return urls.filter((source) => {
      if (seen.has(source.url)) {
        return false;
      }
      seen.add(source.url);
      return true;
    });
  }

  /**
   * Extract URLs from multiple sitemaps
   */
  async extractFromMultipleSitemaps(sitemapUrls: string[]): Promise<URLSource[]> {
    logger.info('Extracting URLs from multiple sitemaps', { count: sitemapUrls.length });

    const allUrls: URLSource[] = [];

    for (const sitemapUrl of sitemapUrls) {
      const urls = await this.extractFromSitemap(sitemapUrl);
      allUrls.push(...urls);
    }

    // Deduplicate
    const deduplicated = this.deduplicateUrls(allUrls);

    logger.info('Extracted and deduplicated URLs', {
      total: allUrls.length,
      unique: deduplicated.length,
    });

    return deduplicated;
  }

  /**
   * Get sample URLs for testing
   */
  async getSampleUrls(count: number = 10): Promise<URLSource[]> {
    const allUrls = await this.extractFromSitemap();
    return allUrls.slice(0, count);
  }
}

// Singleton instance
let urlExtractor: URLExtractor | null = null;

/**
 * Get URL extractor singleton
 */
export function getURLExtractor(): URLExtractor {
  if (!urlExtractor) {
    urlExtractor = new URLExtractor();
  }
  return urlExtractor;
}

export default URLExtractor;
