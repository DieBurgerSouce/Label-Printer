/**
 * Prometheus Metrics Configuration
 * Enterprise-grade metrics for monitoring and observability
 */

import client from 'prom-client';

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'screenshot-algo',
  env: process.env.NODE_ENV || 'development',
});

// Enable the collection of default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'screenshot_algo_',
});

// =============================================================================
// HTTP Request Metrics
// =============================================================================

/**
 * Counter for total HTTP requests
 */
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

/**
 * Histogram for HTTP request duration
 */
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * Gauge for active HTTP connections
 */
export const httpActiveConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// =============================================================================
// Business Metrics
// =============================================================================

/**
 * Counter for screenshots processed
 */
export const screenshotsProcessedTotal = new client.Counter({
  name: 'screenshots_processed_total',
  help: 'Total number of screenshots processed',
  labelNames: ['status'] as const,
  registers: [register],
});

/**
 * Histogram for screenshot processing duration
 */
export const screenshotDuration = new client.Histogram({
  name: 'screenshot_processing_duration_seconds',
  help: 'Duration of screenshot processing in seconds',
  labelNames: ['type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

/**
 * Counter for OCR operations
 */
export const ocrOperationsTotal = new client.Counter({
  name: 'ocr_operations_total',
  help: 'Total number of OCR operations',
  labelNames: ['status'] as const,
  registers: [register],
});

/**
 * Histogram for OCR processing duration
 */
export const ocrDuration = new client.Histogram({
  name: 'ocr_processing_duration_seconds',
  help: 'Duration of OCR processing in seconds',
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

/**
 * Counter for labels generated
 */
export const labelsGeneratedTotal = new client.Counter({
  name: 'labels_generated_total',
  help: 'Total number of labels generated',
  labelNames: ['template'] as const,
  registers: [register],
});

/**
 * Gauge for job queue depth
 */
export const jobQueueDepth = new client.Gauge({
  name: 'job_queue_depth',
  help: 'Number of jobs waiting in the queue',
  labelNames: ['queue'] as const,
  registers: [register],
});

/**
 * Gauge for job queue processing time
 */
export const jobProcessingTime = new client.Histogram({
  name: 'job_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue', 'status'] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

// =============================================================================
// Database Metrics
// =============================================================================

/**
 * Gauge for active database connections
 */
export const databaseConnectionsActive = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

/**
 * Histogram for database query duration
 */
export const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Counter for database errors
 */
export const databaseErrorsTotal = new client.Counter({
  name: 'database_errors_total',
  help: 'Total number of database errors',
  labelNames: ['operation'] as const,
  registers: [register],
});

// =============================================================================
// Redis Metrics
// =============================================================================

/**
 * Gauge for active Redis connections
 */
export const redisConnectionsActive = new client.Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
  registers: [register],
});

/**
 * Counter for Redis operations
 */
export const redisOperationsTotal = new client.Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

// =============================================================================
// Health Check Metric
// =============================================================================

/**
 * Gauge for application health status (1 = healthy, 0 = unhealthy)
 */
export const healthStatus = new client.Gauge({
  name: 'health_check_status',
  help: 'Application health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component'] as const,
  registers: [register],
});

// =============================================================================
// Browser Pool Metrics (for Puppeteer)
// =============================================================================

/**
 * Gauge for available browser instances
 */
export const browserPoolAvailable = new client.Gauge({
  name: 'browser_pool_available',
  help: 'Number of available browser instances in the pool',
  registers: [register],
});

/**
 * Gauge for total browser instances
 */
export const browserPoolTotal = new client.Gauge({
  name: 'browser_pool_total',
  help: 'Total number of browser instances in the pool',
  registers: [register],
});

// =============================================================================
// Export metrics endpoint handler
// =============================================================================

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for metrics
 */
export function getContentType(): string {
  return register.contentType;
}

export default {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  httpActiveConnections,
  screenshotsProcessedTotal,
  screenshotDuration,
  ocrOperationsTotal,
  ocrDuration,
  labelsGeneratedTotal,
  jobQueueDepth,
  jobProcessingTime,
  databaseConnectionsActive,
  databaseQueryDuration,
  databaseErrorsTotal,
  redisConnectionsActive,
  redisOperationsTotal,
  healthStatus,
  browserPoolAvailable,
  browserPoolTotal,
  getMetrics,
  getContentType,
};
