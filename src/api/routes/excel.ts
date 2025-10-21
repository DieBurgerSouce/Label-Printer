import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs-extra';
import { createLogger } from '../../utils/logger';
import { getExcelParserService } from '../../services/excel-parser-service';
import { ValidationError } from '../../types/label-types';

const logger = createLogger('ExcelAPI');
const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: './uploads/excel',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return cb(new Error('Only Excel files are allowed (.xlsx, .xls, .csv)'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/excel/upload
 * Upload and parse Excel file
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const excelService = getExcelParserService();
    const result = await excelService.parseExcelFile(req.file.path);

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.json({
      success: true,
      data: {
        totalRows: result.totalRows,
        successfulProducts: result.products.size,
        errors: result.errors,
        warnings: result.warnings,
      },
      message: `Successfully parsed ${result.products.size} products`,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }

    logger.error('Failed to upload and parse Excel', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload and parse Excel',
    });
  }
});

/**
 * POST /api/excel/validate
 * Validate Excel file format without importing
 */
router.post('/validate', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const excelService = getExcelParserService();
    const validation = await excelService.validateExcelFile(req.file.path);

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }

    logger.error('Failed to validate Excel', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate Excel',
    });
  }
});

/**
 * GET /api/excel/products
 * Get all product descriptions
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const excelService = getExcelParserService();
    const products = excelService.getAllProducts();

    // Optional filtering
    const category = req.query.category as string;
    const search = req.query.search as string;

    let filteredProducts = products;

    if (category) {
      filteredProducts = excelService.getProductsByCategory(category);
    }

    if (search) {
      filteredProducts = excelService.searchProducts(search);
    }

    res.json({
      success: true,
      data: filteredProducts,
      count: filteredProducts.length,
    });
  } catch (error) {
    logger.error('Failed to get products', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get products',
    });
  }
});

/**
 * GET /api/excel/product/:articleNumber
 * Get product description by article number
 */
router.get('/product/:articleNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const excelService = getExcelParserService();
    const product = excelService.getProductDescription(req.params.articleNumber);

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    logger.error('Failed to get product', { articleNumber: req.params.articleNumber, error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get product',
    });
  }
});

/**
 * PUT /api/excel/product/:articleNumber
 * Update product description
 */
router.put('/product/:articleNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const excelService = getExcelParserService();
    const updates = req.body;

    const success = await excelService.updateProductDescription(req.params.articleNumber, updates);

    if (!success) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    const updated = excelService.getProductDescription(req.params.articleNumber);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error('Failed to update product', { articleNumber: req.params.articleNumber, error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product',
    });
  }
});

/**
 * POST /api/excel/product
 * Add new product description
 */
router.post('/product', async (req: Request, res: Response) => {
  try {
    const { articleNumber, description, additionalInfo, category, customFields } = req.body;

    if (!articleNumber || !description) {
      throw new ValidationError('Missing required fields: articleNumber, description');
    }

    const excelService = getExcelParserService();

    await excelService.addProductDescription({
      articleNumber,
      description,
      additionalInfo,
      category,
      customFields,
    });

    const product = excelService.getProductDescription(articleNumber);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    logger.error('Failed to add product', { error });
    res.status(error instanceof ValidationError ? 400 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add product',
    });
  }
});

/**
 * DELETE /api/excel/product/:articleNumber
 * Delete product description
 */
router.delete('/product/:articleNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const excelService = getExcelParserService();
    const success = await excelService.deleteProductDescription(req.params.articleNumber);

    if (!success) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete product', { articleNumber: req.params.articleNumber, error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete product',
    });
  }
});

/**
 * DELETE /api/excel/cache
 * Clear product cache
 */
router.delete('/cache', async (_req: Request, res: Response) => {
  try {
    const excelService = getExcelParserService();
    await excelService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    logger.error('Failed to clear cache', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache',
    });
  }
});

/**
 * GET /api/excel/stats
 * Get cache statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const excelService = getExcelParserService();
    const stats = excelService.getCacheStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

/**
 * GET /api/excel/template
 * Download Excel template
 */
router.get('/template', async (_req: Request, res: Response) => {
  try {
    const excelService = getExcelParserService();
    const templatePath = path.join('./data', 'template.xlsx');

    // Create template with sample data
    await excelService.exportToExcel(templatePath, [
      {
        articleNumber: 'SAMPLE-001',
        description: 'Sample Product 1',
        additionalInfo: 'This is a sample product',
        category: 'Sample Category',
      },
      {
        articleNumber: 'SAMPLE-002',
        description: 'Sample Product 2',
        additionalInfo: 'Another sample product',
        category: 'Sample Category',
      },
    ]);

    res.download(templatePath, 'product-import-template.xlsx', async (err) => {
      // Clean up template file
      await fs.remove(templatePath).catch(() => {});

      if (err) {
        logger.error('Failed to download template', { error: err });
      }
    });
  } catch (error) {
    logger.error('Failed to generate template', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate template',
    });
  }
});

/**
 * GET /api/excel/export
 * Export products to Excel
 */
router.get('/export', async (_req: Request, res: Response) => {
  try {
    const excelService = getExcelParserService();
    const exportPath = path.join('./data', `products-export-${Date.now()}.xlsx`);

    await excelService.exportToExcel(exportPath);

    res.download(exportPath, 'products-export.xlsx', async (err) => {
      // Clean up export file
      await fs.remove(exportPath).catch(() => {});

      if (err) {
        logger.error('Failed to download export', { error: err });
      }
    });
  } catch (error) {
    logger.error('Failed to export products', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export products',
    });
  }
});

export default router;
