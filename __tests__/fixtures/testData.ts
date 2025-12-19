/**
 * Test Fixtures - Screenshot_Algo
 * Shared test data and utilities
 */

// Sample URLs for testing
export const testUrls = {
  valid: [
    'https://example.com',
    'https://google.com',
    'https://github.com',
    'https://wikipedia.org',
  ],
  invalid: [
    'not-a-url',
    'ftp://invalid.com',
    '',
    'javascript:alert(1)',
  ],
  malicious: [
    'https://example.com/<script>alert(1)</script>',
    "https://example.com/'OR'1'='1",
  ],
};

// Sample user data
export const testUsers = {
  admin: {
    id: 'user-admin-001',
    email: 'admin@test.com',
    role: 'admin',
    name: 'Test Admin',
  },
  regular: {
    id: 'user-regular-001',
    email: 'user@test.com',
    role: 'user',
    name: 'Test User',
  },
  guest: {
    id: 'user-guest-001',
    email: null,
    role: 'guest',
    name: 'Guest',
  },
};

// Sample screenshot requests
export const testScreenshotRequests = {
  basic: {
    url: 'https://example.com',
    format: 'png',
    width: 1920,
    height: 1080,
  },
  mobile: {
    url: 'https://example.com',
    format: 'png',
    width: 375,
    height: 667,
    device: 'iPhone 12',
  },
  fullPage: {
    url: 'https://example.com',
    format: 'png',
    fullPage: true,
  },
  pdf: {
    url: 'https://example.com',
    format: 'pdf',
    pageSize: 'A4',
  },
};

// Sample API responses
export const mockResponses = {
  success: {
    status: 'success',
    data: {
      screenshotId: 'screenshot-001',
      url: 'https://storage.example.com/screenshot-001.png',
    },
  },
  error: {
    status: 'error',
    message: 'Invalid URL provided',
    code: 'INVALID_URL',
  },
  rateLimited: {
    status: 'error',
    message: 'Rate limit exceeded',
    code: 'RATE_LIMITED',
    retryAfter: 60,
  },
};

// Helper functions
export const createMockRequest = (overrides = {}) => ({
  url: 'https://example.com',
  format: 'png',
  width: 1920,
  height: 1080,
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: `user-${Date.now()}`,
  email: 'test@example.com',
  role: 'user',
  name: 'Test User',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateRandomString = (length: number) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateRandomEmail = () => {
  return `test-${generateRandomString(8)}@example.com`;
};
