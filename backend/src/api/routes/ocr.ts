/**
 * OCR API Routes
 * Endpoints for text extraction and matching
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ocrService } from '../../services/ocr-service';
import { matcherService } from '../../services/matcher-service';
import { OCRConfig } from '../../types/ocr-types';
import logger from '../../utils/logger';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/screenshots/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/ocr/process
 * Process a single screenshot with OCR
 */
router.post('/process', upload.single('screenshot'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No screenshot provided' });
    }

    const config: Partial<OCRConfig> = req.body.config ? JSON.parse(req.body.config) : {};
    const jobId = req.body.jobId;

    const result = await ocrService.processScreenshot(req.file.path, config, jobId);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    logger.error('OCR processing error:', error);
    res.status(500).json({
      error: 'OCR processing failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/ocr/batch-process
 * Process multiple screenshots in batch
 */
router.post(
  '/batch-process',
  upload.array('screenshots', 50),
  async (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'No screenshots provided' });
      }

      const config: Partial<OCRConfig> = req.body.config ? JSON.parse(req.body.config) : {};
      const jobId = req.body.jobId;

      const screenshotPaths = req.files.map((f) => f.path);

      const results = await ocrService.processScreenshots(screenshotPaths, config, jobId);

      res.json({
        success: true,
        processed: results.length,
        total: screenshotPaths.length,
        results,
      });
    } catch (error: any) {
      logger.error('Batch OCR processing error:', error);
      res.status(500).json({
        error: 'Batch OCR processing failed',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/ocr/process-job
 * Process all screenshots from a crawl job
 */
router.post('/process-job/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const config: Partial<OCRConfig> = req.body.config || {};

    // Get screenshots from crawl job
    const screenshotsDir = path.join(process.cwd(), 'screenshots', jobId);

    try {
      await fs.access(screenshotsDir);
    } catch {
      return res.status(404).json({ error: 'Job screenshots not found' });
    }

    const files = await fs.readdir(screenshotsDir);
    const screenshotPaths = files
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f) && !f.includes('_thumb'))
      .map((f) => path.join(screenshotsDir, f));

    if (screenshotPaths.length === 0) {
      return res.status(404).json({ error: 'No screenshots found for job' });
    }

    const results = await ocrService.processScreenshots(screenshotPaths, config, jobId);

    res.json({
      success: true,
      jobId,
      processed: results.length,
      total: screenshotPaths.length,
      results,
    });
  } catch (error: any) {
    logger.error('Job OCR processing error:', error);
    res.status(500).json({
      error: 'Job OCR processing failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/ocr/match
 * Match OCR result with Excel data
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const { ocrData, excelData, config } = req.body;

    if (!ocrData || !excelData) {
      return res.status(400).json({ error: 'OCR data and Excel data are required' });
    }

    const matchResult = matcherService.matchWithExcel(ocrData, excelData, config);

    if (!matchResult) {
      return res.json({
        success: false,
        message: 'No match found',
      });
    }

    // Validate match
    const validation = matcherService.validateMatch(matchResult);

    res.json({
      success: true,
      match: matchResult,
      validation,
    });
  } catch (error: any) {
    logger.error('Matching error:', error);
    res.status(500).json({
      error: 'Matching failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/ocr/batch-match
 * Match multiple OCR results with Excel data
 */
router.post('/batch-match', async (req: Request, res: Response) => {
  try {
    const { ocrResults, excelData, config } = req.body;

    if (!ocrResults || !excelData) {
      return res.status(400).json({ error: 'OCR results and Excel data are required' });
    }

    const matches = matcherService.batchMatch(ocrResults, excelData, config);

    // Generate match report
    const report = matcherService.generateMatchReport(matches);

    res.json({
      success: true,
      matches,
      report,
    });
  } catch (error: any) {
    logger.error('Batch matching error:', error);
    res.status(500).json({
      error: 'Batch matching failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/ocr/find-best-matches
 * Find top N best matches for an OCR result
 */
router.post('/find-best-matches', async (req: Request, res: Response) => {
  try {
    const { ocrData, excelData, topN = 5 } = req.body;

    if (!ocrData || !excelData) {
      return res.status(400).json({ error: 'OCR data and Excel data are required' });
    }

    const matches = matcherService.findBestMatches(ocrData, excelData, topN);

    res.json({
      success: true,
      matches,
    });
  } catch (error: any) {
    logger.error('Find best matches error:', error);
    res.status(500).json({
      error: 'Finding best matches failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/ocr/status/:resultId
 * Get OCR processing status
 */
router.get('/status/:resultId', (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;
    const status = ocrService.getProcessingStatus(resultId);

    if (!status) {
      return res.status(404).json({ error: 'OCR result not found' });
    }

    res.json({
      success: true,
      status,
    });
  } catch (error: any) {
    logger.error('Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/ocr/validate-match
 * Validate a match result
 */
router.post('/validate-match', (req: Request, res: Response) => {
  try {
    const { match } = req.body;

    if (!match) {
      return res.status(400).json({ error: 'Match data is required' });
    }

    const validation = matcherService.validateMatch(match);

    res.json({
      success: true,
      validation,
    });
  } catch (error: any) {
    logger.error('Validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error.message,
    });
  }
});

export default router;
