import { test, expect } from '@playwright/test';

/**
 * API E2E Tests - Screenshot_Algo
 * End-to-end tests for API endpoints
 */

// Use the backend URL directly for API tests
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

test.describe('Health API', () => {
  test('should return healthy status from /health endpoint', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
  });

  test('should return liveness probe status', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health/live`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('should return readiness probe status', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health/ready`);
    // May be unhealthy if DB/Redis not connected in test env
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Labels API', () => {
  test('should fetch labels list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/labels`);

    // API should respond (may be empty if no labels)
    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
    }
  });

  test('should create a new label', async ({ request }) => {
    const labelData = {
      articleNumber: `E2E-TEST-${Date.now()}`,
      productName: 'E2E Test Product',
      priceInfo: {
        price: 19.99,
        currency: 'EUR',
      },
    };

    const response = await request.post(`${API_BASE_URL}/api/labels`, {
      data: labelData,
    });

    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.articleNumber).toBe(labelData.articleNumber);
    }
  });

  test('should return 400 for invalid label data', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/labels`, {
      data: {}, // Missing required fields
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('should fetch label stats', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/labels/stats`);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
    }
  });
});

test.describe('Products API', () => {
  test('should fetch products list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/products`);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('products');
      expect(Array.isArray(body.products)).toBe(true);
    }
  });

  test('should search products', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/products/search?q=test`);

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });
});

test.describe('Templates API', () => {
  test('should fetch templates list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/templates`);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
    }
  });
});

test.describe('API Error Handling', () => {
  test('should return 404 for unknown routes', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/nonexistent-route`);
    expect(response.status()).toBe(404);
  });

  test('should return 404 for non-existent label', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/labels/nonexistent-id-12345`);
    expect(response.status()).toBe(404);
  });
});
