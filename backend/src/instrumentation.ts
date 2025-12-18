/**
 * OpenTelemetry Instrumentation
 * Auto-instrumentation for Express, HTTP, and Redis
 *
 * This file MUST be imported before any other modules!
 * Use: node --require ./dist/instrumentation.js ./dist/index.js
 * Or: node --import ./src/instrumentation.ts ./src/index.ts (with tsx)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { trace as otelTrace } from '@opentelemetry/api';
import type { IncomingMessage } from 'http';

// Configuration from environment variables
const serviceName = process.env.OTEL_SERVICE_NAME || 'screenshot-algo-backend';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const otelCollectorUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// Check if tracing is enabled
const tracingEnabled = process.env.OTEL_TRACING_ENABLED !== 'false';

if (!tracingEnabled) {
  console.log('[OpenTelemetry] Tracing disabled via OTEL_TRACING_ENABLED=false');
} else {
  // Create resource with service information
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${otelCollectorUrl}/v1/traces`,
  });

  // Configure metrics exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${otelCollectorUrl}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30000, // Export every 30 seconds
  });

  // Initialize OpenTelemetry SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      // HTTP instrumentation (tracks all HTTP requests)
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request: IncomingMessage) => {
          // Ignore health check endpoints
          const url = request.url || '';
          return (
            url.startsWith('/health') ||
            url.startsWith('/metrics') ||
            url.startsWith('/ready') ||
            url.startsWith('/live')
          );
        },
        requestHook: (span, request) => {
          // Add custom attributes to spans for incoming requests
          const incomingRequest = request as IncomingMessage;
          if (incomingRequest.headers) {
            const requestId = incomingRequest.headers['x-request-id'];
            if (requestId) {
              span.setAttribute('http.request_id', requestId as string);
            }
          }
        },
      }),

      // Express instrumentation (tracks route handlers)
      new ExpressInstrumentation(),

      // Redis instrumentation (tracks Redis operations)
      new IORedisInstrumentation({
        dbStatementSerializer: (cmdName: string, cmdArgs: unknown[]) => {
          // Serialize Redis command for span name
          // Limit argument serialization to avoid large payloads
          const args = cmdArgs.slice(0, 2).map(String).join(' ');
          return `${cmdName} ${args}`.substring(0, 100);
        },
      }),
    ],
  });

  // Start SDK
  sdk.start();

  console.log(`[OpenTelemetry] Tracing enabled for ${serviceName}`);
  console.log(`[OpenTelemetry] Exporting to: ${otelCollectorUrl}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
      .catch((error) => console.error('[OpenTelemetry] Error shutting down SDK', error))
      .finally(() => process.exit(0));
  });
}

// Export trace context utilities for manual instrumentation
export { trace, context, SpanStatusCode } from '@opentelemetry/api';
export type { Span } from '@opentelemetry/api';

/**
 * Utility function to add trace context to logs
 * Use this to correlate logs with traces
 */
export function getTraceContext(): { traceId?: string; spanId?: string } {
  const activeSpan = otelTrace.getActiveSpan();

  if (!activeSpan) {
    return {};
  }

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
