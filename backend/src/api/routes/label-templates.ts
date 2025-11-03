/**
 * Label Templates API Routes
 * Handles CRUD operations for label templates with article-specific overrides
 */

import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

// Storage path for label templates
const LABEL_TEMPLATES_DIR = path.join(process.cwd(), 'data', 'label-templates');

// Ensure directory exists
(async () => {
  try {
    await fs.mkdir(LABEL_TEMPLATES_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create label templates directory:', error);
  }
})();

/**
 * POST /api/label-templates
 * Save a new label template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const template = req.body;

    if (!template.id || !template.name) {
      return res.status(400).json({ error: 'Template ID and name are required' });
    }

    const filePath = path.join(LABEL_TEMPLATES_DIR, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));

    res.json({
      success: true,
      message: 'Template saved successfully',
      template,
    });
  } catch (error: any) {
    console.error('Label template save error:', error);
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(LABEL_TEMPLATES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const templates = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(LABEL_TEMPLATES_DIR, file), 'utf-8');
        const template = JSON.parse(content);
        return {
          id: template.id,
          name: template.name,
          width: template.width,
          height: template.height,
          unit: template.unit,
          elementsCount: template.elements?.length || 0,
        };
      })
    );

    res.json({
      success: true,
      templates,
    });
  } catch (error: any) {
    console.error('Label templates listing error:', error);
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
    const filePath = path.join(LABEL_TEMPLATES_DIR, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const template = JSON.parse(content);

      res.json({
        success: true,
        template,
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Label template not found' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Label template fetch error:', error);
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
    const template = req.body;

    if (template.id !== id) {
      return res.status(400).json({ error: 'Template ID mismatch' });
    }

    const filePath = path.join(LABEL_TEMPLATES_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));

    res.json({
      success: true,
      message: 'Template updated successfully',
      template,
    });
  } catch (error: any) {
    console.error('Label template update error:', error);
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
    const filePath = path.join(LABEL_TEMPLATES_DIR, `${id}.json`);

    try {
      await fs.unlink(filePath);
      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Label template not found' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Label template deletion error:', error);
    res.status(500).json({
      error: 'Label template deletion failed',
      message: error.message,
    });
  }
});

export default router;
