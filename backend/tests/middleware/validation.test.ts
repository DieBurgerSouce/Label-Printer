/**
 * Validation Middleware Tests
 * Tests for Zod schema validation middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { validateRequest, validateMultiple, sanitizeString } from '../../src/middleware/validation';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  // ========================================
  // validateRequest Tests
  // ========================================
  describe('validateRequest', () => {
    const testSchema = z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      age: z.number().int().positive().optional(),
    });

    it('should pass validation for valid body', () => {
      mockReq.body = { name: 'Test', email: 'test@example.com' };

      const middleware = validateRequest(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid body', () => {
      mockReq.body = { name: '', email: 'invalid-email' };

      const middleware = validateRequest(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate query parameters', () => {
      const querySchema = z.object({
        page: z.coerce.number().int().positive(),
        limit: z.coerce.number().int().positive().max(100),
      });

      mockReq.query = { page: '1', limit: '20' };

      const middleware = validateRequest(querySchema, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate URL parameters', () => {
      const paramSchema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateRequest(paramSchema, 'params');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid UUID in params', () => {
      const paramSchema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = { id: 'invalid-uuid' };

      const middleware = validateRequest(paramSchema, 'params');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should include validation error details', () => {
      mockReq.body = { name: '', email: 'invalid' };

      const middleware = validateRequest(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.any(Array),
        })
      );
    });
  });

  // ========================================
  // validateMultiple Tests
  // ========================================
  describe('validateMultiple', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
    });

    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    it('should validate both body and params', () => {
      mockReq.body = { name: 'Test' };
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateMultiple({
        body: bodySchema,
        params: paramsSchema,
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail if body validation fails', () => {
      mockReq.body = { name: '' };
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateMultiple({
        body: bodySchema,
        params: paramsSchema,
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should fail if params validation fails', () => {
      mockReq.body = { name: 'Test' };
      mockReq.params = { id: 'invalid' };

      const middleware = validateMultiple({
        body: bodySchema,
        params: paramsSchema,
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  // ========================================
  // sanitizeString Tests
  // ========================================
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should handle normal text', () => {
      const input = 'Hello World';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      const input = '  Hello  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello');
    });

    it('should handle XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>',
        '"><script>alert(1)</script>',
      ];

      xssAttempts.forEach((input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(/<script/i);
        expect(result).not.toMatch(/onerror/i);
        expect(result).not.toMatch(/onload/i);
      });
    });

    it('should preserve safe special characters', () => {
      const input = 'Price: $100 (50% off)';
      const result = sanitizeString(input);
      expect(result).toContain('$');
      expect(result).toContain('%');
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty body', () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      mockReq.body = {};

      const middleware = validateRequest(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle null values', () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      mockReq.body = { value: null };

      const middleware = validateRequest(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle array validation', () => {
      const schema = z.object({
        items: z.array(z.string()).min(1).max(10),
      });

      mockReq.body = { items: ['a', 'b', 'c'] };

      const middleware = validateRequest(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject too many array items', () => {
      const schema = z.object({
        items: z.array(z.string()).max(3),
      });

      mockReq.body = { items: ['a', 'b', 'c', 'd', 'e'] };

      const middleware = validateRequest(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle nested object validation', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            city: z.string(),
          }),
        }),
      });

      mockReq.body = {
        user: {
          name: 'Test',
          address: {
            city: 'Berlin',
          },
        },
      };

      const middleware = validateRequest(schema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
