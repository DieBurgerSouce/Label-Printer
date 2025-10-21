/**
 * Template API Routes
 * Endpoints for template management and rendering
 */

import { Router, Request, Response } from 'express';
import { templateEngine } from '../../services/template-engine';
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

    // Validate required fields
    if (!templateData.name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (!templateData.dimensions) {
      return res.status(400).json({ error: 'Template dimensions are required' });
    }

    // Create template with defaults
    const template: LabelTemplate = {
      id: uuidv4(),
      name: templateData.name,
      description: templateData.description,
      version: '1.0.0',
      dimensions: templateData.dimensions,
      layers: templateData.layers || [],
      fieldStyles: templateData.fieldStyles || [],
      formattingOptions: templateData.formattingOptions || {},
      globalStyles: templateData.globalStyles || {},
      variables: templateData.variables || [],
      settings: templateData.settings || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await templateEngine.saveTemplate(template);

    res.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('Template creation error:', error);
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
    const templates = await templateEngine.listTemplates();

    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error('Template listing error:', error);
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
    const template = await templateEngine.loadTemplate(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('Template fetch error:', error);
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

    // Load existing template
    const existingTemplate = await templateEngine.loadTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Merge updates
    const updatedTemplate: LabelTemplate = {
      ...existingTemplate,
      ...updates,
      id, // Preserve ID
      updatedAt: new Date(),
    };

    await templateEngine.saveTemplate(updatedTemplate);

    res.json({
      success: true,
      template: updatedTemplate,
    });
  } catch (error: any) {
    console.error('Template update error:', error);
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

    const success = await templateEngine.deleteTemplate(id);

    if (!success) {
      return res.status(404).json({ error: 'Template not found or could not be deleted' });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    console.error('Template deletion error:', error);
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

    // Load template
    const template = await templateEngine.loadTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
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
    console.error('Template rendering error:', error);
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

    // Load template
    const template = await templateEngine.loadTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
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
    console.error('Template rendering error:', error);
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

    // Load template
    const template = await templateEngine.loadTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Render all labels
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
    console.error('Batch rendering error:', error);
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

export default router;
