/**
 * Automation API Routes
 * One-click label generation workflow endpoints
 */

import { Router, Request, Response } from 'express';
import { automationService } from '../../services/automation-service';
import { AutomationConfig } from '../../types/automation-types';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  handleError,
} from '../../utils/api-response';

const router = Router();

// Configure multer for Excel file uploads
const upload = multer({
  dest: 'uploads/excel/',
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
});

/**
 * POST /api/automation/start
 * Start a complete automation workflow
 * ONE-CLICK: Shop URL → Labels!
 */
router.post('/start', upload.single('excelFile'), async (req: Request, res: Response) => {
  try {
    const { shopUrl, templateId, config } = req.body;

    if (!shopUrl) {
      return sendBadRequest(res, 'Shop URL is required');
    }

    if (!templateId) {
      return sendBadRequest(res, 'Template ID is required');
    }

    // Parse Excel file if provided
    let excelData: unknown[] = [];
    if (req.file) {
      try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        excelData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`📊 Loaded ${excelData.length} rows from Excel`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return sendBadRequest(res, 'Failed to parse Excel file', { message });
      }
    }

    // Parse additional config
    let parsedConfig = {};
    if (config) {
      try {
        parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
      } catch {
        return sendBadRequest(res, 'Invalid config JSON');
      }
    }

    const automationConfig: AutomationConfig = {
      shopUrl,
      templateId,
      excelData: excelData.length > 0 ? excelData : undefined,
      ...parsedConfig,
    };

    const job = await automationService.startAutomation(automationConfig);

    return sendSuccess(res, {
      jobId: job.id,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
      },
    }, 'Automation job started successfully');
  } catch (error: unknown) {
    console.error('Automation start error:', error);
    return handleError(res, error, 'Failed to start automation');
  }
});

/**
 * POST /api/automation/start-simple
 * Start automation without Excel file (JSON body only)
 */
router.post('/start-simple', async (req: Request, res: Response) => {
  try {
    const { shopUrl, templateId, name, maxProducts, followPagination, extractFields, ...rest } =
      req.body;

    if (!shopUrl) {
      return sendBadRequest(res, 'Shop URL is required');
    }

    if (!templateId) {
      return sendBadRequest(res, 'Template ID is required');
    }

    // Build config with support for both flat and nested formats
    const config: AutomationConfig = {
      shopUrl,
      templateId,
      name,
      crawlerConfig: {
        maxProducts: maxProducts || rest.crawlerConfig?.maxProducts,
        followPagination: followPagination ?? rest.crawlerConfig?.followPagination,
      },
      ocrConfig: {
        ...(extractFields && { extractFields }), // Add if provided
        ...rest.ocrConfig,
      },
      ...rest,
    };

    const job = await automationService.startAutomation(config);

    return sendSuccess(res, {
      jobId: job.id,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
      },
    }, 'Automation job started successfully');
  } catch (error: unknown) {
    console.error('Automation start error:', error);
    return handleError(res, error, 'Failed to start automation');
  }
});

/**
 * GET /api/automation/jobs
 * Get all automation jobs
 */
router.get('/jobs', (_req: Request, res: Response) => {
  try {
    const jobs = automationService.getAllJobs();

    return sendSuccess(res, {
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        summary: job.results.summary,
      })),
      count: jobs.length,
    });
  } catch (error: unknown) {
    console.error('Jobs listing error:', error);
    return handleError(res, error, 'Failed to list jobs');
  }
});

/**
 * GET /api/automation/jobs/:id
 * Get specific automation job with full details
 */
router.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = automationService.getJob(id);

    if (!job) {
      return sendNotFound(res, 'Job');
    }

    return sendSuccess(res, { job });
  } catch (error: unknown) {
    console.error('Job fetch error:', error);
    return handleError(res, error, 'Failed to fetch job');
  }
});

/**
 * GET /api/automation/jobs/:id/progress
 * Get job progress (lightweight endpoint for polling)
 */
router.get('/jobs/:id/progress', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = automationService.getJob(id);

    if (!job) {
      return sendNotFound(res, 'Job');
    }

    return sendSuccess(res, {
      status: job.status,
      progress: job.progress,
      summary: job.results.summary,
    });
  } catch (error: unknown) {
    console.error('Progress fetch error:', error);
    return handleError(res, error, 'Failed to fetch progress');
  }
});

/**
 * GET /api/automation/jobs/:id/labels
 * Get all generated labels for a job
 */
router.get('/jobs/:id/labels', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = automationService.getJob(id);

    if (!job) {
      return sendNotFound(res, 'Job');
    }

    return sendSuccess(res, {
      labels: job.results.labels,
      count: job.results.labels.length,
    });
  } catch (error: unknown) {
    console.error('Labels fetch error:', error);
    return handleError(res, error, 'Failed to fetch labels');
  }
});

/**
 * GET /api/automation/jobs/:id/labels/:labelIndex
 * Get a specific label image
 */
router.get('/jobs/:id/labels/:labelIndex', (req: Request, res: Response) => {
  try {
    const { id, labelIndex } = req.params;
    const job = automationService.getJob(id);

    if (!job) {
      return sendNotFound(res, 'Job');
    }

    const index = parseInt(labelIndex, 10);
    const label = job.results.labels[index];

    if (!label) {
      return sendNotFound(res, 'Label');
    }

    if (!label.success || !label.labelBase64) {
      return sendNotFound(res, 'Label generation');
    }

    // Return base64 image
    const buffer = Buffer.from(label.labelBase64, 'base64');
    res.set('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (error: unknown) {
    console.error('Label fetch error:', error);
    return handleError(res, error, 'Failed to fetch label');
  }
});

/**
 * POST /api/automation/jobs/:id/cancel
 * Cancel a running job
 */
router.post('/jobs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await automationService.cancelJob(id);

    if (!success) {
      return sendNotFound(res, 'Job (or already completed)');
    }

    return sendSuccess(res, undefined, 'Job cancelled successfully');
  } catch (error: unknown) {
    console.error('Job cancellation error:', error);
    return handleError(res, error, 'Failed to cancel job');
  }
});

/**
 * DELETE /api/automation/jobs/:id
 * Delete a job and cleanup files
 */
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await automationService.deleteJob(id);

    if (!success) {
      return sendNotFound(res, 'Job');
    }

    return sendSuccess(res, undefined, 'Job deleted successfully');
  } catch (error: unknown) {
    console.error('Job deletion error:', error);
    return handleError(res, error, 'Failed to delete job');
  }
});

/**
 * GET /api/automation/stats
 * Get overall automation statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const jobs = automationService.getAllJobs();

    const stats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed').length,
      completedJobs: jobs.filter((j) => j.status === 'completed').length,
      failedJobs: jobs.filter((j) => j.status === 'failed').length,
      totalLabelsGenerated: jobs.reduce((sum, j) => sum + j.results.summary.labelsGenerated, 0),
      averageProcessingTime: 0,
    };

    const completedJobs = jobs.filter((j) => j.status === 'completed');
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce(
        (sum, j) => sum + j.results.summary.totalProcessingTime,
        0
      );
      stats.averageProcessingTime = totalTime / completedJobs.length;
    }

    return sendSuccess(res, { stats });
  } catch (error: unknown) {
    console.error('Stats fetch error:', error);
    return handleError(res, error, 'Failed to fetch stats');
  }
});

export default router;
