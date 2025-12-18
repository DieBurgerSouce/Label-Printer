/**
 * Article Zod Schemas
 * Validation schemas for article/product-related operations
 */

import { z } from 'zod';
import { idSchema, nonEmptyString, urlSchema, paginationSchema } from './common';

// =============================================================================
// Article Status
// =============================================================================

export const articleStatusSchema = z.enum(['active', 'inactive', 'discontinued', 'pending']);
export type ArticleStatus = z.infer<typeof articleStatusSchema>;

// =============================================================================
// Article Core Data
// =============================================================================

/**
 * Article/Product schema
 */
export const articleSchema = z.object({
  articleNumber: z.string().max(50).optional(),
  name: nonEmptyString.max(255),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative().optional(),
  originalPrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('EUR'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  sku: z.string().max(50).optional(),
  ean: z
    .string()
    .regex(/^[0-9]{8,14}$/, 'Invalid EAN format')
    .optional(),
  barcode: z.string().max(50).optional(),
  unit: z.string().max(20).default('Stück'),
  weight: z.number().nonnegative().optional(),
  weightUnit: z.enum(['g', 'kg', 'lb', 'oz']).optional(),
  dimensions: z
    .object({
      length: z.number().nonnegative().optional(),
      width: z.number().nonnegative().optional(),
      height: z.number().nonnegative().optional(),
      unit: z.enum(['mm', 'cm', 'm', 'in']).optional(),
    })
    .optional(),
  imageUrl: urlSchema.optional(),
  thumbnailUrl: urlSchema.optional(),
  additionalImages: z.array(urlSchema).max(10).optional(),
  status: articleStatusSchema.optional().default('active'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Article = z.infer<typeof articleSchema>;

// =============================================================================
// Article CRUD Operations
// =============================================================================

/**
 * Create article request
 */
export const createArticleSchema = articleSchema;

export type CreateArticleInput = z.infer<typeof createArticleSchema>;

/**
 * Update article request
 */
export const updateArticleSchema = articleSchema.partial();

export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

/**
 * Article ID parameter
 */
export const articleIdParamSchema = z.object({
  id: idSchema,
});

// =============================================================================
// Article Queries
// =============================================================================

/**
 * List articles query parameters
 */
export const listArticlesQuerySchema = paginationSchema.extend({
  status: articleStatusSchema.optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  hasImage: z.coerce.boolean().optional(),
  tags: z.string().optional(), // Comma-separated tags
});

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;

// =============================================================================
// Article Batch Operations
// =============================================================================

/**
 * Batch create articles
 */
export const batchCreateArticlesSchema = z.object({
  articles: z.array(createArticleSchema).min(1).max(1000),
});

export type BatchCreateArticlesInput = z.infer<typeof batchCreateArticlesSchema>;

/**
 * Batch update articles
 */
export const batchUpdateArticlesSchema = z.object({
  ids: z.array(idSchema).min(1).max(1000),
  update: updateArticleSchema,
});

export type BatchUpdateArticlesInput = z.infer<typeof batchUpdateArticlesSchema>;

/**
 * Batch delete articles
 */
export const batchDeleteArticlesSchema = z.object({
  ids: z.array(idSchema).min(1).max(1000),
});

export type BatchDeleteArticlesInput = z.infer<typeof batchDeleteArticlesSchema>;

// =============================================================================
// Article Import/Export
// =============================================================================

/**
 * Import articles from Excel/CSV
 */
export const importArticlesSchema = z.object({
  filename: z.string(),
  mappings: z.record(z.string()).optional(), // Column name -> field mappings
  skipDuplicates: z.boolean().optional().default(true),
  updateExisting: z.boolean().optional().default(false),
});

export type ImportArticlesInput = z.infer<typeof importArticlesSchema>;

/**
 * Export articles request
 */
export const exportArticlesSchema = z.object({
  format: z.enum(['xlsx', 'csv', 'json']).default('xlsx'),
  ids: z.array(idSchema).optional(), // If empty, export all
  fields: z.array(z.string()).optional(), // Fields to include
  filters: listArticlesQuerySchema.optional(),
});

export type ExportArticlesInput = z.infer<typeof exportArticlesSchema>;
