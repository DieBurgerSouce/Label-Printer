/**
 * Print & Export API Routes
 */

import { Router, Request, Response } from 'express';
import { PrintService } from '../../services/print-service.js';
import { StorageService } from '../../services/storage-service.js';
import { ApiResponse } from '../../types/label-types.js';

const router = Router();

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

export default router;
