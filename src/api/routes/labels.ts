import { Router, Request, Response } from 'express';
import { Page } from 'playwright';
import { createLogger } from '../../utils/logger';
import { getLabelStorageService } from '../../services/label-storage-service';
import { getLabelGeneratorService } from '../../services/label-generator-service';
import { getBrowserManager } from '../../services/browser-manager';
import {
  CreateLabelRequest,
  UpdateLabelRequest,
  LabelFilter,
  PaginationParams,
  ValidationError,
  PriceLabel,
} from '../../types/label-types';

const logger = createLogger('LabelsAPI');
const router = Router();

/**
 * GET /api/labels
 * Get all labels with optional filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const storage = getLabelStorageService();

    // Parse filters
    const filter: LabelFilter = {
      articleNumber: req.query.articleNumber as string,
      category: req.query.category as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      search: req.query.search as string,
      priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
      priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    // Parse pagination
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    const result = await storage.getLabels(filter, pagination);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get labels', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get labels',
    });
  }
});

/**
 * GET /api/labels/search
 * Search labels
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (!query) {
      throw new ValidationError('Missing query parameter: q');
    }

    const storage = getLabelStorageService();
    const labels = await storage.searchLabels(query, limit);

    res.json({
      success: true,
      data: labels,
      count: labels.length,
    });
  } catch (error) {
    logger.error('Failed to search labels', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search labels',
    });
  }
});

/**
 * GET /api/labels/stats
 * Get storage statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const storage = getLabelStorageService();
    const stats = await storage.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

/**
 * GET /api/labels/:id
 * Get a single label by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const storage = getLabelStorageService();
    const includeImage = req.query.includeImage === 'true';

    const label = await storage.getLabel(req.params.id, includeImage);

    // If includeImage is true, return image as base64
    if (includeImage && label.imageData) {
      res.json({
        success: true,
        data: {
          ...label,
          imageData: label.imageData.toString('base64'),
        },
      });
    } else {
      res.json({
        success: true,
        data: label,
      });
    }
  } catch (error) {
    logger.error('Failed to get label', { labelId: req.params.id, error });
    res.status(error instanceof Error && error.name === 'NotFoundError' ? 404 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get label',
    });
  }
});

/**
 * GET /api/labels/:id/image
 * Get label image
 */
router.get('/:id/image', async (req: Request, res: Response): Promise<void> => {
  try {
    const storage = getLabelStorageService();
    const image = await storage.getImage(req.params.id);

    if (!image) {
      res.status(404).json({
        success: false,
        error: 'Image not found',
      });
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(image);
  } catch (error) {
    logger.error('Failed to get label image', { labelId: req.params.id, error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get label image',
    });
  }
});

/**
 * GET /api/labels/:id/thumbnail
 * Get label thumbnail
 */
router.get('/:id/thumbnail', async (req: Request, res: Response): Promise<void> => {
  try {
    const storage = getLabelStorageService();
    const thumbnail = await storage.getThumbnail(req.params.id);

    if (!thumbnail) {
      res.status(404).json({
        success: false,
        error: 'Thumbnail not found',
      });
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(thumbnail);
  } catch (error) {
    logger.error('Failed to get label thumbnail', { labelId: req.params.id, error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get label thumbnail',
    });
  }
});

/**
 * POST /api/labels
 * Create a new label
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateLabelRequest = req.body;

    // Validate
    if (!data.articleNumber || !data.productName || !data.priceInfo) {
      throw new ValidationError('Missing required fields: articleNumber, productName, priceInfo');
    }

    const generator = getLabelGeneratorService();
    const storage = getLabelStorageService();

    const label = await generator.createLabel({
      articleNumber: data.articleNumber,
      productName: data.productName,
      description: data.description,
      priceInfo: data.priceInfo,
      templateType: data.templateType,
    });

    await storage.saveLabel(label);

    res.status(201).json({
      success: true,
      data: label,
    });
  } catch (error) {
    logger.error('Failed to create label', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create label',
    });
  }
});

/**
 * POST /api/labels/extract
 * Extract label from a URL
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { url, articleNumber } = req.body;

    if (!url || !articleNumber) {
      throw new ValidationError('Missing required fields: url, articleNumber');
    }

    const browserManager = getBrowserManager();
    const generator = getLabelGeneratorService();
    const storage = getLabelStorageService();

    // Acquire browser
    const { page, release } = await browserManager.acquire();

    try {
      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Extract label
      const label = await generator.extractLabelFromPage(page as Page, articleNumber);

      // Save label
      await storage.saveLabel(label);

      res.status(201).json({
        success: true,
        data: label,
      });
    } finally {
      await release();
    }
  } catch (error) {
    logger.error('Failed to extract label', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract label',
    });
  }
});

/**
 * PUT /api/labels/:id
 * Update a label
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const storage = getLabelStorageService();
    const updates: UpdateLabelRequest = req.body;

    const updatedLabel = await storage.updateLabel(req.params.id, updates as Partial<PriceLabel>);

    res.json({
      success: true,
      data: updatedLabel,
    });
  } catch (error) {
    logger.error('Failed to update label', { labelId: req.params.id, error });
    res.status(error instanceof Error && error.name === 'NotFoundError' ? 404 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update label',
    });
  }
});

/**
 * DELETE /api/labels/:id
 * Delete a label
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const storage = getLabelStorageService();
    await storage.deleteLabel(req.params.id);

    res.json({
      success: true,
      message: 'Label deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete label', { labelId: req.params.id, error });
    res.status(error instanceof Error && error.name === 'NotFoundError' ? 404 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete label',
    });
  }
});

/**
 * POST /api/labels/batch
 * Process multiple labels
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { labelIds, action } = req.body;

    if (!labelIds || !Array.isArray(labelIds)) {
      throw new ValidationError('Invalid labelIds array');
    }

    const storage = getLabelStorageService();

    switch (action) {
      case 'delete': {
        const results = await Promise.allSettled(
          labelIds.map((id) => storage.deleteLabel(id))
        );

        const successful = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        res.json({
          success: true,
          message: `Deleted ${successful} labels, ${failed} failed`,
          successful,
          failed,
        });
        break;
      }

      case 'export': {
        const labels = await Promise.all(
          labelIds.map((id) => storage.getLabel(id, false))
        );

        res.json({
          success: true,
          data: labels,
        });
        break;
      }

      default:
        throw new ValidationError(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Failed to process batch', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process batch',
    });
  }
});

export default router;
