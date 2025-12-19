/**
 * Deep Health Check Utilities
 * Enterprise-grade health check implementations for all service dependencies
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import logger from './logger';

// Health check result interface
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

// Aggregated health status
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    queue: HealthCheckResult;
    memory: HealthCheckResult;
    disk?: HealthCheckResult;
  };
}

// Track startup time
const startupTime = Date.now();

/**
 * Check PostgreSQL database health
 */
export async function checkDatabaseHealth(prisma: PrismaClient): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Execute a simple query to verify connection
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW()`;
    const latencyMs = Date.now() - startTime;

    // Check if latency is acceptable
    if (latencyMs > 1000) {
      return {
        status: 'degraded',
        message: 'Database connection slow',
        latencyMs,
        details: {
          serverTime: result[0].now,
          threshold: 1000,
        },
      };
    }

    return {
      status: 'healthy',
      message: 'Database connection OK',
      latencyMs,
      details: {
        serverTime: result[0].now,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database health check failed', { error: message });

    return {
      status: 'unhealthy',
      message: `Database connection failed: ${message}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check Redis connection and performance
 */
export async function checkRedisHealth(redis: Redis | null): Promise<HealthCheckResult> {
  if (!redis) {
    return {
      status: 'unhealthy',
      message: 'Redis client not initialized',
    };
  }

  const startTime = Date.now();

  try {
    // Ping Redis
    const pong = await redis.ping();
    const latencyMs = Date.now() - startTime;

    if (pong !== 'PONG') {
      return {
        status: 'unhealthy',
        message: `Unexpected Redis response: ${pong}`,
        latencyMs,
      };
    }

    // Get Redis info for additional details
    const info = await redis.info('memory');
    const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
    const maxMemory = info.match(/maxmemory:(\d+)/)?.[1];

    // Check memory usage
    const memoryUsagePercent =
      usedMemory && maxMemory && parseInt(maxMemory) > 0
        ? (parseInt(usedMemory) / parseInt(maxMemory)) * 100
        : undefined;

    if (memoryUsagePercent && memoryUsagePercent > 90) {
      return {
        status: 'degraded',
        message: 'Redis memory usage high',
        latencyMs,
        details: {
          usedMemoryBytes: usedMemory ? parseInt(usedMemory) : undefined,
          maxMemoryBytes: maxMemory ? parseInt(maxMemory) : undefined,
          memoryUsagePercent: memoryUsagePercent.toFixed(2),
        },
      };
    }

    // Check latency
    if (latencyMs > 100) {
      return {
        status: 'degraded',
        message: 'Redis connection slow',
        latencyMs,
        details: {
          threshold: 100,
          usedMemoryBytes: usedMemory ? parseInt(usedMemory) : undefined,
        },
      };
    }

    return {
      status: 'healthy',
      message: 'Redis connection OK',
      latencyMs,
      details: {
        usedMemoryBytes: usedMemory ? parseInt(usedMemory) : undefined,
        memoryUsagePercent: memoryUsagePercent?.toFixed(2),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Redis health check failed', { error: message });

    return {
      status: 'unhealthy',
      message: `Redis connection failed: ${message}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check BullMQ queue health
 */
export async function checkQueueHealth(
  getQueueStats: () => Promise<Record<string, unknown> | null>
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const rawStats = await getQueueStats();
    const latencyMs = Date.now() - startTime;

    if (!rawStats) {
      return {
        status: 'degraded',
        message: 'Queue not available (in-memory fallback)',
        latencyMs,
      };
    }

    // Extract queue stats with type safety
    const waiting = typeof rawStats.waiting === 'number' ? rawStats.waiting : 0;
    const active = typeof rawStats.active === 'number' ? rawStats.active : 0;
    const completed = typeof rawStats.completed === 'number' ? rawStats.completed : 0;
    const failed = typeof rawStats.failed === 'number' ? rawStats.failed : 0;

    // Check for stuck jobs
    if (waiting > 1000) {
      return {
        status: 'degraded',
        message: 'Queue backlog high',
        latencyMs,
        details: {
          waiting,
          active,
          completed,
          failed,
          threshold: 1000,
        },
      };
    }

    // Check for high failure rate
    const totalProcessed = completed + failed;
    if (totalProcessed > 0) {
      const failureRate = (failed / totalProcessed) * 100;
      if (failureRate > 10) {
        return {
          status: 'degraded',
          message: 'Queue failure rate high',
          latencyMs,
          details: {
            waiting,
            active,
            completed,
            failed,
            failureRatePercent: failureRate.toFixed(2),
          },
        };
      }
    }

    return {
      status: 'healthy',
      message: 'Queue operational',
      latencyMs,
      details: {
        waiting,
        active,
        completed,
        failed,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Queue health check failed', { error: message });

    return {
      status: 'unhealthy',
      message: `Queue check failed: ${message}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check Node.js memory usage
 */
export function checkMemoryHealth(): HealthCheckResult {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
  const externalMB = Math.round(memoryUsage.external / 1024 / 1024);

  const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  // Check heap usage
  if (heapUsagePercent > 95) {
    return {
      status: 'unhealthy',
      message: 'Memory critically low',
      details: {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        externalMB,
        heapUsagePercent: heapUsagePercent.toFixed(2),
      },
    };
  }

  if (heapUsagePercent > 85) {
    return {
      status: 'degraded',
      message: 'Memory usage high',
      details: {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        externalMB,
        heapUsagePercent: heapUsagePercent.toFixed(2),
      },
    };
  }

  return {
    status: 'healthy',
    message: 'Memory usage normal',
    details: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      externalMB,
      heapUsagePercent: heapUsagePercent.toFixed(2),
    },
  };
}

/**
 * Get uptime in seconds
 */
export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startupTime) / 1000);
}

/**
 * Aggregate health status from all checks
 */
export function aggregateHealthStatus(
  checks: Record<string, HealthCheckResult>
): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(checks).map((c) => c.status);

  if (statuses.some((s) => s === 'unhealthy')) {
    return 'unhealthy';
  }

  if (statuses.some((s) => s === 'degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Format health check response for API
 */
export function formatHealthResponse(checks: Record<string, HealthCheckResult>): SystemHealth {
  return {
    status: aggregateHealthStatus(checks),
    timestamp: new Date().toISOString(),
    uptime: getUptimeSeconds(),
    checks: checks as SystemHealth['checks'],
  };
}
