/**
 * Auth Middleware Tests
 * Tests for authentication and session handling middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies before importing auth middleware
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock express-session with Store class
vi.mock('express-session', () => {
  class Store {}
  const session = vi.fn(() => vi.fn());
  session.Store = Store;
  return { default: session };
});

// Mock connect-redis
vi.mock('connect-redis', () => ({
  default: class RedisStore {
    constructor() {}
  },
}));

// Mock redis client
vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => null),
}));

// Import the middleware (we'll test isAuthenticated and requireRole)
import { isAuthenticated, requireRole } from '../../src/middleware/auth';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      session: {} as any,
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  // ========================================
  // isAuthenticated Tests
  // ========================================
  describe('isAuthenticated', () => {
    it('should call next() when user is authenticated', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'USER' };
      mockReq.session = {
        userId: 'user-123',
        user,
      } as any;

      isAuthenticated(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when no session exists', () => {
      mockReq.session = undefined as any;

      expect(() => isAuthenticated(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        'Authentication required'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when no user in session', () => {
      mockReq.session = {} as any;

      expect(() => isAuthenticated(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        'Authentication required'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should attach user to request object', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'USER' };
      mockReq.session = {
        userId: 'user-123',
        user,
      } as any;

      isAuthenticated(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).user).toEqual(user);
    });
  });

  // ========================================
  // requireRole Tests
  // ========================================
  describe('requireRole', () => {
    it('should call next() for user with required role', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'ADMIN' };
      mockReq.user = user as any;

      const middleware = requireRole('ADMIN');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() for ADMIN when any role is required', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'ADMIN' };
      mockReq.user = user as any;

      const middleware = requireRole('USER');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw ForbiddenError for user without required role', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'USER' };
      mockReq.user = user as any;

      const middleware = requireRole('ADMIN');

      expect(() => middleware(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        'Insufficient permissions'
      );
    });

    it('should throw UnauthorizedError when no user in session', () => {
      mockReq.user = undefined;

      const middleware = requireRole('USER');

      expect(() => middleware(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        'Authentication required'
      );
    });
  });
});
