/**
 * Excel Import API Routes
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ExcelParserService } from '../../services/excel-parser-service.js';
import { ApiResponse } from '../../types/label-types.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/excel/upload - Upload and parse Excel file
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        error: 'No file uploaded',
      };
      res.status(400).json(response);
      return;
    }

    const result = await ExcelParserService.parseExcel(req.file.buffer);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: `Parsed ${result.validRows} products successfully`,
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
 * GET /api/excel/products - Get all products
 */
router.get('/products', (_req: Request, res: Response) => {
  try {
    const products = ExcelParserService.getAllProducts();

    const response: ApiResponse = {
      success: true,
      data: products,
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
 * GET /api/excel/product/:articleNumber - Get single product
 */
router.get('/product/:articleNumber', (req: Request, res: Response): void => {
  try {
    const product = ExcelParserService.getProduct(req.params.articleNumber);

    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: product,
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
 * PUT /api/excel/product/:articleNumber - Update product
 */
router.put('/product/:articleNumber', (req: Request, res: Response): void => {
  try {
    const existing = ExcelParserService.getProduct(req.params.articleNumber);

    if (!existing) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found',
      };
      res.status(404).json(response);
      return;
    }

    const updated = {
      ...existing,
      ...req.body,
      articleNumber: req.params.articleNumber, // Prevent articleNumber change
    };

    ExcelParserService.saveProduct(updated);

    const response: ApiResponse = {
      success: true,
      data: updated,
      message: 'Product updated successfully',
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
 * POST /api/excel/product - Add new product
 */
router.post('/product', (req: Request, res: Response) => {
  try {
    ExcelParserService.saveProduct(req.body);

    const response: ApiResponse = {
      success: true,
      data: req.body,
      message: 'Product added successfully',
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
 * DELETE /api/excel/product/:articleNumber - Delete product
 */
router.delete('/product/:articleNumber', (req: Request, res: Response): void => {
  try {
    const success = ExcelParserService.deleteProduct(req.params.articleNumber);

    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Product deleted successfully',
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
 * DELETE /api/excel/cache - Clear cache
 */
router.delete('/cache', (_req: Request, res: Response) => {
  try {
    ExcelParserService.clearCache();

    const response: ApiResponse = {
      success: true,
      message: 'Cache cleared successfully',
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
 * GET /api/excel/stats - Get cache statistics
 */
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const stats = ExcelParserService.getStats();

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
 * GET /api/excel/template - Download Excel template
 */
router.get('/template', (_req: Request, res: Response) => {
  try {
    const buffer = ExcelParserService.generateTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
    res.send(buffer);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/excel/export - Export to Excel
 */
router.get('/export', (_req: Request, res: Response) => {
  try {
    const buffer = ExcelParserService.exportToExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
    res.send(buffer);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export default router;
