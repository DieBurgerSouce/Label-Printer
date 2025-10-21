import { Worker, Job } from 'bullmq';
import config from '../config';
import { createLogger } from '../utils/logger';
import { ScreenshotJobData, ScreenshotResult } from '../types';
import { initializeBrowserManager } from '../services/browser-manager';
import { getScreenshotService } from '../services/screenshot-service';
import { getCacheService } from '../services/cache-service';

const logger = createLogger('ScreenshotWorker');

/**
 * Process screenshot job
 */
async function processScreenshotJob(
  job: Job<ScreenshotJobData>
): Promise<ScreenshotResult> {
  const { url, productId, category } = job.data;

  logger.info('Processing screenshot job', {
    jobId: job.id,
    url,
    productId,
    category,
  });

  try {
    // Update job progress
    await job.updateProgress(10);

    // Check cache first
    const cacheService = getCacheService();
    if (config.cache.enabled) {
      const cachedPath = await cacheService.getScreenshotByUrl(url);
      if (cachedPath) {
        logger.info('Cache hit - using cached screenshot', { url, cachedPath });
        await job.updateProgress(100);
        return {
          success: true,
          url,
          filepath: cachedPath,
          timestamp: new Date(),
        };
      }
    }

    await job.updateProgress(30);

    // Capture screenshot
    const screenshotService = getScreenshotService();
    const result = await screenshotService.captureScreenshot({
      url,
      productId,
      category,
    });

    await job.updateProgress(90);

    // Cache the result if successful
    if (result.success && result.filepath && config.cache.enabled) {
      await cacheService.cacheScreenshotByUrl(url, result.filepath);
      if (result.contentHash) {
        await cacheService.cacheScreenshotByContentHash(result.contentHash, result.filepath);
      }
    }

    await job.updateProgress(100);

    return result;
  } catch (error) {
    logger.error('Job processing failed', {
      jobId: job.id,
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error; // BullMQ will handle retry logic
  }
}

/**
 * Create and start screenshot worker
 */
export async function createScreenshotWorker(): Promise<Worker> {
  // Initialize browser manager first
  await initializeBrowserManager();

  logger.info('Creating screenshot worker', {
    concurrency: config.queue.concurrency,
  });

  const worker = new Worker<ScreenshotJobData, ScreenshotResult>(
    'screenshots',
    processScreenshotJob,
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      },
      concurrency: config.queue.concurrency,
      limiter: {
        max: config.queue.rateLimitMax,
        duration: config.queue.rateLimitDuration,
      },
    }
  );

  // Worker event handlers
  worker.on('ready', () => {
    logger.info('Worker is ready to process jobs');
  });

  worker.on('active', (job) => {
    logger.info('Job started', { jobId: job.id, url: job.data.url });
  });

  worker.on('completed', (job, result) => {
    logger.info('Job completed successfully', {
      jobId: job.id,
      url: job.data.url,
      success: result.success,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', {
      jobId: job?.id,
      url: job?.data.url,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (error) => {
    logger.error('Worker error', { error: error.message });
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Job stalled', { jobId });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing worker');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing worker');
    await worker.close();
    process.exit(0);
  });

  return worker;
}

/**
 * Main function to run worker
 */
async function main() {
  try {
    logger.info('Starting screenshot worker');
    await createScreenshotWorker();
    logger.info('Screenshot worker started successfully');

    // Keep process alive
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });
  } catch (error) {
    logger.error('Failed to start worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default createScreenshotWorker;
