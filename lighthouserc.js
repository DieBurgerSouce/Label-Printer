/**
 * Lighthouse CI Configuration
 * https://github.com/GoogleChrome/lighthouse-ci
 */

module.exports = {
  ci: {
    collect: {
      // Server configuration
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Server listening on',
      startServerReadyTimeout: 30000,

      // URLs to test
      url: [
        'http://localhost:4000/',
        'http://localhost:4000/health',
      ],

      // Collection settings
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 1,
        },
        // Skip PWA audits if not applicable
        skipAudits: [
          'installable-manifest',
          'service-worker',
        ],
      },
    },

    assert: {
      // Assertion configuration
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'interactive': ['error', { maxNumericValue: 4000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],

        // Accessibility
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'color-contrast': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',

        // Best Practices
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'errors-in-console': 'warn',
        'deprecations': 'warn',
        'doctype': 'error',
        'charset': 'error',

        // SEO
        'categories:seo': ['warn', { minScore: 0.9 }],
        'meta-description': 'warn',
        'robots-txt': 'warn',

        // PWA (optional, relaxed)
        'categories:pwa': 'off',

        // Security
        'is-on-https': 'off', // Disabled for local testing
        'csp-xss': 'warn',

        // Resource sizes
        'total-byte-weight': ['warn', { maxNumericValue: 1500000 }],
        'unminified-css': 'warn',
        'unminified-javascript': 'warn',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',

        // Network
        'uses-http2': 'off', // May not be available locally
        'uses-text-compression': 'warn',
        'uses-responsive-images': 'warn',
        'efficient-animated-content': 'warn',
      },
    },

    upload: {
      // Upload configuration (choose one)
      target: 'temporary-public-storage',
      // Or for GitHub Actions:
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.example.com',
      // token: process.env.LHCI_TOKEN,
    },
  },
};
