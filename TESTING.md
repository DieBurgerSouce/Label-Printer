# Testing Guide

Comprehensive testing documentation for Screenshot_Algo.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Coverage](#coverage)
- [Best Practices](#best-practices)

## Overview

We use the following testing tools:

| Tool | Purpose |
|------|---------|
| Jest | Unit & Integration tests |
| Playwright | E2E browser testing |
| Testing Library | React component tests |

### Coverage Requirements

- **Minimum**: 70% overall
- **Critical paths**: 90%+
- **New code**: Must have tests

## Test Structure

```
Screenshot_Algo/
├── __tests__/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── e2e/            # End-to-end tests
│   └── fixtures/       # Test data & mocks
├── jest.config.js      # Jest configuration
├── playwright.config.ts # Playwright configuration
└── jest.setup.js       # Jest setup file
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Types

```bash
# Unit tests
npm test -- --testPathPattern=unit

# Integration tests
npm test -- --testPathPattern=integration

# E2E tests
npx playwright test
```

### Watch Mode

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm test -- --coverage
```

### Specific File

```bash
npm test -- path/to/test.ts
```

## Writing Tests

### Unit Tests

```typescript
// __tests__/unit/utils.test.ts
import { formatDate, validateUrl } from '@/utils';

describe('Utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('15.01.2024');
    });

    it('should handle invalid dates', () => {
      expect(() => formatDate(null)).toThrow();
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/api.test.ts
import request from 'supertest';
import { app } from '@/app';

describe('API Integration', () => {
  beforeAll(async () => {
    // Setup test database
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('POST /api/screenshot', () => {
    it('should create screenshot request', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should reject invalid URLs', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'invalid' });

      expect(response.status).toBe(400);
    });
  });
});
```

### E2E Tests (Playwright)

```typescript
// __tests__/e2e/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display screenshot form', async ({ page }) => {
    await page.goto('/');

    const urlInput = page.locator('input[name="url"]');
    await expect(urlInput).toBeVisible();

    await urlInput.fill('https://example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('.screenshot-preview')).toBeVisible();
  });

  test('should show error for invalid URL', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[name="url"]', 'invalid');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('Invalid URL');
  });
});
```

## Coverage

### Viewing Coverage

```bash
# Generate report
npm test -- --coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

## Best Practices

### 1. Follow AAA Pattern

```typescript
it('should calculate total', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(30);
});
```

### 2. Use Descriptive Names

```typescript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should return 0 when cart is empty', () => { ... });
```

### 3. Test Edge Cases

```typescript
describe('divide', () => {
  it('should divide positive numbers', () => { ... });
  it('should handle negative numbers', () => { ... });
  it('should throw on division by zero', () => { ... });
  it('should handle decimal numbers', () => { ... });
});
```

### 4. Mock External Dependencies

```typescript
jest.mock('@/services/api', () => ({
  fetchScreenshot: jest.fn().mockResolvedValue({ url: 'mock.png' }),
}));
```

### 5. Clean Up After Tests

```typescript
afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await database.disconnect();
});
```

### 6. Use Fixtures for Test Data

```typescript
// __tests__/fixtures/testData.ts
export const validScreenshotRequest = {
  url: 'https://example.com',
  format: 'png',
  width: 1920,
  height: 1080,
};
```

## Troubleshooting

### Tests Timeout

```javascript
// Increase timeout
jest.setTimeout(30000);
```

### Database Issues

```bash
# Reset test database
npm run db:reset:test
```

### Flaky Tests

- Add `retry` option in Playwright
- Use `waitFor` instead of fixed delays
- Check for race conditions

---

Happy Testing! 🧪
