/**
 * Article Schema Tests
 * Tests validation rules for article forms
 */

import { describe, it, expect } from 'vitest';
import {
  articleFormSchema,
  articleSearchSchema,
  tieredPriceSchema,
  parseTieredPricesText,
  formatPrice,
  type ArticleFormData,
} from './article.schema';

describe('tieredPriceSchema', () => {
  it('validates correct tiered price', () => {
    const result = tieredPriceSchema.safeParse({ quantity: 10, price: 45.99 });
    expect(result.success).toBe(true);
  });

  it('rejects negative quantity', () => {
    const result = tieredPriceSchema.safeParse({ quantity: -5, price: 45.99 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('positiv');
    }
  });

  it('rejects negative price', () => {
    const result = tieredPriceSchema.safeParse({ quantity: 10, price: -5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('negativ');
    }
  });

  it('rejects non-integer quantity', () => {
    const result = tieredPriceSchema.safeParse({ quantity: 10.5, price: 45.99 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('ganze Zahl');
    }
  });
});

describe('articleFormSchema', () => {
  const validArticle: ArticleFormData = {
    articleNumber: 'ABC-123',
    productName: 'Test Product',
    priceType: 'normal',
    price: 29.99,
    currency: 'EUR',
    verified: false,
    published: true,
  };

  describe('articleNumber validation', () => {
    it('accepts valid article numbers', () => {
      const result = articleFormSchema.safeParse(validArticle);
      expect(result.success).toBe(true);
    });

    it('rejects empty article number', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, articleNumber: '' });
      expect(result.success).toBe(false);
    });

    it('rejects article numbers with special characters', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, articleNumber: 'ABC@123' });
      expect(result.success).toBe(false);
    });

    it('accepts article numbers with hyphens and underscores', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, articleNumber: 'ABC-123_XYZ' });
      expect(result.success).toBe(true);
    });
  });

  describe('productName validation', () => {
    it('rejects empty product name', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, productName: '' });
      expect(result.success).toBe(false);
    });

    it('rejects product name over 200 characters', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, productName: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });
  });

  describe('priceType normal validation', () => {
    it('requires price when priceType is normal', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        priceType: 'normal',
        price: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const priceError = result.error.issues.find((e) => e.path.includes('price'));
        expect(priceError?.message).toContain('erforderlich');
      }
    });

    it('accepts valid normal price', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        priceType: 'normal',
        price: 49.99,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('priceType tiered validation', () => {
    it('requires tieredPrices when priceType is tiered', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        priceType: 'tiered',
        price: null,
        tieredPrices: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const tieredError = result.error.issues.find((e) => e.path.includes('tieredPrices'));
        expect(tieredError?.message).toContain('Staffelpreis');
      }
    });

    it('accepts valid tiered prices', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        priceType: 'tiered',
        price: null,
        tieredPrices: [
          { quantity: 10, price: 45.99 },
          { quantity: 50, price: 42.99 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('priceType auf_anfrage', () => {
    it('does not require price when priceType is auf_anfrage', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        priceType: 'auf_anfrage',
        price: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('EAN validation', () => {
    it('accepts 8-digit EAN', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, ean: '12345678' });
      expect(result.success).toBe(true);
    });

    it('accepts 13-digit EAN', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, ean: '1234567890123' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid EAN length', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, ean: '123456' });
      expect(result.success).toBe(false);
    });

    it('rejects EAN with letters', () => {
      const result = articleFormSchema.safeParse({ ...validArticle, ean: '12345678A' });
      expect(result.success).toBe(false);
    });

    it('accepts empty/null EAN', () => {
      const result1 = articleFormSchema.safeParse({ ...validArticle, ean: '' });
      const result2 = articleFormSchema.safeParse({ ...validArticle, ean: null });
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('URL validation', () => {
    it('accepts valid imageUrl', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        imageUrl: 'https://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid imageUrl', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        imageUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty imageUrl', () => {
      const result = articleFormSchema.safeParse({
        ...validArticle,
        imageUrl: '',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('articleSearchSchema', () => {
  it('uses default values', () => {
    const result = articleSearchSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sortBy).toBe('createdAt');
    expect(result.sortOrder).toBe('desc');
  });

  it('accepts valid search params', () => {
    const result = articleSearchSchema.safeParse({
      query: 'test',
      priceType: 'tiered',
      page: 2,
      limit: 50,
      sortBy: 'price',
      sortOrder: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid sortBy', () => {
    const result = articleSearchSchema.safeParse({
      sortBy: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects limit over 100', () => {
    const result = articleSearchSchema.safeParse({
      limit: 200,
    });
    expect(result.success).toBe(false);
  });
});

describe('parseTieredPricesText', () => {
  it('parses "ab X Stück: Y EUR" format', () => {
    const text = 'ab 10 Stück: 45,99 EUR\nab 50 Stück: 42,99 EUR';
    const prices = parseTieredPricesText(text);

    expect(prices).toHaveLength(2);
    expect(prices[0]).toEqual({ quantity: 10, price: 45.99 });
    expect(prices[1]).toEqual({ quantity: 50, price: 42.99 });
  });

  it('parses simplified format', () => {
    const text = '10: 45.99\n50: 42.99';
    const prices = parseTieredPricesText(text);

    expect(prices).toHaveLength(2);
    expect(prices[0]).toEqual({ quantity: 10, price: 45.99 });
  });

  it('sorts by quantity', () => {
    const text = 'ab 50 Stück: 42,99\nab 10 Stück: 45,99';
    const prices = parseTieredPricesText(text);

    expect(prices[0].quantity).toBe(10);
    expect(prices[1].quantity).toBe(50);
  });

  it('handles empty text', () => {
    const prices = parseTieredPricesText('');
    expect(prices).toHaveLength(0);
  });

  it('handles invalid lines', () => {
    const text = 'invalid line\nab 10 Stück: 45,99\nmore invalid';
    const prices = parseTieredPricesText(text);

    expect(prices).toHaveLength(1);
    expect(prices[0]).toEqual({ quantity: 10, price: 45.99 });
  });
});

describe('formatPrice', () => {
  it('formats EUR correctly', () => {
    const result = formatPrice(45.99);
    expect(result).toMatch(/45,99\s*€/);
  });

  it('formats USD correctly', () => {
    const result = formatPrice(45.99, 'USD');
    expect(result).toMatch(/45,99\s*\$/);
  });

  it('handles whole numbers', () => {
    const result = formatPrice(50);
    expect(result).toMatch(/50,00\s*€/);
  });
});
