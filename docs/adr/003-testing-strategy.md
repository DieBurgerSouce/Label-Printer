# ADR-003: Testing Strategy

## Status

Accepted

## Date

2024-01-01

## Context

We need a comprehensive testing strategy that:

- Catches bugs before production
- Enables confident refactoring
- Provides fast feedback during development
- Validates both functionality and integration
- Supports CI/CD pipeline

## Decision

We will implement a **testing pyramid** approach using:

- **Jest** for unit and integration tests
- **Playwright** for end-to-end tests
- **70% minimum coverage** requirement

### Testing Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ← Few, slow, high confidence
                    │ (Playwright)
                    ├───────────┤
                    │Integration│  ← Medium quantity
                    │  (Jest)   │
                    ├───────────┤
                    │   Unit    │  ← Many, fast, isolated
                    │  (Jest)   │
                    └───────────┘
```

### Test Categories

#### Unit Tests
- Test individual functions/classes in isolation
- Mock all external dependencies
- Fast execution (< 100ms per test)
- Location: `__tests__/unit/`

```typescript
// Example unit test
describe('ScreenshotEngine', () => {
  it('should validate URL before capture', async () => {
    const engine = new ScreenshotEngine();
    await expect(engine.capture({ url: 'invalid' }))
      .rejects.toThrow('Invalid URL');
  });
});
```

#### Integration Tests
- Test component interactions
- Use real dependencies where practical
- Test database queries, API routes
- Location: `__tests__/integration/`

```typescript
// Example integration test
describe('Screenshot API', () => {
  it('should capture screenshot and store result', async () => {
    const response = await request(app)
      .post('/api/screenshot')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(200);
    expect(response.body.imageUrl).toBeDefined();
  });
});
```

#### End-to-End Tests
- Test complete user workflows
- Run against deployed application
- Validate critical paths
- Location: `__tests__/e2e/`

```typescript
// Example E2E test
test('full screenshot workflow', async ({ page }) => {
  await page.goto('/');
  await page.fill('#url', 'https://example.com');
  await page.click('#capture');
  await expect(page.locator('#result')).toBeVisible();
});
```

### Configuration

#### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};
```

#### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './__tests__/e2e',
  retries: 2,
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Coverage Requirements

| Metric | Minimum | Target |
|--------|---------|--------|
| Branches | 70% | 85% |
| Functions | 70% | 85% |
| Lines | 70% | 85% |
| Statements | 70% | 85% |

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm test -- --coverage
    - uses: codecov/codecov-action@v3
```

## Consequences

### Positive

- **Confidence**: High test coverage enables confident deployments
- **Fast Feedback**: Unit tests provide immediate feedback
- **Regression Prevention**: Tests catch regressions automatically
- **Documentation**: Tests serve as executable documentation
- **Refactoring Support**: Tests enable safe refactoring

### Negative

- **Time Investment**: Writing and maintaining tests takes time
- **Test Maintenance**: Tests need updating when code changes
- **False Confidence**: High coverage doesn't guarantee bug-free code
- **E2E Flakiness**: E2E tests can be flaky and slow

### Neutral

- Team needs testing discipline
- Requires CI/CD infrastructure for automation

## Alternatives Considered

### No Testing

- **Pros**: Faster initial development
- **Cons**: Bugs found in production, regression risk
- **Why not chosen**: Unacceptable risk for production system

### Only E2E Tests

- **Pros**: Tests real user scenarios
- **Cons**: Slow feedback, hard to debug failures
- **Why not chosen**: Need fast feedback from unit tests

### Different Test Framework (Mocha/Vitest)

- **Pros**: Alternative features, potentially faster
- **Cons**: Less integrated experience
- **Why not chosen**: Jest has best TypeScript integration and ecosystem

## References

- [Jest Documentation](https://jestjs.io/docs/)
- [Playwright Documentation](https://playwright.dev/docs/)
- [Testing JavaScript](https://testingjavascript.com/)
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
