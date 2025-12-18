/**
 * Retry Utility with Exponential Backoff
 * Enterprise-grade retry logic for resilient external API calls
 */

import logger from './logger';

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to delay (default: true) */
  jitter?: boolean;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Name of operation for logging */
  operationName?: string;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'operationName'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
};

/**
 * Calculate delay for retry attempt with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: delay = initial * multiplier^attempt
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at maximum delay
  delay = Math.min(delay, maxDelayMs);

  // Add jitter (±25% randomization) to prevent thundering herd
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchExternalAPI(),
 *   { maxRetries: 3 }
 * );
 *
 * @example
 * // With custom retry logic
 * const result = await withRetry(
 *   () => uploadToCloudStorage(file),
 *   {
 *     maxRetries: 5,
 *     initialDelayMs: 500,
 *     isRetryable: (error) => error instanceof NetworkError,
 *     operationName: 'cloud-upload'
 *   }
 * );
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier, jitter, isRetryable } = config;
  const operationName = options.operationName || 'operation';

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the function
      const result = await fn();

      // Log success after retries
      if (attempt > 0) {
        logger.info(`${operationName} succeeded after ${attempt} retries`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries) {
        logger.error(`${operationName} failed after ${maxRetries} retries`, {
          error: error instanceof Error ? error.message : String(error),
          totalAttempts: attempt + 1,
        });
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        logger.warn(`${operationName} failed with non-retryable error`, {
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      // Calculate delay for next retry
      const delay = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, jitter);

      logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: error instanceof Error ? error.message : String(error),
        delayMs: delay,
      });

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt + 1, error, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Throw the last error if all retries failed
  throw lastError;
}

/**
 * Create a retryable version of a function
 *
 * @example
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3, operationName: 'api-fetch' }
 * );
 *
 * const data = await retryableFetch('/api/data');
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Common retry predicates for different error types
 */
export const RetryPredicates = {
  /** Retry on network errors (ECONNREFUSED, ETIMEDOUT, etc.) */
  isNetworkError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const networkCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'];
      return networkCodes.some((code) => error.message.includes(code));
    }
    return false;
  },

  /** Retry on HTTP 5xx errors */
  isServerError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const match = error.message.match(/status[:\s]+(\d{3})/i);
      if (match) {
        const status = parseInt(match[1], 10);
        return status >= 500 && status < 600;
      }
    }
    return false;
  },

  /** Retry on HTTP 429 (Too Many Requests) */
  isRateLimitError: (error: unknown): boolean => {
    if (error instanceof Error) {
      return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
    }
    return false;
  },

  /** Retry on any transient error (network, server, rate limit) */
  isTransientError: (error: unknown): boolean => {
    return (
      RetryPredicates.isNetworkError(error) ||
      RetryPredicates.isServerError(error) ||
      RetryPredicates.isRateLimitError(error)
    );
  },

  /** Never retry (fail immediately) */
  never: (): boolean => false,

  /** Always retry */
  always: (): boolean => true,
};

/**
 * Pre-configured retry options for common scenarios
 */
export const RetryPresets = {
  /** Quick retries for fast APIs (3 retries, 500ms initial) */
  quick: {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    isRetryable: RetryPredicates.isTransientError,
  } as RetryOptions,

  /** Standard retries for most operations (3 retries, 1s initial) */
  standard: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 15000,
    isRetryable: RetryPredicates.isTransientError,
  } as RetryOptions,

  /** Aggressive retries for critical operations (5 retries, 2s initial) */
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    isRetryable: RetryPredicates.isTransientError,
  } as RetryOptions,

  /** Rate limit specific (longer delays for 429 errors) */
  rateLimit: {
    maxRetries: 5,
    initialDelayMs: 5000,
    maxDelayMs: 120000,
    backoffMultiplier: 2.5,
    isRetryable: RetryPredicates.isRateLimitError,
  } as RetryOptions,
};

export default withRetry;
