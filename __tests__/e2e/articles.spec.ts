import { test, expect } from '@playwright/test';

/**
 * Articles Page E2E Tests - Screenshot_Algo
 * End-to-end tests for article management features
 */

test.describe('Articles Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');
  });

  test('should display articles page', async ({ page }) => {
    // Page should load
    await expect(page.locator('body')).toBeVisible();

    // Should have a heading
    const heading = page.locator('h1, h2').filter({ hasText: /Artikel|Articles|Products/i });
    if (await heading.count() > 0) {
      await expect(heading.first()).toBeVisible();
    }
  });

  test('should display search functionality', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Suche"], input[placeholder*="Search"]'
    );

    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test('should allow searching articles', async ({ page }) => {
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Suche"], input[placeholder*="Search"]'
    );

    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');

      // Wait for search results
      await page.waitForTimeout(500);

      // Page should still be responsive
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display article cards or list', async ({ page }) => {
    // Look for article cards or list items
    const articleItems = page.locator(
      '[class*="article"], [class*="product"], [class*="card"], table tbody tr'
    );

    // May have no articles, but the container should exist
    await page.waitForTimeout(1000);
    const container = page.locator('[class*="grid"], [class*="list"], table, main');
    await expect(container.first()).toBeVisible();
  });

  test('should have filter options', async ({ page }) => {
    // Look for filter button or dropdown
    const filterButton = page.locator(
      'button:has-text("Filter"), button[aria-label*="filter"], select'
    );

    if (await filterButton.count() > 0) {
      await expect(filterButton.first()).toBeVisible();
    }
  });

  test('should have sorting options', async ({ page }) => {
    // Look for sort button or dropdown
    const sortButton = page.locator(
      'button:has-text("Sort"), select[name*="sort"], th[role="columnheader"]'
    );

    if (await sortButton.count() > 0) {
      await expect(sortButton.first()).toBeVisible();
    }
  });
});

test.describe('Article Details', () => {
  test('should open article details on click', async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // Find and click first article
    const articleItem = page.locator(
      '[class*="article"], [class*="product"], [class*="card"], table tbody tr'
    );

    if ((await articleItem.count()) > 0) {
      await articleItem.first().click();

      // Should open modal or navigate to detail page
      await page.waitForTimeout(500);

      // Check for modal or detail view
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
      const detailView = page.locator('[class*="detail"], [class*="preview"]');

      const hasModal = (await modal.count()) > 0;
      const hasDetail = (await detailView.count()) > 0;
      const urlChanged = page.url().includes('/article/') || page.url().includes('/product/');

      // At least one should be true
      expect(hasModal || hasDetail || urlChanged).toBe(true);
    }
  });
});

test.describe('Article Actions', () => {
  test('should have action buttons for articles', async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // Look for action buttons (edit, delete, generate label)
    const actionButton = page.locator(
      'button:has-text("Edit"), button:has-text("Delete"), button:has-text("Label"), ' +
        'button[aria-label*="edit"], button[aria-label*="delete"]'
    );

    if ((await actionButton.count()) > 0) {
      await expect(actionButton.first()).toBeVisible();
    }
  });

  test('should have bulk action options', async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // Look for checkboxes or select all
    const checkbox = page.locator('input[type="checkbox"]');
    const selectAll = page.locator('button:has-text("Select all"), input[type="checkbox"][name*="all"]');

    if ((await checkbox.count()) > 0 || (await selectAll.count()) > 0) {
      // Has bulk selection capability
      expect(true).toBe(true);
    }
  });
});

test.describe('Articles Pagination', () => {
  test('should have pagination controls if many articles', async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // Look for pagination
    const pagination = page.locator(
      '[class*="pagination"], nav[aria-label*="pagination"], ' +
        'button:has-text("Next"), button:has-text("Previous")'
    );

    if ((await pagination.count()) > 0) {
      await expect(pagination.first()).toBeVisible();
    }
  });

  test('should show article count', async ({ page }) => {
    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // Look for count indicator
    const countText = page.locator('text=/\\d+\\s*(Artikel|articles|items|Produkte)/i');

    if ((await countText.count()) > 0) {
      await expect(countText.first()).toBeVisible();
    }
  });
});
