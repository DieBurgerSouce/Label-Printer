/**
 * Print & Export API Routes
 */

import { Router, Request, Response } from 'express';
import { PrintService } from '../../services/print-service.js';
import { StorageService } from '../../services/storage-service.js';
import { ApiResponse } from '../../types/label-types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const PRINT_TEMPLATES_DIR = path.join(process.cwd(), 'data', 'print-templates');

/**
 * POST /api/print/preview - Generate print preview
 */
router.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { layout, labelIds } = req.body;

    if (!layout || !labelIds) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing layout or labelIds',
      };
      res.status(400).json(response);
      return;
    }

    // Fetch labels
    const labels = await Promise.all(
      labelIds.map((id: string) => StorageService.getLabel(id))
    );

    const validLabels = labels.filter((l) => l !== null);

    if (validLabels.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No valid labels found',
      };
      res.status(404).json(response);
      return;
    }

    const preview = await PrintService.generatePreview(layout, validLabels);

    const response: ApiResponse = {
      success: true,
      data: {
        preview,
        labelsCount: validLabels.length,
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
 * POST /api/print/export - Export to PDF or PNG
 */
router.post('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { layout, labelIds, format = 'pdf' } = req.body;

    if (!layout || !labelIds) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing layout or labelIds',
      };
      res.status(400).json(response);
      return;
    }

    // Fetch labels
    const labels = await Promise.all(
      labelIds.map((id: string) => StorageService.getLabel(id))
    );

    const validLabels = labels.filter((l) => l !== null);

    if (validLabels.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No valid labels found',
      };
      res.status(404).json(response);
      return;
    }

    if (format === 'pdf') {
      const pdfBuffer = await PrintService.generatePDF(layout, validLabels);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=labels.pdf');
      res.send(pdfBuffer);
    } else {
      const response: ApiResponse = {
        success: false,
        error: `Format ${format} not yet supported`,
      };
      res.status(400).json(response);
    }
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/print/formats - Get available paper formats
 */
router.get('/formats', (_req: Request, res: Response) => {
  try {
    const formats = PrintService.getAvailableFormats();

    const response: ApiResponse = {
      success: true,
      data: formats,
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
 * POST /api/print/calculate-grid - Calculate optimal grid layout
 */
router.post('/calculate-grid', (req: Request, res: Response): void => {
  try {
    const { paperFormat, labelCount, labelWidth, labelHeight } = req.body;

    if (!paperFormat || !labelCount) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing paperFormat or labelCount',
      };
      res.status(400).json(response);
      return;
    }

    const grid = PrintService.calculateOptimalGrid(
      paperFormat,
      labelCount,
      labelWidth,
      labelHeight
    );

    const response: ApiResponse = {
      success: true,
      data: grid,
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
 * GET /api/print/templates - Get all print templates
 */
router.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Ensure directory exists
    await fs.mkdir(PRINT_TEMPLATES_DIR, { recursive: true });

    // Read all template files
    const files = await fs.readdir(PRINT_TEMPLATES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const templates = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(PRINT_TEMPLATES_DIR, file), 'utf-8');
        return JSON.parse(content);
      })
    );

    const response: ApiResponse = {
      success: true,
      data: templates,
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to load print templates:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/print/templates - Create/Update print template
 */
router.post('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const template = req.body;

    // Ensure directory exists
    await fs.mkdir(PRINT_TEMPLATES_DIR, { recursive: true });

    // Generate ID if not provided
    if (!template.id) {
      template.id = uuidv4();
    }

    // Add timestamps
    if (!template.createdAt) {
      template.createdAt = new Date().toISOString();
    }
    template.updatedAt = new Date().toISOString();

    // Save template
    const filePath = path.join(PRINT_TEMPLATES_DIR, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));

    console.log(`✅ Print template saved: ${template.name || template.id}`);

    const response: ApiResponse = {
      success: true,
      data: template,
      message: 'Template saved successfully',
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Failed to save print template:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/print/templates/:id - Get specific print template
 */
router.get('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filePath = path.join(PRINT_TEMPLATES_DIR, `${id}.json`);

    const content = await fs.readFile(filePath, 'utf-8');
    const template = JSON.parse(content);

    const response: ApiResponse = {
      success: true,
      data: template,
    };

    res.json(response);
  } catch (error) {
    console.error(`Failed to load print template ${req.params.id}:`, error);
    const response: ApiResponse = {
      success: false,
      error: 'Template not found',
    };
    res.status(404).json(response);
  }
});

/**
 * DELETE /api/print/templates/:id - Delete print template
 */
router.delete('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filePath = path.join(PRINT_TEMPLATES_DIR, `${id}.json`);

    await fs.unlink(filePath);

    console.log(`✅ Print template deleted: ${id}`);

    const response: ApiResponse = {
      success: true,
      message: 'Template deleted successfully',
    };

    res.json(response);
  } catch (error) {
    console.error(`Failed to delete print template ${req.params.id}:`, error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export default router;
