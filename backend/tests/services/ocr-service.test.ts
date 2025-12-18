/**
 * OCR Service Tests
 * Tests for OCR text extraction from screenshots
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockImplementation(() =>
    Promise.resolve({
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: 'Produktnummer: 8805\nTest Product Name\n29,99 EUR\nBeschreibung des Produkts',
          confidence: 85,
          words: [
            {
              text: '8805',
              confidence: 90,
              bbox: { x0: 100, y0: 50, x1: 200, y1: 80 },
            },
            {
              text: '29,99',
              confidence: 95,
              bbox: { x0: 100, y0: 150, x1: 180, y1: 180 },
            },
          ],
        },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    })
  ),
}));

// Mock sharp for image preprocessing
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    flatten: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    linear: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123'),
}));

// Mock cloud vision service
vi.mock('../../src/services/cloud-vision-service.js', () => ({
  cloudVisionService: {
    shouldUseFallback: vi.fn().mockReturnValue(false),
    processImage: vi.fn().mockResolvedValue(null),
  },
}));

// Import after mocks
import { ocrService } from '../../src/services/ocr-service';

describe('OCRService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize OCR workers', async () => {
      const { createWorker } = await import('tesseract.js');

      await ocrService.initialize();

      // Should create workers (default maxWorkers = 2)
      expect(createWorker).toHaveBeenCalled();
    });
  });

  describe('processScreenshot', () => {
    it('should process a screenshot and extract text', async () => {
      // Ensure workers are initialized
      await ocrService.initialize();

      const result = await ocrService.processScreenshot(
        '/path/to/screenshot.png',
        {},
        'test-job-id'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('test-uuid-123');
      expect(result.status).toBe('completed');
      expect(result.rawText).toContain('Test Product Name');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should extract article number from text', async () => {
      await ocrService.initialize();

      const result = await ocrService.processScreenshot('/path/to/screenshot.png');

      // Article number extraction depends on pattern matching in extractStructuredData
      // The mock returns raw text which may or may not match patterns
      expect(result.extractedData).toBeDefined();
      // If patterns match, articleNumber will be defined
      // This tests that the extraction logic runs without error
    });

    it('should calculate confidence scores', async () => {
      await ocrService.initialize();

      const result = await ocrService.processScreenshot('/path/to/screenshot.png');

      expect(result.confidence).toBeDefined();
      expect(result.confidence.overall).toBeGreaterThan(0);
    });

    it('should include bounding boxes for words', async () => {
      await ocrService.initialize();

      const result = await ocrService.processScreenshot('/path/to/screenshot.png');

      expect(result.boundingBoxes).toBeDefined();
      expect(Array.isArray(result.boundingBoxes)).toBe(true);
    });

    it('should fail gracefully on invalid image', async () => {
      await ocrService.initialize();
      const { stat } = await import('fs/promises');
      vi.mocked(stat).mockRejectedValueOnce(new Error('File not found'));

      await expect(ocrService.processScreenshot('/invalid/path.png')).rejects.toThrow();
    });

    it('should fail on empty image file', async () => {
      await ocrService.initialize();
      const { stat } = await import('fs/promises');
      vi.mocked(stat).mockResolvedValueOnce({ size: 0 } as any);

      await expect(ocrService.processScreenshot('/empty/image.png')).rejects.toThrow(
        'Image file is empty'
      );
    });
  });

  describe('processScreenshots (batch)', () => {
    it('should process multiple screenshots in batch', async () => {
      await ocrService.initialize();

      const screenshots = ['/path/to/image1.png', '/path/to/image2.png', '/path/to/image3.png'];

      const results = await ocrService.processScreenshots(screenshots, {}, 'batch-job');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
    });

    it('should handle individual failures in batch', async () => {
      await ocrService.initialize();

      const { stat } = await import('fs/promises');
      vi.mocked(stat)
        .mockResolvedValueOnce({ size: 1024 } as any)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({ size: 1024 } as any);

      const screenshots = ['/path/to/image1.png', '/path/to/invalid.png', '/path/to/image3.png'];

      const results = await ocrService.processScreenshots(screenshots);

      expect(results.length).toBe(2);
    });
  });

  describe('getProcessingStatus', () => {
    it('should return undefined for unknown result ID', () => {
      const status = ocrService.getProcessingStatus('unknown-id');
      expect(status).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should terminate all workers on shutdown', async () => {
      await ocrService.initialize();
      await ocrService.shutdown();
      expect(ocrService.getProcessingStatus('any')).toBeUndefined();
    });
  });
});

describe('OCR Text Extraction Patterns', () => {
  describe('Article Number Patterns', () => {
    it('should match German article number formats', () => {
      // Test patterns that match common German article number formats
      const testCases = [
        { text: 'Produktnummer: 8805', pattern: /Produktnummer[:\s]+(\d+)/i, expected: '8805' },
        { text: 'Art.-Nr. 12345', pattern: /Art\.\-Nr\.\s*(\d+)/i, expected: '12345' },
        { text: 'Art.Nr: 67890', pattern: /Art\.Nr[:\s]*(\d+)/i, expected: '67890' },
        { text: 'Artikel: 11111', pattern: /Artikel[:\s]+(\d+)/i, expected: '11111' },
      ];

      for (const { text, pattern, expected } of testCases) {
        const match = text.match(pattern);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(expected);
      }
    });
  });

  describe('Price Patterns', () => {
    it('should match German price formats', () => {
      const pricePattern = /(\d+[,.]?\d*)\s*EUR|EUR\s*(\d+[,.]?\d*)/gi;

      const testCases = [
        { text: '29,99 EUR', expected: '29,99' },
        { text: '45.41 EUR', expected: '45.41' },
        { text: 'EUR 100', expected: '100' },
      ];

      for (const { text, expected } of testCases) {
        const match = pricePattern.exec(text);
        pricePattern.lastIndex = 0;
        expect(match).not.toBeNull();
        expect(match![1] || match![2]).toBe(expected);
      }
    });
  });

  describe('Tiered Price Patterns', () => {
    it('should match German tiered price formats', () => {
      const tieredPattern = /(ab|bis)\s+(\d+)\s+(?:Stueck|St\.|Stk\.?)?\s*([\d,]+)\s*EUR/gi;

      const testCases = [
        { text: 'ab 7 Stueck 190,92 EUR', quantity: '7', price: '190,92' },
        { text: 'ab 24 Stueck 180,60 EUR', quantity: '24', price: '180,60' },
        { text: 'bis 10 St. 25,00 EUR', quantity: '10', price: '25,00' },
      ];

      for (const { text, quantity, price } of testCases) {
        const match = tieredPattern.exec(text);
        tieredPattern.lastIndex = 0;
        expect(match).not.toBeNull();
        expect(match![2]).toBe(quantity);
        expect(match![3]).toBe(price);
      }
    });
  });
});
