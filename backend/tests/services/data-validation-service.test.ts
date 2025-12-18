/**
 * Unit Tests for DataValidationService
 * Tests validation, auto-fix, and corruption detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataValidationService } from '../../src/services/data-validation-service';
import type { MergedProductData, TieredPrice } from '../../src/types/extraction-types';

describe('DataValidationService', () => {
  let service: DataValidationService;

  beforeEach(() => {
    service = new DataValidationService();
  });

  // ==========================================
  // validateProductData Tests
  // ==========================================
  describe('validateProductData', () => {
    it('should validate complete valid product data', () => {
      const validData: MergedProductData = {
        productName: 'Test Product Name',
        description: 'This is a valid product description with enough content.',
        articleNumber: '12345',
        price: 29.99,
        tieredPrices: [
          { quantity: 10, price: '25.99' },
          { quantity: 50, price: '22.99' },
        ],
      };

      const result = service.validateProductData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.overallConfidence).toBeGreaterThan(0.8);
      expect(result.fieldValidation.productName).toBe(true);
      expect(result.fieldValidation.articleNumber).toBe(true);
      expect(result.fieldValidation.price).toBe(true);
    });

    it('should return errors for missing required fields', () => {
      const incompleteData: MergedProductData = {
        description: 'Only description provided',
      };

      const result = service.validateProductData(incompleteData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Product name is missing');
      expect(result.errors).toContain('Article number is missing');
      expect(result.fieldValidation.productName).toBe(false);
      expect(result.fieldValidation.articleNumber).toBe(false);
    });

    it('should return error for too short product name', () => {
      const data: MergedProductData = {
        productName: 'AB', // Too short
        articleNumber: '12345',
        price: 10.0,
      };

      const result = service.validateProductData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Product name is too short (< 3 characters)');
      expect(result.fieldValidation.productName).toBe(false);
    });

    it('should warn about all-uppercase product names', () => {
      const data: MergedProductData = {
        productName: 'THIS IS ALL UPPERCASE PRODUCT NAME',
        articleNumber: '12345',
        price: 10.0,
      };

      const result = service.validateProductData(data);

      expect(result.warnings).toContain('Product name is all uppercase (possible OCR artifact)');
      expect(result.confidence.productName).toBeLessThanOrEqual(0.8);
    });

    it('should warn about line breaks in product name', () => {
      const data: MergedProductData = {
        productName: 'Product\nWith Line Break',
        articleNumber: '12345',
        price: 10.0,
      };

      const result = service.validateProductData(data);

      expect(result.warnings).toContain('Product name contains line breaks (OCR artifact)');
    });

    it('should handle null or undefined data gracefully', () => {
      const result = service.validateProductData(null as unknown as MergedProductData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid data object provided');
      expect(result.overallConfidence).toBe(0);
    });

    describe('price validation', () => {
      it('should validate valid prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          price: 29.99,
        };

        const result = service.validateProductData(data);

        expect(result.fieldValidation.price).toBe(true);
        expect(result.confidence.price).toBe(1.0);
      });

      it('should reject negative prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          price: -10.0,
        };

        const result = service.validateProductData(data);

        expect(result.errors).toContain('Price must be greater than 0');
        expect(result.fieldValidation.price).toBe(false);
      });

      it('should reject zero prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          price: 0,
        };

        const result = service.validateProductData(data);

        expect(result.errors).toContain('Price must be greater than 0');
        expect(result.fieldValidation.price).toBe(false);
      });

      it('should warn about very high prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          price: 150000,
        };

        const result = service.validateProductData(data);

        expect(result.warnings).toContain('Price is very high (> 100,000)');
        expect(result.confidence.price).toBe(0.7);
      });

      it('should warn about potential missing decimal point', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          price: '2545', // Should probably be 25.45
        };

        const result = service.validateProductData(data);

        expect(result.warnings).toContain('Price may be missing decimal point');
      });
    });

    describe('tiered prices validation', () => {
      it('should validate sorted tiered prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          tieredPrices: [
            { quantity: 10, price: '25.99' },
            { quantity: 50, price: '22.99' },
            { quantity: 100, price: '19.99' },
          ],
        };

        const result = service.validateProductData(data);

        expect(result.fieldValidation.tieredPrices).toBe(true);
        expect(result.confidence.tieredPrices).toBe(1.0);
      });

      it('should warn about unsorted tiered prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          tieredPrices: [
            { quantity: 50, price: '22.99' },
            { quantity: 10, price: '25.99' }, // Wrong order
          ],
        };

        const result = service.validateProductData(data);

        expect(result.warnings).toContain('Tiered prices are not sorted by quantity');
      });

      it('should warn about duplicate quantities', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          tieredPrices: [
            { quantity: 10, price: '25.99' },
            { quantity: 10, price: '24.99' }, // Duplicate quantity
          ],
        };

        const result = service.validateProductData(data);

        expect(result.warnings).toContain('Tiered prices contain duplicate quantities');
      });

      it('should reject invalid tier quantities', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          tieredPrices: [
            { quantity: -5, price: '25.99' }, // Invalid quantity
          ],
        };

        const result = service.validateProductData(data);

        expect(result.errors.some((e) => e.includes('Invalid quantity'))).toBe(true);
      });

      it('should reject invalid tier prices', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345',
          tieredPrices: [
            { quantity: 10, price: '-5.00' }, // Invalid price
          ],
        };

        const result = service.validateProductData(data);

        expect(result.errors.some((e) => e.includes('Invalid price'))).toBe(true);
      });
    });

    describe('article number validation', () => {
      it('should validate numeric article numbers', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '12345678',
          price: 10.0,
        };

        const result = service.validateProductData(data);

        expect(result.fieldValidation.articleNumber).toBe(true);
        expect(result.confidence.articleNumber).toBe(1.0);
      });

      it('should warn about non-digit article numbers', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: 'ABC-123',
          price: 10.0,
        };

        const result = service.validateProductData(data);

        expect(result.warnings).toContain('Article number contains non-digit characters');
        expect(result.confidence.articleNumber).toBe(0.8);
      });

      it('should warn about very short article numbers', () => {
        const data: MergedProductData = {
          productName: 'Test Product',
          articleNumber: '1',
          price: 10.0,
        };

        const result = service.validateProductData(data);

        expect(result.warnings).toContain('Article number is very short');
      });
    });
  });

  // ==========================================
  // autoFixData Tests
  // ==========================================
  describe('autoFixData', () => {
    it('should remove line breaks from product name', () => {
      const data: MergedProductData = {
        productName: 'Product\nWith\nLine\nBreaks',
        articleNumber: '12345',
      };

      const fixed = service.autoFixData(data);

      expect(fixed.productName).toBe('Product With Line Breaks');
    });

    it('should trim excessive whitespace', () => {
      const data: MergedProductData = {
        productName: '  Product   with   extra   spaces  ',
        description: '  Description   with   spaces  ',
        articleNumber: '12345',
      };

      const fixed = service.autoFixData(data);

      expect(fixed.productName).toBe('Product with extra spaces');
      expect(fixed.description).toBe('Description with spaces');
    });

    it('should convert all-caps to title case for long names', () => {
      const data: MergedProductData = {
        productName: 'THIS IS A LONG ALL CAPS PRODUCT NAME',
        articleNumber: '12345',
      };

      const fixed = service.autoFixData(data);

      // Should be title case
      expect(fixed.productName).not.toBe('THIS IS A LONG ALL CAPS PRODUCT NAME');
      expect(fixed.productName?.charAt(0)).toBe('T');
    });

    it('should fix missing decimal point in prices', () => {
      const data: MergedProductData = {
        productName: 'Test Product',
        articleNumber: '12345',
        price: 2545, // Should become 25.45
      };

      const fixed = service.autoFixData(data);

      expect(fixed.price).toBe(25.45);
    });

    it('should sort tiered prices by quantity', () => {
      const data: MergedProductData = {
        productName: 'Test Product',
        articleNumber: '12345',
        tieredPrices: [
          { quantity: 100, price: '19.99' },
          { quantity: 10, price: '25.99' },
          { quantity: 50, price: '22.99' },
        ],
      };

      const fixed = service.autoFixData(data);

      expect(fixed.tieredPrices?.[0].quantity).toBe(10);
      expect(fixed.tieredPrices?.[1].quantity).toBe(50);
      expect(fixed.tieredPrices?.[2].quantity).toBe(100);
    });

    it('should remove duplicate tier quantities', () => {
      const data: MergedProductData = {
        productName: 'Test Product',
        articleNumber: '12345',
        tieredPrices: [
          { quantity: 10, price: '25.99' },
          { quantity: 10, price: '24.99' }, // Duplicate
          { quantity: 50, price: '22.99' },
        ],
      };

      const fixed = service.autoFixData(data);

      expect(fixed.tieredPrices).toHaveLength(2);
    });

    it('should handle null data gracefully', () => {
      const result = service.autoFixData(null as unknown as MergedProductData);
      expect(result).toBeNull();
    });

    it('should fix common OCR errors like "Fir " to "Für "', () => {
      const data: MergedProductData = {
        productName: 'Fir Katzen geeignet',
        articleNumber: '12345',
      };

      const fixed = service.autoFixData(data);

      expect(fixed.productName).toBe('Für Katzen geeignet');
    });
  });

  // ==========================================
  // detectCorruptedData Tests
  // ==========================================
  describe('detectCorruptedData', () => {
    it('should detect clean data', () => {
      const cleanData: MergedProductData = {
        productName: 'Normal Product Name',
        description: 'A normal product description without any issues.',
        articleNumber: '12345',
      };

      const result = service.detectCorruptedData(cleanData);

      expect(result.isCorrupted).toBe(false);
      expect(result.corruptionScore).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect OCR encoding artifacts', () => {
      const corruptedData: MergedProductData = {
        productName: 'Product © ® ™ with artifacts',
        articleNumber: '12345',
      };

      const result = service.detectCorruptedData(corruptedData);

      expect(result.corruptionScore).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('OCR encoding artifacts'))).toBe(true);
    });

    it('should detect cookie banner contamination', () => {
      // Need multiple matches to cross 20% threshold (weight 0.5 * matches/5)
      const corruptedData: MergedProductData = {
        productName: 'Product servicerHilfe servicerHilfe servicerHilfe something',
        articleNumber: '12345',
      };

      const result = service.detectCorruptedData(corruptedData);

      expect(result.corruptionScore).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('Cookie banner contamination'))).toBe(true);
    });

    it('should detect navigation contamination', () => {
      // Need multiple matches to cross 20% threshold (weight 0.4 * matches/5)
      const corruptedData: MergedProductData = {
        description: 'zur suche springen zur suche springen zum hauptinhalt Some product',
        articleNumber: '12345',
      };

      const result = service.detectCorruptedData(corruptedData);

      expect(result.corruptionScore).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('Navigation contamination'))).toBe(true);
    });

    it('should cap corruption score at 1.0', () => {
      const heavilyCorruptedData: MergedProductData = {
        productName: '© © © © © ® ® ® ® ® ™ ™ ™ ™ ™ servicerHilfe servicerHilfe',
        description: 'zur suche springen © © © © © Ã¶ Ã¶ Ã¶',
        articleNumber: '12345',
      };

      const result = service.detectCorruptedData(heavilyCorruptedData);

      expect(result.corruptionScore).toBeLessThanOrEqual(1.0);
    });
  });

  // ==========================================
  // validateField Tests (legacy)
  // ==========================================
  describe('validateField (legacy)', () => {
    it('should validate a single field', () => {
      const result = service.validateField('productName', 'Valid Product Name');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should return error for invalid single field', () => {
      const result = service.validateField('productName', 'AB');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Product name is too short (< 3 characters)');
    });

    it('should validate tiered prices field', () => {
      const tieredPrices: TieredPrice[] = [
        { quantity: 10, price: '25.99' },
        { quantity: 50, price: '22.99' },
      ];

      const result = service.validateField('tieredPrices', tieredPrices);

      expect(result.isValid).toBe(true);
    });
  });

  // ==========================================
  // Overall Confidence Calculation Tests
  // ==========================================
  describe('overall confidence calculation', () => {
    it('should weight critical fields higher', () => {
      // Product name and price have higher weights
      const dataWithGoodCriticalFields: MergedProductData = {
        productName: 'Excellent Product Name',
        articleNumber: '12345',
        price: 29.99,
        description: '', // Empty/low confidence
      };

      const result = service.validateProductData(dataWithGoodCriticalFields);

      // Should still have decent overall confidence due to critical fields
      expect(result.overallConfidence).toBeGreaterThan(0.5);
    });

    it('should calculate correct weighted average', () => {
      const perfectData: MergedProductData = {
        productName: 'Perfect Product Name',
        description: 'A sufficiently long description for validation.',
        articleNumber: '12345',
        price: 29.99,
        tieredPrices: [
          { quantity: 10, price: '25.99' },
          { quantity: 50, price: '22.99' },
        ],
      };

      const result = service.validateProductData(perfectData);

      // With all fields valid and confidence = 1.0, overall should be close to 1.0
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});
