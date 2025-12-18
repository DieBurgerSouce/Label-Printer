/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping calls to failing services
 *
 * States:
 * - CLOSED: Normal operation, calls pass through
 * - OPEN: Service is failing, calls are rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited calls allowed
 */

import logger from './logger';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerOptions {
  /** Name for logging and identification */
  name: string;
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Number of successful calls to close circuit (default: 3) */
  successThreshold?: number;
  /** Time in ms to wait before half-opening (default: 30000) */
  resetTimeoutMs?: number;
  /** Time window in ms for counting failures (default: 60000) */
  failureWindowMs?: number;
  /** Function to determine if error should count as failure */
  isFailure?: (error: unknown) => boolean;
  /** Callback when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
  /** Fallback function when circuit is open */
  fallback?: <T>() => T | Promise<T>;
}

/**
 * Circuit breaker error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly resetAt: Date;

  constructor(circuitName: string, resetAt: Date) {
    super(`Circuit breaker '${circuitName}' is open. Will reset at ${resetAt.toISOString()}`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.resetAt = resetAt;
  }
}

/**
 * Internal state tracking
 */
interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  openedAt: number | null;
  failureTimestamps: number[];
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private readonly options: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'fallback'>> & {
    onStateChange?: CircuitBreakerOptions['onStateChange'];
    fallback?: CircuitBreakerOptions['fallback'];
  };
  private state: CircuitBreakerState;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 3,
      resetTimeoutMs: 30000,
      failureWindowMs: 60000,
      isFailure: () => true,
      ...options,
    };

    this.state = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      openedAt: null,
      failureTimestamps: [],
    };

    logger.info(`Circuit breaker '${this.options.name}' initialized`, {
      failureThreshold: this.options.failureThreshold,
      successThreshold: this.options.successThreshold,
      resetTimeoutMs: this.options.resetTimeoutMs,
    });
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    this.checkResetTimeout();
    return this.state.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: Date | null;
  } {
    return {
      state: this.getState(),
      failures: this.state.failures,
      successes: this.state.successes,
      lastFailureTime: this.state.lastFailureTime ? new Date(this.state.lastFailureTime) : null,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @example
   * const breaker = new CircuitBreaker({ name: 'external-api' });
   * const result = await breaker.execute(() => fetchExternalAPI());
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from OPEN to HALF_OPEN
    this.checkResetTimeout();

    // Reject immediately if circuit is open
    if (this.state.state === CircuitState.OPEN) {
      logger.warn(`Circuit '${this.options.name}' is open, rejecting call`);

      if (this.options.fallback) {
        logger.debug(`Using fallback for '${this.options.name}'`);
        return this.options.fallback<T>();
      }

      throw new CircuitOpenError(
        this.options.name,
        new Date((this.state.openedAt || 0) + this.options.resetTimeoutMs)
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    const previousState = this.state.state;
    this.state = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      openedAt: null,
      failureTimestamps: [],
    };

    if (previousState !== CircuitState.CLOSED) {
      this.transitionTo(CircuitState.CLOSED, previousState);
    }

    logger.info(`Circuit '${this.options.name}' manually reset`);
  }

  /**
   * Manually trip the circuit breaker to open state
   */
  trip(): void {
    if (this.state.state !== CircuitState.OPEN) {
      this.transitionTo(CircuitState.OPEN, this.state.state);
      this.state.openedAt = Date.now();
    }
  }

  /**
   * Handle successful call
   */
  private onSuccess(): void {
    if (this.state.state === CircuitState.HALF_OPEN) {
      this.state.successes++;

      if (this.state.successes >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED, CircuitState.HALF_OPEN);
        this.state.failures = 0;
        this.state.successes = 0;
        this.state.failureTimestamps = [];
      }
    } else if (this.state.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.state.failures = 0;
    }
  }

  /**
   * Handle failed call
   */
  private onFailure(error: unknown): void {
    // Check if this error should count as a failure
    if (!this.options.isFailure(error)) {
      return;
    }

    const now = Date.now();
    this.state.lastFailureTime = now;

    if (this.state.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.transitionTo(CircuitState.OPEN, CircuitState.HALF_OPEN);
      this.state.openedAt = now;
      this.state.successes = 0;
      return;
    }

    // Clean up old failures outside the window
    this.state.failureTimestamps = this.state.failureTimestamps.filter(
      (timestamp) => now - timestamp < this.options.failureWindowMs
    );

    // Record this failure
    this.state.failureTimestamps.push(now);
    this.state.failures = this.state.failureTimestamps.length;

    logger.warn(`Circuit '${this.options.name}' recorded failure`, {
      failures: this.state.failures,
      threshold: this.options.failureThreshold,
      error: error instanceof Error ? error.message : String(error),
    });

    // Check if we should open the circuit
    if (this.state.failures >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN, CircuitState.CLOSED);
      this.state.openedAt = now;
    }
  }

  /**
   * Check if reset timeout has passed and transition to half-open
   */
  private checkResetTimeout(): void {
    if (
      this.state.state === CircuitState.OPEN &&
      this.state.openedAt &&
      Date.now() - this.state.openedAt >= this.options.resetTimeoutMs
    ) {
      this.transitionTo(CircuitState.HALF_OPEN, CircuitState.OPEN);
      this.state.successes = 0;
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(to: CircuitState, from: CircuitState): void {
    this.state.state = to;

    logger.info(`Circuit '${this.options.name}' state transition`, {
      from,
      to,
    });

    if (this.options.onStateChange) {
      this.options.onStateChange(from, to, this.options.name);
    }
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker by name
   */
  get(name: string, options?: Omit<CircuitBreakerOptions, 'name'>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Create a function wrapped with circuit breaker protection
 *
 * @example
 * const protectedFetch = withCircuitBreaker(
 *   'external-api',
 *   fetchExternalAPI,
 *   { failureThreshold: 5 }
 * );
 *
 * const result = await protectedFetch();
 */
export function withCircuitBreaker<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: Omit<CircuitBreakerOptions, 'name'>
): (...args: TArgs) => Promise<TResult> {
  const breaker = circuitBreakerRegistry.get(name, options);
  return (...args: TArgs) => breaker.execute(() => fn(...args));
}

export default CircuitBreaker;
