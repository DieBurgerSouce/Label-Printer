/**
 * Product Service Tests
 * Tests for product creation from OCR results
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data inside factory to avoid hoisting issues
vi.mock('../../src/lib/prisma.js', () => {
  const mockProduct = {
    id: 'prod-123',
    articleNumber: 'ART-001',
    productName: 'Test Product',
    description: 'A test product description',
    price: 29.99,
    priceType: 'normal',
    tieredPrices: [],
    imageUrl: 'https://example.com/image.jpg',
    category: null,
    ean: null,
    sourceUrl: 'https://shop.example.com/product/ART-001',
    crawlJobId: 'job-123',
    ocrConfidence: 0.95,
    verified: false,
    published: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  return {
    prisma: {
      product: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([mockProduct]),
        create: vi.fn().mockImplementation((args) =>
          Promise.resolve({
            ...mockProduct,
            ...args.data,
            id: 'new-prod-' + Date.now(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        ),
        update: vi.fn().mockImplementation((args) =>
          Promise.resolve({
            ...mockProduct,
            ...args.data,
            updatedAt: new Date(),
          })
        ),
        count: vi.fn().mockResolvedValue(100),
        groupBy: vi.fn().mockResolvedValue([
          { category: 'Electronics', _count: 50 },
          { category: 'Tools', _count: 30 },
        ]),
      },
      ocrResult: {
        findMany: vi.fn().mockResolvedValue([]),
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

import { ProductService } from '../../src/services/product-service';
import { prisma } from '../../src/lib/prisma';

describe('ProductService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrUpdateFromOcr', () => {
    const mockOcrResult = {
      id: 'ocr-123',
      screenshotId: 'screenshot-123',
      status: 'completed' as const,
      articleNumber: 'ART-001',
      productName: 'Test Product',
      fullText: 'Full product description text',
      price: 29.99,
      tieredPrices: [],
      ean: '1234567890123',
      confidence: 0.95,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobId: null,
      rawText: null,
      error: null,
      tieredPricesText: null,
    };

    const mockScreenshot = {
      id: 'screenshot-123',
      productUrl: 'https://shop.example.com/product',
      productName: 'Screenshot Product Name',
      imageUrl: '/images/product.jpg',
      thumbnailUrl: '/images/product-thumb.jpg',
      crawlJobId: 'job-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      imagePath: null,
      width: null,
      height: null,
    };

    it('should create a new product from OCR result', async () => {
      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: mockOcrResult,
        screenshot: mockScreenshot,
        crawlJobId: 'job-123',
      });

      expect(result).not.toBeNull();
      expect(prisma.product.create).toHaveBeenCalled();
      expect(result?.articleNumber).toBe('ART-001');
    });

    it('should skip if OCR status is not completed', async () => {
      const failedOcrResult = { ...mockOcrResult, status: 'failed' as const };

      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: failedOcrResult,
        screenshot: mockScreenshot,
      });

      expect(result).toBeNull();
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('should skip if no article number found', async () => {
      const noArticleOcr = { ...mockOcrResult, articleNumber: null };

      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: noArticleOcr,
        screenshot: mockScreenshot,
      });

      expect(result).toBeNull();
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('should skip if no product name and no description', async () => {
      const noDataOcr = {
        ...mockOcrResult,
        productName: null,
        fullText: null,
      };
      const noNameScreenshot = { ...mockScreenshot, productName: null };

      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: noDataOcr,
        screenshot: noNameScreenshot,
      });

      expect(result).toBeNull();
    });

    it('should update existing product with higher confidence', async () => {
      const existingProduct = {
        id: 'existing-prod-123',
        articleNumber: 'ART-001',
        productName: 'Old Product Name',
        ocrConfidence: 0.5,
        imageUrl: '/old-image.jpg',
        thumbnailUrl: '/old-thumb.jpg',
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(existingProduct as any);

      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: mockOcrResult,
        screenshot: mockScreenshot,
      });

      expect(prisma.product.update).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should force-update broken products with placeholder names', async () => {
      const brokenProduct = {
        id: 'broken-prod-123',
        articleNumber: 'ART-001',
        productName: 'Product ART-001', // Placeholder name
        ocrConfidence: 0.99, // Even with high confidence
        imageUrl: null,
        thumbnailUrl: null,
        description: '',
        price: 0,
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(brokenProduct as any);

      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: mockOcrResult,
        screenshot: mockScreenshot,
      });

      expect(prisma.product.update).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should preserve existing images if new data has none', async () => {
      const existingWithImage = {
        id: 'existing-prod-123',
        articleNumber: 'ART-001',
        productName: 'Product 123', // Placeholder triggers update
        ocrConfidence: 0.5,
        imageUrl: '/existing-image.jpg',
        thumbnailUrl: '/existing-thumb.jpg',
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(existingWithImage as any);

      const screenshotNoImages = {
        ...mockScreenshot,
        imageUrl: null,
        thumbnailUrl: null,
      };

      await ProductService.createOrUpdateFromOcr({
        ocrResult: mockOcrResult,
        screenshot: screenshotNoImages,
      });

      const updateCall = vi.mocked(prisma.product.update).mock.calls[0];
      expect(updateCall[0].data.imageUrl).toBe('/existing-image.jpg');
      expect(updateCall[0].data.thumbnailUrl).toBe('/existing-thumb.jpg');
    });

    it('should return null on database error', async () => {
      vi.mocked(prisma.product.findUnique).mockRejectedValueOnce(new Error('DB Error'));

      const result = await ProductService.createOrUpdateFromOcr({
        ocrResult: mockOcrResult,
        screenshot: mockScreenshot,
      });

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return product statistics', async () => {
      const stats = await ProductService.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('withImages');
      expect(stats).toHaveProperty('verified');
      expect(stats).toHaveProperty('categories');
      expect(stats.total).toBe(100);
    });

    it('should return category breakdown', async () => {
      const stats = await ProductService.getStats();

      expect(stats.categories).toHaveLength(2);
      expect(stats.categories[0].name).toBe('Electronics');
      expect(stats.categories[0].count).toBe(50);
    });
  });

  describe('search', () => {
    it('should search products by article number, name, or description', async () => {
      const results = await ProductService.search('test');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ articleNumber: { contains: 'test', mode: 'insensitive' } }),
              expect.objectContaining({ productName: { contains: 'test', mode: 'insensitive' } }),
              expect.objectContaining({ description: { contains: 'test', mode: 'insensitive' } }),
            ]),
            published: true,
          }),
        })
      );

      expect(results).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      await ProductService.search('test', 10);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should use default limit of 20', async () => {
      await ProductService.search('test');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });
  });

  describe('batchCreateFromOcr', () => {
    it('should process multiple OCR results', async () => {
      const ocrResults = [
        {
          id: 'ocr-1',
          screenshotId: 'ss-1',
          status: 'completed' as const,
          articleNumber: 'ART-001',
          productName: 'Product 1',
          fullText: 'Description 1',
          price: 10.0,
          confidence: 0.9,
          createdAt: new Date(),
          updatedAt: new Date(),
          tieredPrices: [],
          ean: null,
          jobId: null,
          rawText: null,
          error: null,
          tieredPricesText: null,
          screenshot: {
            id: 'ss-1',
            productUrl: 'https://example.com/1',
            productName: null,
            imageUrl: '/img1.jpg',
            thumbnailUrl: null,
            crawlJobId: 'job-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            imagePath: null,
            width: null,
            height: null,
          },
        },
        {
          id: 'ocr-2',
          screenshotId: 'ss-2',
          status: 'completed' as const,
          articleNumber: 'ART-002',
          productName: 'Product 2',
          fullText: 'Description 2',
          price: 20.0,
          confidence: 0.85,
          createdAt: new Date(),
          updatedAt: new Date(),
          tieredPrices: [],
          ean: null,
          jobId: null,
          rawText: null,
          error: null,
          tieredPricesText: null,
          screenshot: {
            id: 'ss-2',
            productUrl: 'https://example.com/2',
            productName: null,
            imageUrl: '/img2.jpg',
            thumbnailUrl: null,
            crawlJobId: 'job-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            imagePath: null,
            width: null,
            height: null,
          },
        },
      ];

      const results = await ProductService.batchCreateFromOcr(ocrResults, 'job-123');

      expect(results).toHaveProperty('created');
      expect(results).toHaveProperty('updated');
      expect(results).toHaveProperty('skipped');
      expect(results).toHaveProperty('errors');
    });
  });
});
