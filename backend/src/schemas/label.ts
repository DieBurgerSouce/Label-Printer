/**
 * Label Zod Schemas
 * Validation schemas for label-related operations
 */

import { z } from 'zod';
import { idSchema, nonEmptyString, positiveInt, urlSchema, paginationSchema } from './common';

// =============================================================================
// API Route Schemas (for labels.ts routes)
// =============================================================================

/**
 * Staffelpreis (tiered pricing) schema
 */
const staffelpreisSchema = z.object({
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

/**
 * Price info schema
 */
const priceInfoSchema = z.object({
  price: z.number().nonnegative(),
  currency: z.string().min(1).max(10).default('EUR'),
  unit: z.string().optional(),
  staffelpreise: z.array(staffelpreisSchema).optional(),
});

/**
 * Template type enum
 */
const templateTypeSchema = z.enum(['minimal', 'standard', 'extended', 'custom']);

/**
 * Source type enum
 */
const sourceTypeSchema = z.enum(['screenshot', 'manual', 'import']);

/**
 * POST /api/labels - Create a new label
 */
export const createLabelApiSchema = z.object({
  articleNumber: z.string().min(1).max(100),
  productName: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  priceInfo: priceInfoSchema,
  imageUrl: urlSchema.optional(),
  templateType: templateTypeSchema.optional().default('standard'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  category: z.string().max(100).optional(),
  source: sourceTypeSchema.optional().default('manual'),
});

export type CreateLabelApiInput = z.infer<typeof createLabelApiSchema>;

/**
 * PUT /api/labels/:id - Update a label
 */
export const updateLabelApiSchema = z.object({
  articleNumber: z.string().min(1).max(100).optional(),
  productName: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  priceInfo: priceInfoSchema.partial().optional(),
  imageUrl: urlSchema.optional(),
  templateType: templateTypeSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  category: z.string().max(100).optional(),
});

export type UpdateLabelApiInput = z.infer<typeof updateLabelApiSchema>;

/**
 * Allowed sortBy fields (whitelist to prevent SQL injection)
 */
const allowedSortFields = [
  'createdAt',
  'updatedAt',
  'articleNumber',
  'productName',
  'category',
] as const;

/**
 * GET /api/labels - Query parameters
 */
export const listLabelsApiQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(allowedSortFields).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  tags: z.string().max(500).optional(), // Comma-separated
  source: sourceTypeSchema.optional(),
});

export type ListLabelsApiQuery = z.infer<typeof listLabelsApiQuerySchema>;

/**
 * Batch operation types
 */
const batchOperationSchema = z.enum(['delete']);

/**
 * POST /api/labels/batch - Batch operations
 */
export const batchLabelsApiSchema = z.object({
  operation: batchOperationSchema,
  labelIds: z.array(z.string().uuid()).min(1).max(1000),
});

export type BatchLabelsApiInput = z.infer<typeof batchLabelsApiSchema>;

/**
 * POST /api/labels/generate-from-article
 */
export const generateFromArticleSchema = z.object({
  articleId: z.string().min(1),
  templateId: z.string().optional(),
});

export type GenerateFromArticleInput = z.infer<typeof generateFromArticleSchema>;

/**
 * POST /api/labels/extract
 */
export const extractLabelSchema = z.object({
  url: urlSchema,
});

export type ExtractLabelInput = z.infer<typeof extractLabelSchema>;

/**
 * GET /api/labels/:id/thumbnail - Query parameters
 */
export const thumbnailQuerySchema = z.object({
  width: z.coerce.number().int().positive().max(1000).optional().default(200),
  height: z.coerce.number().int().positive().max(1000).optional().default(200),
});

export type ThumbnailQuery = z.infer<typeof thumbnailQuerySchema>;

/**
 * URL parameter with ID
 */
export const labelIdParamApiSchema = z.object({
  id: z.string().min(1),
});

// =============================================================================
// Label Status
// =============================================================================

export const labelStatusSchema = z.enum(['draft', 'active', 'printed', 'archived']);
export type LabelStatus = z.infer<typeof labelStatusSchema>;

// =============================================================================
// Label Data
// =============================================================================

/**
 * Core label data fields
 */
export const labelDataSchema = z.object({
  articleNumber: z.string().optional(),
  productName: nonEmptyString,
  price: z.number().nonnegative().optional(),
  originalPrice: z.number().nonnegative().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  imageUrl: urlSchema.optional(),
  customFields: z.record(z.string()).optional(),
});

export type LabelData = z.infer<typeof labelDataSchema>;

// =============================================================================
// Label CRUD Operations
// =============================================================================

/**
 * Create label request
 */
export const createLabelSchema = z.object({
  templateId: idSchema.optional(),
  data: labelDataSchema,
  status: labelStatusSchema.optional().default('draft'),
  quantity: positiveInt.optional().default(1),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;

/**
 * Update label request
 */
export const updateLabelSchema = z.object({
  templateId: idSchema.optional(),
  data: labelDataSchema.partial().optional(),
  status: labelStatusSchema.optional(),
  quantity: positiveInt.optional(),
});

export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

/**
 * Label ID parameter
 */
export const labelIdParamSchema = z.object({
  id: idSchema,
});

// =============================================================================
// Label Queries
// =============================================================================

/**
 * List labels query parameters
 */
export const listLabelsQuerySchema = paginationSchema.extend({
  status: labelStatusSchema.optional(),
  templateId: idSchema.optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type ListLabelsQuery = z.infer<typeof listLabelsQuerySchema>;

// =============================================================================
// Label Batch Operations
// =============================================================================

/**
 * Batch create labels
 */
export const batchCreateLabelsSchema = z.object({
  labels: z.array(createLabelSchema).min(1).max(1000),
  templateId: idSchema.optional(),
});

export type BatchCreateLabelsInput = z.infer<typeof batchCreateLabelsSchema>;

/**
 * Batch update labels
 */
export const batchUpdateLabelsSchema = z.object({
  ids: z.array(idSchema).min(1).max(1000),
  update: updateLabelSchema,
});

export type BatchUpdateLabelsInput = z.infer<typeof batchUpdateLabelsSchema>;

/**
 * Batch delete labels
 */
export const batchDeleteLabelsSchema = z.object({
  ids: z.array(idSchema).min(1).max(1000),
});

export type BatchDeleteLabelsInput = z.infer<typeof batchDeleteLabelsSchema>;

// =============================================================================
// Label Print
// =============================================================================

/**
 * Print label request
 */
export const printLabelSchema = z.object({
  labelIds: z.array(idSchema).min(1),
  copies: positiveInt.optional().default(1),
  printerName: z.string().optional(),
});

export type PrintLabelInput = z.infer<typeof printLabelSchema>;

// =============================================================================
// Label Template
// =============================================================================

/**
 * Label template schema
 */
export const labelTemplateSchema = z.object({
  name: nonEmptyString,
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['mm', 'cm', 'in', 'pt']).default('mm'),
  layout: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional().default(false),
});

export type LabelTemplateInput = z.infer<typeof labelTemplateSchema>;

/**
 * Update label template
 */
export const updateLabelTemplateSchema = labelTemplateSchema.partial();

export type UpdateLabelTemplateInput = z.infer<typeof updateLabelTemplateSchema>;
