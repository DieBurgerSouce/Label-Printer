/**
 * Screenshot Job Data
 */
export interface ScreenshotJobData {
  url: string;
  productId?: string;
  category?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Screenshot Result
 */
export interface ScreenshotResult {
  success: boolean;
  url: string;
  filepath?: string;
  filename?: string;
  s3Url?: string;
  contentHash?: string;
  fileSize?: number;
  timestamp: Date;
  error?: string;
  metadata?: ScreenshotMetadata;
}

/**
 * Screenshot Metadata
 */
export interface ScreenshotMetadata {
  productId?: string;
  category?: string;
  sourceUrl: string;
  captureTimestamp: Date;
  fileSize: number;
  width: number;
  height: number;
  colorSpace: string;
  version: string;
  contentHash: string;
}

/**
 * Browser Pool Status
 */
export interface BrowserPoolStatus {
  total: number;
  available: number;
  inUse: number;
  healthy: number;
}

/**
 * Queue Statistics
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Storage Options
 */
export interface StorageOptions {
  filepath: string;
  buffer: Buffer;
  metadata?: ScreenshotMetadata;
  uploadToCloud?: boolean;
}

/**
 * URL Source
 */
export interface URLSource {
  url: string;
  productId?: string;
  category?: string;
  discoveredAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Sitemap Entry
 */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

/**
 * Shopware Product
 */
export interface ShopwareProduct {
  id: string;
  name: string;
  productNumber: string;
  price: {
    gross: number;
    net: number;
  };
  categories?: Array<{
    id: string;
    name: string;
  }>;
  media?: Array<{
    url: string;
  }>;
  seoUrls?: Array<{
    seoPathInfo: string;
  }>;
}

/**
 * Cache Entry
 */
export interface CacheEntry {
  key: string;
  value: string;
  contentHash?: string;
  timestamp: Date;
  ttl: number;
}

/**
 * Error Categories
 */
export enum ErrorCategory {
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  RENDERING = 'rendering',
  STORAGE = 'storage',
  UNKNOWN = 'unknown',
}

/**
 * Screenshot Service Error
 */
export class ScreenshotError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public url?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

/**
 * File Naming Options
 */
export interface FileNamingOptions {
  productId?: string;
  category?: string;
  date?: Date;
  version?: string;
}

/**
 * Logger Interface
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
