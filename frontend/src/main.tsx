/**
 * Application Entry Point
 * Initializes Sentry, Web Vitals, and renders the React app
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.tsx';
import { setErrorReporter } from './components/common/ErrorBoundary';
import { initWebVitals, onWebVitals, sendToSentry } from './utils/web-vitals';

// Initialize Sentry for error tracking (production only)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: `screenshot-algo-frontend@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    // Session replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% on error
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
    // Ignore common errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Network request failed',
    ],
  });

  console.log('[Sentry] Initialized for error tracking');
}

// Connect Sentry to ErrorBoundary global reporter
if (SENTRY_DSN) {
  setErrorReporter((error, errorInfo, errorId) => {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        errorId,
      },
      tags: {
        errorBoundary: 'true',
      },
    });
  });
}

// Initialize Web Vitals monitoring
initWebVitals();

// Send Web Vitals to Sentry if configured
if (SENTRY_DSN) {
  onWebVitals(sendToSentry());
}

// Development-only Web Vitals logging
if (import.meta.env.DEV) {
  onWebVitals((metric) => {
    console.log(
      `%c[Web Vitals] ${metric.name}`,
      `color: ${metric.rating === 'good' ? 'green' : metric.rating === 'needs-improvement' ? 'orange' : 'red'}`,
      `${metric.value.toFixed(2)} (${metric.rating})`
    );
  });
}

// Render the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
