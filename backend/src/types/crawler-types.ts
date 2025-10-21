/**
 * Type definitions for Web Crawler Service
 */

export interface CrawlJob {
  id: string;
  shopUrl: string;
  status: 'pending' | 'crawling' | 'processing' | 'completed' | 'failed';
  config: CrawlConfig;
  results: CrawlResults;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface CrawlConfig {
  maxProducts?: number;
  followPagination: boolean;
  screenshotQuality: number; // 0-100
  waitForImages: boolean;
  timeout: number; // milliseconds
  customSelectors?: ProductSelectors;
  userAgent?: string;
  headless: boolean;
  fullShopScan?: boolean; // Scan entire shop before selecting products
}

export interface CrawlResults {
  productsFound: number;
  screenshots: Screenshot[];
  errors: CrawlError[];
  duration: number; // milliseconds
  stats: CrawlStats;
}

export interface Screenshot {
  id: string;
  url: string;
  productUrl: string;
  imagePath: string;
  thumbnailPath?: string;
  metadata: ScreenshotMetadata;
  extractedElements?: ExtractedElements;
}

export interface ScreenshotMetadata {
  width: number;
  height: number;
  timestamp: Date;
  pageTitle: string;
  fileSize: number;
  format: 'png' | 'jpeg' | 'webp';
}

export interface ExtractedElements {
  articleNumber?: string;
  price?: string;
  productName?: string;
  productImage?: string;
  description?: string;
  additionalData?: Record<string, any>;
}

export interface ProductSelectors {
  productContainer: string;
  productLink: string;
  productImage: string;
  price: string;
  articleNumber: string;
  productName: string;
  description?: string;
  nextPageButton?: string;
  paginationLinks?: string;
}

export interface CrawlError {
  timestamp: Date;
  url: string;
  error: string;
  type: 'network' | 'timeout' | 'selector' | 'screenshot' | 'other';
  stack?: string;
}

export interface CrawlStats {
  totalPages: number;
  successfulScreenshots: number;
  failedScreenshots: number;
  averagePageLoadTime: number;
  totalDataTransferred: number; // bytes
}

export interface ProductDetectionResult {
  confidence: number;
  products: DetectedProduct[];
  layoutType: 'grid' | 'list' | 'carousel' | 'mixed';
  selectors: AutoDetectedSelectors;
}

export interface DetectedProduct {
  boundingBox: BoundingBox;
  elements: ProductElements;
  extractedData: ExtractedElements;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProductElements {
  image?: HTMLElementInfo;
  title?: HTMLElementInfo;
  price?: HTMLElementInfo;
  articleNumber?: HTMLElementInfo;
  description?: HTMLElementInfo;
}

export interface HTMLElementInfo {
  selector: string;
  text?: string;
  src?: string;
  href?: string;
  attributes: Record<string, string>;
}

export interface AutoDetectedSelectors {
  productContainer: string;
  confidence: number;
  alternatives: Array<{
    selector: string;
    confidence: number;
  }>;
}

// Default configurations
export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxProducts: 100,
  followPagination: true,
  screenshotQuality: 90,
  waitForImages: true,
  timeout: 30000,
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

export const COMMON_PRODUCT_SELECTORS: Record<string, ProductSelectors> = {
  shopify: {
    productContainer: '.product-item',
    productLink: 'a.product-link',
    productImage: 'img.product-image',
    price: '.price',
    articleNumber: '.sku',
    productName: '.product-title',
    nextPageButton: 'a.next'
  },
  woocommerce: {
    productContainer: '.product',
    productLink: 'a.woocommerce-LoopProduct-link',
    productImage: 'img.attachment-woocommerce_thumbnail',
    price: '.woocommerce-Price-amount',
    articleNumber: '.sku',
    productName: '.woocommerce-loop-product__title',
    nextPageButton: 'a.next.page-numbers'
  },
  magento: {
    productContainer: '.product-item',
    productLink: 'a.product-item-link',
    productImage: 'img.product-image-photo',
    price: '.price',
    articleNumber: '.sku',
    productName: '.product-item-name',
    nextPageButton: 'a.action.next'
  }
};
