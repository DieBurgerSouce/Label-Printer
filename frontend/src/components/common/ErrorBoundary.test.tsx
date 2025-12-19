/**
 * ErrorBoundary Component Tests
 * Tests error catching, fallback rendering, and error reporting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary, { FeatureErrorBoundary, setErrorReporter } from './ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div data-testid="child-component">Child rendered successfully</div>;
}

// Suppress console.error in tests since we're testing error handling
const originalError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  describe('when no error occurs', () => {
    it('renders children normally', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child-component')).toBeInTheDocument();
      expect(screen.getByText('Child rendered successfully')).toBeInTheDocument();
    });
  });

  describe('when an error occurs', () => {
    it('catches errors and displays fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText('Ein Fehler ist aufgetreten')).toBeInTheDocument();
      expect(screen.getByText(/Test error message/)).toBeInTheDocument();
    });

    it('displays the error ID', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Error ID should be displayed
      expect(screen.getByText(/Fehler-ID:/)).toBeInTheDocument();
    });

    it('shows retry and reload buttons', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Erneut versuchen')).toBeInTheDocument();
      expect(screen.getByText('Seite neu laden')).toBeInTheDocument();
    });

    it('handles retry button click by resetting error state', () => {
      // Use a stateful wrapper to control the throwing behavior
      let shouldThrow = true;

      function ConditionalThrow() {
        if (shouldThrow) {
          throw new Error('Test error message');
        }
        return <div data-testid="recovered-component">Recovered successfully</div>;
      }

      render(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>
      );

      // Verify error state
      expect(screen.getByText('Ein Fehler ist aufgetreten')).toBeInTheDocument();

      // "Fix" the error condition
      shouldThrow = false;

      // Click retry button
      const retryButton = screen.getByText('Erneut versuchen');
      fireEvent.click(retryButton);

      // After reset and re-render, child should show
      expect(screen.getByTestId('recovered-component')).toBeInTheDocument();
    });
  });

  describe('with custom fallback', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders compact UI when compact prop is true', () => {
      render(
        <ErrorBoundary compact>
          <ThrowError />
        </ErrorBoundary>
      );

      // Compact mode shows "Erneut" instead of "Erneut versuchen"
      expect(screen.getByText('Erneut')).toBeInTheDocument();
      // Should not show the full-page UI elements
      expect(screen.queryByText('Seite neu laden')).not.toBeInTheDocument();
    });

    it('displays feature name in compact mode', () => {
      render(
        <ErrorBoundary compact featureName="LabelEditor">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Fehler in LabelEditor')).toBeInTheDocument();
    });
  });

  describe('error reporting', () => {
    it('calls onError callback when error occurs', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) }),
        expect.stringMatching(/^err_/)
      );
    });

    it('calls global error reporter when set', () => {
      const globalReporter = vi.fn();
      setErrorReporter(globalReporter);

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(globalReporter).toHaveBeenCalledTimes(1);
      expect(globalReporter).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) }),
        expect.stringMatching(/^err_/)
      );

      // Reset global reporter
      setErrorReporter(() => {});
    });

    it('calls both onError and global reporter', () => {
      const onError = vi.fn();
      const globalReporter = vi.fn();
      setErrorReporter(globalReporter);

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(globalReporter).toHaveBeenCalledTimes(1);

      // Reset global reporter
      setErrorReporter(() => {});
    });
  });
});

describe('FeatureErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <FeatureErrorBoundary featureName="TestFeature">
        <ThrowError shouldThrow={false} />
      </FeatureErrorBoundary>
    );

    expect(screen.getByTestId('child-component')).toBeInTheDocument();
  });

  it('uses compact mode by default', () => {
    render(
      <FeatureErrorBoundary featureName="TestFeature">
        <ThrowError />
      </FeatureErrorBoundary>
    );

    // Should show compact UI with feature name
    expect(screen.getByText('Fehler in TestFeature')).toBeInTheDocument();
    expect(screen.getByText('Erneut')).toBeInTheDocument();
  });

  it('accepts custom fallback', () => {
    const customFallback = <div data-testid="custom-feature-fallback">Feature Error</div>;

    render(
      <FeatureErrorBoundary featureName="TestFeature" fallback={customFallback}>
        <ThrowError />
      </FeatureErrorBoundary>
    );

    expect(screen.getByTestId('custom-feature-fallback')).toBeInTheDocument();
  });
});

describe('Error ID generation', () => {
  it('generates unique error IDs', () => {
    const errorIds: string[] = [];
    const onError = vi.fn((_, __, errorId) => {
      errorIds.push(errorId);
    });

    // Render multiple error boundaries
    const { unmount } = render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );
    unmount();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should have called onError twice with different IDs
    expect(onError).toHaveBeenCalledTimes(2);
    expect(errorIds[0]).not.toBe(errorIds[1]);
    expect(errorIds[0]).toMatch(/^err_/);
    expect(errorIds[1]).toMatch(/^err_/);
  });
});
