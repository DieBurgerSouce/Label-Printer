/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals metrics (LCP, FID, CLS, FCP, TTFB)
 * Sends metrics to analytics/monitoring services
 */

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// Metric thresholds based on Google's Web Vitals recommendations
export const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 }, // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
  INP: { good: 200, needsImprovement: 500 }, // Interaction to Next Paint
} as const;

// Rating type
export type MetricRating = 'good' | 'needs-improvement' | 'poor';

// Processed metric with rating
export interface ProcessedMetric {
  name: string;
  value: number;
  rating: MetricRating;
  delta: number;
  id: string;
  navigationType: string;
}

// Callback for handling metrics
export type MetricHandler = (metric: ProcessedMetric) => void;

// Default handlers
let metricHandlers: MetricHandler[] = [];

/**
 * Get rating for a metric value
 */
function getRating(name: string, value: number): MetricRating {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Process a web vitals metric
 */
function processMetric(metric: Metric): ProcessedMetric {
  return {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType || 'unknown',
  };
}

/**
 * Handle a metric by calling all registered handlers
 */
function handleMetric(metric: Metric): void {
  const processed = processMetric(metric);

  // Log in development
  if (import.meta.env.DEV) {
    console.log(
      `[Web Vitals] ${processed.name}: ${processed.value.toFixed(2)} (${processed.rating})`
    );
  }

  // Call all registered handlers
  metricHandlers.forEach((handler) => {
    try {
      handler(processed);
    } catch (error) {
      console.error('[Web Vitals] Handler error:', error);
    }
  });
}

/**
 * Register a handler for web vitals metrics
 */
export function onWebVitals(handler: MetricHandler): () => void {
  metricHandlers.push(handler);

  // Return unsubscribe function
  return () => {
    metricHandlers = metricHandlers.filter((h) => h !== handler);
  };
}

/**
 * Initialize web vitals collection
 * Should be called once in the app entry point
 */
export function initWebVitals(): void {
  // Register all metric observers
  onCLS(handleMetric);
  onFCP(handleMetric);
  onFID(handleMetric);
  onINP(handleMetric);
  onLCP(handleMetric);
  onTTFB(handleMetric);

  if (import.meta.env.DEV) {
    console.log('[Web Vitals] Monitoring initialized');
  }
}

/**
 * Send metrics to a beacon endpoint
 * Use this for analytics or monitoring services
 */
export function sendToBeacon(url: string): MetricHandler {
  return (metric) => {
    const body = JSON.stringify({
      ...metric,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // Use sendBeacon for reliable delivery
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      // Fallback to fetch
      fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Ignore errors - metrics are best-effort
      });
    }
  };
}

/**
 * Send metrics to Sentry as custom metrics
 */
export function sendToSentry(): MetricHandler {
  return (metric) => {
    // Check if Sentry is available
    const Sentry = (
      window as {
        Sentry?: {
          metrics?: {
            distribution: (
              name: string,
              value: number,
              options: { tags: Record<string, string> }
            ) => void;
          };
        };
      }
    ).Sentry;
    if (Sentry?.metrics) {
      Sentry.metrics.distribution(`web_vitals.${metric.name.toLowerCase()}`, metric.value, {
        tags: {
          rating: metric.rating,
          navigationType: metric.navigationType,
        },
      });
    }
  };
}

/**
 * Get performance budget status
 */
export function checkPerformanceBudget(metrics: ProcessedMetric[]): {
  passed: boolean;
  violations: ProcessedMetric[];
} {
  const violations = metrics.filter((m) => m.rating === 'poor');

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Format metric value for display
 */
export function formatMetricValue(name: string, value: number): string {
  switch (name) {
    case 'CLS':
      return value.toFixed(3);
    case 'LCP':
    case 'FCP':
    case 'TTFB':
    case 'FID':
    case 'INP':
      return `${Math.round(value)}ms`;
    default:
      return value.toFixed(2);
  }
}
