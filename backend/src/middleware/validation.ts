/**
 * Input Validation Middleware
 * Centralized Zod-based validation for Express routes
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';

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
 * Sanitize string input - removes potential XSS characters
 * Use with Zod's .transform() for custom sanitization
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
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
