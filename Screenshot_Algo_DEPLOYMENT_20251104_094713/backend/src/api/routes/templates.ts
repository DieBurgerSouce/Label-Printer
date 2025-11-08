/**
 * Template API Routes
 * Endpoints for template management and rendering
 * Refactored to use TemplateStorageService for CRUD and TemplateEngine for rendering
 */

import { Router, Request, Response } from 'express';
import { templateEngine } from '../../services/template-engine';
import templateStorageService from '../../services/template-storage-service';
import { convertLabelTemplateToRenderingTemplate } from '../../services/label-to-rendering-converter';
import { LabelTemplate, RenderContext, RenderOptions } from '../../types/template-types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const templateData: Partial<LabelTemplate> = req.body;

    // Create template with defaults
    const template: LabelTemplate = {
      id: templateData.id || uuidv4(),
      name: templateData.name || 'Untitled Template',
      description: templateData.description,
      version: templateData.version || '1.0.0',
      dimensions: templateData.dimensions || { width: 400, height: 300, unit: 'px', dpi: 300 },
      layers: templateData.layers || [],
      fieldStyles: templateData.fieldStyles || [],
      formattingOptions: templateData.formattingOptions || {},
      globalStyles: templateData.globalStyles || {},
      variables: templateData.variables || [],
      settings: templateData.settings || {},
      createdAt: templateData.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Use storage service with validation
    const savedTemplate = await templateStorageService.createTemplate(template);

    res.json({
      success: true,
      template: savedTemplate,
    });
  } catch (error: any) {
    console.error('❌ Template creation error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Template already exists',
        message: error.message,
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({
        error: 'Invalid template',
        message: error.message,
      });
    }

    if (error.code === 'EACCES') {
      return res.status(500).json({
        error: 'Permission denied',
        message: 'Server does not have permission to write template files',
      });
    }

    if (error.code === 'ENOSPC') {
      return res.status(500).json({
        error: 'No space left',
        message: 'Server disk is full',
      });
    }

    res.status(500).json({
      error: 'Template creation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/templates
 * List all templates
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await templateStorageService.listTemplates();

    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error('❌ Template listing error:', error);
    res.status(500).json({
      error: 'Template listing failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await templateStorageService.getTemplate(id);

    res.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('❌ Template fetch error:', error);

    if (error.message.includes('Invalid template ID')) {
      return res.status(400).json({
        error: 'Invalid template ID',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Template fetch failed',
      message: error.message,
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Partial<LabelTemplate> = req.body;

    // Merge updates with updatedAt
    const updatedTemplate: LabelTemplate = {
      ...updates as LabelTemplate,
      id, // Preserve ID from URL
      updatedAt: new Date(),
    };

    const savedTemplate = await templateStorageService.updateTemplate(id, updatedTemplate);

    res.json({
      success: true,
      template: savedTemplate,
    });
  } catch (error: any) {
    console.error('❌ Template update error:', error);

    if (error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('mismatch')) {
      return res.status(400).json({
        error: 'Invalid template',
        message: error.message,
      });
    }

    if (error.code === 'EACCES') {
      return res.status(500).json({
        error: 'Permission denied',
        message: 'Server does not have permission to write template files',
      });
    }

    if (error.code === 'ENOSPC') {
      return res.status(500).json({
        error: 'No space left',
        message: 'Server disk is full',
      });
    }

    res.status(500).json({
      error: 'Template update failed',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await templateStorageService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Template deletion error:', error);

    if (error.message.includes('Invalid template ID')) {
      return res.status(400).json({
        error: 'Invalid template ID',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        message: error.message,
      });
    }

    if (error.code === 'EACCES') {
      return res.status(500).json({
        error: 'Permission denied',
        message: 'Server does not have permission to delete template files',
      });
    }

    res.status(500).json({
      error: 'Template deletion failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/:id/render
 * Render a template with data
 */
router.post('/:id/render', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required for rendering' });
    }

    // Load template from storage service
    const template = await templateStorageService.getTemplate(id);

    // Create render context
    const context: RenderContext = {
      template,
      data,
      options: options as RenderOptions,
    };

    // Render using template engine
    const result = await templateEngine.render(context);

    if (!result.success) {
      return res.status(500).json({
        error: 'Rendering failed',
        message: result.error,
      });
    }

    // Return image
    const format = result.format || 'png';
    res.set('Content-Type', `image/${format}`);
    res.set('X-Render-Time', `${result.renderTime}ms`);
    res.send(result.buffer);
  } catch (error: any) {
    console.error('❌ Template rendering error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Template rendering failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/:id/render/base64
 * Render a template and return base64
 */
router.post('/:id/render/base64', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required for rendering' });
    }

    // Load template from storage service
    const template = await templateStorageService.getTemplate(id);

    // Create render context
    const context: RenderContext = {
      template,
      data,
      options: options as RenderOptions,
    };

    // Render using template engine
    const result = await templateEngine.render(context);

    if (!result.success) {
      return res.status(500).json({
        error: 'Rendering failed',
        message: result.error,
      });
    }

    res.json({
      success: true,
      image: result.base64,
      format: result.format,
      width: result.width,
      height: result.height,
      renderTime: result.renderTime,
    });
  } catch (error: any) {
    console.error('❌ Template rendering error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Template rendering failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/render-batch
 * Render multiple labels with a template
 */
router.post('/render-batch', async (req: Request, res: Response) => {
  try {
    const { templateId, dataArray, options } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    // Load template from storage service
    const template = await templateStorageService.getTemplate(templateId);

    // Render all labels using template engine
    const results = await Promise.all(
      dataArray.map(async (data, index) => {
        const context: RenderContext = {
          template,
          data,
          options: options as RenderOptions,
        };

        const result = await templateEngine.render(context);

        return {
          index,
          success: result.success,
          base64: result.success ? result.base64 : undefined,
          error: result.error,
        };
      })
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      results,
      summary: {
        total: dataArray.length,
        successful,
        failed,
      },
    });
  } catch (error: any) {
    console.error('❌ Batch rendering error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Batch rendering failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/preview
 * Preview a template without saving
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { template, data, options } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template is required' });
    }

    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    // Create render context
    const context: RenderContext = {
      template,
      data,
      options: options as RenderOptions,
    };

    // Render
    const result = await templateEngine.render(context);

    if (!result.success) {
      return res.status(500).json({
        error: 'Preview rendering failed',
        message: result.error,
      });
    }

    res.json({
      success: true,
      image: result.base64,
      format: result.format,
      width: result.width,
      height: result.height,
      renderTime: result.renderTime,
    });
  } catch (error: any) {
    console.error('Template preview error:', error);
    res.status(500).json({
      error: 'Template preview failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/convert
 * Convert Label Template (Visual Editor) to Rendering Template
 */
router.post('/convert', async (req: Request, res: Response) => {
  try {
    const { labelTemplate, saveAs } = req.body;

    if (!labelTemplate) {
      return res.status(400).json({ error: 'Label template is required' });
    }

    // Convert Label Template to Rendering Template
    const renderingTemplate = convertLabelTemplateToRenderingTemplate(labelTemplate);

    // Optionally save the converted template
    if (saveAs) {
      renderingTemplate.name = saveAs;
      const savedTemplate = await templateStorageService.createTemplate(renderingTemplate);

      return res.json({
        success: true,
        template: savedTemplate,
        message: `Template converted and saved as: ${saveAs}`,
      });
    }

    // Just return the converted template without saving
    res.json({
      success: true,
      template: renderingTemplate,
      message: 'Template converted successfully',
    });
  } catch (error: any) {
    console.error('❌ Template conversion error:', error);
    res.status(500).json({
      error: 'Template conversion failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/:id/export-pdf
 * Export template as PDF using article data
 */
router.post('/:id/export-pdf', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { articleData, options } = req.body;

    if (!articleData) {
      return res.status(400).json({ error: 'Article data is required' });
    }

    // Load template
    const template = await templateStorageService.getTemplate(id);

    // Create render context
    const context: RenderContext = {
      template,
      data: articleData,
      options: {
        ...options,
        format: 'pdf',
      } as RenderOptions,
    };

    // Render as PDF
    const result = await templateEngine.render(context);

    if (!result.success) {
      return res.status(500).json({
        error: 'PDF export failed',
        message: result.error,
      });
    }

    // Return PDF data
    res.json({
      success: true,
      pdf: result.base64,
      fileName: `${template.name}_${articleData.articleNumber || 'export'}.pdf`,
      message: 'PDF generated successfully',
    });
  } catch (error: any) {
    console.error('❌ PDF export error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Template not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'PDF export failed',
      message: error.message,
    });
  }
});

export default router;
