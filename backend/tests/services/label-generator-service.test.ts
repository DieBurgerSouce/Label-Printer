/**
 * Label Generator Service Tests
 * Tests for label creation, update, and extraction functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/services/excel-parser-service.js', () => ({
  ExcelParserService: {
    getProduct: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../src/services/ocr-service.js', () => ({
  ocrService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    processScreenshot: vi.fn().mockResolvedValue({
      extractedData: {
        articleNumber: 'OCR-12345',
        productName: 'OCR Extracted Product',
        description: 'Product extracted via OCR',
        price: '29.99',
        tieredPrices: [
          { quantity: 10, price: '27.99' },
          { quantity: 50, price: '25.99' },
        ],
      },
      confidence: { overall: 0.92 },
    }),
    workers: new Map(),
  },
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    label: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'label-123',
        data: {
          articleNumber: 'ART-001',
          productName: 'Test Product',
          priceInfo: { price: 19.99, currency: '€' },
        },
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }),
      update: vi.fn().mockImplementation((args) => Promise.resolve({
        id: args.where.id,
        data: args.data.data,
        status: args.data.status || 'completed',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        imageUrl: null,
      })),
    },
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    flatten: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { LabelGeneratorService } from '../../src/services/label-generator-service';

describe('LabelGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLabel', () => {
    it('should create a label with required fields', async () => {
      const labelData = {
        articleNumber: 'ART-001',
        productName: 'Test Product',
        priceInfo: {
          price: 19.99,
          currency: '€',
        },
      };

      const label = await LabelGeneratorService.createLabel(labelData);

      expect(label).toBeDefined();
      expect(label.id).toBeDefined();
      expect(label.articleNumber).toBe('ART-001');
      expect(label.productName).toBe('Test Product');
      expect(label.priceInfo.price).toBe(19.99);
      expect(label.priceInfo.currency).toBe('€');
      expect(label.templateType).toBe('standard');
      expect(label.source).toBe('manual');
    });

    it('should create a label with optional fields', async () => {
      const labelData = {
        articleNumber: 'ART-002',
        productName: 'Extended Product',
        description: 'A detailed description',
        priceInfo: {
          price: 29.99,
          currency: 'USD',
          unit: 'piece',
        },
        templateType: 'extended' as const,
        tags: ['sale', 'new'],
        category: 'Electronics',
        source: 'import' as const,
      };

      const label = await LabelGeneratorService.createLabel(labelData);

      expect(label.description).toBe('A detailed description');
      expect(label.priceInfo.unit).toBe('piece');
      expect(label.templateType).toBe('extended');
      expect(label.tags).toEqual(['sale', 'new']);
      expect(label.category).toBe('Electronics');
      expect(label.source).toBe('import');
    });

    it('should set default currency to €', async () => {
      const labelData = {
        articleNumber: 'ART-003',
        productName: 'Default Currency Product',
        priceInfo: {
          price: 9.99,
        },
      };

      const label = await LabelGeneratorService.createLabel(labelData);

      expect(label.priceInfo.currency).toBe('€');
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const before = new Date();

      const label = await LabelGeneratorService.createLabel({
        articleNumber: 'ART-004',
        productName: 'Timestamp Test',
        priceInfo: { price: 5.99 },
      });

      const after = new Date();

      expect(label.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(label.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(label.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should generate unique IDs for each label', async () => {
      const label1 = await LabelGeneratorService.createLabel({
        articleNumber: 'ART-005',
        productName: 'Product 1',
        priceInfo: { price: 10 },
      });

      const label2 = await LabelGeneratorService.createLabel({
        articleNumber: 'ART-006',
        productName: 'Product 2',
        priceInfo: { price: 20 },
      });

      expect(label1.id).not.toBe(label2.id);
    });
  });

  describe('duplicateLabel', () => {
    it('should create a copy with new ID', async () => {
      const originalLabel = await LabelGeneratorService.createLabel({
        articleNumber: 'ORIG-001',
        productName: 'Original Product',
        priceInfo: { price: 15.99 },
        tags: ['original'],
      });

      const duplicatedLabel = await LabelGeneratorService.duplicateLabel(originalLabel);

      expect(duplicatedLabel.id).not.toBe(originalLabel.id);
      expect(duplicatedLabel.articleNumber).toBe('ORIG-001-copy');
      expect(duplicatedLabel.productName).toBe(originalLabel.productName);
      expect(duplicatedLabel.priceInfo).toEqual(originalLabel.priceInfo);
    });

    it('should set new timestamps on duplicate', async () => {
      const originalLabel = await LabelGeneratorService.createLabel({
        articleNumber: 'ORIG-002',
        productName: 'Original',
        priceInfo: { price: 10 },
      });

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const duplicatedLabel = await LabelGeneratorService.duplicateLabel(originalLabel);

      expect(duplicatedLabel.createdAt.getTime()).toBeGreaterThanOrEqual(
        originalLabel.createdAt.getTime()
      );
    });
  });

  describe('mergeLabels', () => {
    it('should merge multiple labels into one', async () => {
      const label1 = await LabelGeneratorService.createLabel({
        articleNumber: 'MERGE-001',
        productName: 'Product A',
        description: 'Description A',
        priceInfo: { price: 10 },
        tags: ['tagA'],
      });

      const label2 = await LabelGeneratorService.createLabel({
        articleNumber: 'MERGE-002',
        productName: 'Product B',
        description: 'Description B',
        priceInfo: { price: 20 },
        tags: ['tagB'],
      });

      const merged = await LabelGeneratorService.mergeLabels([label1, label2]);

      expect(merged.articleNumber).toBe('MERGE-001'); // Takes first
      expect(merged.description).toContain('Description A');
      expect(merged.description).toContain('Description B');
      expect(merged.tags).toContain('tagA');
      expect(merged.tags).toContain('tagB');
    });

    it('should throw error when no labels provided', async () => {
      await expect(LabelGeneratorService.mergeLabels([])).rejects.toThrow('No labels to merge');
    });

    it('should deduplicate tags when merging', async () => {
      const label1 = await LabelGeneratorService.createLabel({
        articleNumber: 'DUP-001',
        productName: 'Product',
        priceInfo: { price: 10 },
        tags: ['common', 'unique1'],
      });

      const label2 = await LabelGeneratorService.createLabel({
        articleNumber: 'DUP-002',
        productName: 'Product',
        priceInfo: { price: 10 },
        tags: ['common', 'unique2'],
      });

      const merged = await LabelGeneratorService.mergeLabels([label1, label2]);

      const commonCount = merged.tags?.filter(t => t === 'common').length;
      expect(commonCount).toBe(1);
    });
  });

  describe('generateFromExcel', () => {
    it('should generate labels from product descriptions', async () => {
      const products = [
        { articleNumber: 'EX-001', description: 'Excel Product 1' },
        { articleNumber: 'EX-002', description: 'Excel Product 2' },
      ];

      const labels = await LabelGeneratorService.generateFromExcel(products, 25.99);

      expect(labels).toHaveLength(2);
      expect(labels[0].articleNumber).toBe('EX-001');
      expect(labels[0].productName).toBe('Excel Product 1');
      expect(labels[0].priceInfo.price).toBe(25.99);
      expect(labels[0].source).toBe('import');
    });

    it('should use default price of 0 when not provided', async () => {
      const products = [
        { articleNumber: 'EX-003', description: 'No Price Product' },
      ];

      const labels = await LabelGeneratorService.generateFromExcel(products);

      expect(labels[0].priceInfo.price).toBe(0);
    });
  });
});
