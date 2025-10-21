import { Queue, QueueEvents } from 'bullmq';
import config from '../config';
import { createLogger } from '../utils/logger';
import { ScreenshotJobData, QueueStats } from '../types';
import crypto from 'crypto';

const logger = createLogger('QueueService');

/**
 * Convert URL to a valid job ID (BullMQ doesn't allow colons)
 */
function urlToJobId(url: string): string {
  // Create a hash of the URL to use as job ID
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Queue Service for managing screenshot jobs
 */
export class QueueService {
  private queue: Queue<ScreenshotJobData>;
  private queueEvents: QueueEvents;

  constructor(queueName: string = 'screenshots') {
    // Initialize queue
    this.queue = new Queue<ScreenshotJobData>(queueName, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      },
      defaultJobOptions: {
        attempts: config.queue.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: config.queue.backoffDelay,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Initialize queue events
    this.queueEvents = new QueueEvents(queueName, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Setup queue event handlers
   */
  private setupEventHandlers(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.debug('Job completed', { jobId, returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.warn('Job failed', { jobId, failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { jobId, progress: data });
    });

    this.queueEvents.on('retries-exhausted', ({ jobId }) => {
      logger.error('Job retries exhausted', { jobId });
    });
  }

  /**
   * Add a single job to the queue
   */
  async addJob(data: ScreenshotJobData, priority: number = 0): Promise<string> {
    const job = await this.queue.add('screenshot', data, {
      priority,
      jobId: urlToJobId(data.url), // Use URL hash as job ID to prevent duplicates
    });

    logger.info('Job added to queue', {
      jobId: job.id,
      url: data.url,
      priority,
    });

    return job.id ?? '';
  }

  /**
   * Add multiple jobs to the queue (bulk)
   */
  async addBulkJobs(jobs: ScreenshotJobData[]): Promise<void> {
    const bulkJobs = jobs.map((data) => ({
      name: 'screenshot',
      data,
      opts: {
        priority: data.priority || 0,
        jobId: urlToJobId(data.url), // Use URL hash as job ID
      },
    }));

    await this.queue.addBulk(bulkJobs);

    logger.info('Bulk jobs added to queue', { count: jobs.length });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  /**
   * Remove job by ID
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('Job removed', { jobId });
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.retry();
      logger.info('Job retry initiated', { jobId });
    }
  }

  /**
   * Get all failed jobs
   */
  async getFailedJobs(start: number = 0, end: number = 100) {
    return this.queue.getFailed(start, end);
  }

  /**
   * Get all completed jobs
   */
  async getCompletedJobs(start: number = 0, end: number = 100) {
    return this.queue.getCompleted(start, end);
  }

  /**
   * Get all waiting jobs
   */
  async getWaitingJobs(start: number = 0, end: number = 100) {
    return this.queue.getWaiting(start, end);
  }

  /**
   * Get all active jobs
   */
  async getActiveJobs(start: number = 0, end: number = 100) {
    return this.queue.getActive(start, end);
  }

  /**
   * Clean old jobs
   */
  async clean(grace: number = 0, limit: number = 1000, status: 'completed' | 'failed' = 'completed'): Promise<string[]> {
    return this.queue.clean(grace, limit, status);
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Queue resumed');
  }

  /**
   * Check if queue is paused
   */
  async isPaused(): Promise<boolean> {
    return this.queue.isPaused();
  }

  /**
   * Drain the queue (remove all waiting jobs)
   */
  async drain(delayed: boolean = false): Promise<void> {
    await this.queue.drain(delayed);
    logger.info('Queue drained');
  }

  /**
   * Empty the queue (remove all jobs)
   */
  async empty(): Promise<void> {
    await this.queue.obliterate({ force: true });
    logger.warn('Queue emptied - all jobs removed');
  }

  /**
   * Get queue health status
   */
  async getHealth(): Promise<{
    isReady: boolean;
    isPaused: boolean;
    stats: QueueStats;
  }> {
    const isPaused = await this.isPaused();
    const stats = await this.getStats();

    return {
      isReady: true,
      isPaused,
      stats,
    };
  }

  /**
   * Close queue connections
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    logger.info('Queue connections closed');
  }

  /**
   * Get the underlying queue instance
   */
  getQueue(): Queue<ScreenshotJobData> {
    return this.queue;
  }
}

// Singleton instance
let queueService: QueueService | null = null;

/**
 * Get queue service singleton
 */
export function getQueueService(): QueueService {
  if (!queueService) {
    queueService = new QueueService();
  }
  return queueService;
}

/**
 * Initialize queue service
 */
export async function initializeQueueService(): Promise<QueueService> {
  const service = getQueueService();
  logger.info('Queue service initialized');
  return service;
}

export default QueueService;
