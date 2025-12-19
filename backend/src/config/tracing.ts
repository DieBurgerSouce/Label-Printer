/**
 * OpenTelemetry Distributed Tracing Configuration
 * Provides end-to-end request tracing across services
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { trace, SpanStatusCode, context, propagation } from '@opentelemetry/api';
import type { Span, SpanOptions, Context } from '@opentelemetry/api';

// Environment configuration
const OTEL_EXPORTER_OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'screenshot-algo-backend';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const TRACING_ENABLED = process.env.TRACING_ENABLED !== 'false';

// SDK instance
let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 * Must be called before any other imports that need instrumentation
 */
export function initTracing(): void {
  if (!TRACING_ENABLED) {
    console.log('[Tracing] Disabled via TRACING_ENABLED=false');
    return;
  }

  // Create resource with service information
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
  });

  // Choose exporter based on environment
  const spanProcessors =
    ENVIRONMENT === 'production'
      ? [
          new BatchSpanProcessor(
            new OTLPTraceExporter({
              url: OTEL_EXPORTER_OTLP_ENDPOINT,
            })
          ),
        ]
      : [
          // In development, log to console and optionally send to collector
          new SimpleSpanProcessor(new ConsoleSpanExporter()),
          ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT
            ? [
                new BatchSpanProcessor(
                  new OTLPTraceExporter({
                    url: OTEL_EXPORTER_OTLP_ENDPOINT,
                  })
                ),
              ]
            : []),
        ];

  // Initialize SDK with auto-instrumentation
  sdk = new NodeSDK({
    resource,
    spanProcessors,
    instrumentations: [
      new HttpInstrumentation({
        // Don't trace health check requests
        ignoreIncomingRequestHook: (request) => {
          const url = request.url || '';
          return url.includes('/health') || url.includes('/metrics');
        },
      }),
      new ExpressInstrumentation(),
    ],
  });

  // Start the SDK
  sdk.start();

  console.log(`[Tracing] Initialized for ${SERVICE_NAME} (${ENVIRONMENT})`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('[Tracing] Shut down successfully'))
      .catch((err) => console.error('[Tracing] Shutdown error:', err));
  });
}

/**
 * Get the global tracer
 */
export function getTracer(name = SERVICE_NAME) {
  return trace.getTracer(name, SERVICE_VERSION);
}

/**
 * Create a new span for tracing a code block
 */
export function createSpan(name: string, options?: SpanOptions, parentContext?: Context): Span {
  const tracer = getTracer();
  const ctx = parentContext || context.active();
  return tracer.startSpan(name, options, ctx);
}

/**
 * Execute a function within a traced span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, options);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Execute a synchronous function within a traced span
 */
export function withSpanSync<T>(name: string, fn: (span: Span) => T, options?: SpanOptions): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name, options);

  try {
    const result = context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add attributes to the current active span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    Object.entries(attributes).forEach(([key, value]) => {
      currentSpan.setAttribute(key, value);
    });
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    currentSpan.addEvent(name, attributes);
  }
}

/**
 * Get trace context for propagation to external services
 */
export function getTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Extract trace context from incoming request headers
 */
export function extractTraceContext(
  headers: Record<string, string | string[] | undefined>
): Context {
  // Normalize headers to Record<string, string>
  const normalizedHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      normalizedHeaders[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      normalizedHeaders[key.toLowerCase()] = value[0];
    }
  });

  return propagation.extract(context.active(), normalizedHeaders);
}

/**
 * Shutdown the SDK gracefully
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.log('[Tracing] Shut down successfully');
  }
}

// Export OpenTelemetry API for advanced usage
export { trace, context, propagation, SpanStatusCode };
export type { Span, SpanOptions, Context };
