import { Router, Request, Response } from 'express';
import path from 'path';
import { createLogger } from '../../utils/logger';
import { getLayoutComposerService } from '../../services/layout-composer-service';
import { getLabelStorageService } from '../../services/label-storage-service';
import { getLabelGeneratorService } from '../../services/label-generator-service';
import {
  CreateLayoutRequest,
  ExportRequest,
  PaperFormat,
  ValidationError,
  PAPER_FORMATS,
  PaperFormatType,
  isValidPaperFormat,
  isValidExportFormat,
} from '../../types/label-types';

const logger = createLogger('PrintAPI');
const router = Router();

/**
 * POST /api/print/preview
 * Generate print preview
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const data: CreateLayoutRequest = req.body;

    // Validate
    if (!data.labelIds || data.labelIds.length === 0) {
      throw new ValidationError('Missing labelIds');
    }

    const composer = getLayoutComposerService();
    const storage = getLabelStorageService();

    // Get labels
    const labels = await Promise.all(
      data.labelIds.map((id) => storage.getLabel(id, true))
    );

    // Create layout
    const layout = await composer.createLayout(
      labels,
      data.paperFormat || {},
      data.gridLayout || {},
      data.settings
    );

    // Generate preview (low-res)
    const preview = await composer.generatePreview(layout, 800);

    // Return preview as base64
    res.json({
      success: true,
      data: {
        layout: {
          id: layout.id,
          name: layout.name,
          paperFormat: layout.paperFormat,
          gridLayout: layout.gridLayout,
          settings: layout.settings,
          labelCount: layout.labels.length,
        },
        preview: preview.toString('base64'),
      },
    });
  } catch (error) {
    logger.error('Failed to generate preview', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    });
  }
});

/**
 * POST /api/print/export
 * Export print layout
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const data: ExportRequest = req.body;

    // Validate format
    if (!data.format || !isValidExportFormat(data.format)) {
      throw new ValidationError(`Invalid export format: ${data.format}`);
    }

    const composer = getLayoutComposerService();
    const storage = getLabelStorageService();

    let labels;
    if (data.layoutId) {
      // Use existing layout (not implemented yet - would need layout storage)
      throw new Error('Layout storage not yet implemented');
    } else if (data.labelIds && data.labelIds.length > 0) {
      // Create new layout from label IDs
      labels = await Promise.all(
        data.labelIds.map((id) => storage.getLabel(id, true))
      );
    } else {
      throw new ValidationError('Either layoutId or labelIds must be provided');
    }

    // Create layout
    const layout = await composer.createLayout(
      labels!,
      data.paperFormat || {},
      data.gridLayout || {},
      data.settings
    );

    // Export
    const outputPath = path.join('./data/exports', `${layout.id}.${data.format}`);
    const exportedPath = await composer.export(layout, data.format, data.settings, outputPath);

    // Send file
    res.download(exportedPath, `print-${Date.now()}.${data.format}`, (err) => {
      if (err) {
        logger.error('Failed to send export', { error: err });
      }
    });
  } catch (error) {
    logger.error('Failed to export', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export',
    });
  }
});

/**
 * GET /api/print/formats
 * Get available paper formats
 */
router.get('/formats', (_req: Request, res: Response) => {
  try {
    const formats = Object.entries(PAPER_FORMATS).map(([type, dimensions]) => ({
      type,
      ...dimensions,
      displayName: type === 'Custom' ? 'Custom Size' : `DIN ${type}`,
    }));

    res.json({
      success: true,
      data: formats,
    });
  } catch (error) {
    logger.error('Failed to get formats', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get formats',
    });
  }
});

/**
 * POST /api/print/calculate-grid
 * Calculate optimal grid layout
 */
router.post('/calculate-grid', async (req: Request, res: Response) => {
  try {
    const { paperFormat, labelCount, margins, spacing } = req.body;

    if (!paperFormat || !labelCount) {
      throw new ValidationError('Missing required fields: paperFormat, labelCount');
    }

    // Validate paper format
    if (!isValidPaperFormat(paperFormat.type)) {
      throw new ValidationError(`Invalid paper format: ${paperFormat.type}`);
    }

    const composer = getLayoutComposerService();

    // Build complete paper format
    const format: PaperFormat = {
      type: paperFormat.type as PaperFormatType,
      width: paperFormat.width || PAPER_FORMATS[paperFormat.type as PaperFormatType].width,
      height: paperFormat.height || PAPER_FORMATS[paperFormat.type as PaperFormatType].height,
      orientation: paperFormat.orientation || 'portrait',
    };

    // Swap dimensions if landscape
    if (format.orientation === 'landscape' && format.type !== 'Custom') {
      [format.width, format.height] = [format.height, format.width];
    }

    const grid = composer.calculateOptimalGrid(format, labelCount, margins, spacing);

    res.json({
      success: true,
      data: {
        paperFormat: format,
        grid,
      },
    });
  } catch (error) {
    logger.error('Failed to calculate grid', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate grid',
    });
  }
});

/**
 * GET /api/print/templates
 * Get available label templates
 */
router.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const generator = getLabelGeneratorService();
    const templates = generator.getTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('Failed to get templates', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get templates',
    });
  }
});

/**
 * POST /api/print/templates
 * Add custom template
 */
router.post('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const template = req.body;

    // Validate required fields
    if (!template.id || !template.name || !template.layout || !template.fields) {
      throw new ValidationError('Missing required template fields');
    }

    const generator = getLabelGeneratorService();
    await generator.addTemplate(template);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Failed to add template', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add template',
    });
  }
});

/**
 * POST /api/print/validate-layout
 * Validate a layout configuration
 */
router.post('/validate-layout', async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateLayoutRequest = req.body;

    if (!data.labelIds || data.labelIds.length === 0) {
      throw new ValidationError('Missing labelIds');
    }

    const composer = getLayoutComposerService();
    const storage = getLabelStorageService();

    // Get labels (without image data for faster validation)
    const labels = await Promise.all(
      data.labelIds.map((id) => storage.getLabel(id, false))
    );

    // Create layout
    const layout = await composer.createLayout(
      labels,
      data.paperFormat || {},
      data.gridLayout || {},
      data.settings
    );

    // Validate
    const validation = composer.validateLayout(layout);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors,
        layout: {
          paperFormat: layout.paperFormat,
          gridLayout: layout.gridLayout,
          totalLabels: layout.labels.length,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to validate layout', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate layout',
    });
  }
});

export default router;
