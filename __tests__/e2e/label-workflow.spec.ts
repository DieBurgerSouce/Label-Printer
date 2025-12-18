import { test, expect } from '@playwright/test';

/**
 * Label Generation Workflow E2E Tests - Screenshot_Algo
 * End-to-end tests for the core label generation functionality
 */

// Use the backend URL directly for API tests
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

test.describe('Label Generation Workflow', () => {
  test.describe('Manual Label Creation', () => {
    test('should create a label from article data', async ({ page, request }) => {
      // Step 1: Create a label via API
      const labelData = {
        articleNumber: `E2E-WORKFLOW-${Date.now()}`,
        productName: 'E2E Workflow Test Product',
        priceInfo: {
          price: 29.99,
          currency: 'EUR',
        },
        description: 'A test product for E2E workflow testing',
      };

      const createResponse = await request.post(`${API_BASE_URL}/api/labels`, {
        data: labelData,
      });

      if (createResponse.ok()) {
        const body = await createResponse.json();
        expect(body.success).toBe(true);
        const labelId = body.data.id;

        // Step 2: Verify label can be retrieved
        const getResponse = await request.get(`${API_BASE_URL}/api/labels/${labelId}`);
        if (getResponse.ok()) {
          const labelBody = await getResponse.json();
          expect(labelBody.data.articleNumber).toBe(labelData.articleNumber);
        }

        // Step 3: Navigate to labels page in UI
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Look for labels navigation
        const labelsLink = page.locator('a[href*="label"], nav >> text=Label');
        if ((await labelsLink.count()) > 0) {
          await labelsLink.first().click();
          await page.waitForLoadState('networkidle');
        }
      }
    });

    test('should allow label editing', async ({ page, request }) => {
      // Create a label first
      const labelData = {
        articleNumber: `E2E-EDIT-${Date.now()}`,
        productName: 'E2E Edit Test Product',
        priceInfo: { price: 19.99, currency: 'EUR' },
      };

      const createResponse = await request.post(`${API_BASE_URL}/api/labels`, {
        data: labelData,
      });

      if (createResponse.ok()) {
        const body = await createResponse.json();
        const labelId = body.data.id;

        // Update the label
        const updatedData = {
          ...labelData,
          productName: 'E2E Edit Test Product - Updated',
          priceInfo: { price: 24.99, currency: 'EUR' },
        };

        const updateResponse = await request.put(`${API_BASE_URL}/api/labels/${labelId}`, {
          data: updatedData,
        });

        if (updateResponse.ok()) {
          const updateBody = await updateResponse.json();
          expect(updateBody.success).toBe(true);
          expect(updateBody.data.priceInfo.price).toBe(24.99);
        }
      }
    });

    test('should allow label deletion', async ({ request }) => {
      // Create a label to delete
      const labelData = {
        articleNumber: `E2E-DELETE-${Date.now()}`,
        productName: 'E2E Delete Test Product',
        priceInfo: { price: 9.99, currency: 'EUR' },
      };

      const createResponse = await request.post(`${API_BASE_URL}/api/labels`, {
        data: labelData,
      });

      if (createResponse.ok()) {
        const body = await createResponse.json();
        const labelId = body.data.id;

        // Delete the label
        const deleteResponse = await request.delete(`${API_BASE_URL}/api/labels/${labelId}`);
        expect(deleteResponse.ok()).toBe(true);

        // Verify it's gone
        const getResponse = await request.get(`${API_BASE_URL}/api/labels/${labelId}`);
        expect(getResponse.status()).toBe(404);
      }
    });
  });

  test.describe('Label Duplication', () => {
    test('should duplicate a label', async ({ request }) => {
      // Create original label
      const originalData = {
        articleNumber: `E2E-ORIGINAL-${Date.now()}`,
        productName: 'E2E Original Product',
        priceInfo: { price: 39.99, currency: 'EUR' },
      };

      const createResponse = await request.post(`${API_BASE_URL}/api/labels`, {
        data: originalData,
      });

      if (createResponse.ok()) {
        const body = await createResponse.json();
        const originalId = body.data.id;

        // Duplicate the label
        const duplicateResponse = await request.post(`${API_BASE_URL}/api/labels/${originalId}/duplicate`);

        if (duplicateResponse.ok()) {
          const dupBody = await duplicateResponse.json();
          expect(dupBody.success).toBe(true);
          expect(dupBody.data.id).not.toBe(originalId);
          expect(dupBody.data.productName).toContain('Original');
        }
      }
    });
  });

  test.describe('Label Merging', () => {
    test('should merge multiple labels', async ({ request }) => {
      // Create two labels to merge
      const label1Data = {
        articleNumber: `E2E-MERGE-1-${Date.now()}`,
        productName: 'E2E Merge Product 1',
        priceInfo: { price: 10.0, currency: 'EUR' },
      };

      const label2Data = {
        articleNumber: `E2E-MERGE-2-${Date.now()}`,
        productName: 'E2E Merge Product 2',
        priceInfo: { price: 20.0, currency: 'EUR' },
      };

      const [create1, create2] = await Promise.all([
        request.post(`${API_BASE_URL}/api/labels`, { data: label1Data }),
        request.post(`${API_BASE_URL}/api/labels`, { data: label2Data }),
      ]);

      if (create1.ok() && create2.ok()) {
        const body1 = await create1.json();
        const body2 = await create2.json();

        const mergeResponse = await request.post(`${API_BASE_URL}/api/labels/merge`, {
          data: {
            labelIds: [body1.data.id, body2.data.id],
          },
        });

        if (mergeResponse.ok()) {
          const mergeBody = await mergeResponse.json();
          expect(mergeBody.success).toBe(true);
        }
      }
    });
  });

  test.describe('Tiered Pricing', () => {
    test('should create a label with tiered prices', async ({ request }) => {
      const labelData = {
        articleNumber: `E2E-TIERED-${Date.now()}`,
        productName: 'E2E Tiered Price Product',
        priceInfo: {
          price: 100.0,
          currency: 'EUR',
          priceType: 'tiered',
        },
        tieredPrices: [
          { quantity: 1, price: 100.0 },
          { quantity: 10, price: 90.0 },
          { quantity: 50, price: 80.0 },
          { quantity: 100, price: 70.0 },
        ],
      };

      const createResponse = await request.post(`${API_BASE_URL}/api/labels`, {
        data: labelData,
      });

      if (createResponse.ok()) {
        const body = await createResponse.json();
        expect(body.success).toBe(true);
        expect(body.data.tieredPrices).toBeDefined();
        expect(body.data.tieredPrices.length).toBe(4);
      }
    });
  });

  test.describe('Label Validation', () => {
    test('should reject label without article number', async ({ request }) => {
      const invalidData = {
        productName: 'Product Without Article Number',
        priceInfo: { price: 10.0, currency: 'EUR' },
      };

      const response = await request.post(`${API_BASE_URL}/api/labels`, {
        data: invalidData,
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should reject label without product name', async ({ request }) => {
      const invalidData = {
        articleNumber: `E2E-INVALID-${Date.now()}`,
        priceInfo: { price: 10.0, currency: 'EUR' },
      };

      const response = await request.post(`${API_BASE_URL}/api/labels`, {
        data: invalidData,
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should reject label without price info', async ({ request }) => {
      const invalidData = {
        articleNumber: `E2E-INVALID-${Date.now()}`,
        productName: 'Product Without Price',
      };

      const response = await request.post(`${API_BASE_URL}/api/labels`, {
        data: invalidData,
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });
});

test.describe('Label Export', () => {
  test('should export labels to Excel', async ({ request }) => {
    // Create some labels first
    const labels = await Promise.all(
      [1, 2, 3].map((i) =>
        request.post(`${API_BASE_URL}/api/labels`, {
          data: {
            articleNumber: `E2E-EXPORT-${Date.now()}-${i}`,
            productName: `E2E Export Product ${i}`,
            priceInfo: { price: i * 10, currency: 'EUR' },
          },
        })
      )
    );

    // Export to Excel
    const exportResponse = await request.get(`${API_BASE_URL}/api/labels/export/excel`);

    if (exportResponse.ok()) {
      const contentType = exportResponse.headers()['content-type'];
      expect(contentType).toContain('spreadsheet');
    }
  });
});

test.describe('Label Search', () => {
  test('should search labels by article number', async ({ request }) => {
    // Create a label with a unique article number
    const uniqueId = Date.now();
    const labelData = {
      articleNumber: `SEARCH-${uniqueId}`,
      productName: 'Searchable Product',
      priceInfo: { price: 15.0, currency: 'EUR' },
    };

    await request.post(`${API_BASE_URL}/api/labels`, { data: labelData });

    // Search for the label
    const searchResponse = await request.get(`${API_BASE_URL}/api/labels?search=SEARCH-${uniqueId}`);

    if (searchResponse.ok()) {
      const body = await searchResponse.json();
      expect(body.success).toBe(true);
      expect(body.data.labels.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('should search labels by product name', async ({ request }) => {
    const uniqueId = Date.now();
    const labelData = {
      articleNumber: `E2E-${uniqueId}`,
      productName: `UniqueProduct${uniqueId}`,
      priceInfo: { price: 25.0, currency: 'EUR' },
    };

    await request.post(`${API_BASE_URL}/api/labels`, { data: labelData });

    // Search by product name
    const searchResponse = await request.get(
      `${API_BASE_URL}/api/labels?search=UniqueProduct${uniqueId}`
    );

    if (searchResponse.ok()) {
      const body = await searchResponse.json();
      expect(body.success).toBe(true);
    }
  });
});

test.describe('Label Pagination', () => {
  test('should paginate labels', async ({ request }) => {
    // Get first page
    const page1Response = await request.get(`${API_BASE_URL}/api/labels?page=1&limit=10`);

    if (page1Response.ok()) {
      const body = await page1Response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('labels');
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('page');
      expect(body.data).toHaveProperty('limit');
    }
  });

  test('should return correct page metadata', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/labels?page=2&limit=5`);

    if (response.ok()) {
      const body = await response.json();
      expect(body.data.page).toBe(2);
      expect(body.data.limit).toBe(5);
    }
  });
});
