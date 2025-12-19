/**
 * Tracing Middleware
 * Extracts trace context from incoming requests and adds tracing metadata
 */

import { Request, Response, NextFunction } from 'express';
import { trace, context, extractTraceContext, addSpanAttributes } from '../config/tracing';

/**
 * Express middleware for distributed tracing
 * Extracts trace context from incoming requests and enriches spans with request info
 */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract trace context from incoming headers
  const parentContext = extractTraceContext(req.headers as Record<string, string>);

  // Run the rest of the request in the extracted context
  context.with(parentContext, () => {
    // Add request attributes to the current span
    addSpanAttributes({
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'http.user_agent': req.get('user-agent') || 'unknown',
      'http.request_id': req.id || 'unknown',
      'http.client_ip': req.ip || 'unknown',
    });

    // Add user context if authenticated
    if (req.session?.userId) {
      addSpanAttributes({
        'user.id': req.session.userId,
      });
    }

    // Track response
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      addSpanAttributes({
        'http.status_code': res.statusCode,
        'http.response_time_ms': duration,
      });
    });

    next();
  });
}

/**
 * Get the current trace ID for logging correlation
 */
export function getTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().traceId;
  }
  return undefined;
}

/**
 * Get the current span ID for logging correlation
 */
export function getSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().spanId;
  }
  return undefined;
}

/**
 * Get trace context as a log-friendly object
 */
export function getTraceLogContext(): { traceId?: string; spanId?: string } {
  return {
    traceId: getTraceId(),
    spanId: getSpanId(),
  };
}

export default tracingMiddleware;
