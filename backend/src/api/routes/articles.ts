/**
 * Articles API Routes
 * CRUD operations for managing crawled products
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/supabase.js';
import { z } from 'zod';
import { DynamicExcelImportService } from '../../services/dynamic-excel-import.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ========================================
// VALIDATION SCHEMAS
// ========================================

const productBaseSchema = z.object({
  articleNumber: z.string().min(1),
  productName: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0).nullable().optional(),
  tieredPrices: z.array(z.object({
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })).optional(),
  tieredPricesText: z.string().optional(), // Raw OCR text for label formatting (e.g., "ab 7 Stück: 190,92 EUR\nab 24 Stück: 180,60 EUR")
  currency: z.string().default('EUR'),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  ean: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  sourceUrl: z.string().url(),
  crawlJobId: z.string().uuid().optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  verified: z.boolean().default(false),
  published: z.boolean().default(true)
});

const createProductSchema = productBaseSchema.refine(
  (data) => {
    // Either price or tieredPrices must be provided (but not necessarily both)
    const hasPrice = data.price !== null && data.price !== undefined && data.price > 0;
    const hasTieredPrices = data.tieredPrices && data.tieredPrices.length > 0;
    return hasPrice || hasTieredPrices;
  },
  {
    message: "Either price or tieredPrices must be provided",
    path: ["price"]
  }
);

const updateProductSchema = productBaseSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  verified: z.coerce.boolean().optional(),
  published: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'articleNumber', 'productName', 'price']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ========================================
// ROUTES
// ========================================

/**
 * GET /api/articles
 * List all products with pagination, filtering, and search
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);

    const { page, limit, search, category, verified, published, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (published !== undefined) {
      where.published = published;
    }

    if (verified !== undefined) {
      where.verified = verified;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { articleNumber: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.product.count({ where });

    // Get paginated results
    const products = await prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    });

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch products'
    });
  }
});

/**
 * GET /api/articles/stats
 * Get statistics about products
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [total, withImages, verified, published, categories] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { imageUrl: { not: null } } }),
      prisma.product.count({ where: { verified: true } }),
      prisma.product.count({ where: { published: true } }),
      prisma.product.groupBy({
        by: ['category'],
        _count: true,
        where: { category: { not: null } }
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        withImages,
        verified,
        published,
        categories: categories.map(c => ({
          name: c.category,
          count: c._count
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product statistics'
    });
  }
});

/**
 * GET /api/articles/:id
 * Get a single product by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * POST /api/articles
 * Create a new product
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createProductSchema.parse(req.body);

    // Check if article number already exists
    const existing = await prisma.product.findUnique({
      where: { articleNumber: data.articleNumber }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Article number already exists'
      });
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        tieredPrices: data.tieredPrices || []
      }
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create product'
    });
  }
});

/**
 * PUT /api/articles/:id
 * Update a product
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateProductSchema.parse(req.body);

    // If article number is being changed, check if it already exists
    if (data.articleNumber) {
      const existing = await prisma.product.findFirst({
        where: {
          articleNumber: data.articleNumber,
          id: { not: id }
        }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Article number already exists'
        });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data
    });

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product'
    });
  }
});

/**
 * DELETE /api/articles/:id
 * Delete a product
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete product'
    });
  }
});

/**
 * POST /api/articles/bulk-delete
 * Delete multiple products
 */
router.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids must be a non-empty array'
      });
    }

    const result = await prisma.product.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    res.json({
      success: true,
      message: `Deleted ${result.count} products`,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error bulk deleting products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete products'
    });
  }
});

/**
 * POST /api/articles/bulk-update
 * Update multiple products
 */
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { ids, data } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids must be a non-empty array'
      });
    }

    const updateData = updateProductSchema.parse(data);

    const result = await prisma.product.updateMany({
      where: {
        id: { in: ids }
      },
      data: updateData
    });

    res.json({
      success: true,
      message: `Updated ${result.count} products`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update products'
    });
  }
});

/**
 * POST /api/articles/export
 * Export products as CSV/Excel
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { ids, format = 'csv' } = req.body;

    const where = ids && ids.length > 0 ? { id: { in: ids } } : {};

    const products = await prisma.product.findMany({
      where,
      orderBy: { articleNumber: 'asc' }
    });

    if (format === 'json') {
      res.json({
        success: true,
        data: products
      });
    } else if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Artikelnummer',
        'Produktname',
        'Beschreibung',
        'Preis',
        'Staffelpreise',
        'Währung',
        'EAN',
        'Kategorie',
        'Hersteller',
        'Bild-URL',
        'Quelle-URL',
        'Verifiziert'
      ];

      const rows = products.map(p => [
        p.articleNumber,
        p.productName,
        p.description || '',
        p.price,
        JSON.stringify(p.tieredPrices || []),
        p.currency,
        p.ean || '',
        p.category || '',
        p.manufacturer || '',
        p.imageUrl || '',
        p.sourceUrl,
        p.verified ? 'Ja' : 'Nein'
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="articles-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + csv); // BOM for Excel
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Supported formats: json, csv'
      });
    }
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export products'
    });
  }
});

// ========================================
// EXCEL IMPORT ROUTES
// ========================================

/**
 * POST /api/articles/excel-preview
 * Upload Excel file and get preview data
 */
router.post('/excel-preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const previewData = DynamicExcelImportService.parseExcelPreview(req.file.buffer);

    res.json({
      success: true,
      data: previewData
    });
  } catch (error) {
    console.error('Error previewing Excel:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview Excel file'
    });
  }
});

/**
 * POST /api/articles/excel-import
 * Import Excel data with dynamic field mapping
 */
router.post('/excel-import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Parse config from request body
    let config;
    try {
      config = typeof req.body.config === 'string'
        ? JSON.parse(req.body.config)
        : req.body.config;
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid config format'
      });
    }

    // Validate config
    const validation = DynamicExcelImportService.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: validation.errors
      });
    }

    // Perform import
    const result = await DynamicExcelImportService.importExcel(req.file.buffer, config);

    res.json({
      success: true,
      data: result,
      message: `Import completed: ${result.updatedArticles} articles updated, ${result.skippedArticles} skipped`
    });
  } catch (error) {
    console.error('Error importing Excel:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import Excel file'
    });
  }
});

/**
 * GET /api/articles/excel-valid-fields
 * Get list of valid database fields for mapping
 */
router.get('/excel-valid-fields', (_req: Request, res: Response) => {
  try {
    const fields = DynamicExcelImportService.getValidDbFields();

    res.json({
      success: true,
      data: fields
    });
  } catch (error) {
    console.error('Error getting valid fields:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get valid fields'
    });
  }
});

export default router;
