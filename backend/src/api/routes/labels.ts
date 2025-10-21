/**
 * Label Management API Routes
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { LabelGeneratorService } from '../../services/label-generator-service.js';
import { StorageService } from '../../services/storage-service.js';
import { ApiResponse, FilterParams, PaginationParams } from '../../types/label-types.js';

const router = Router();

/**
 * POST /api/labels - Create a new label
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const label = await LabelGeneratorService.createLabel(req.body);
    await StorageService.saveLabel(label);

    const response: ApiResponse = {
      success: true,
      data: label,
      message: 'Label created successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

/**
 * GET /api/labels - Get all labels with filters and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: FilterParams = {
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      source: req.query.source as any,
    };

    const pagination: PaginationParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: (req.query.sortBy as string) || 'createdAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    const { labels, total } = await StorageService.getLabels(filters, pagination);

    const response: ApiResponse = {
      success: true,
      data: {
        labels,
        total,
        page: pagination.page,
        limit: pagination.limit,
        pages: Math.ceil(total / pagination.limit),
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/labels/:id - Get single label
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const label = await StorageService.getLabel(req.params.id);

    if (!label) {
      const response: ApiResponse = {
        success: false,
        error: 'Label not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: label,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/labels/:id - Update a label
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await StorageService.getLabel(req.params.id);

    if (!existing) {
      const response: ApiResponse = {
        success: false,
        error: 'Label not found',
      };
      res.status(404).json(response);
      return;
    }

    const updated = {
      ...existing,
      ...req.body,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Prevent createdAt change
      updatedAt: new Date(),
    };

    await StorageService.saveLabel(updated);

    const response: ApiResponse = {
      success: true,
      data: updated,
      message: 'Label updated successfully',
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/labels/:id - Delete a label
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const success = await StorageService.deleteLabel(req.params.id);

    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Label not found or could not be deleted',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Label deleted successfully',
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/labels/batch - Batch operations
 */
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { operation, labelIds } = req.body;

    if (!operation || !labelIds || !Array.isArray(labelIds)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid batch operation request',
      };
      res.status(400).json(response);
      return;
    }

    let result;

    switch (operation) {
      case 'delete':
        result = await StorageService.deleteLabels(labelIds);
        break;

      default:
        const response: ApiResponse = {
          success: false,
          error: `Unknown operation: ${operation}`,
        };
        res.status(400).json(response);
        return;
    }

    const response: ApiResponse = {
      success: true,
      data: { affected: result },
      message: `Batch ${operation} completed`,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/labels/stats - Get label statistics
 */
router.get('/stats/summary', async (_req: Request, res: Response) => {
  try {
    const stats = await StorageService.getStats();

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/labels/duplicate/:id - Duplicate a label
 */
router.post('/duplicate/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const source = await StorageService.getLabel(req.params.id);

    if (!source) {
      const response: ApiResponse = {
        success: false,
        error: 'Source label not found',
      };
      res.status(404).json(response);
      return;
    }

    const duplicate = await LabelGeneratorService.duplicateLabel(source);
    await StorageService.saveLabel(duplicate);

    const response: ApiResponse = {
      success: true,
      data: duplicate,
      message: 'Label duplicated successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/labels/generate-from-article - Generate label from article
 */
router.post('/generate-from-article', async (req: Request, res: Response): Promise<void> => {
  try {
    const { articleId, templateId } = req.body;

    if (!articleId) {
      const response: ApiResponse = {
        success: false,
        error: 'Article ID is required',
      };
      res.status(400).json(response);
      return;
    }

    // Fetch the article from the database
    const { ArticleService } = await import('../../services/article-service.js');
    const article = await ArticleService.getArticleById(articleId);

    if (!article) {
      const response: ApiResponse = {
        success: false,
        error: 'Article not found',
      };
      res.status(404).json(response);
      return;
    }

    // Generate label from article data
    const labelData = {
      id: crypto.randomUUID(),
      articleNumber: article.articleNumber,
      productName: article.productName,
      description: article.description || '',
      price: article.price || 0,
      currency: article.currency || 'EUR',
      ean: article.ean || '',
      category: article.category || '',
      manufacturer: article.manufacturer || '',
      image: article.imageUrl || '',
      qrCode: article.sourceUrl || '',
      template: templateId || 'standard-label',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: article.category ? [article.category] : [],
      metadata: {
        sourceArticleId: article.id,
        generatedFrom: 'article',
      },
    };

    // Save the label
    await StorageService.saveLabel(labelData);

    const response: ApiResponse = {
      success: true,
      data: labelData,
      message: 'Label generated from article successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error generating label from article:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export default router;
