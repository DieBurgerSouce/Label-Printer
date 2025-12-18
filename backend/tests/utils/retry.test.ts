/**
 * Retry Utility Tests
 * Tests for exponential backoff retry logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { withRetry, createRetryable, RetryPredicates, RetryPresets } from '../../src/utils/retry';

describe('Retry Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================
  // withRetry Tests
  // ========================================
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10, // Very short delay for tests
        jitter: false,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        withRetry(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
          jitter: false,
        })
      ).rejects.toThrow('Always fails');

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'));

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          isRetryable: () => false,
        })
      ).rejects.toThrow('Non-retryable');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('Fail')).mockResolvedValue('success');

      const onRetry = vi.fn();

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        jitter: false,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should apply exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const delays: number[] = [];

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        jitter: false,
        onRetry: (_attempt, _error, delay) => {
          delays.push(delay);
        },
      });

      // First retry: 100ms, Second retry: 200ms
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
    });

    it('should respect maxDelayMs', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('Fail')).mockResolvedValue('success');

      let capturedDelay = 0;

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10000,
        maxDelayMs: 500,
        jitter: false,
        onRetry: (_attempt, _error, delay) => {
          capturedDelay = delay;
        },
      });

      expect(capturedDelay).toBeLessThanOrEqual(500);
    });
  });

  // ========================================
  // createRetryable Tests
  // ========================================
  describe('createRetryable', () => {
    it('should create a retryable function', async () => {
      const originalFn = vi.fn().mockResolvedValue('result');

      const retryableFn = createRetryable(originalFn, { maxRetries: 3 });

      const result = await retryableFn('arg1', 'arg2');

      expect(result).toBe('result');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should pass arguments correctly', async () => {
      const originalFn = vi.fn().mockResolvedValue('result');

      const retryableFn = createRetryable(originalFn, { maxRetries: 1 });

      await retryableFn(1, 'string', { key: 'value' });

      expect(originalFn).toHaveBeenCalledWith(1, 'string', { key: 'value' });
    });
  });

  // ========================================
  // RetryPredicates Tests
  // ========================================
  describe('RetryPredicates', () => {
    describe('isNetworkError', () => {
      it('should return true for network errors', () => {
        const networkErrors = [
          new Error('ECONNREFUSED'),
          new Error('ETIMEDOUT'),
          new Error('ENOTFOUND'),
          new Error('ECONNRESET'),
          new Error('EAI_AGAIN'),
        ];

        networkErrors.forEach((err) => {
          expect(RetryPredicates.isNetworkError(err)).toBe(true);
        });
      });

      it('should return false for non-network errors', () => {
        expect(RetryPredicates.isNetworkError(new Error('Some other error'))).toBe(false);
        expect(RetryPredicates.isNetworkError(null)).toBe(false);
        expect(RetryPredicates.isNetworkError('string error')).toBe(false);
      });
    });

    describe('isServerError', () => {
      it('should return true for 5xx errors', () => {
        const serverErrors = [
          new Error('status: 500'),
          new Error('status 502'),
          new Error('HTTP status: 503'),
        ];

        serverErrors.forEach((err) => {
          expect(RetryPredicates.isServerError(err)).toBe(true);
        });
      });

      it('should return false for 4xx errors', () => {
        expect(RetryPredicates.isServerError(new Error('status: 404'))).toBe(false);
        expect(RetryPredicates.isServerError(new Error('status: 400'))).toBe(false);
      });
    });

    describe('isRateLimitError', () => {
      it('should return true for rate limit errors', () => {
        expect(RetryPredicates.isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
        expect(RetryPredicates.isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
      });

      it('should return false for other errors', () => {
        expect(RetryPredicates.isRateLimitError(new Error('500 Server Error'))).toBe(false);
      });
    });

    describe('isTransientError', () => {
      it('should return true for any transient error', () => {
        expect(RetryPredicates.isTransientError(new Error('ECONNREFUSED'))).toBe(true);
        expect(RetryPredicates.isTransientError(new Error('status: 503'))).toBe(true);
        expect(RetryPredicates.isTransientError(new Error('429 rate limit'))).toBe(true);
      });
    });

    describe('never and always', () => {
      it('should return false for never', () => {
        expect(RetryPredicates.never()).toBe(false);
      });

      it('should return true for always', () => {
        expect(RetryPredicates.always()).toBe(true);
      });
    });
  });

  // ========================================
  // RetryPresets Tests
  // ========================================
  describe('RetryPresets', () => {
    it('should have quick preset with correct values', () => {
      expect(RetryPresets.quick.maxRetries).toBe(3);
      expect(RetryPresets.quick.initialDelayMs).toBe(500);
    });

    it('should have standard preset with correct values', () => {
      expect(RetryPresets.standard.maxRetries).toBe(3);
      expect(RetryPresets.standard.initialDelayMs).toBe(1000);
    });

    it('should have aggressive preset with correct values', () => {
      expect(RetryPresets.aggressive.maxRetries).toBe(5);
      expect(RetryPresets.aggressive.initialDelayMs).toBe(2000);
    });

    it('should have rateLimit preset with longer delays', () => {
      expect(RetryPresets.rateLimit.maxRetries).toBe(5);
      expect(RetryPresets.rateLimit.initialDelayMs).toBe(5000);
      expect(RetryPresets.rateLimit.maxDelayMs).toBe(120000);
    });
  });
});
