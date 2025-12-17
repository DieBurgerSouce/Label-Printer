/**
 * Vitest Test Setup - Backend
 * This file runs before each test file
 */

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Mock console methods to reduce noise in test output
// Comment out if you need to debug
const originalConsole = { ...console };

beforeAll(() => {
  console.log = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();
  // Keep warn and error visible for debugging
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});
