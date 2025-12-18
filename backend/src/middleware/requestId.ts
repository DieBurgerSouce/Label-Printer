/**
 * Request ID Middleware
 * Adds a unique request ID to each request for tracing and debugging
 */
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware to add unique request ID to each request
 * - Uses existing x-request-id header if provided (for distributed tracing)
 * - Generates new UUID if not provided
 * - Sets response header for client correlation
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const requestId = (req.get(REQUEST_ID_HEADER) as string) || randomUUID();

  // Attach to request object
  req.id = requestId;

  // Set response header for client correlation
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}

/**
 * Get request ID from request object
 * Utility function for use in services/repositories
 */
export function getRequestId(req: Request): string {
  return req.id || 'unknown';
}
