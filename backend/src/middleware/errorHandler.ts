/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized responses
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { isAppError, ValidationError } from '../errors/AppError';
import logger from '../utils/logger';
import { healthStatus } from '../utils/metrics';

/**
 * Type guard for Prisma known request errors
 */
function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error && error.name === 'PrismaClientKnownRequestError' && 'code' in error
  );
}

/**
 * Global error handler middleware
 * Must be registered LAST in the middleware chain
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,

  _next: NextFunction
): void {
  // Log the error
  const errorContext = {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body ? '[REDACTED]' : undefined,
  };

  // Handle AppError (our custom errors)
  if (isAppError(err)) {
    // Only log non-operational errors as actual errors
    if (!err.isOperational) {
      logger.error('Non-operational error', { error: err, ...errorContext });
      healthStatus.set({ component: 'api' }, 0);
    } else {
      logger.warn('Operational error', {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        ...errorContext,
      });
    }

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationError = new ValidationError('Validation failed', {
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    });

    logger.warn('Zod validation error', {
      errors: err.errors,
      ...errorContext,
    });

    res.status(validationError.statusCode).json(validationError.toJSON());
    return;
  }

  // Handle Prisma errors with type-safe check
  if (isPrismaKnownRequestError(err)) {
    // Handle specific Prisma error codes
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        {
          const target = err.meta?.target;
          const field = Array.isArray(target) ? target[0] : undefined;
          res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_ENTRY',
              message: 'A record with this value already exists',
              field,
            },
          });
        }
        return;

      case 'P2025': // Record not found
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        });
        return;

      default:
        logger.error('Prisma error', { error: err, code: err.code, ...errorContext });
    }
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
    });
    return;
  }

  // Log unexpected errors
  logger.error('Unhandled error', { error: err, stack: err.stack, ...errorContext });

  // Update health metric for serious errors
  healthStatus.set({ component: 'api' }, 0);

  // Generic error response (hide details in production)
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}

/**
 * 404 Not Found handler for undefined routes
 * Register BEFORE the error handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
}

/**
 * Async handler wrapper
 * Catches errors in async route handlers and passes them to error middleware
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
