import Redis from 'ioredis';
import config from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('CacheService');

/**
 * Cache Service using Redis
 */
export class CacheService {
  private redis: Redis;
  private isConnected = false;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis connection retry', { attempt: times, delay });
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error', { error: error.message });
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.redis.status === 'ready';
  }

  /**
   * Get cached value by key
   */
  async get(key: string): Promise<string | null> {
    if (!config.cache.enabled || !this.isReady()) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        logger.debug('Cache hit', { key });
      }
      return value;
    } catch (error) {
      logger.warn('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key: string, value: string, ttl: number = config.cache.ttl): Promise<boolean> {
    if (!config.cache.enabled || !this.isReady()) {
      return false;
    }

    try {
      await this.redis.setex(key, ttl, value);
      logger.debug('Cache set', { key, ttl });
      return true;
    } catch (error) {
      logger.warn('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      await this.redis.del(key);
      logger.debug('Cache deleted', { key });
      return true;
    } catch (error) {
      logger.warn('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.warn('Cache exists check error', { key, error });
      return false;
    }
  }

  /**
   * Get cached screenshot by content hash
   */
  async getScreenshotByContentHash(contentHash: string): Promise<string | null> {
    const key = `screenshot:hash:${contentHash}`;
    return this.get(key);
  }

  /**
   * Cache screenshot with content hash
   */
  async cacheScreenshotByContentHash(
    contentHash: string,
    filepath: string,
    ttl?: number
  ): Promise<boolean> {
    const key = `screenshot:hash:${contentHash}`;
    return this.set(key, filepath, ttl);
  }

  /**
   * Get cached screenshot by URL
   */
  async getScreenshotByUrl(url: string): Promise<string | null> {
    const key = `screenshot:url:${this.hashUrl(url)}`;
    return this.get(key);
  }

  /**
   * Cache screenshot by URL
   */
  async cacheScreenshotByUrl(url: string, filepath: string, ttl?: number): Promise<boolean> {
    const key = `screenshot:url:${this.hashUrl(url)}`;
    return this.set(key, filepath, ttl);
  }

  /**
   * Hash URL for cache key
   */
  private hashUrl(url: string): string {
    // Simple hash function (for production, consider using crypto.createHash)
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    if (!this.isReady()) {
      return {
        keys: 0,
        memoryUsage: '0',
        hitRate: 0,
      };
    }

    try {
      const dbSize = await this.redis.dbsize();
      const info = await this.redis.info('stats');

      // Parse info string for hit rate
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);

      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      // Get memory usage
      const memoryInfo = await this.redis.info('memory');
      const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'N/A';

      return {
        keys: dbSize,
        memoryUsage,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      logger.warn('Failed to get cache stats', { error });
      return {
        keys: 0,
        memoryUsage: '0',
        hitRate: 0,
      };
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      await this.redis.flushdb();
      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async getKeys(pattern: string = '*'): Promise<string[]> {
    if (!this.isReady()) {
      return [];
    }

    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      logger.warn('Failed to get keys', { pattern, error });
      return [];
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis connection closed');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.warn('Redis health check failed', { error });
      return false;
    }
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

/**
 * Get cache service singleton
 */
export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}

export default CacheService;
