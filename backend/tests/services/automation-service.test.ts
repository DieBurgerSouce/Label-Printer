/**
 * Automation Service Tests
 * Tests for the automation workflow orchestration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger first
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock all dependent services
vi.mock('../../src/services/web-crawler-service.js', () => ({
  webCrawlerService: {
    startCrawl: vi.fn().mockResolvedValue({
      id: 'crawl-job-123',
      status: 'pending',
    }),
    getJob: vi.fn().mockImplementation(() => ({
      id: 'crawl-job-123',
      status: 'completed',
      results: {
        screenshots: [
          {
            id: 'ss-1',
            url: 'https://shop.example.com/product/1',
            productUrl: 'https://shop.example.com/product/1',
            imagePath: '/data/screenshots/crawl-job-123/8801/product-image.png',
          },
          {
            id: 'ss-2',
            url: 'https://shop.example.com/product/2',
            productUrl: 'https://shop.example.com/product/2',
            imagePath: '/data/screenshots/crawl-job-123/8802/product-image.png',
          },
        ],
      },
    })),
    stopJob: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../src/services/robust-ocr-service.js', () => ({
  robustOCRService: {
    processArticleElements: vi.fn().mockResolvedValue({
      success: true,
      data: {
        articleNumber: '8801',
        productName: 'Test Product',
        description: 'Product description',
        price: 29.99,
        tieredPrices: [],
        tieredPricesText: '',
      },
      confidence: {
        articleNumber: 0.95,
        productName: 0.9,
        price: 0.92,
      },
    }),
  },
}));

vi.mock('../../src/services/ocr-service.js', () => ({
  ocrService: {
    processScreenshot: vi.fn().mockResolvedValue({
      id: 'ocr-result-123',
      screenshotId: 'ss-1',
      status: 'completed',
      confidence: { overall: 0.85 },
      extractedData: {
        articleNumber: '8801',
        productName: 'Fallback Product',
      },
    }),
  },
}));

vi.mock('../../src/services/matcher-service.js', () => ({
  matcherService: {
    matchWithExcel: vi.fn().mockReturnValue({
      matchScore: 0.95,
      matchedBy: 'articleNumber',
      excelData: { name: 'Excel Product' },
      confidence: 0.9,
    }),
    validateMatch: vi.fn().mockReturnValue({
      isValid: true,
      warnings: [],
    }),
  },
}));

vi.mock('../../src/services/template-engine.js', () => ({
  templateEngine: {
    loadTemplate: vi.fn().mockResolvedValue({
      id: 'template-123',
      name: 'Standard Label',
    }),
    render: vi.fn().mockResolvedValue({
      success: true,
      format: 'pdf',
      buffer: Buffer.from('PDF content'),
      base64: 'base64-content',
      renderTime: 100,
    }),
  },
}));

vi.mock('../../src/services/product-service.js', () => ({
  ProductService: {
    processOcrResultsFromAutomation: vi.fn().mockResolvedValue({
      created: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    }),
  },
}));

vi.mock('../../src/services/automation/index.js', () => ({
  emitJobCreated: vi.fn(),
  emitJobUpdated: vi.fn(),
  emitJobCompleted: vi.fn(),
  emitJobFailed: vi.fn(),
  emitLabelGenerated: vi.fn(),
  calculateOverallProgress: vi
    .fn()
    .mockImplementation((step, progress) => step * 25 + progress / 4),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-job-uuid'),
}));

import { automationService } from '../../src/services/automation-service';
import { webCrawlerService } from '../../src/services/web-crawler-service';

describe('AutomationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startAutomation', () => {
    it('should create a new automation job', async () => {
      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const job = await automationService.startAutomation(config);

      expect(job).toBeDefined();
      expect(job.id).toBe('test-job-uuid');
      // Job starts as 'pending' but quickly transitions to 'crawling' due to async workflow
      expect(['pending', 'crawling']).toContain(job.status);
      expect(job.config.shopUrl).toBe('https://shop.example.com');
    });

    it('should initialize job progress structure', async () => {
      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const job = await automationService.startAutomation(config);

      expect(job.progress).toBeDefined();
      expect(job.progress.currentStep).toBe('crawling');
      expect(job.progress.totalSteps).toBe(4);
      expect(job.progress.productsFound).toBe(0);
    });

    it('should initialize results structure', async () => {
      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const job = await automationService.startAutomation(config);

      expect(job.results).toBeDefined();
      expect(job.results.screenshots).toEqual([]);
      expect(job.results.ocrResults).toEqual([]);
      expect(job.results.labels).toEqual([]);
    });

    it('should start the crawler', async () => {
      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
        crawlerConfig: {
          maxProducts: 100,
          fullShopScan: true,
        },
      };

      await automationService.startAutomation(config);

      // Wait a bit for async workflow to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(webCrawlerService.startCrawl).toHaveBeenCalledWith(
        'https://shop.example.com',
        expect.objectContaining({
          maxProducts: 100,
          fullShopScan: true,
        })
      );
    });
  });

  describe('getJob', () => {
    it('should return job by ID', async () => {
      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const createdJob = await automationService.startAutomation(config);
      const retrievedJob = automationService.getJob(createdJob.id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(createdJob.id);
    });

    it('should return undefined for unknown job ID', () => {
      const job = automationService.getJob('non-existent-id');
      expect(job).toBeUndefined();
    });
  });

  describe('getAllJobs', () => {
    it('should return all jobs', async () => {
      // Create a unique job ID for this test
      const { v4 } = await import('uuid');
      vi.mocked(v4).mockReturnValueOnce('job-1').mockReturnValueOnce('job-2');

      await automationService.startAutomation({
        shopUrl: 'https://shop1.example.com',
        templateId: 'template-1',
      });

      await automationService.startAutomation({
        shopUrl: 'https://shop2.example.com',
        templateId: 'template-2',
      });

      const allJobs = automationService.getAllJobs();

      expect(Array.isArray(allJobs)).toBe(true);
      expect(allJobs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a running job', async () => {
      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const job = await automationService.startAutomation(config);
      const cancelled = await automationService.cancelJob(job.id);

      expect(cancelled).toBe(true);

      const cancelledJob = automationService.getJob(job.id);
      expect(cancelledJob?.status).toBe('failed');
      expect(cancelledJob?.error).toBe('Job cancelled by user');
    });

    it('should return false for non-existent job', async () => {
      const cancelled = await automationService.cancelJob('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should stop the crawler when cancelling', async () => {
      const { v4 } = await import('uuid');
      vi.mocked(v4).mockReturnValueOnce('cancel-test-job');

      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const job = await automationService.startAutomation(config);

      // Wait for crawl to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Manually set crawlJobId to simulate running state
      job.results.crawlJobId = 'crawl-job-123';

      await automationService.cancelJob(job.id);

      expect(webCrawlerService.stopJob).toHaveBeenCalledWith('crawl-job-123');
    });
  });

  describe('deleteJob', () => {
    it('should delete a job', async () => {
      const { v4 } = await import('uuid');
      vi.mocked(v4).mockReturnValueOnce('delete-test-job');

      const config = {
        shopUrl: 'https://shop.example.com',
        templateId: 'template-123',
      };

      const job = await automationService.startAutomation(config);
      const deleted = await automationService.deleteJob(job.id);

      expect(deleted).toBe(true);
      expect(automationService.getJob(job.id)).toBeUndefined();
    });

    it('should return false for non-existent job', async () => {
      const deleted = await automationService.deleteJob('non-existent');
      expect(deleted).toBe(false);
    });
  });
});

describe('AutomationJob Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use default crawler config values', async () => {
    const config = {
      shopUrl: 'https://shop.example.com',
      templateId: 'template-123',
    };

    await automationService.startAutomation(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(webCrawlerService.startCrawl).toHaveBeenCalledWith(
      'https://shop.example.com',
      expect.objectContaining({
        maxProducts: 2000, // Default
        fullShopScan: true, // Default
        followPagination: true, // Default
        screenshotQuality: 90, // Default
      })
    );
  });

  it('should override defaults with provided config', async () => {
    const config = {
      shopUrl: 'https://shop.example.com',
      templateId: 'template-123',
      crawlerConfig: {
        maxProducts: 50,
        fullShopScan: false,
        followPagination: false,
        screenshotQuality: 80,
      },
    };

    await automationService.startAutomation(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(webCrawlerService.startCrawl).toHaveBeenCalledWith(
      'https://shop.example.com',
      expect.objectContaining({
        maxProducts: 50,
        fullShopScan: false,
        followPagination: false,
        screenshotQuality: 80,
      })
    );
  });
});
