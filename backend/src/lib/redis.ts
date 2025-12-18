/**
 * Redis Client Configuration
 * Centralized Redis connection with authentication support
 */
import Redis, { RedisOptions } from 'ioredis';
import logger from '../utils/logger';

let redisClient: Redis | null = null;

/**
 * Get Redis connection options from environment variables
 */
function getRedisOptions(): RedisOptions {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;

  const options: RedisOptions = {
    host,
    port,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    commandTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000); // Exponential backoff
    },
  };

  // Only add password if provided and not the default placeholder
  if (password && password !== 'changeme_in_production') {
    options.password = password;
  }

  return options;
}

/**
 * Get or create Redis client singleton
 * Returns null if Redis is not configured
 */
export function getRedisClient(): Redis | null {
  if (!redisClient) {
    // Check if Redis is configured (at minimum, host should be set or REDIS_URL)
    if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
      logger.warn('Redis not configured (REDIS_HOST or REDIS_URL not set)');
      return null;
    }

    // If REDIS_URL is provided, use it directly
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        commandTimeout: 5000,
      });
    } else {
      redisClient = new Redis(getRedisOptions());
    }

    // Set up event handlers
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
}

/**
 * Build Redis URL from environment variables
 * Useful for libraries that require a connection string
 */
export function getRedisUrl(): string {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;

  // If password is set and not the default, include it in the URL
  if (password && password !== 'changeme_in_production') {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed gracefully');
  }
}
