/**
 * Articles API Routes
 * ✅ FIXED: Now uses PostgreSQL Database via Prisma!
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const router = Router();

// ========================================
// VALIDATION SCHEMAS
// ========================================

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(2000).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  verified: z.coerce.boolean().optional(),
  published: z.coerce.boolean().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'articleNumber', 'productName', 'price'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ========================================
// ROUTES
// ========================================

/**
 * GET /api/articles
 * List all products from DATABASE with pagination, filtering, and search
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const { page, limit, search, published, category, verified, sortBy, sortOrder } = query;

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
      ];
    }

    // Get total count
    const total = await prisma.product.count({ where });

    // Get paginated articles
    const skip = (page - 1) * limit;
    const articles = await prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    console.log(`✅ Loaded ${articles.length} articles from DATABASE (total: ${total})`);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);

    // Return paginated response
    res.json({
      data: articles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    res.status(500).json({
      error: 'Failed to fetch articles',
      message: error.message,
    });
  }
});

/**
 * GET /api/articles/stats
 * Get statistics about articles from DATABASE
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [total, published, withImages, withPrices, categories] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { published: true } }),
      prisma.product.count({ where: { imageUrl: { not: null } } }),
      prisma.product.count({
        where: {
          OR: [{ price: { gt: 0 } }, { tieredPrices: { not: { equals: [] } } }],
        },
      }),
      prisma.product.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      }),
    ]);

    const stats = {
      total,
      published,
      withImages,
      withPrices,
      verified: await prisma.product.count({ where: { verified: true } }),
      categories: categories.map((c) => c.category).filter(Boolean),
    };

    return res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/articles/:id
 * Get a single article by ID or articleNumber from DATABASE
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try to find by ID first, then by articleNumber
    const article = await prisma.product.findFirst({
      where: {
        OR: [{ id }, { articleNumber: id }],
      },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    return res.json(article);
  } catch (error: any) {
    console.error('Error fetching article:', error);
    return res.status(500).json({
      error: 'Failed to fetch article',
      message: error.message,
    });
  }
});

/**
 * PUT /api/articles/:id
 * Update an article in DATABASE
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find article
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ id }, { articleNumber: id }],
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Update article
    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating article:', error);
    res.status(500).json({
      error: 'Failed to update article',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/articles/:id
 * Delete an article from DATABASE
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find article
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ id }, { articleNumber: id }],
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Delete article
    await prisma.product.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting article:', error);
    res.status(500).json({
      error: 'Failed to delete article',
      message: error.message,
    });
  }
});

/**
 * POST /api/articles
 * Create a new article in DATABASE
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const articleData = req.body;

    // Create article
    const created = await prisma.product.create({
      data: {
        ...articleData,
        createdAt: articleData.createdAt ? new Date(articleData.createdAt) : new Date(),
        updatedAt: new Date(),
      },
    });

    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating article:', error);
    res.status(500).json({
      error: 'Failed to create article',
      message: error.message,
    });
  }
});

export default router;
