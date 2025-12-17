import { Router, Request, Response } from 'express';
import lexwareImportService from '../../services/lexware-import-service';
import batchProcessor from '../../services/lexware-batch-processor';
import lexwareValidationService from '../../services/lexware-validation-service';
import prisma from '../../lib/prisma';

const router = Router();

// Store active jobs in memory (in production, use Redis or database)
const activeJobs = new Map<string, any>();

/**
 * Discover and list all Lexware screenshot pairs
 * GET /api/lexware/discover
 */
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const folderPath = req.query.folder as string | undefined;

    console.log('🔍 Discovering Lexware screenshots...');
    const pairs = await lexwareImportService.discoverImagePairs(folderPath);

    // Get folder statistics
    const stats = await lexwareImportService.getFolderStatistics(folderPath);

    res.json({
      success: true,
      data: {
        pairs,
        statistics: stats,
        summary: {
          total: pairs.length,
          valid: pairs.filter((p) => p.status === 'valid').length,
          incomplete: pairs.filter(
            (p) => p.status === 'missing_screen1' || p.status === 'missing_screen2'
          ).length,
          invalid: pairs.filter((p) => p.status === 'invalid').length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error discovering Lexware files:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to discover Lexware screenshots',
    });
  }
});

/**
 * Validate discovered pairs
 * POST /api/lexware/validate
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { pairs } = req.body;

    if (!pairs || !Array.isArray(pairs)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: pairs array required',
      });
    }

    console.log(`🔍 Validating ${pairs.length} image pairs...`);
    const validationResults = await lexwareImportService.validateImagePairs(pairs);

    // Check for duplicates
    const articleNumbers = pairs.map((p: any) => p.articleNumber);
    const duplicates = await lexwareValidationService.checkForDuplicatesBatch(articleNumbers);

    res.json({
      success: true,
      data: {
        validationResults,
        duplicates: Array.from(duplicates.entries()),
        summary: {
          total: validationResults.length,
          valid: validationResults.filter((r) => r.isValid).length,
          withWarnings: validationResults.filter((r) => r.warnings.length > 0).length,
          withErrors: validationResults.filter((r) => r.errors.length > 0).length,
          duplicatesFound: Array.from(duplicates.values()).filter((v) => v).length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error validating pairs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate pairs',
    });
  }
});

/**
 * Preview extraction for sample articles
 * POST /api/lexware/preview
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { pairs, limit = 3 } = req.body;

    if (!pairs || !Array.isArray(pairs)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: pairs array required',
      });
    }

    // Take only a few samples for preview
    const samplePairs = pairs.slice(0, Math.min(limit, pairs.length));

    console.log(`🔍 Generating preview for ${samplePairs.length} articles...`);

    // Initialize processor
    await batchProcessor.initialize();

    // Process samples
    const result = await batchProcessor.processBatch(samplePairs, {
      dryRun: true, // Don't save to database
      batchSize: samplePairs.length,
    });

    // Shutdown processor
    await batchProcessor.shutdown();

    res.json({
      success: true,
      data: {
        samples: result.successful.map((s) => ({
          articleNumber: s.articleNumber,
          productName: s.data.productName,
          description: s.data.description,
          price: s.data.price,
          priceType: s.data.priceType,
          tieredPrices: s.data.tieredPrices,
          confidence: s.confidence,
        })),
        failed: result.failed,
        stats: result.stats,
      },
    });
  } catch (error: any) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate preview',
    });
  }
});

/**
 * Process full import
 * POST /api/lexware/process
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { folderPath, options = {} } = req.body;

    console.log('🚀 Starting Lexware import process...');

    // Initialize processor
    await batchProcessor.initialize();

    // Run complete pipeline asynchronously
    const jobPromise = batchProcessor.runCompletePipeline(folderPath, options);

    // Store job for tracking
    const jobId = Date.now().toString(); // Simple ID for demo
    activeJobs.set(jobId, {
      id: jobId,
      status: 'processing',
      startTime: new Date(),
      promise: jobPromise,
    });

    // Handle job completion
    jobPromise
      .then((result) => {
        activeJobs.set(jobId, {
          id: jobId,
          status: 'completed',
          startTime: activeJobs.get(jobId).startTime,
          endTime: new Date(),
          result,
        });
      })
      .catch((error) => {
        activeJobs.set(jobId, {
          id: jobId,
          status: 'failed',
          startTime: activeJobs.get(jobId).startTime,
          endTime: new Date(),
          error: error.message,
        });
      });

    res.json({
      success: true,
      data: {
        jobId,
        message: 'Import process started',
        status: 'processing',
      },
    });
  } catch (error: any) {
    console.error('Error starting import process:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start import process',
    });
  }
});

/**
 * Get job status
 * GET /api/lexware/jobs/:id
 */
router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = activeJobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Return job status without full result data
    const response = {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        startTime: job.startTime,
        endTime: job.endTime,
        summary: null as any,
      },
    };

    // Add summary if job is complete
    if (job.status === 'completed' && job.result) {
      response.data.summary = {
        processing: {
          successful: job.result.processingResult.successful.length,
          failed: job.result.processingResult.failed.length,
          reviewNeeded: job.result.processingResult.flaggedForReview.length,
          stats: job.result.processingResult.stats,
        },
        import: {
          imported: job.result.importResult.imported,
          updated: job.result.importResult.updated,
          failed: job.result.importResult.failed,
        },
      };
    } else if (job.status === 'failed') {
      response.data.summary = { error: job.error };
    }

    res.json(response);
  } catch (error: any) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get job status',
    });
  }
});

/**
 * Get detailed job results
 * GET /api/lexware/jobs/:id/results
 */
router.get('/jobs/:id/results', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = activeJobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Job is ${job.status}, results not available yet`,
      });
    }

    res.json({
      success: true,
      data: job.result,
    });
  } catch (error: any) {
    console.error('Error getting job results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get job results',
    });
  }
});

/**
 * Cancel a running job
 * DELETE /api/lexware/jobs/:id
 */
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = activeJobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      activeJobs.delete(jobId);
      return res.json({
        success: true,
        message: 'Job removed from memory',
      });
    }

    // Note: Actual cancellation would require more sophisticated job management
    activeJobs.delete(jobId);

    res.json({
      success: true,
      message: 'Job cancelled (note: processing may continue in background)',
    });
  } catch (error: any) {
    console.error('Error cancelling job:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel job',
    });
  }
});

/**
 * Get articles imported from Lexware
 * GET /api/lexware/articles
 */
router.get('/articles', async (_req: Request, res: Response) => {
  try {
    const articles = await prisma.product.findMany({
      where: {
        sourceUrl: 'lexware-import',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: {
        articles,
        total: articles.length,
        summary: {
          withPrice: articles.filter((a) => a.price !== null).length,
          withTieredPrice: articles.filter((a) => a.priceType === 'tiered').length,
          aufAnfrage: articles.filter((a) => a.priceType === 'auf_anfrage').length,
          unknown: articles.filter((a) => a.priceType === 'unknown').length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching Lexware articles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Lexware articles',
    });
  }
});

/**
 * Delete all Lexware imported articles (cleanup)
 * DELETE /api/lexware/articles
 */
router.delete('/articles', async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'DELETE_ALL_LEXWARE_ARTICLES') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Set confirm to "DELETE_ALL_LEXWARE_ARTICLES"',
      });
    }

    const result = await prisma.product.deleteMany({
      where: {
        sourceUrl: 'lexware-import',
      },
    });

    res.json({
      success: true,
      data: {
        deleted: result.count,
        message: `Deleted ${result.count} Lexware articles`,
      },
    });
  } catch (error: any) {
    console.error('Error deleting Lexware articles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete Lexware articles',
    });
  }
});

export default router;
