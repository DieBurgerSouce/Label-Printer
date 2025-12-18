/**
 * Article Service Tests
 * Tests for article retrieval from PostgreSQL via Prisma
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data must be inside the factory to avoid hoisting issues
vi.mock('../../src/lib/prisma.js', () => {
  const mockProduct = {
    id: 'prod-123',
    articleNumber: 'ART-001',
    productName: 'Test Product',
    description: 'A test product description',
    price: 29.99,
    currency: 'EUR',
    imageUrl: 'https://example.com/image.jpg',
    category: 'Electronics',
    tieredPrices: [
      { quantity: 10, price: 27.99 },
      { quantity: 50, price: 25.99 },
    ],
    tieredPricesText: 'ab 10 Stück: 27,99 EUR\nab 50 Stück: 25,99 EUR',
    sourceUrl: 'https://shop.example.com/product/ART-001',
    published: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  return {
    prisma: {
      product: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.OR) {
            const idMatch = where.OR.find((c: { id?: string }) => c.id === 'prod-123');
            const articleMatch = where.OR.find((c: { articleNumber?: string }) =>
              c.articleNumber === 'ART-001'
            );
            if (idMatch || articleMatch) {
              return Promise.resolve(mockProduct);
            }
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockResolvedValue([
          mockProduct,
          {
            ...mockProduct,
            id: 'prod-456',
            articleNumber: 'ART-002',
            productName: 'Second Product',
            tieredPrices: null,
            tieredPricesText: null,
          },
        ]),
      },
    },
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ArticleService } from '../../src/services/article-service';

describe('ArticleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getArticleById', () => {
    it('should return article by ID', async () => {
      const article = await ArticleService.getArticleById('prod-123');

      expect(article).not.toBeNull();
      expect(article?.id).toBe('prod-123');
      expect(article?.articleNumber).toBe('ART-001');
      expect(article?.productName).toBe('Test Product');
    });

    it('should return article by article number', async () => {
      const article = await ArticleService.getArticleById('ART-001');

      expect(article).not.toBeNull();
      expect(article?.articleNumber).toBe('ART-001');
    });

    it('should return null for non-existent article', async () => {
      const article = await ArticleService.getArticleById('non-existent');

      expect(article).toBeNull();
    });

    it('should convert price to number', async () => {
      const article = await ArticleService.getArticleById('prod-123');

      expect(typeof article?.price).toBe('number');
      expect(article?.price).toBe(29.99);
    });

    it('should parse tiered prices from JSON', async () => {
      const article = await ArticleService.getArticleById('prod-123');

      expect(article?.tieredPrices).toBeDefined();
      expect(article?.tieredPrices).toHaveLength(2);
      expect(article?.tieredPrices?.[0].quantity).toBe(10);
      expect(article?.tieredPrices?.[0].price).toBe(27.99);
    });

    it('should include all optional fields when present', async () => {
      const article = await ArticleService.getArticleById('prod-123');

      expect(article?.description).toBe('A test product description');
      expect(article?.imageUrl).toBe('https://example.com/image.jpg');
      expect(article?.category).toBe('Electronics');
      expect(article?.tieredPricesText).toContain('ab 10 Stück');
      expect(article?.sourceUrl).toBe('https://shop.example.com/product/ART-001');
    });

    it('should default currency to EUR', async () => {
      const article = await ArticleService.getArticleById('prod-123');

      expect(article?.currency).toBe('EUR');
    });
  });

  describe('getAllArticles', () => {
    it('should return all published articles', async () => {
      const articles = await ArticleService.getAllArticles();

      expect(articles).toHaveLength(2);
      expect(articles[0].articleNumber).toBe('ART-001');
      expect(articles[1].articleNumber).toBe('ART-002');
    });

    it('should handle articles without tiered prices', async () => {
      const articles = await ArticleService.getAllArticles();

      const secondArticle = articles.find(a => a.articleNumber === 'ART-002');
      expect(secondArticle?.tieredPrices).toBeUndefined();
    });

    it('should return empty array on error', async () => {
      const { prisma } = await import('../../src/lib/prisma.js');
      vi.mocked(prisma.product.findMany).mockRejectedValueOnce(new Error('DB Error'));

      const articles = await ArticleService.getAllArticles();

      expect(articles).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should return null on database error in getArticleById', async () => {
      const { prisma } = await import('../../src/lib/prisma.js');
      vi.mocked(prisma.product.findFirst).mockRejectedValueOnce(new Error('Connection failed'));

      const article = await ArticleService.getArticleById('any-id');

      expect(article).toBeNull();
    });
  });
});
