/**
 * Label Templates API Routes
 * Handles CRUD operations for label templates with article-specific overrides
 * Refactored to use centralized LabelTemplateService
 */

import { Router, Request, Response } from 'express';
import labelTemplateService from '../../services/label-template-service';

const router = Router();

/**
 * POST /api/label-templates
 * Save a new label template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const template = await labelTemplateService.createTemplate(req.body);

    res.json({
      success: true,
      message: 'Template saved successfully',
      template,
    });
  } catch (error: any) {
    console.error('❌ Label template save error:', error);

    // Handle specific error cases
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
      error: 'Label template save failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/label-templates
 * List all label templates
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await labelTemplateService.listTemplates();

    res.json({
      success: true,
      templates,
    });
  } catch (error: any) {
    console.error('❌ Label templates listing error:', error);
    res.status(500).json({
      error: 'Label templates listing failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/label-templates/:id
 * Get a specific label template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await labelTemplateService.getTemplate(id);

    res.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('❌ Label template fetch error:', error);

    if (error.message.includes('Invalid template ID')) {
      return res.status(400).json({
        error: 'Invalid template ID',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Label template not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Label template fetch failed',
      message: error.message,
    });
  }
});

/**
 * PUT /api/label-templates/:id
 * Update a label template
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await labelTemplateService.updateTemplate(id, req.body);

    res.json({
      success: true,
      message: 'Template updated successfully',
      template,
    });
  } catch (error: any) {
    console.error('❌ Label template update error:', error);

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
      error: 'Label template update failed',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/label-templates/:id
 * Delete a label template
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await labelTemplateService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Label template deletion error:', error);

    if (error.message.includes('Invalid template ID')) {
      return res.status(400).json({
        error: 'Invalid template ID',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Label template not found',
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
      error: 'Label template deletion failed',
      message: error.message,
    });
  }
});

export default router;
