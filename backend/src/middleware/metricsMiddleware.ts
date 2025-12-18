/**
 * Prometheus Metrics Middleware for Express
 * Automatically tracks HTTP request metrics
 */

import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration, httpActiveConnections } from '../utils/metrics';

/**
 * Normalize route path for consistent metric labels
 * Replaces dynamic segments like /api/articles/123 with /api/articles/:id
 */
function normalizeRoute(path: string): string {
  // Common patterns to normalize
  return (
    path
      // UUID patterns
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      // Numeric IDs
      .replace(/\/\d+/g, '/:id')
      // Remove query strings
      .split('?')[0]
      // Collapse multiple slashes
      .replace(/\/+/g, '/')
      // Remove trailing slash
      .replace(/\/$/, '') || '/'
  );
}

/**
 * Express middleware to track HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint itself to prevent recursion
  if (req.path === '/metrics') {
    return next();
  }

  // Track active connections
  httpActiveConnections.inc();

  // Record start time
  const startTime = process.hrtime.bigint();

  // Override end to capture metrics
  const originalEnd = res.end.bind(res);

  res.end = function (
    this: Response,
    ...args: Parameters<typeof originalEnd>
  ): ReturnType<typeof originalEnd> {
    // Calculate duration in seconds
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationSeconds = durationNs / 1e9;

    // Normalize the route path
    const route = normalizeRoute(req.route?.path || req.path);
    const method = req.method;
    const statusCode = String(res.statusCode);

    // Record metrics
    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
    });

    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode,
      },
      durationSeconds
    );

    // Decrement active connections
    httpActiveConnections.dec();

    // Call original end
    return originalEnd(...args);
  } as typeof res.end;

  next();
}

export default metricsMiddleware;
