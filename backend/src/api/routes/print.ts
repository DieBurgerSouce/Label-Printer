/**
 * Print & Export API Routes
 */

import { Router, Request, Response } from 'express';
import { PrintService } from '../../services/print-service.js';
import { StorageService } from '../../services/storage-service.js';
import { ApiResponse, PriceLabel } from '../../types/label-types.js';
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
    console.log('🔍 Preview request received:', JSON.stringify(req.body, null, 2));
    const { layout, labelIds, format, gridConfig, customWidth, customHeight } = req.body;

    console.log('📋 Debugging request structure:');
    console.log('  - layout:', layout ? 'present' : 'missing');
    console.log('  - labelIds:', labelIds ? `present (${Array.isArray(labelIds) ? labelIds.length : 'not array'} items)` : 'missing');
    console.log('  - labelIds value:', labelIds);
    console.log('  - format:', format || 'missing');
    console.log('  - gridConfig:', gridConfig ? 'present' : 'missing');

    // Support both old format (layout + labelIds) and new format (flat structure)
    let printLayout;
    let labelIdArray;

    // Check if labelIds is an empty array
    const hasLabelIds = labelIds && Array.isArray(labelIds) && labelIds.length > 0;
    console.log('  - hasLabelIds:', hasLabelIds);

    if (layout && labelIds) {
      // Old format
      printLayout = layout;
      labelIdArray = labelIds;
    } else if (hasLabelIds && (format || gridConfig)) {
      // New format from frontend
      labelIdArray = labelIds;

      // Build layout from flat structure
      const paperFormat = format || 'A4';
      const formatDimensions = {
        A3: { width: 297, height: 420 },
        A4: { width: 210, height: 297 },
        A5: { width: 148, height: 210 },
        Letter: { width: 216, height: 279 },
      };

      printLayout = {
        paperFormat: {
          type: paperFormat,
          width: customWidth || formatDimensions[paperFormat as keyof typeof formatDimensions]?.width || 210,
          height: customHeight || formatDimensions[paperFormat as keyof typeof formatDimensions]?.height || 297,
        },
        gridLayout: {
          columns: gridConfig?.columns || 2,
          rows: gridConfig?.rows || 3,
          spacing: gridConfig?.spacing || 5,
          margins: {
            top: gridConfig?.marginTop || 10,
            bottom: gridConfig?.marginBottom || 10,
            left: gridConfig?.marginLeft || 10,
            right: gridConfig?.marginRight || 10,
          },
        },
        settings: {
          showCutMarks: false,
          showBorders: false,
        },
      };
    } else {
      // More specific error message
      let errorMsg = 'Invalid request: ';
      if (!labelIds || !Array.isArray(labelIds)) {
        errorMsg += 'labelIds must be an array';
      } else if (labelIds.length === 0) {
        errorMsg += 'labelIds array is empty. Please select labels from Label Library first.';
      } else if (!format && !gridConfig && !layout) {
        errorMsg += 'missing format, gridConfig, or layout';
      } else {
        errorMsg += 'unknown validation error';
      }

      console.log('❌ Validation failed:', errorMsg);

      const response: ApiResponse = {
        success: false,
        error: errorMsg,
      };
      res.status(400).json(response);
      return;
    }

    // Fetch labels in batches to avoid memory explosion
    console.log(`📦 Loading ${labelIdArray.length} labels in batches...`);
    const labels: (PriceLabel | null)[] = [];
    const LOAD_BATCH_SIZE = 100;

    for (let i = 0; i < labelIdArray.length; i += LOAD_BATCH_SIZE) {
      const batchIds = labelIdArray.slice(i, i + LOAD_BATCH_SIZE);
      const batch = await Promise.all(
        batchIds.map((id: string) => StorageService.getLabel(id))
      );
      labels.push(...batch);

      const progress = Math.min(i + LOAD_BATCH_SIZE, labelIdArray.length);
      console.log(`✅ Loaded ${progress}/${labelIdArray.length} labels`);
    }

    const validLabels = labels.filter((l) => l !== null);

    if (validLabels.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No valid labels found',
      };
      res.status(404).json(response);
      return;
    }

    const preview = await PrintService.generatePreview(printLayout, validLabels);

    const response: ApiResponse = {
      success: true,
      data: {
        previewUrl: preview, // ✅ Match frontend expectation
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
    const { layout, labelIds, format, gridConfig, customWidth, customHeight, outputFormat } = req.body;

    // Support both old format (layout + labelIds) and new format (flat structure)
    let printLayout;
    let labelIdArray;
    let exportFormat = outputFormat || 'pdf'; // Output format: pdf, png, etc.

    if (layout && labelIds) {
      // Old format (used by exportPDF function)
      printLayout = layout;
      labelIdArray = labelIds;
      exportFormat = format || exportFormat; // In old format, 'format' means output format
    } else if (labelIds && (format || gridConfig)) {
      // New format from frontend
      labelIdArray = labelIds;

      // In new format: 'format' is the PAPER format (A4, A3, etc.)
      const paperFormat = format || 'A4';
      const formatDimensions = {
        A3: { width: 297, height: 420 },
        A4: { width: 210, height: 297 },
        A5: { width: 148, height: 210 },
        Letter: { width: 216, height: 279 },
      };

      printLayout = {
        paperFormat: {
          type: paperFormat,
          width: customWidth || formatDimensions[paperFormat as keyof typeof formatDimensions]?.width || 210,
          height: customHeight || formatDimensions[paperFormat as keyof typeof formatDimensions]?.height || 297,
        },
        gridLayout: {
          columns: gridConfig?.columns || 2,
          rows: gridConfig?.rows || 3,
          spacing: gridConfig?.spacing || 5,
          margins: {
            top: gridConfig?.marginTop || 10,
            bottom: gridConfig?.marginBottom || 10,
            left: gridConfig?.marginLeft || 10,
            right: gridConfig?.marginRight || 10,
          },
        },
        settings: {
          showCutMarks: false,
          showBorders: false,
        },
      };
    } else {
      const response: ApiResponse = {
        success: false,
        error: 'Missing layout or labelIds',
      };
      res.status(400).json(response);
      return;
    }

    // Fetch labels in batches to avoid memory explosion
    console.log(`📦 Loading ${labelIdArray.length} labels in batches...`);
    const labels: (PriceLabel | null)[] = [];
    const LOAD_BATCH_SIZE = 100;

    for (let i = 0; i < labelIdArray.length; i += LOAD_BATCH_SIZE) {
      const batchIds = labelIdArray.slice(i, i + LOAD_BATCH_SIZE);
      const batch = await Promise.all(
        batchIds.map((id: string) => StorageService.getLabel(id))
      );
      labels.push(...batch);

      const progress = Math.min(i + LOAD_BATCH_SIZE, labelIdArray.length);
      console.log(`✅ Loaded ${progress}/${labelIdArray.length} labels`);
    }

    const validLabels = labels.filter((l) => l !== null);

    if (validLabels.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No valid labels found',
      };
      res.status(404).json(response);
      return;
    }

    if (exportFormat === 'pdf') {
      console.log(`📄 Generating PDF for ${validLabels.length} labels...`);
      const pdfBuffer = await PrintService.generatePDF(printLayout, validLabels);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=labels.pdf');
      res.send(pdfBuffer);
    } else {
      const response: ApiResponse = {
        success: false,
        error: `Output format ${exportFormat} not yet supported`,
      };
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('❌ PDF Export Error:', error);
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
