import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration - Screenshot_Algo
 * Cross-browser testing with comprehensive device coverage
 */
export default defineConfig({
  // Test directory
  testDir: './__tests__/e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail fast in CI
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Worker configuration
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Global test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (for local dev)
    ignoreHTTPSErrors: true,

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 15000,

    // Locale
    locale: 'de-DE',

    // Timezone
    timezoneId: 'Europe/Berlin',
  },

  // Browser projects
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'iPad',
      use: { ...devices['iPad Pro 11'] },
    },

    // Edge (Chromium)
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },

    // Chrome branded
    {
      name: 'Google Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],

  // Web server configuration
  webServer: [
    {
      // Backend API server
      command: 'npm run dev:backend',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
        PORT: '4000',
      },
    },
    {
      // Frontend dev server
      command: 'npm run dev:frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
      },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Global setup/teardown
  // globalSetup: require.resolve('./playwright.global-setup.ts'),
  // globalTeardown: require.resolve('./playwright.global-teardown.ts'),
});
