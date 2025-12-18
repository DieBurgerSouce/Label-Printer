import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// Error reporting callback type
type ErrorReporter = (error: Error, errorInfo: ErrorInfo, errorId: string) => void;

// Global error reporter - can be set once at app initialization
let globalErrorReporter: ErrorReporter | null = null;

/**
 * Set a global error reporter function (e.g., for Sentry integration)
 * Call this once at app startup:
 * @example
 * setErrorReporter((error, errorInfo, errorId) => {
 *   Sentry.captureException(error, { extra: { errorId, componentStack: errorInfo.componentStack } });
 * });
 */
export function setErrorReporter(reporter: ErrorReporter): void {
  globalErrorReporter = reporter;
}

// Generate a unique error ID for tracking
function generateErrorId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `err_${crypto.randomUUID()}`;
  }
  // Fallback for older browsers
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Feature name for context (e.g., 'LabelEditor', 'PrintPreview') */
  featureName?: string;
  /** Custom error reporter for this boundary */
  onError?: ErrorReporter;
  /** Show compact UI for feature-level boundaries */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI
 *
 * Features:
 * - Generates unique error ID for tracking
 * - Supports global error reporter (for Sentry/etc.)
 * - Supports per-boundary error reporter
 * - Compact mode for feature-level boundaries
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const errorId = this.state.errorId || generateErrorId();
    const featureContext = this.props.featureName ? ` [${this.props.featureName}]` : '';

    // Log error to console
    console.error(`ErrorBoundary${featureContext} caught an error [${errorId}]:`, error, errorInfo);

    // Report to custom handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId);
    }

    // Report to global handler if configured
    if (globalErrorReporter) {
      globalErrorReporter(error, errorInfo, errorId);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Compact UI for feature-level boundaries
      if (this.props.compact) {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">
                  {this.props.featureName
                    ? `Fehler in ${this.props.featureName}`
                    : 'Ein Fehler ist aufgetreten'}
                </p>
                {this.state.error && (
                  <p className="text-sm text-red-600 mt-1 truncate">
                    {this.state.error.message}
                  </p>
                )}
                {this.state.errorId && (
                  <p className="text-xs text-red-400 mt-1 font-mono">
                    ID: {this.state.errorId}
                  </p>
                )}
              </div>
              <button
                onClick={this.handleReset}
                className="flex-shrink-0 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Erneut
              </button>
            </div>
          </div>
        );
      }

      // Full-page UI for app-level boundary
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Ein Fehler ist aufgetreten
            </h2>

            <p className="text-gray-600 text-center mb-4">
              Die Anwendung hat einen unerwarteten Fehler festgestellt.
            </p>

            {this.state.error && (
              <div className="bg-gray-50 rounded-md p-3 mb-4">
                <p className="text-sm font-mono text-red-600 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {this.state.errorId && (
              <p className="text-xs text-gray-400 text-center mb-4 font-mono">
                Fehler-ID: {this.state.errorId}
              </p>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Erneut versuchen
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Seite neu laden
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Technische Details (Entwicklermodus)
                </summary>
                <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Feature-level Error Boundary - use this to wrap individual features/sections
 * Shows a compact error UI instead of full-page error
 */
export function FeatureErrorBoundary({
  children,
  featureName,
  fallback,
}: {
  children: ReactNode;
  featureName: string;
  fallback?: ReactNode;
}): ReactNode {
  return (
    <ErrorBoundary featureName={featureName} compact fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
