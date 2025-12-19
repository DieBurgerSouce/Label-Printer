/**
 * Label Form Validation Schemas
 * Uses Zod for type-safe validation with React Hook Form
 */

import { z } from 'zod';

// Label size enum
export const labelSizeEnum = z.enum(['small', 'medium', 'large', 'custom'], {
  errorMap: () => ({ message: 'Ungültige Label-Größe' }),
});

// Label orientation enum
export const labelOrientationEnum = z.enum(['portrait', 'landscape'], {
  errorMap: () => ({ message: 'Ungültige Ausrichtung' }),
});

// Label format enum
export const labelFormatEnum = z.enum(['png', 'pdf', 'svg'], {
  errorMap: () => ({ message: 'Ungültiges Format' }),
});

// Custom dimensions schema
export const customDimensionsSchema = z.object({
  width: z
    .number({ invalid_type_error: 'Breite muss eine Zahl sein' })
    .positive('Breite muss positiv sein')
    .max(500, 'Breite darf maximal 500mm sein'),
  height: z
    .number({ invalid_type_error: 'Höhe muss eine Zahl sein' })
    .positive('Höhe muss positiv sein')
    .max(500, 'Höhe darf maximal 500mm sein'),
  unit: z.enum(['mm', 'cm', 'in']).default('mm'),
});

// Label generation request schema
export const labelGenerationSchema = z
  .object({
    templateId: z
      .string()
      .uuid('Template-ID muss eine gültige UUID sein')
      .optional()
      .nullable(),

    templateName: z
      .string()
      .min(1, 'Template-Name ist erforderlich')
      .max(100, 'Template-Name darf max. 100 Zeichen haben')
      .optional(),

    articleNumber: z
      .string()
      .min(1, 'Artikelnummer ist erforderlich')
      .max(50, 'Artikelnummer darf max. 50 Zeichen haben'),

    productName: z
      .string()
      .min(1, 'Produktname ist erforderlich')
      .max(200, 'Produktname darf max. 200 Zeichen haben'),

    price: z
      .number({ invalid_type_error: 'Preis muss eine Zahl sein' })
      .nonnegative('Preis darf nicht negativ sein')
      .optional()
      .nullable(),

    priceText: z
      .string()
      .max(100, 'Preistext darf max. 100 Zeichen haben')
      .optional()
      .nullable(),

    currency: z.string().length(3, 'Währung muss 3 Zeichen haben (ISO 4217)').default('EUR'),

    barcode: z
      .string()
      .regex(/^(\d{8}|\d{13})?$/, 'Barcode muss 8 oder 13 Ziffern haben (EAN-8/EAN-13)')
      .optional()
      .nullable()
      .transform((val) => val || undefined),

    qrCode: z
      .string()
      .url('QR-Code muss eine gültige URL sein')
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val)),

    imageUrl: z
      .string()
      .url('Ungültige Bild-URL')
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val)),

    size: labelSizeEnum.default('medium'),

    customDimensions: customDimensionsSchema.optional().nullable(),

    orientation: labelOrientationEnum.default('portrait'),

    format: labelFormatEnum.default('png'),

    quantity: z
      .number({ invalid_type_error: 'Anzahl muss eine Zahl sein' })
      .int('Anzahl muss eine ganze Zahl sein')
      .positive('Anzahl muss mindestens 1 sein')
      .max(1000, 'Maximal 1000 Labels pro Auftrag')
      .default(1),

    includeDescription: z.boolean().default(false),

    description: z
      .string()
      .max(500, 'Beschreibung darf max. 500 Zeichen haben')
      .optional()
      .nullable()
      .transform((val) => val || undefined),
  })
  .refine(
    (data) => {
      // If size is 'custom', customDimensions must be provided
      if (data.size === 'custom') {
        return data.customDimensions !== null && data.customDimensions !== undefined;
      }
      return true;
    },
    {
      message: 'Benutzerdefinierte Maße sind erforderlich bei custom-Größe',
      path: ['customDimensions'],
    }
  )
  .refine(
    (data) => {
      // Either price or priceText must be provided
      const hasPrice = data.price !== null && data.price !== undefined;
      const hasPriceText = data.priceText && data.priceText.trim().length > 0;
      return hasPrice || hasPriceText;
    },
    {
      message: 'Entweder Preis oder Preistext ist erforderlich',
      path: ['price'],
    }
  );

// Print job schema
export const printJobSchema = z.object({
  labelIds: z
    .array(z.string().uuid('Label-ID muss eine gültige UUID sein'))
    .min(1, 'Mindestens ein Label erforderlich'),

  printerName: z.string().min(1, 'Druckername ist erforderlich').optional(),

  copies: z
    .number()
    .int('Kopien muss eine ganze Zahl sein')
    .positive('Mindestens 1 Kopie')
    .max(100, 'Maximal 100 Kopien')
    .default(1),

  collate: z.boolean().default(true),

  paperSize: z.enum(['A4', 'A5', 'Letter', 'Label', 'Custom']).default('Label'),

  dpi: z.number().int().min(72).max(600).default(300),
});

// Batch label generation schema
export const batchLabelSchema = z.object({
  templateId: z.string().uuid('Template-ID muss eine gültige UUID sein'),

  articles: z
    .array(
      z.object({
        articleNumber: z.string().min(1),
        productName: z.string().min(1),
        price: z.number().nonnegative().optional().nullable(),
        priceText: z.string().optional().nullable(),
        currency: z.string().length(3).optional(),
        barcode: z.string().optional().nullable(),
        imageUrl: z.string().url().optional().nullable(),
      })
    )
    .min(1, 'Mindestens ein Artikel erforderlich')
    .max(500, 'Maximal 500 Artikel pro Batch'),

  format: labelFormatEnum.default('pdf'),

  mergePdf: z.boolean().default(true),
});

// Types derived from schemas
export type LabelSize = z.infer<typeof labelSizeEnum>;
export type LabelOrientation = z.infer<typeof labelOrientationEnum>;
export type LabelFormat = z.infer<typeof labelFormatEnum>;
export type CustomDimensions = z.infer<typeof customDimensionsSchema>;
export type LabelGenerationData = z.infer<typeof labelGenerationSchema>;
export type PrintJobData = z.infer<typeof printJobSchema>;
export type BatchLabelData = z.infer<typeof batchLabelSchema>;

// Default form values
export const defaultLabelFormValues: Partial<LabelGenerationData> = {
  currency: 'EUR',
  size: 'medium',
  orientation: 'portrait',
  format: 'png',
  quantity: 1,
  includeDescription: false,
};

// Predefined label sizes (in mm)
export const LABEL_SIZES = {
  small: { width: 40, height: 30, name: 'Klein (40x30mm)' },
  medium: { width: 60, height: 40, name: 'Mittel (60x40mm)' },
  large: { width: 100, height: 60, name: 'Groß (100x60mm)' },
} as const;

// Helper to get dimensions for a size
export function getLabelDimensions(
  size: LabelSize,
  customDimensions?: CustomDimensions | null
): { width: number; height: number } {
  if (size === 'custom' && customDimensions) {
    // Convert to mm if needed
    let { width, height } = customDimensions;
    if (customDimensions.unit === 'cm') {
      width *= 10;
      height *= 10;
    } else if (customDimensions.unit === 'in') {
      width *= 25.4;
      height *= 25.4;
    }
    return { width, height };
  }

  const sizeConfig = LABEL_SIZES[size as keyof typeof LABEL_SIZES] || LABEL_SIZES.medium;
  return { width: sizeConfig.width, height: sizeConfig.height };
}

// Format price for label display
export function formatLabelPrice(price: number | null | undefined, currency = 'EUR'): string {
  if (price === null || price === undefined) {
    return 'Auf Anfrage';
  }

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(price);
}
