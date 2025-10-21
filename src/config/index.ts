import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/**
 * Parse environment variable as boolean
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse environment variable as number
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Main application configuration
 */
export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseNumber(process.env.APP_PORT, 3000),
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  shop: {
    url: process.env.SHOP_URL || 'https://shop.firmenich.de',
    sitemapUrl: process.env.SHOP_SITEMAP_URL || 'https://shop.firmenich.de/sitemap.xml',
  },

  shopware: {
    apiUrl: process.env.SHOPWARE_API_URL || '',
    apiKey: process.env.SHOPWARE_API_KEY || '',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseNumber(process.env.REDIS_DB, 0),
  },

  screenshot: {
    width: parseNumber(process.env.SCREENSHOT_WIDTH, 1920),
    height: parseNumber(process.env.SCREENSHOT_HEIGHT, 1080),
    deviceScaleFactor: parseNumber(process.env.SCREENSHOT_DEVICE_SCALE_FACTOR, 2),
    timeout: parseNumber(process.env.SCREENSHOT_TIMEOUT, 30000),
    waitAfterLoad: parseNumber(process.env.SCREENSHOT_WAIT_AFTER_LOAD, 1000),
  },

  browser: {
    headless: parseBoolean(process.env.BROWSER_HEADLESS, true),
    poolMin: parseNumber(process.env.BROWSER_POOL_MIN, 3),
    poolMax: parseNumber(process.env.BROWSER_POOL_MAX, 12),
    recycleAfter: parseNumber(process.env.BROWSER_RECYCLE_AFTER, 100),
  },

  queue: {
    concurrency: parseNumber(process.env.QUEUE_CONCURRENCY, 8),
    maxAttempts: parseNumber(process.env.QUEUE_MAX_ATTEMPTS, 3),
    backoffDelay: parseNumber(process.env.QUEUE_BACKOFF_DELAY, 2000),
    rateLimitMax: parseNumber(process.env.QUEUE_RATE_LIMIT_MAX, 10),
    rateLimitDuration: parseNumber(process.env.QUEUE_RATE_LIMIT_DURATION, 1000),
  },

  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 's3' | 'r2') || 'local',
    localPath: path.resolve(process.env.STORAGE_LOCAL_PATH || './screenshots'),
    s3: {
      bucket: process.env.STORAGE_S3_BUCKET || '',
      region: process.env.STORAGE_S3_REGION || '',
      accessKey: process.env.STORAGE_S3_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_S3_SECRET_KEY || '',
      endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
    },
    r2: {
      accountId: process.env.STORAGE_R2_ACCOUNT_ID || '',
      accessKey: process.env.STORAGE_R2_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_R2_SECRET_KEY || '',
      bucket: process.env.STORAGE_R2_BUCKET || '',
    },
  },

  cache: {
    enabled: parseBoolean(process.env.CACHE_ENABLED, true),
    ttl: parseNumber(process.env.CACHE_TTL, 86400),
    contentHash: parseBoolean(process.env.CACHE_CONTENT_HASH, true),
  },

  monitoring: {
    enablePrometheus: parseBoolean(process.env.ENABLE_PROMETHEUS_METRICS, false),
    prometheusPort: parseNumber(process.env.PROMETHEUS_PORT, 9090),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
    maxFiles: process.env.LOG_MAX_FILES || '10',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
  },

  bullBoard: {
    enabled: parseBoolean(process.env.BULL_BOARD_ENABLED, true),
    port: parseNumber(process.env.BULL_BOARD_PORT, 3001),
    username: process.env.BULL_BOARD_USERNAME || 'admin',
    password: process.env.BULL_BOARD_PASSWORD || '',
  },

  database: {
    type: (process.env.DATABASE_TYPE as 'sqlite' | 'postgres') || 'sqlite',
    path: path.resolve(process.env.DATABASE_PATH || './metadata.sqlite'),
    postgres: {
      host: process.env.DATABASE_POSTGRES_HOST || '',
      port: parseNumber(process.env.DATABASE_POSTGRES_PORT, 5432),
      user: process.env.DATABASE_POSTGRES_USER || '',
      password: process.env.DATABASE_POSTGRES_PASSWORD || '',
      database: process.env.DATABASE_POSTGRES_DATABASE || '',
    },
  },

  features: {
    enableAutoScroll: parseBoolean(process.env.ENABLE_AUTO_SCROLL, true),
    enableLazyLoadingFix: parseBoolean(process.env.ENABLE_LAZY_LOADING_FIX, true),
    disableAnimations: parseBoolean(process.env.DISABLE_ANIMATIONS, true),
    chunkedScreenshotThreshold: parseNumber(process.env.CHUNKED_SCREENSHOT_THRESHOLD, 6000),
  },
} as const;

export default config;
