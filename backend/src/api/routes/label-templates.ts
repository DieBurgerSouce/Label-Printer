/**
 * Label Templates API Routes
 * Handles CRUD operations for label templates with article-specific overrides
 * Refactored to use centralized LabelTemplateService
 */

import { Router, Request, Response } from 'express';
import labelTemplateService from '../../services/label-template-service';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendConflict,
  sendInternalError,
  handleError,
} from '../../utils/api-response';

const router = Router();

// Type guard for Node.js errors with code property
interface NodeError extends Error {
  code?: string;
}

/**
 * POST /api/label-templates
 * Save a new label template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const template = await labelTemplateService.createTemplate(req.body);
    return sendCreated(res, { template }, 'Template saved successfully');
  } catch (error: unknown) {
    console.error('❌ Label template save error:', error);

    const err = error as NodeError;
    const message = err.message || 'Unknown error';

    // Handle specific error cases
    if (message.includes('already exists')) {
      return sendConflict(res, message);
    }

    if (message.includes('Invalid') || message.includes('required')) {
      return sendBadRequest(res, message);
    }

    if (err.code === 'EACCES') {
      return sendInternalError(res, 'Server does not have permission to write template files');
    }

    if (err.code === 'ENOSPC') {
      return sendInternalError(res, 'Server disk is full');
    }

    return handleError(res, error, 'Label template save failed');
  }
});

/**
 * GET /api/label-templates
 * List all label templates
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await labelTemplateService.listTemplates();
    return sendSuccess(res, { templates });
  } catch (error: unknown) {
    console.error('❌ Label templates listing error:', error);
    return handleError(res, error, 'Label templates listing failed');
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
    return sendSuccess(res, { template });
  } catch (error: unknown) {
    console.error('❌ Label template fetch error:', error);

    const err = error as NodeError;
    const message = err.message || 'Unknown error';

    if (message.includes('Invalid template ID')) {
      return sendBadRequest(res, message);
    }

    if (message.includes('not found')) {
      return sendNotFound(res, 'Label template');
    }

    return handleError(res, error, 'Label template fetch failed');
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
    return sendSuccess(res, { template }, 'Template updated successfully');
  } catch (error: unknown) {
    console.error('❌ Label template update error:', error);

    const err = error as NodeError;
    const message = err.message || 'Unknown error';

    if (message.includes('Invalid') || message.includes('required') || message.includes('mismatch')) {
      return sendBadRequest(res, message);
    }

    if (err.code === 'EACCES') {
      return sendInternalError(res, 'Server does not have permission to write template files');
    }

    if (err.code === 'ENOSPC') {
      return sendInternalError(res, 'Server disk is full');
    }

    return handleError(res, error, 'Label template update failed');
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
    return sendSuccess(res, undefined, 'Template deleted successfully');
  } catch (error: unknown) {
    console.error('❌ Label template deletion error:', error);

    const err = error as NodeError;
    const message = err.message || 'Unknown error';

    if (message.includes('Invalid template ID')) {
      return sendBadRequest(res, message);
    }

    if (message.includes('not found')) {
      return sendNotFound(res, 'Label template');
    }

    if (err.code === 'EACCES') {
      return sendInternalError(res, 'Server does not have permission to delete template files');
    }

    return handleError(res, error, 'Label template deletion failed');
  }
});

export default router;
