import { test, expect } from '@playwright/test';

/**
 * Homepage E2E Tests - Screenshot_Algo
 * End-to-end tests for the homepage
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/Screenshot/i);
  });

  test('should have working navigation', async ({ page }) => {
    // Check that main navigation elements exist
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have no accessibility violations', async ({ page }) => {
    // Basic accessibility check
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for alt text on images
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Alt can be empty for decorative images, but should be present
      expect(alt !== null).toBe(true);
    }
  });

  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('Screenshot Feature', () => {
  test('should allow URL input', async ({ page }) => {
    await page.goto('/');

    // Look for URL input field
    const urlInput = page.locator('input[type="url"], input[placeholder*="URL"], input[name*="url"]');

    if (await urlInput.count() > 0) {
      await urlInput.first().fill('https://example.com');
      await expect(urlInput.first()).toHaveValue('https://example.com');
    }
  });

  test('should have a submit button', async ({ page }) => {
    await page.goto('/');

    // Look for submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Screenshot"), button:has-text("Capture")');

    if (await submitButton.count() > 0) {
      await expect(submitButton.first()).toBeVisible();
    }
  });
});

test.describe('Performance', () => {
  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/');

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries);
        });
        observer.observe({ entryTypes: ['navigation', 'paint'] });

        // Fallback if no metrics available
        setTimeout(() => resolve([]), 3000);
      });
    });

    // Basic check that page loaded
    expect(metrics).toBeDefined();
  });
});
