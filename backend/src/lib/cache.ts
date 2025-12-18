/**
 * Redis Cache Layer
 * High-performance caching with TTL support
 */

import Redis from 'ioredis';
import logger from '../utils/logger';

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Default TTL in seconds (default: 3600 = 1 hour) */
  defaultTtl?: number;
  /** Prefix for all cache keys (default: 'cache:') */
  keyPrefix?: string;
  /** Serialize function (default: JSON.stringify) */
  serialize?: (value: unknown) => string;
  /** Deserialize function (default: JSON.parse) */
  deserialize?: <T>(value: string) => T;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
  hits: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_OPTIONS: Required<CacheOptions> = {
  defaultTtl: 3600, // 1 hour
  keyPrefix: 'cache:',
  serialize: JSON.stringify,
  deserialize: <T>(value: string): T => JSON.parse(value) as T,
};

/**
 * Cache class for Redis-backed caching
 */
export class Cache {
  private redis: Redis | null = null;
  private options: Required<CacheOptions>;
  private connected: boolean = false;
  private localCache: Map<string, { value: string; expiresAt: number }> = new Map();

  constructor(options: CacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize Redis connection
   */
  async connect(redisUrl?: string): Promise<void> {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Cache: Redis connection failed, falling back to local cache');
            return null; // Stop retrying
          }
          return Math.min(times * 1000, 3000);
        },
        lazyConnect: true,
      });

      this.redis.on('error', (error) => {
        if (this.connected) {
          logger.error('Cache: Redis error', { error: error.message });
          this.connected = false;
        }
      });

      this.redis.on('connect', () => {
        this.connected = true;
        logger.info('Cache: Redis connected');
      });

      this.redis.on('close', () => {
        this.connected = false;
        logger.warn('Cache: Redis connection closed');
      });

      await this.redis.connect();
    } catch (error) {
      logger.warn('Cache: Failed to connect to Redis, using local cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected && this.redis !== null;
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string): string {
    return `${this.options.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      // Try Redis first
      if (this.isConnected() && this.redis) {
        const value = await this.redis.get(fullKey);
        if (value) {
          logger.debug('Cache: HIT', { key });
          return this.options.deserialize<T>(value);
        }
      } else {
        // Fallback to local cache
        const entry = this.localCache.get(fullKey);
        if (entry && entry.expiresAt > Date.now()) {
          logger.debug('Cache: LOCAL HIT', { key });
          return this.options.deserialize<T>(entry.value);
        } else if (entry) {
          // Expired, remove it
          this.localCache.delete(fullKey);
        }
      }

      logger.debug('Cache: MISS', { key });
      return null;
    } catch (error) {
      logger.warn('Cache: GET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const ttl = ttlSeconds ?? this.options.defaultTtl;

    try {
      const serialized = this.options.serialize(value);

      if (this.isConnected() && this.redis) {
        await this.redis.setex(fullKey, ttl, serialized);
        logger.debug('Cache: SET', { key, ttl });
      } else {
        // Fallback to local cache
        this.localCache.set(fullKey, {
          value: serialized,
          expiresAt: Date.now() + ttl * 1000,
        });
        logger.debug('Cache: LOCAL SET', { key, ttl });
      }

      return true;
    } catch (error) {
      logger.warn('Cache: SET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      if (this.isConnected() && this.redis) {
        await this.redis.del(fullKey);
      }
      this.localCache.delete(fullKey);
      logger.debug('Cache: DELETE', { key });
      return true;
    } catch (error) {
      logger.warn('Cache: DELETE error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);

    try {
      if (this.isConnected() && this.redis) {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.debug('Cache: DELETE PATTERN', { pattern, count: keys.length });
          return keys.length;
        }
      }

      // Also clean local cache
      let count = 0;
      const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
      this.localCache.forEach((_, key) => {
        if (regex.test(key)) {
          this.localCache.delete(key);
          count++;
        }
      });

      return count;
    } catch (error) {
      logger.warn('Cache: DELETE PATTERN error', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get or set value with callback (cache-aside pattern)
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Not in cache, call factory
    const value = await factory();

    // Store in cache
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      if (this.isConnected() && this.redis) {
        return (await this.redis.exists(fullKey)) === 1;
      }

      const entry = this.localCache.get(fullKey);
      return entry !== undefined && entry.expiresAt > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.buildKey(key);

    try {
      if (this.isConnected() && this.redis) {
        return await this.redis.ttl(fullKey);
      }

      const entry = this.localCache.get(fullKey);
      if (entry) {
        const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
      }
      return -2; // Key doesn't exist
    } catch {
      return -2;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      if (this.isConnected() && this.redis) {
        const keys = await this.redis.keys(`${this.options.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
      this.localCache.clear();
      logger.info('Cache: Cleared all entries');
    } catch (error) {
      logger.warn('Cache: CLEAR error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    localCacheSize: number;
  }> {
    let keyCount = 0;

    try {
      if (this.isConnected() && this.redis) {
        const keys = await this.redis.keys(`${this.options.keyPrefix}*`);
        keyCount = keys.length;
      }
    } catch {
      // Ignore - return 0 count on error
    }

    return {
      connected: this.isConnected(),
      keyCount,
      localCacheSize: this.localCache.size,
    };
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.connected = false;
      logger.info('Cache: Disconnected');
    }
  }
}

// Default cache instance
let defaultCache: Cache | null = null;

/**
 * Get default cache instance (lazy initialization)
 */
export async function getCache(): Promise<Cache> {
  if (!defaultCache) {
    defaultCache = new Cache();
    await defaultCache.connect();
  }
  return defaultCache;
}

/**
 * Common TTL presets in seconds
 */
export const CacheTTL = {
  /** 1 minute */
  SHORT: 60,
  /** 5 minutes */
  MEDIUM: 300,
  /** 30 minutes */
  LONG: 1800,
  /** 1 hour */
  HOUR: 3600,
  /** 6 hours */
  SIX_HOURS: 21600,
  /** 24 hours */
  DAY: 86400,
  /** 7 days */
  WEEK: 604800,
};

/**
 * Cache key builders for common patterns
 */
export const CacheKeys = {
  /** Build key for product data */
  product: (id: string) => `product:${id}`,
  /** Build key for product list */
  productList: (page: number, limit: number, filters?: string) =>
    `products:list:${page}:${limit}${filters ? `:${filters}` : ''}`,
  /** Build key for template */
  template: (id: string) => `template:${id}`,
  /** Build key for template list */
  templateList: () => 'templates:list',
  /** Build key for categories */
  categories: () => 'categories:all',
  /** Build key for user session */
  userSession: (userId: string) => `session:${userId}`,
  /** Build key for crawl job */
  crawlJob: (id: string) => `crawljob:${id}`,
};

export default Cache;
