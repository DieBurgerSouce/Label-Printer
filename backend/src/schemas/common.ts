/**
 * Common Zod Schemas
 * Shared validation schemas used across the application
 */

import { z } from 'zod';

// =============================================================================
// Primitive Types
// =============================================================================

/**
 * UUID v4 schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * CUID schema (Prisma's default ID format)
 */
export const cuidSchema = z.string().cuid('Invalid CUID format');

/**
 * Generic ID schema (accepts both UUID and CUID)
 */
export const idSchema = z.string().min(1, 'ID is required');

/**
 * Non-empty string schema
 */
export const nonEmptyString = z.string().min(1, 'This field cannot be empty');

/**
 * Email schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * URL schema
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Positive integer schema
 */
export const positiveInt = z.number().int().positive('Must be a positive integer');

/**
 * Non-negative integer schema
 */
export const nonNegativeInt = z.number().int().nonnegative('Must be a non-negative integer');

// =============================================================================
// Pagination
// =============================================================================

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// =============================================================================
// Search & Filter
// =============================================================================

/**
 * Generic search query
 */
export const searchSchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
});

/**
 * Date range filter
 */
export const dateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'Start date must be before end date' }
  );

// =============================================================================
// Response Types
// =============================================================================

/**
 * Generic API response schema
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
  });

/**
 * Paginated response schema
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// =============================================================================
// File Upload
// =============================================================================

/**
 * File metadata schema
 */
export const fileMetadataSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string(),
  size: z.number().positive(),
});

/**
 * Allowed image MIME types
 */
export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export const imageMimeTypeSchema = z.enum(imageMimeTypes);

// =============================================================================
// Type Exports
// =============================================================================

export type FileMetadata = z.infer<typeof fileMetadataSchema>;
