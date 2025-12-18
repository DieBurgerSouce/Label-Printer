/**
 * Label Management API Routes
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { LabelGeneratorService } from '../../services/label-generator-service.js';
import { StorageService } from '../../services/storage-service.js';
import {
  ApiResponse,
  FilterParams,
  PaginationParams,
  PriceLabel,
} from '../../types/label-types.js';
import logger from '../../utils/logger';

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
    // Validate source parameter
    const sourceParam = req.query.source as string | undefined;
    const validSources: Array<'screenshot' | 'manual' | 'import'> = [
      'screenshot',
      'manual',
      'import',
    ];
    const source =
      sourceParam && validSources.includes(sourceParam as 'screenshot' | 'manual' | 'import')
        ? (sourceParam as 'screenshot' | 'manual' | 'import')
        : undefined;

    const filters: FilterParams = {
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      source,
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
 * GET /api/labels/stats - Get label statistics (alias for /stats/summary)
 * IMPORTANT: Must be BEFORE /:id route
 */
router.get('/stats', async (_req: Request, res: Response) => {
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
 * GET /api/labels/:id/image - Get label image as blob
 */
router.get('/:id/image', async (req: Request, res: Response): Promise<void> => {
  try {
    const label = await StorageService.getLabel(req.params.id);

    if (!label) {
      res.status(404).json({
        success: false,
        error: 'Label not found',
      });
      return;
    }

    if (!label.imageData) {
      res.status(404).json({
        success: false,
        error: 'No image data available for this label',
      });
      return;
    }

    // imageData is already a Buffer
    const buffer = Buffer.isBuffer(label.imageData)
      ? label.imageData
      : Buffer.from(label.imageData);

    res.contentType('image/png');
    res.send(buffer);
  } catch (error) {
    logger.error('Error serving label image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve image',
    });
  }
});

/**
 * GET /api/labels/:id/thumbnail - Get label thumbnail (resized image)
 */
router.get('/:id/thumbnail', async (req: Request, res: Response): Promise<void> => {
  try {
    const label = await StorageService.getLabel(req.params.id);

    if (!label) {
      res.status(404).json({
        success: false,
        error: 'Label not found',
      });
      return;
    }

    if (!label.imageData) {
      res.status(404).json({
        success: false,
        error: 'No image data available for this label',
      });
      return;
    }

    // Parse query parameters for size
    const width = parseInt(req.query.width as string) || 200;
    const height = parseInt(req.query.height as string) || 200;

    // imageData is already a Buffer
    const buffer = Buffer.isBuffer(label.imageData)
      ? label.imageData
      : Buffer.from(label.imageData);

    // Resize using sharp (already installed)
    const sharp = (await import('sharp')).default;
    const thumbnail = await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    res.contentType('image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(thumbnail);
  } catch (error) {
    logger.error('Error generating thumbnail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate thumbnail',
    });
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

      default: {
        const response: ApiResponse = {
          success: false,
          error: `Unknown operation: ${operation}`,
        };
        res.status(400).json(response);
        return;
      }
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

    // Convert tieredPrices to staffelpreise format if available
    const staffelpreise = article.tieredPrices?.map((tp) => ({
      quantity: tp.quantity || 0,
      price: parseFloat(tp.price?.toString() || '0'),
    }));

    // OPTION A: Render label WITH image
    let imageData: Buffer | undefined;

    if (templateId) {
      try {
        logger.info(
          `🎨 Rendering label for article ${article.articleNumber} with template ${templateId}`
        );

        // Load the template from the CORRECT location (data/label-templates/)
        const LabelTemplateService = (await import('../../services/label-template-service.js'))
          .default;
        const template = await LabelTemplateService.getTemplate(templateId);

        if (template) {
          // Import rendering services
          const { convertLabelTemplateToRenderingTemplate } =
            await import('../../services/label-to-rendering-converter.js');
          const { templateEngine } = await import('../../services/template-engine.js');

          // Convert Label Template to Rendering Template (if needed)
          const renderingTemplate = convertLabelTemplateToRenderingTemplate(template);

          // Prepare data for rendering
          const renderData = {
            articleNumber: article.articleNumber,
            productName: article.productName,
            description: article.description || '',
            price: article.price || 0,
            currency: article.currency || 'EUR',
            tieredPrices: staffelpreise || [],
            imageUrl: article.imageUrl,
            sourceUrl: article.sourceUrl || '',
          };

          // 🔍 DEBUG: Log render data to verify prices
          logger.info(`🔍 RENDER DATA for Article ${article.articleNumber}:`);
          logger.info(`   - Price: ${renderData.price} ${renderData.currency}`);
          logger.info(`   - Tiered Prices: ${renderData.tieredPrices.length} tiers`);
          if (renderData.tieredPrices.length > 0) {
            renderData.tieredPrices.forEach((tp: any, i: number) => {
              logger.info(`     ${i + 1}. ${tp.quantity} Stk → ${tp.price} EUR`);
            });
          }

          // Render template to PNG
          const renderResult = await templateEngine.render({
            template: renderingTemplate,
            data: renderData,
            options: {
              format: 'png',
              quality: 90,
              scale: 1,
            },
          });

          if (renderResult.success && renderResult.buffer) {
            imageData = renderResult.buffer;
            logger.info(
              `✅ Label rendered successfully: ${renderResult.width}x${renderResult.height} in ${renderResult.renderTime}ms`
            );
          } else {
            logger.error('❌ Label rendering failed:', renderResult.error);
          }
        } else {
          logger.warn(`⚠️  Template ${templateId} not found, generating label without image`);
        }
      } catch (renderError) {
        logger.error('❌ Error during label rendering:', renderError);
        // Continue without image - don't fail the whole request
      }
    }

    // Generate label from article data with template
    const labelData: PriceLabel = {
      id: crypto.randomUUID(),
      articleNumber: article.articleNumber,
      productName: article.productName,
      description: article.description || '',
      priceInfo: {
        price: article.price || 0,
        currency: article.currency || 'EUR',
        staffelpreise: staffelpreise,
      },
      imageUrl: article.imageUrl || undefined,
      imageData: imageData, // ⭐ NOW INCLUDING THE RENDERED IMAGE!
      templateType: templateId ? 'custom' : 'standard',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: article.category ? [article.category] : [],
      category: article.category || undefined,
      source: 'manual',
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
    logger.error('Error generating label from article:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/labels/extract - Extract label from URL (screenshot + OCR)
 * NOTE: This route is not fully implemented yet. Use /api/automation/start-simple instead
 * for full screenshot + OCR + label generation workflow.
 */
router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      const response: ApiResponse = {
        success: false,
        error: 'URL is required',
      };
      res.status(400).json(response);
      return;
    }

    // This route requires complex integration with PreciseScreenshotService and RobustOCRService
    // which need Page instances and jobIds. For now, redirect users to the automation API.
    const response: ApiResponse = {
      success: false,
      error: 'Not implemented - use /api/automation/start-simple instead',
      message:
        'This route is not yet fully implemented. Please use the automation API endpoint /api/automation/start-simple for screenshot + OCR + label generation.',
    };

    res.status(501).json(response);
  } catch (error) {
    logger.error('Error in label extraction route:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    res.status(500).json(response);
  }
});

export default router;
