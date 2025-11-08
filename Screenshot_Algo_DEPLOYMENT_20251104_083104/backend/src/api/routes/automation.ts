/**
 * Automation API Routes
 * One-click label generation workflow endpoints
 */

import { Router, Request, Response } from 'express';
import { automationService } from '../../services/automation-service';
import { AutomationConfig } from '../../types/automation-types';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();

// Configure multer for Excel file uploads
const upload = multer({
  dest: 'uploads/excel/',
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
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
      return res.status(400).json({ error: 'Shop URL is required' });
    }

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Parse Excel file if provided
    let excelData: any[] = [];
    if (req.file) {
      try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        excelData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`📊 Loaded ${excelData.length} rows from Excel`);
      } catch (error: any) {
        return res.status(400).json({
          error: 'Failed to parse Excel file',
          message: error.message,
        });
      }
    }

    // Parse additional config
    let parsedConfig = {};
    if (config) {
      try {
        parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid config JSON' });
      }
    }

    const automationConfig: AutomationConfig = {
      shopUrl,
      templateId,
      excelData: excelData.length > 0 ? excelData : undefined,
      ...parsedConfig,
    };

    const job = await automationService.startAutomation(automationConfig);

    res.json({
      success: true,
      jobId: job.id,  // Frontend expects jobId directly
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
      },
      message: 'Automation job started successfully',
    });
  } catch (error: any) {
    console.error('Automation start error:', error);
    res.status(500).json({
      error: 'Failed to start automation',
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/start-simple
 * Start automation without Excel file (JSON body only)
 */
router.post('/start-simple', async (req: Request, res: Response) => {
  try {
    const {
      shopUrl,
      templateId,
      name,
      maxProducts,
      followPagination,
      extractFields,
      ...rest
    } = req.body;

    if (!shopUrl) {
      return res.status(400).json({ error: 'Shop URL is required' });
    }

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
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

    res.json({
      success: true,
      jobId: job.id,  // Frontend expects jobId directly
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
      },
      message: 'Automation job started successfully',
    });
  } catch (error: any) {
    console.error('Automation start error:', error);
    res.status(500).json({
      error: 'Failed to start automation',
      message: error.message,
    });
  }
});

/**
 * GET /api/automation/jobs
 * Get all automation jobs
 */
router.get('/jobs', (_req: Request, res: Response) => {
  try {
    const jobs = automationService.getAllJobs();

    res.json({
      success: true,
      jobs: jobs.map(job => ({
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
  } catch (error: any) {
    console.error('Jobs listing error:', error);
    res.status(500).json({
      error: 'Failed to list jobs',
      message: error.message,
    });
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
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error('Job fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch job',
      message: error.message,
    });
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
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      status: job.status,
      progress: job.progress,
      summary: job.results.summary,
    });
  } catch (error: any) {
    console.error('Progress fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch progress',
      message: error.message,
    });
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
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      labels: job.results.labels,
      count: job.results.labels.length,
    });
  } catch (error: any) {
    console.error('Labels fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch labels',
      message: error.message,
    });
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
      return res.status(404).json({ error: 'Job not found' });
    }

    const index = parseInt(labelIndex, 10);
    const label = job.results.labels[index];

    if (!label) {
      return res.status(404).json({ error: 'Label not found' });
    }

    if (!label.success || !label.labelBase64) {
      return res.status(404).json({ error: 'Label generation failed' });
    }

    // Return base64 image
    const buffer = Buffer.from(label.labelBase64, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error: any) {
    console.error('Label fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch label',
      message: error.message,
    });
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
      return res.status(404).json({ error: 'Job not found or already completed' });
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error: any) {
    console.error('Job cancellation error:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message,
    });
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
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error: any) {
    console.error('Job deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete job',
      message: error.message,
    });
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
      activeJobs: jobs.filter(j => j.status !== 'completed' && j.status !== 'failed').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      totalLabelsGenerated: jobs.reduce((sum, j) => sum + j.results.summary.labelsGenerated, 0),
      averageProcessingTime: 0,
    };

    const completedJobs = jobs.filter(j => j.status === 'completed');
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, j) => sum + j.results.summary.totalProcessingTime, 0);
      stats.averageProcessingTime = totalTime / completedJobs.length;
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message,
    });
  }
});

export default router;
