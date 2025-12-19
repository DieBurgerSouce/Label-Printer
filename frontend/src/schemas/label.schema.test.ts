/**
 * Label Schema Tests
 * Tests validation rules for label generation forms
 */

import { describe, it, expect } from 'vitest';
import {
  labelSizeEnum,
  labelOrientationEnum,
  labelFormatEnum,
  customDimensionsSchema,
  labelGenerationSchema,
  printJobSchema,
  batchLabelSchema,
  getLabelDimensions,
  formatLabelPrice,
  LABEL_SIZES,
} from './label.schema';

describe('labelSizeEnum', () => {
  it('accepts valid sizes', () => {
    expect(labelSizeEnum.safeParse('small').success).toBe(true);
    expect(labelSizeEnum.safeParse('medium').success).toBe(true);
    expect(labelSizeEnum.safeParse('large').success).toBe(true);
    expect(labelSizeEnum.safeParse('custom').success).toBe(true);
  });

  it('rejects invalid sizes', () => {
    const result = labelSizeEnum.safeParse('extra-large');
    expect(result.success).toBe(false);
  });
});

describe('labelOrientationEnum', () => {
  it('accepts valid orientations', () => {
    expect(labelOrientationEnum.safeParse('portrait').success).toBe(true);
    expect(labelOrientationEnum.safeParse('landscape').success).toBe(true);
  });

  it('rejects invalid orientations', () => {
    const result = labelOrientationEnum.safeParse('diagonal');
    expect(result.success).toBe(false);
  });
});

describe('labelFormatEnum', () => {
  it('accepts valid formats', () => {
    expect(labelFormatEnum.safeParse('png').success).toBe(true);
    expect(labelFormatEnum.safeParse('pdf').success).toBe(true);
    expect(labelFormatEnum.safeParse('svg').success).toBe(true);
  });

  it('rejects invalid formats', () => {
    const result = labelFormatEnum.safeParse('jpeg');
    expect(result.success).toBe(false);
  });
});

describe('customDimensionsSchema', () => {
  it('validates correct dimensions', () => {
    const result = customDimensionsSchema.safeParse({
      width: 100,
      height: 50,
      unit: 'mm',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative width', () => {
    const result = customDimensionsSchema.safeParse({
      width: -10,
      height: 50,
      unit: 'mm',
    });
    expect(result.success).toBe(false);
  });

  it('rejects width over 500mm', () => {
    const result = customDimensionsSchema.safeParse({
      width: 600,
      height: 50,
      unit: 'mm',
    });
    expect(result.success).toBe(false);
  });

  it('accepts different units', () => {
    expect(
      customDimensionsSchema.safeParse({ width: 10, height: 5, unit: 'cm' }).success
    ).toBe(true);
    expect(
      customDimensionsSchema.safeParse({ width: 4, height: 2, unit: 'in' }).success
    ).toBe(true);
  });

  it('defaults to mm unit', () => {
    const result = customDimensionsSchema.parse({ width: 100, height: 50 });
    expect(result.unit).toBe('mm');
  });
});

describe('labelGenerationSchema', () => {
  const validLabel = {
    articleNumber: 'ABC-123',
    productName: 'Test Product',
    price: 29.99,
    currency: 'EUR',
  };

  describe('required fields', () => {
    it('validates complete label data', () => {
      const result = labelGenerationSchema.safeParse(validLabel);
      expect(result.success).toBe(true);
    });

    it('rejects empty article number', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        articleNumber: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty product name', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        productName: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('price validation', () => {
    it('accepts numeric price', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        price: 49.99,
      });
      expect(result.success).toBe(true);
    });

    it('accepts priceText instead of price', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        price: null,
        priceText: 'Auf Anfrage',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when neither price nor priceText provided', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        price: null,
        priceText: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const priceError = result.error.issues.find((e) => e.path.includes('price'));
        expect(priceError?.message).toContain('Preis oder Preistext');
      }
    });

    it('rejects negative price', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        price: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('custom dimensions', () => {
    it('requires customDimensions when size is custom', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        size: 'custom',
        customDimensions: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path.includes('customDimensions'));
        expect(error?.message).toContain('Benutzerdefinierte Maße');
      }
    });

    it('accepts custom size with dimensions', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        size: 'custom',
        customDimensions: { width: 80, height: 50, unit: 'mm' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('barcode validation', () => {
    it('accepts 8-digit barcode (EAN-8)', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        barcode: '12345678',
      });
      expect(result.success).toBe(true);
    });

    it('accepts 13-digit barcode (EAN-13)', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        barcode: '1234567890123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid barcode length', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        barcode: '123456',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty barcode', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        barcode: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('quantity validation', () => {
    it('defaults to 1', () => {
      const result = labelGenerationSchema.parse(validLabel);
      expect(result.quantity).toBe(1);
    });

    it('rejects quantity over 1000', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        quantity: 1001,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer quantity', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        quantity: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('URL validation', () => {
    it('accepts valid imageUrl', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        imageUrl: 'https://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid imageUrl', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        imageUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid qrCode URL', () => {
      const result = labelGenerationSchema.safeParse({
        ...validLabel,
        qrCode: 'https://shop.example.com/product/123',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('printJobSchema', () => {
  const validPrintJob = {
    labelIds: ['550e8400-e29b-41d4-a716-446655440000'],
    copies: 1,
  };

  it('validates correct print job', () => {
    const result = printJobSchema.safeParse(validPrintJob);
    expect(result.success).toBe(true);
  });

  it('rejects empty labelIds array', () => {
    const result = printJobSchema.safeParse({
      ...validPrintJob,
      labelIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID in labelIds', () => {
    const result = printJobSchema.safeParse({
      ...validPrintJob,
      labelIds: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects copies over 100', () => {
    const result = printJobSchema.safeParse({
      ...validPrintJob,
      copies: 101,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid paper sizes', () => {
    const sizes = ['A4', 'A5', 'Letter', 'Label', 'Custom'];
    sizes.forEach((paperSize) => {
      const result = printJobSchema.safeParse({
        ...validPrintJob,
        paperSize,
      });
      expect(result.success).toBe(true);
    });
  });

  it('validates DPI range', () => {
    expect(printJobSchema.safeParse({ ...validPrintJob, dpi: 72 }).success).toBe(true);
    expect(printJobSchema.safeParse({ ...validPrintJob, dpi: 600 }).success).toBe(true);
    expect(printJobSchema.safeParse({ ...validPrintJob, dpi: 71 }).success).toBe(false);
    expect(printJobSchema.safeParse({ ...validPrintJob, dpi: 601 }).success).toBe(false);
  });
});

describe('batchLabelSchema', () => {
  const validBatch = {
    templateId: '550e8400-e29b-41d4-a716-446655440000',
    articles: [
      {
        articleNumber: 'ABC-123',
        productName: 'Product 1',
        price: 29.99,
      },
    ],
  };

  it('validates correct batch data', () => {
    const result = batchLabelSchema.safeParse(validBatch);
    expect(result.success).toBe(true);
  });

  it('rejects empty articles array', () => {
    const result = batchLabelSchema.safeParse({
      ...validBatch,
      articles: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid templateId', () => {
    const result = batchLabelSchema.safeParse({
      ...validBatch,
      templateId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('defaults mergePdf to true', () => {
    const result = batchLabelSchema.parse(validBatch);
    expect(result.mergePdf).toBe(true);
  });
});

describe('getLabelDimensions', () => {
  it('returns correct dimensions for predefined sizes', () => {
    expect(getLabelDimensions('small')).toEqual({ width: 40, height: 30 });
    expect(getLabelDimensions('medium')).toEqual({ width: 60, height: 40 });
    expect(getLabelDimensions('large')).toEqual({ width: 100, height: 60 });
  });

  it('converts custom dimensions from cm to mm', () => {
    const result = getLabelDimensions('custom', { width: 10, height: 5, unit: 'cm' });
    expect(result).toEqual({ width: 100, height: 50 });
  });

  it('converts custom dimensions from inches to mm', () => {
    const result = getLabelDimensions('custom', { width: 4, height: 2, unit: 'in' });
    expect(result.width).toBeCloseTo(101.6);
    expect(result.height).toBeCloseTo(50.8);
  });

  it('returns mm dimensions as-is', () => {
    const result = getLabelDimensions('custom', { width: 80, height: 50, unit: 'mm' });
    expect(result).toEqual({ width: 80, height: 50 });
  });

  it('falls back to medium if custom without dimensions', () => {
    const result = getLabelDimensions('custom', null);
    expect(result).toEqual({ width: LABEL_SIZES.medium.width, height: LABEL_SIZES.medium.height });
  });
});

describe('formatLabelPrice', () => {
  it('formats EUR correctly', () => {
    const result = formatLabelPrice(45.99, 'EUR');
    expect(result).toMatch(/45,99\s*€/);
  });

  it('formats USD correctly', () => {
    const result = formatLabelPrice(45.99, 'USD');
    expect(result).toMatch(/45,99\s*\$/);
  });

  it('returns "Auf Anfrage" for null price', () => {
    expect(formatLabelPrice(null)).toBe('Auf Anfrage');
  });

  it('returns "Auf Anfrage" for undefined price', () => {
    expect(formatLabelPrice(undefined)).toBe('Auf Anfrage');
  });

  it('defaults to EUR currency', () => {
    const result = formatLabelPrice(100);
    expect(result).toMatch(/100,00\s*€/);
  });
});
