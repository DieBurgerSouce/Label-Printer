/**
 * Label Zod Schemas
 * Validation schemas for label-related operations
 */

import { z } from 'zod';
import { idSchema, nonEmptyString, positiveInt, urlSchema, paginationSchema } from './common';

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
