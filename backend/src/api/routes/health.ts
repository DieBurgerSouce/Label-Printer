/**
 * Health Check Routes
 * Kubernetes-compatible health endpoints for liveness, readiness, and startup probes
 */

import { Router, Request, Response } from 'express';
import os from 'os';
import { PrismaClient } from '@prisma/client';
import { healthStatus } from '../../utils/metrics';
import { getRedisClient } from '../../lib/redis';
import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkQueueHealth,
  checkMemoryHealth,
  formatHealthResponse,
  getUptimeSeconds,
} from '../../utils/health-checks';
import { automationService } from '../../services/automation-service';

const router = Router();

// Lazy-loaded database client for health checks
let prisma: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Track application startup state
let isStartupComplete = false;
let startupError: string | null = null;

/**
 * Mark startup as complete (call this after all services are initialized)
 */
export function markStartupComplete(): void {
  isStartupComplete = true;
}

/**
 * Mark startup as failed
 */
export function markStartupFailed(error: string): void {
  startupError = error;
}

/**
 * Check if application can connect to essential services
 */
async function checkDependencies(): Promise<{
  healthy: boolean;
  details: Record<string, boolean>;
}> {
  const details: Record<string, boolean> = {};

  // Check file system (basic I/O)
  try {
    const tmpDir = os.tmpdir();
    details.filesystem = !!tmpDir;
  } catch {
    details.filesystem = false;
  }

  // Check memory is not critically low
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  details.memory = heapUsedPercent < 95; // Unhealthy if heap is > 95% used

  // Check database connection
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    details.database = true;
    healthStatus.set({ component: 'database' }, 1);
  } catch {
    details.database = false;
    healthStatus.set({ component: 'database' }, 0);
  }

  // Check Redis connection (if configured)
  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.ping();
      details.redis = true;
      healthStatus.set({ component: 'redis' }, 1);
    } else {
      // Redis not configured - this is OK, not all deployments need Redis
      details.redis = true;
    }
  } catch {
    details.redis = false;
    healthStatus.set({ component: 'redis' }, 0);
  }

  const healthy = Object.values(details).every(Boolean);
  return { healthy, details };
}

/**
 * GET /health/live
 * Liveness probe - Is the application alive?
 * Returns 200 if the process is running and responsive
 * Kubernetes will restart the pod if this fails
 */
router.get('/live', (_req: Request, res: Response) => {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Readiness probe - Is the application ready to receive traffic?
 * Returns 200 if the application can handle requests
 * Kubernetes will remove the pod from service if this fails
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const { healthy, details } = await checkDependencies();

    if (!healthy) {
      return res.status(503).json({
        status: 'not ready',
        checks: details,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: 'ready',
      checks: details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/startup
 * Startup probe - Has the application finished starting?
 * Returns 200 once startup is complete
 * Kubernetes will not check liveness/readiness until this succeeds
 */
router.get('/startup', (_req: Request, res: Response) => {
  if (startupError) {
    return res.status(503).json({
      status: 'startup failed',
      error: startupError,
      timestamp: new Date().toISOString(),
    });
  }

  if (!isStartupComplete) {
    return res.status(503).json({
      status: 'starting',
      timestamp: new Date().toISOString(),
    });
  }

  res.status(200).json({
    status: 'started',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/deep
 * Deep health check with detailed status of all dependencies
 * Use for comprehensive monitoring and debugging
 */
router.get('/deep', async (_req: Request, res: Response) => {
  try {
    const prismaClient = getPrismaClient();
    const redisClient = getRedisClient();

    // Run all health checks in parallel
    const [databaseCheck, redisCheck, queueCheck] = await Promise.all([
      checkDatabaseHealth(prismaClient),
      checkRedisHealth(redisClient),
      checkQueueHealth(() => automationService.getQueueStats()),
    ]);

    // Memory check is sync
    const memoryCheck = checkMemoryHealth();

    // Format response
    const healthResponse = formatHealthResponse({
      database: databaseCheck,
      redis: redisCheck,
      queue: queueCheck,
      memory: memoryCheck,
    });

    // Update Prometheus metrics
    healthStatus.set({ component: 'database' }, databaseCheck.status === 'healthy' ? 1 : 0);
    healthStatus.set({ component: 'redis' }, redisCheck.status === 'healthy' ? 1 : 0);
    healthStatus.set({ component: 'queue' }, queueCheck.status === 'healthy' ? 1 : 0);
    healthStatus.set({ component: 'memory' }, memoryCheck.status === 'healthy' ? 1 : 0);

    const statusCode =
      healthResponse.status === 'healthy' ? 200 : healthResponse.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthResponse);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: getUptimeSeconds(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health
 * Combined health check with detailed information (for debugging/monitoring)
 */
router.get('/', async (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const { healthy, details } = await checkDependencies();

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    startup: isStartupComplete ? 'complete' : 'in_progress',
    checks: details,
    memory: {
      process: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      system: {
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        used: Math.round(usedMemory / 1024 / 1024),
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
    },
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
