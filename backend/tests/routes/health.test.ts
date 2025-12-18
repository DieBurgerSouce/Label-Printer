/**
 * Health Route Tests
 * Tests for Kubernetes-compatible health endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import healthRouter, { markStartupComplete, markStartupFailed } from '../../src/api/routes/health';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  })),
}));

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn(),
  })),
}));

// Mock metrics
vi.mock('../../src/utils/metrics', () => ({
  healthStatus: {
    set: vi.fn(),
  },
}));

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/health', healthRouter);
    vi.clearAllMocks();
  });

  describe('GET /health/live', () => {
    it('should return 200 with status ok', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should always respond (liveness check)', async () => {
      // Liveness probe should always succeed if process is running
      const response = await request(app).get('/health/live');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /health/startup', () => {
    it('should return 503 before startup is complete', async () => {
      // Reset startup state by reimporting module
      vi.resetModules();
      const freshApp = express();
      const freshRouter = (await import('../../src/api/routes/health')).default;
      freshApp.use('/health', freshRouter);

      const response = await request(freshApp).get('/health/startup');
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('starting');
    });

    it('should return 200 after startup is complete', async () => {
      markStartupComplete();

      const response = await request(app).get('/health/startup');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('started');
    });
  });

  describe('GET /health/ready', () => {
    it('should check dependencies and return status', async () => {
      const response = await request(app).get('/health/ready');

      // Should return 200 or 503 depending on dependencies
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include filesystem and memory checks', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.body.checks).toHaveProperty('filesystem');
      expect(response.body.checks).toHaveProperty('memory');
    });
  });

  describe('GET /health', () => {
    it('should return detailed health information', async () => {
      const response = await request(app).get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('startup');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include process memory information', async () => {
      const response = await request(app).get('/health');

      expect(response.body.memory).toHaveProperty('process');
      expect(response.body.memory.process).toHaveProperty('rss');
      expect(response.body.memory.process).toHaveProperty('heapTotal');
      expect(response.body.memory.process).toHaveProperty('heapUsed');
    });

    it('should include system memory information', async () => {
      const response = await request(app).get('/health');

      expect(response.body.memory).toHaveProperty('system');
      expect(response.body.memory.system).toHaveProperty('total');
      expect(response.body.memory.system).toHaveProperty('free');
      expect(response.body.memory.system).toHaveProperty('used');
      expect(response.body.memory.system).toHaveProperty('percentage');
    });
  });
});
