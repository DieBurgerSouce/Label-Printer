/**
 * Input Validation Middleware
 * Centralized Zod-based validation for Express routes
 * Includes XSS protection via the xss library
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import xss, { IFilterXSSOptions } from 'xss';
import logger from '../utils/logger';

// Configure XSS filter options for strict sanitization
const xssOptions: IFilterXSSOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true, // Strip all non-whitelisted tags
  stripIgnoreTagBody: ['script', 'style'], // Remove script and style tag content entirely
};

/**
 * Validation target - which part of the request to validate
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Zod schema
 *
 * @example
 * // Validate request body
 * router.post('/users', validateRequest(createUserSchema, 'body'), handler);
 *
 * // Validate query parameters
 * router.get('/users', validateRequest(querySchema, 'query'), handler);
 *
 * // Validate URL parameters
 * router.get('/users/:id', validateRequest(paramsSchema, 'params'), handler);
 */
export function validateRequest<T>(schema: ZodSchema<T>, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const result = schema.parse(data);

      // Replace with parsed/transformed data
      req[target] = result as any;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Validation failed', {
          target,
          path: req.path,
          errors: formattedErrors,
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
        });
        return;
      }

      // Unexpected error
      logger.error('Unexpected validation error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
      });
    }
  };
}

/**
 * Validate multiple targets at once
 *
 * @example
 * router.post('/items/:id',
 *   validateMultiple({
 *     params: paramsSchema,
 *     body: bodySchema,
 *   }),
 *   handler
 * );
 */
export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ target: string; field: string; message: string; code: string }> = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      try {
        const data = req[target as ValidationTarget];
        const result = schema.parse(data);
        req[target as ValidationTarget] = result as any;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((err) => ({
              target,
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            }))
          );
        }
      }
    }

    if (errors.length > 0) {
      logger.warn('Multi-target validation failed', {
        path: req.path,
        errors,
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

/**
 * Sanitize string input - comprehensive XSS protection
 * Uses the xss library for robust sanitization of:
 * - HTML tags (script, style, iframe, etc.)
 * - JavaScript event handlers (onclick, onerror, etc.)
 * - JavaScript URLs (javascript:, data:, vbscript:)
 * - HTML entities
 *
 * Use with Zod's .transform() for custom sanitization
 */
export function sanitizeString(value: string): string {
  // First apply xss library for comprehensive sanitization
  const sanitized = xss(value, xssOptions);

  // Additional cleanup
  return (
    sanitized
      // Remove any remaining potential dangerous patterns
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      // Remove null bytes
      .replace(/\0/g, '')
      .trim()
  );
}

/**
 * Sanitize HTML content - allows safe HTML tags
 * Use this for fields that intentionally contain HTML (like descriptions)
 */
export function sanitizeHtml(value: string): string {
  const safeHtmlOptions: IFilterXSSOptions = {
    whiteList: {
      p: [],
      br: [],
      b: [],
      i: [],
      u: [],
      strong: [],
      em: [],
      ul: [],
      ol: [],
      li: [],
      a: ['href', 'title', 'target'],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
  };

  return xss(value, safeHtmlOptions).trim();
}

/**
 * Zod transform helper for sanitizing strings
 *
 * @example
 * const schema = z.object({
 *   name: z.string().transform(sanitize),
 * });
 */
export const sanitize = (val: string) => sanitizeString(val);

/**
 * Zod transform helper for sanitizing HTML content
 *
 * @example
 * const schema = z.object({
 *   description: z.string().transform(sanitizeHtmlTransform),
 * });
 */
export const sanitizeHtmlTransform = (val: string) => sanitizeHtml(val);
