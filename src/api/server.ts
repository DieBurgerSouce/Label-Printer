import express, { Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueService } from '../services/queue-service';
import { getBrowserManager } from '../services/browser-manager';
import { getCacheService } from '../services/cache-service';
import { createLogger } from '../utils/logger';
import config from '../config';
import apiRoutes from './routes';

const logger = createLogger('APIServer');

/**
 * API Server with Bull Board UI and REST API
 */
export class APIServer {
  private app: express.Application;
  private queueService = getQueueService();
  private browserManager = getBrowserManager();
  private cacheService = getCacheService();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupBullBoard();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug('Incoming request', {
        method: req.method,
        path: req.path,
        query: req.query,
      });
      next();
    });

    // CORS
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }

  /**
   * Setup Bull Board UI for queue monitoring
   */
  private setupBullBoard(): void {
    if (!config.bullBoard.enabled) {
      logger.info('Bull Board disabled in config');
      return;
    }

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(this.queueService.getQueue())],
      serverAdapter,
    });

    // Basic auth for Bull Board
    if (config.bullBoard.username && config.bullBoard.password) {
      this.app.use(
        '/admin/queues',
        (req: Request, res: Response, next: NextFunction) => {
          const auth = req.headers.authorization;
          if (!auth) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
            return res.status(401).send('Authentication required');
          }

          const [, credentials] = auth.split(' ');
          const [username, password] = Buffer.from(credentials, 'base64')
            .toString()
            .split(':');

          if (
            username === config.bullBoard.username &&
            password === config.bullBoard.password
          ) {
            return next();
          }

          res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
          return res.status(401).send('Invalid credentials');
        }
      );
    }

    this.app.use('/admin/queues', serverAdapter.getRouter());

    logger.info('Bull Board UI initialized', {
      path: '/admin/queues',
      auth: !!(config.bullBoard.username && config.bullBoard.password),
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Mount new API routes (labels, excel, print)
    this.app.use('/api', apiRoutes);

    // Health check
    this.app.get('/health', async (_req: Request, res: Response) => {
      try {
        const queueHealth = await this.queueService.getHealth();
        const browserStatus = this.browserManager.getStatus();

        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          queue: queueHealth,
          browser: browserStatus,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        };

        res.json(health);
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Queue statistics
    this.app.get('/api/queue/stats', async (_req: Request, res: Response) => {
      try {
        const stats = await this.queueService.getStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get queue stats', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Create screenshot job
    this.app.post('/api/screenshot', async (req: Request, res: Response) => {
      try {
        const { url, productId, category, priority } = req.body;

        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        const jobId = await this.queueService.addJob(
          { url, productId, category },
          priority || 0
        );

        logger.info('Screenshot job created via API', { jobId, url });

        return res.status(201).json({
          success: true,
          jobId,
          message: 'Screenshot job created successfully',
        });
      } catch (error) {
        logger.error('Failed to create screenshot job', { error });
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Bulk create screenshot jobs
    this.app.post('/api/screenshot/bulk', async (req: Request, res: Response) => {
      try {
        const { jobs } = req.body;

        if (!Array.isArray(jobs) || jobs.length === 0) {
          return res.status(400).json({ error: 'Jobs array is required' });
        }

        await this.queueService.addBulkJobs(jobs);

        logger.info('Bulk screenshot jobs created via API', { count: jobs.length });

        return res.status(201).json({
          success: true,
          count: jobs.length,
          message: `${jobs.length} screenshot jobs created successfully`,
        });
      } catch (error) {
        logger.error('Failed to create bulk screenshot jobs', { error });
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get job status
    this.app.get('/api/screenshot/:jobId', async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params;
        const job = await this.queueService.getJob(jobId);

        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();

        return res.json({
          id: job.id,
          data: job.data,
          state,
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          returnvalue: job.returnvalue,
          failedReason: job.failedReason,
        });
      } catch (error) {
        logger.error('Failed to get job status', { error });
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Retry failed job
    this.app.post('/api/screenshot/:jobId/retry', async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params;
        await this.queueService.retryJob(jobId);

        logger.info('Job retry initiated via API', { jobId });

        res.json({
          success: true,
          message: 'Job retry initiated',
        });
      } catch (error) {
        logger.error('Failed to retry job', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get failed jobs
    this.app.get('/api/queue/failed', async (req: Request, res: Response) => {
      try {
        const start = parseInt(req.query.start as string) || 0;
        const end = parseInt(req.query.end as string) || 100;
        const jobs = await this.queueService.getFailedJobs(start, end);

        res.json({
          count: jobs.length,
          jobs: jobs.map((job) => ({
            id: job.id,
            data: job.data,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
          })),
        });
      } catch (error) {
        logger.error('Failed to get failed jobs', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get completed jobs
    this.app.get('/api/queue/completed', async (req: Request, res: Response) => {
      try {
        const start = parseInt(req.query.start as string) || 0;
        const end = parseInt(req.query.end as string) || 100;
        const jobs = await this.queueService.getCompletedJobs(start, end);

        res.json({
          count: jobs.length,
          jobs: jobs.map((job) => ({
            id: job.id,
            data: job.data,
            returnvalue: job.returnvalue,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
          })),
        });
      } catch (error) {
        logger.error('Failed to get completed jobs', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Cache statistics
    this.app.get('/api/cache/stats', async (_req: Request, res: Response) => {
      try {
        const stats = await this.cacheService.getStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get cache stats', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Clear cache
    this.app.delete('/api/cache', async (_req: Request, res: Response) => {
      try {
        await this.cacheService.clear();
        logger.info('Cache cleared via API');
        res.json({ success: true, message: 'Cache cleared successfully' });
      } catch (error) {
        logger.error('Failed to clear cache', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Pause queue
    this.app.post('/api/queue/pause', async (_req: Request, res: Response) => {
      try {
        await this.queueService.pause();
        logger.info('Queue paused via API');
        res.json({ success: true, message: 'Queue paused' });
      } catch (error) {
        logger.error('Failed to pause queue', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Resume queue
    this.app.post('/api/queue/resume', async (_req: Request, res: Response) => {
      try {
        await this.queueService.resume();
        logger.info('Queue resumed via API');
        res.json({ success: true, message: 'Queue resumed' });
      } catch (error) {
        logger.error('Failed to resume queue', { error });
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // API documentation
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: 'Screenshot Scraper API',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          bullBoard: 'GET /admin/queues',

          // Screenshot Queue API
          queueStats: 'GET /api/queue/stats',
          createJob: 'POST /api/screenshot',
          bulkCreateJobs: 'POST /api/screenshot/bulk',
          getJobStatus: 'GET /api/screenshot/:jobId',
          retryJob: 'POST /api/screenshot/:jobId/retry',
          failedJobs: 'GET /api/queue/failed',
          completedJobs: 'GET /api/queue/completed',
          cacheStats: 'GET /api/cache/stats',
          clearCache: 'DELETE /api/cache',
          pauseQueue: 'POST /api/queue/pause',
          resumeQueue: 'POST /api/queue/resume',

          // Label Management API
          labels: 'GET /api/labels',
          getLabel: 'GET /api/labels/:id',
          createLabel: 'POST /api/labels',
          extractLabel: 'POST /api/labels/extract',
          updateLabel: 'PUT /api/labels/:id',
          deleteLabel: 'DELETE /api/labels/:id',
          searchLabels: 'GET /api/labels/search',
          batchLabels: 'POST /api/labels/batch',
          labelStats: 'GET /api/labels/stats',

          // Excel API
          uploadExcel: 'POST /api/excel/upload',
          validateExcel: 'POST /api/excel/validate',
          getProducts: 'GET /api/excel/products',
          getProduct: 'GET /api/excel/product/:articleNumber',
          updateProduct: 'PUT /api/excel/product/:articleNumber',
          addProduct: 'POST /api/excel/product',
          deleteProduct: 'DELETE /api/excel/product/:articleNumber',
          excelStats: 'GET /api/excel/stats',
          excelTemplate: 'GET /api/excel/template',
          exportExcel: 'GET /api/excel/export',

          // Print API
          printPreview: 'POST /api/print/preview',
          printExport: 'POST /api/print/export',
          printFormats: 'GET /api/print/formats',
          calculateGrid: 'POST /api/print/calculate-grid',
          getTemplates: 'GET /api/print/templates',
          addTemplate: 'POST /api/print/templates',
          validateLayout: 'POST /api/print/validate-layout',
        },
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Global error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error', { error: err.message, stack: err.stack });
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  /**
   * Start the server
   */
  async start(port: number = config.app.port): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info('API Server started', {
          port,
          bullBoard: config.bullBoard.enabled ? `/admin/queues` : 'disabled',
        });
        resolve();
      });
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }
}

// Create and export singleton instance
let apiServer: APIServer | null = null;

export function getAPIServer(): APIServer {
  if (!apiServer) {
    apiServer = new APIServer();
  }
  return apiServer;
}

export default APIServer;
