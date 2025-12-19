// Sentry Configuration
// Enterprise-grade error tracking for Screenshot_Algo
// https://docs.sentry.io/platforms/node/

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import type { NodeOptions } from '@sentry/node';

/**
 * Environment configuration
 */
const environment = process.env.NODE_ENV || 'development';
const isDevelopment = environment === 'development';
const isProduction = environment === 'production';

/**
 * Sentry DSN from environment variables
 * Never commit real DSN to version control
 */
const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Release version for source map association
 */
const RELEASE_VERSION = process.env.npm_package_version || '0.0.0';

/**
 * Sentry configuration options
 */
export const sentryConfig: NodeOptions = {
  // Data Source Name - required for Sentry to work
  dsn: SENTRY_DSN,

  // Environment tag for filtering
  environment,

  // Release version for tracking
  release: `screenshot-algo@${RELEASE_VERSION}`,

  // Sample rate for error events (1.0 = 100%)
  sampleRate: isProduction ? 1.0 : 1.0,

  // Sample rate for performance monitoring (0.1 = 10%)
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // Profile sample rate (relative to traces sample rate)
  profilesSampleRate: isProduction ? 0.1 : 1.0,

  // Enable debug mode in development
  debug: isDevelopment,

  // Attach stack traces to messages
  attachStacktrace: true,

  // Maximum breadcrumbs to store
  maxBreadcrumbs: 100,

  // Normalize call stack depth
  normalizeDepth: 10,

  // Server name for identification
  serverName: process.env.HOSTNAME || 'screenshot-algo',

  // Integrations
  integrations: [
    // HTTP integration for automatic request tracking
    new Sentry.Integrations.Http({ tracing: true }),

    // Express integration (if using Express)
    new Sentry.Integrations.Express(),

    // Console integration for capturing console errors
    new Sentry.Integrations.Console(),

    // Context lines for source code
    new Sentry.Integrations.ContextLines(),

    // Local variables in stack traces
    new Sentry.Integrations.LocalVariables({
      captureAllExceptions: true,
    }),

    // Request data integration
    new Sentry.Integrations.RequestData({
      // Include cookies in request data
      include: {
        cookies: false, // Don't include cookies by default
        data: true,
        headers: true,
        ip: true,
        query_string: true,
        url: true,
        user: true,
      },
    }),

    // Profiling integration for performance
    new ProfilingIntegration(),

    // Modules integration for dependency tracking
    new Sentry.Integrations.Modules(),

    // Linked errors for error chains
    new Sentry.Integrations.LinkedErrors({
      key: 'cause',
      limit: 5,
    }),
  ],

  // Before send hook for data sanitization
  beforeSend: (event, hint) => {
    // Skip in development if not testing Sentry
    if (isDevelopment && !process.env.SENTRY_TEST) {
      console.log('[Sentry] Event captured (dev mode):', event.message);
      return null;
    }

    // Sanitize sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }

    // Sanitize user data
    if (event.user) {
      delete event.user.ip_address;
      // Keep user ID for tracking but remove PII
      event.user = {
        id: event.user.id,
      };
    }

    // Remove sensitive data from extras
    if (event.extra) {
      const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key'];
      for (const key of sensitiveKeys) {
        if (key in event.extra) {
          event.extra[key] = '[REDACTED]';
        }
      }
    }

    return event;
  },

  // Before send transaction hook
  beforeSendTransaction: (event) => {
    // Filter out health check transactions
    if (event.transaction?.includes('/health')) {
      return null;
    }
    if (event.transaction?.includes('/ready')) {
      return null;
    }
    if (event.transaction?.includes('/metrics')) {
      return null;
    }
    return event;
  },

  // Before breadcrumb hook
  beforeBreadcrumb: (breadcrumb, hint) => {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }

    // Sanitize URLs in breadcrumbs
    if (breadcrumb.data?.url) {
      try {
        const url = new URL(breadcrumb.data.url);
        // Remove sensitive query parameters
        url.searchParams.delete('token');
        url.searchParams.delete('api_key');
        url.searchParams.delete('apiKey');
        breadcrumb.data.url = url.toString();
      } catch {
        // URL parsing failed, keep original
      }
    }

    return breadcrumb;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',

    // User-initiated cancellations
    'AbortError',
    'The operation was aborted',
    'The user aborted a request',

    // Rate limiting
    'Too Many Requests',
    'Rate limit exceeded',

    // Development errors
    /^Module not found/,
    /^Cannot find module/,
  ],

  // Deny URLs to prevent capturing errors from these sources
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,

    // Analytics scripts
    /google-analytics\.com/i,
    /googletagmanager\.com/i,

    // Ad scripts
    /doubleclick\.net/i,
    /googlesyndication\.com/i,
  ],

  // Tags added to all events
  initialScope: {
    tags: {
      component: 'screenshot-algo',
      'node.version': process.version,
    },
  },
};

/**
 * Initialize Sentry
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN not configured, Sentry is disabled');
    return;
  }

  Sentry.init(sentryConfig);
  console.log(`[Sentry] Initialized for ${environment} environment`);
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message with severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context
 */
export function setUser(user: { id: string; email?: string }): void {
  Sentry.setUser({
    id: user.id,
    // Only include email in non-production for debugging
    email: isProduction ? undefined : user.email,
  });
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction {
  return Sentry.startTransaction({ name, op });
}

/**
 * Flush pending events before shutdown
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client
 */
export async function closeSentry(timeout = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

// Export Sentry for direct access
export { Sentry };

// Default export
export default {
  init: initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  startTransaction,
  flush: flushSentry,
  close: closeSentry,
};
