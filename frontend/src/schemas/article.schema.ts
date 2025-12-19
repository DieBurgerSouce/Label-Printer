/**
 * Article Form Validation Schemas
 * Uses Zod for type-safe validation with React Hook Form
 */

import { z } from 'zod';

// Tiered price schema
export const tieredPriceSchema = z.object({
  quantity: z
    .number({ invalid_type_error: 'Menge muss eine Zahl sein' })
    .int('Menge muss eine ganze Zahl sein')
    .positive('Menge muss positiv sein'),
  price: z
    .number({ invalid_type_error: 'Preis muss eine Zahl sein' })
    .nonnegative('Preis darf nicht negativ sein'),
});

// Price type enum
export const priceTypeEnum = z.enum(['normal', 'tiered', 'auf_anfrage', 'unknown'], {
  errorMap: () => ({ message: 'Ungültiger Preistyp' }),
});

// Article form schema - for creating/editing articles
export const articleFormSchema = z
  .object({
    articleNumber: z
      .string()
      .min(1, 'Artikelnummer ist erforderlich')
      .max(50, 'Artikelnummer darf max. 50 Zeichen haben')
      .regex(
        /^[A-Za-z0-9\-_]+$/,
        'Artikelnummer darf nur Buchstaben, Zahlen, Bindestriche und Unterstriche enthalten'
      ),

    productName: z
      .string()
      .min(1, 'Produktname ist erforderlich')
      .max(200, 'Produktname darf max. 200 Zeichen haben'),

    description: z
      .string()
      .max(2000, 'Beschreibung darf max. 2000 Zeichen haben')
      .optional()
      .nullable()
      .transform((val) => val || undefined),

    priceType: priceTypeEnum.default('normal'),

    price: z
      .number({ invalid_type_error: 'Preis muss eine Zahl sein' })
      .nonnegative('Preis darf nicht negativ sein')
      .optional()
      .nullable(),

    tieredPrices: z.array(tieredPriceSchema).optional().nullable(),

    tieredPricesText: z
      .string()
      .max(1000, 'Staffelpreise-Text darf max. 1000 Zeichen haben')
      .optional()
      .nullable()
      .transform((val) => val || undefined),

    currency: z.string().length(3, 'Währung muss 3 Zeichen haben (ISO 4217)').default('EUR'),

    imageUrl: z
      .string()
      .url('Ungültige Bild-URL')
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val)),

    sourceUrl: z
      .string()
      .url('Ungültige Quell-URL')
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val)),

    ean: z
      .string()
      .regex(/^(\d{8}|\d{13})?$/, 'EAN muss 8 oder 13 Ziffern haben')
      .optional()
      .nullable()
      .transform((val) => val || undefined),

    category: z
      .string()
      .max(100, 'Kategorie darf max. 100 Zeichen haben')
      .optional()
      .nullable()
      .transform((val) => val || undefined),

    manufacturer: z
      .string()
      .max(100, 'Hersteller darf max. 100 Zeichen haben')
      .optional()
      .nullable()
      .transform((val) => val || undefined),

    verified: z.boolean().default(false),
    published: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If priceType is 'normal', price must be provided
      if (data.priceType === 'normal') {
        return data.price !== null && data.price !== undefined;
      }
      return true;
    },
    {
      message: 'Preis ist erforderlich bei normalem Preistyp',
      path: ['price'],
    }
  )
  .refine(
    (data) => {
      // If priceType is 'tiered', tieredPrices must have at least one entry
      if (data.priceType === 'tiered') {
        return (
          data.tieredPrices && Array.isArray(data.tieredPrices) && data.tieredPrices.length > 0
        );
      }
      return true;
    },
    {
      message: 'Mindestens ein Staffelpreis ist erforderlich bei Staffelpreisen',
      path: ['tieredPrices'],
    }
  );

// Article search/filter schema
export const articleSearchSchema = z.object({
  query: z.string().max(200).optional(),
  priceType: priceTypeEnum.optional(),
  category: z.string().optional(),
  verified: z.boolean().optional(),
  published: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z
    .enum(['articleNumber', 'productName', 'price', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Types derived from schemas
export type ArticleFormData = z.infer<typeof articleFormSchema>;
export type ArticleSearchParams = z.infer<typeof articleSearchSchema>;
export type TieredPrice = z.infer<typeof tieredPriceSchema>;
export type PriceType = z.infer<typeof priceTypeEnum>;

// Helper function to parse tiered prices from text
export function parseTieredPricesText(text: string): TieredPrice[] {
  const lines = text.split('\n').filter((line) => line.trim());
  const prices: TieredPrice[] = [];

  for (const line of lines) {
    // Match patterns like "ab 10 Stück: 45,99 EUR" or "10+: 45.99"
    const match = line.match(
      /(?:ab\s*)?(\d+)(?:\s*(?:Stück|St\.|pcs|units|-))?[:\s]+(\d+[.,]\d{2})/i
    );
    if (match) {
      prices.push({
        quantity: parseInt(match[1], 10),
        price: parseFloat(match[2].replace(',', '.')),
      });
    }
  }

  return prices.sort((a, b) => a.quantity - b.quantity);
}

// Helper to format price for display
export function formatPrice(price: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(price);
}

// Default form values
export const defaultArticleFormValues: Partial<ArticleFormData> = {
  priceType: 'normal',
  currency: 'EUR',
  verified: false,
  published: true,
};
