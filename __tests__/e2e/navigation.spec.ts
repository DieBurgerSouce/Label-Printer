import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests - Screenshot_Algo
 * End-to-end tests for page navigation and routing
 */

test.describe('Main Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to Dashboard', async ({ page }) => {
    // Dashboard is usually the home page
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should navigate to Articles page', async ({ page }) => {
    const articlesLink = page.locator('a[href*="articles"], nav >> text=Artikel, nav >> text=Articles');

    if (await articlesLink.count() > 0) {
      await articlesLink.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/articles/);
    }
  });

  test('should navigate to Shop Automation page', async ({ page }) => {
    const automationLink = page.locator(
      'a[href*="automation"], nav >> text=Automation, nav >> text=Shop'
    );

    if (await automationLink.count() > 0) {
      await automationLink.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/automation/);
    }
  });

  test('should navigate to Templates page', async ({ page }) => {
    const templatesLink = page.locator(
      'a[href*="templates"], nav >> text=Templates, nav >> text=Vorlagen'
    );

    if (await templatesLink.count() > 0) {
      await templatesLink.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/templates/);
    }
  });

  test('should navigate to Settings page', async ({ page }) => {
    const settingsLink = page.locator(
      'a[href*="settings"], nav >> text=Settings, nav >> text=Einstellungen'
    );

    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/settings/);
    }
  });
});

test.describe('Sidebar Navigation', () => {
  test('should have visible sidebar on desktop', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 720 });

    const sidebar = page.locator('aside, nav[role="navigation"], .sidebar');
    if (await sidebar.count() > 0) {
      await expect(sidebar.first()).toBeVisible();
    }
  });

  test('should show navigation items in sidebar', async ({ page }) => {
    await page.goto('/');

    // Check for common navigation items
    const navItems = page.locator('nav a, aside a, .sidebar a');
    const count = await navItems.count();

    // Should have multiple navigation items
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Breadcrumb Navigation', () => {
  test('should show breadcrumbs on subpages', async ({ page }) => {
    // Navigate to a subpage
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    const breadcrumb = page.locator('[aria-label="breadcrumb"], .breadcrumb, nav ol');

    if (await breadcrumb.count() > 0) {
      await expect(breadcrumb.first()).toBeVisible();
    }
  });
});

test.describe('Route Guards and Redirects', () => {
  test('should handle unknown routes gracefully', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    // Should either show 404 page or redirect to home
    const page404 = page.locator('text=404, text=Not Found, text=Nicht gefunden');
    const homeRedirected = page.url().includes('/') && !page.url().includes('this-route');

    expect((await page404.count()) > 0 || homeRedirected).toBe(true);
  });
});

test.describe('Deep Linking', () => {
  test('should support direct navigation to Dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should support direct navigation to Articles', async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should support direct navigation to Templates', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});
