/**
 * Queue Service - BullMQ Integration
 * Provides persistent job queue functionality for automation tasks
 *
 * Key Features:
 * - Job persistence in Redis (survives server restart)
 * - Retry strategies with exponential backoff
 * - Dead letter queue for failed jobs
 * - Real-time job progress tracking
 * - Graceful shutdown support
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions, ConnectionOptions } from 'bullmq';
import { getRedisUrl, isRedisAvailable } from '../lib/redis';
import { AutomationConfig, AutomationJob } from '../types/automation-types';
import logger from '../utils/logger';

// Queue names
export const QUEUE_NAMES = {
  AUTOMATION: 'automation-jobs',
  OCR: 'ocr-processing',
  CRAWL: 'crawl-jobs',
  LABEL_RENDER: 'label-rendering',
} as const;

// Job types
export interface AutomationJobData {
  config: AutomationConfig;
  jobId: string;
  createdAt: string;
}

export interface AutomationJobResult {
  success: boolean;
  jobId: string;
  summary?: AutomationJob['results']['summary'];
  error?: string;
}

// Default job options
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5s initial delay
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 100, // Keep max 100 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    count: 50, // Keep max 50 failed jobs
  },
};

// Connection options for BullMQ
function getConnectionOptions(): ConnectionOptions {
  const redisUrl = getRedisUrl();
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}

/**
 * Queue Service Class
 * Manages BullMQ queues and workers
 */
class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private isInitialized = false;
  private connectionOptions: ConnectionOptions | null = null;

  /**
   * Initialize the queue service
   * Must be called before using any queue functionality
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      logger.warn('Queue service already initialized');
      return true;
    }

    // Check Redis availability
    const redisAvailable = await isRedisAvailable();
    if (!redisAvailable) {
      logger.error('Redis not available - queue service cannot start');
      return false;
    }

    try {
      this.connectionOptions = getConnectionOptions();

      // Initialize queues
      for (const queueName of Object.values(QUEUE_NAMES)) {
        await this.createQueue(queueName);
      }

      this.isInitialized = true;
      logger.info('Queue service initialized successfully', {
        queues: Object.values(QUEUE_NAMES),
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize queue service', { error });
      return false;
    }
  }

  /**
   * Create a new queue
   */
  private async createQueue(name: string): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    if (!this.connectionOptions) {
      throw new Error('Queue service not initialized');
    }

    const queue = new Queue(name, {
      connection: this.connectionOptions,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    // Create QueueEvents for this queue
    const queueEvents = new QueueEvents(name, {
      connection: this.connectionOptions,
    });

    // Set up event listeners
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Job completed: ${jobId}`, { returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed: ${jobId}`, { reason: failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Job progress: ${jobId}`, { progress: data });
    });

    this.queues.set(name, queue);
    this.queueEvents.set(name, queueEvents);

    logger.info(`Queue created: ${name}`);
    return queue;
  }

  /**
   * Get a queue by name
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Add a job to the automation queue
   */
  async addAutomationJob(
    config: AutomationConfig,
    jobId: string,
    options?: Partial<JobsOptions>
  ): Promise<Job<AutomationJobData, AutomationJobResult> | null> {
    const queue = this.queues.get(QUEUE_NAMES.AUTOMATION);
    if (!queue) {
      logger.error('Automation queue not available');
      return null;
    }

    const jobData: AutomationJobData = {
      config,
      jobId,
      createdAt: new Date().toISOString(),
    };

    const job = await queue.add(`automation-${jobId}`, jobData, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
      jobId, // Use our job ID as BullMQ job ID
    });

    logger.info('Automation job added to queue', {
      jobId,
      queueName: QUEUE_NAMES.AUTOMATION,
      bullmqJobId: job.id,
    });

    return job as Job<AutomationJobData, AutomationJobResult>;
  }

  /**
   * Get job by ID from automation queue
   */
  async getAutomationJob(
    jobId: string
  ): Promise<Job<AutomationJobData, AutomationJobResult> | null> {
    const queue = this.queues.get(QUEUE_NAMES.AUTOMATION);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    return job as Job<AutomationJobData, AutomationJobResult> | null;
  }

  /**
   * Get all jobs from automation queue
   */
  async getAllAutomationJobs(): Promise<Job<AutomationJobData, AutomationJobResult>[]> {
    const queue = this.queues.get(QUEUE_NAMES.AUTOMATION);
    if (!queue) return [];

    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
    return jobs as Job<AutomationJobData, AutomationJobResult>[];
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Job removed: ${jobId} from ${queueName}`);
      return true;
    }

    return false;
  }

  /**
   * Register a worker for a queue
   */
  registerWorker<T, R>(
    queueName: string,
    processor: (job: Job<T, R>) => Promise<R>,
    concurrency = 1
  ): Worker<T, R> | null {
    if (!this.connectionOptions) {
      logger.error('Queue service not initialized');
      return null;
    }

    // Close existing worker if any
    const existingWorker = this.workers.get(queueName);
    if (existingWorker) {
      existingWorker.close();
    }

    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.connectionOptions,
      concurrency,
      lockDuration: 300000, // 5 minutes lock
      stalledInterval: 30000, // Check for stalled jobs every 30s
    });

    // Set up worker event listeners
    worker.on('completed', (job, result) => {
      logger.info(`Worker completed job: ${job.id}`, { result });
    });

    worker.on('failed', (job, error) => {
      logger.error(`Worker failed job: ${job?.id}`, { error: error.message });
    });

    worker.on('error', (error) => {
      logger.error(`Worker error on ${queueName}`, { error: error.message });
    });

    worker.on('stalled', (jobId) => {
      logger.warn(`Job stalled: ${jobId} in ${queueName}`);
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker registered for queue: ${queueName}`, { concurrency });

    return worker;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get stats for all queues
   */
  async getAllQueueStats(): Promise<
    Record<string, Awaited<ReturnType<typeof this.getQueueStats>>>
  > {
    const stats: Record<string, Awaited<ReturnType<typeof this.getQueueStats>>> = {};

    for (const queueName of Object.values(QUEUE_NAMES)) {
      stats[queueName] = await this.getQueueStats(queueName);
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    await queue.pause();
    logger.info(`Queue paused: ${queueName}`);
    return true;
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    await queue.resume();
    logger.info(`Queue resumed: ${queueName}`);
    return true;
  }

  /**
   * Drain a queue (remove all waiting jobs)
   */
  async drainQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    await queue.drain();
    logger.info(`Queue drained: ${queueName}`);
    return true;
  }

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue(
    queueName: string,
    grace: number = 24 * 3600 * 1000, // 24 hours
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    const removed = await queue.clean(grace, 100, status);
    logger.info(`Queue cleaned: ${queueName}`, { removed: removed.length, status });
    return removed;
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue service...');

    // Close all workers first (stop processing)
    for (const [name, worker] of this.workers.entries()) {
      logger.info(`Closing worker: ${name}`);
      await worker.close();
    }
    this.workers.clear();

    // Close all queue events
    for (const [name, queueEvents] of this.queueEvents.entries()) {
      logger.info(`Closing queue events: ${name}`);
      await queueEvents.close();
    }
    this.queueEvents.clear();

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      logger.info(`Closing queue: ${name}`);
      await queue.close();
    }
    this.queues.clear();

    this.isInitialized = false;
    logger.info('Queue service shutdown complete');
  }
}

// Export singleton instance
export const queueService = new QueueService();
