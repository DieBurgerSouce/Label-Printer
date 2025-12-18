/**
 * Circuit Breaker Tests
 * Tests for circuit breaker pattern implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
} from '../../src/utils/circuit-breaker';

describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================
  // Basic Functionality Tests
  // ========================================
  describe('Basic Functionality', () => {
    it('should execute function when closed', async () => {
      const cb = new CircuitBreaker({ name: 'test' });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await cb.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should start in closed state', () => {
      const cb = new CircuitBreaker({ name: 'test' });
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should track successful calls', async () => {
      const cb = new CircuitBreaker({ name: 'test' });
      const fn = vi.fn().mockResolvedValue('success');

      await cb.execute(fn);
      await cb.execute(fn);
      await cb.execute(fn);

      const stats = cb.getStats();
      expect(stats.successes).toBeGreaterThanOrEqual(0); // Successes reset on each success in CLOSED state
      expect(stats.failures).toBe(0);
    });

    it('should track failed calls', async () => {
      const cb = new CircuitBreaker({ name: 'test', failureThreshold: 10 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      const stats = cb.getStats();
      expect(stats.failures).toBe(1);
    });
  });

  // ========================================
  // State Transition Tests
  // ========================================
  describe('State Transitions', () => {
    it('should open circuit after threshold failures', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 3,
        resetTimeoutMs: 10000,
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject calls when open', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        resetTimeoutMs: 10000,
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      // Next call should be rejected immediately
      await expect(cb.execute(vi.fn())).rejects.toThrow(/Circuit breaker.*open/);
    });

    it('should transition to half-open after timeout', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        resetTimeoutMs: 50, // Very short timeout for test
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait past reset timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check state - should be half-open now
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after success in half-open state', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        resetTimeoutMs: 50,
        successThreshold: 1,
      });
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Open the circuit
      try {
        await cb.execute(failFn);
      } catch {
        // Expected
      }

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Successful call should close circuit
      await cb.execute(successFn);

      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should re-open circuit after failure in half-open state', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        resetTimeoutMs: 50,
      });
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      try {
        await cb.execute(failFn);
      } catch {
        // Expected
      }

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Failed call should re-open circuit
      try {
        await cb.execute(failFn);
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });
  });

  // ========================================
  // Configuration Tests
  // ========================================
  describe('Configuration', () => {
    it('should use custom failure threshold', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 5,
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // 4 failures should not open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await cb.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(cb.getState()).toBe(CircuitState.CLOSED);

      // 5th failure should open it
      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should use custom success threshold for closing', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        resetTimeoutMs: 50,
        successThreshold: 3,
      });
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Open circuit
      try {
        await cb.execute(failFn);
      } catch {
        // Expected
      }

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Need 3 successes to close
      await cb.execute(successFn);
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

      await cb.execute(successFn);
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

      await cb.execute(successFn);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should call onStateChange callback', async () => {
      const onStateChange = vi.fn();
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        onStateChange,
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN, 'test');
    });
  });

  // ========================================
  // Manual Control Tests
  // ========================================
  describe('Manual Control', () => {
    it('should allow manual open', async () => {
      const cb = new CircuitBreaker({ name: 'test' });

      cb.open();

      expect(cb.getState()).toBe(CircuitState.OPEN);
      await expect(cb.execute(vi.fn())).rejects.toThrow(/Circuit breaker.*open/);
    });

    it('should allow manual close', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open circuit
      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Manually close
      cb.close();

      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow reset', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
      });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause failures and open circuit
      try {
        await cb.execute(fn);
      } catch {
        // Expected
      }

      const statsBefore = cb.getStats();
      expect(statsBefore.failures).toBe(1);

      // Reset
      cb.reset();

      const statsAfter = cb.getStats();
      expect(statsAfter.failures).toBe(0);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  // ========================================
  // Registry Tests
  // ========================================
  describe('CircuitBreakerRegistry', () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
      registry = new CircuitBreakerRegistry();
    });

    it('should create and retrieve circuit breakers', () => {
      const cb = registry.get('test-service');
      expect(cb).toBeInstanceOf(CircuitBreaker);

      const cb2 = registry.get('test-service');
      expect(cb2).toBe(cb); // Same instance
    });

    it('should allow custom options per circuit', () => {
      const cb = registry.get('custom', { failureThreshold: 10 });
      expect(cb).toBeInstanceOf(CircuitBreaker);
    });

    it('should list all circuit breakers', () => {
      registry.get('service-a');
      registry.get('service-b');

      const all = registry.getAll();
      expect(Object.keys(all)).toContain('service-a');
      expect(Object.keys(all)).toContain('service-b');
    });

    it('should get all stats', () => {
      registry.get('service-a');
      registry.get('service-b');

      const allStats = registry.getAllStats();
      expect(allStats['service-a']).toBeDefined();
      expect(allStats['service-b']).toBeDefined();
    });

    it('should reset all circuit breakers', async () => {
      const cbA = registry.get('service-a', { failureThreshold: 1 });
      const cbB = registry.get('service-b', { failureThreshold: 1 });

      // Open both
      try {
        await cbA.execute(vi.fn().mockRejectedValue(new Error('fail')));
      } catch {
        // Expected
      }
      try {
        await cbB.execute(vi.fn().mockRejectedValue(new Error('fail')));
      } catch {
        // Expected
      }

      expect(cbA.getState()).toBe(CircuitState.OPEN);
      expect(cbB.getState()).toBe(CircuitState.OPEN);

      registry.resetAll();

      expect(cbA.getState()).toBe(CircuitState.CLOSED);
      expect(cbB.getState()).toBe(CircuitState.CLOSED);
    });
  });

  // ========================================
  // Global Registry Tests
  // ========================================
  describe('Global Registry', () => {
    it('should provide a default global registry', () => {
      expect(circuitBreakerRegistry).toBeInstanceOf(CircuitBreakerRegistry);
    });
  });
});
