/**
 * Authentication Middleware
 * Session-based authentication with Redis store
 */
import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { Role } from '@prisma/client';
import { getRedisClient } from '../lib/redis';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { SafeUser } from '../services/auth-service';
import logger from '../utils/logger';

// Extend Express session with user data
declare module 'express-session' {
  interface SessionData {
    userId: string;
    user: SafeUser;
  }
}

// Extend Express Request with user
declare module 'express-serve-static-core' {
  interface Request {
    user?: SafeUser;
  }
}

/**
 * Create session middleware with Redis store
 */
export function createSessionMiddleware() {
  const redisClient = getRedisClient();

  // Session configuration
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'change_this_session_secret_in_production',
    name: 'session_id', // Custom cookie name (avoid default 'connect.sid')
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // CSRF protection
    },
  };

  // Use Redis store if Redis is available
  if (redisClient) {
    sessionConfig.store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
      ttl: 86400, // 24 hours in seconds
    });
    logger.info('Session store: Redis');
  } else {
    logger.warn('Session store: Memory (not recommended for production)');
  }

  return session(sessionConfig);
}

/**
 * Middleware to check if user is authenticated
 * Attaches user to request if session is valid
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId || !req.session?.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Attach user to request for convenience
  req.user = req.session.user;

  next();
}

/**
 * Middleware to check if user has required role
 * Must be used after isAuthenticated
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // ADMIN has access to everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user has one of the allowed roles
    if (!allowedRoles.includes(req.user.role as Role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}

/**
 * Middleware to optionally attach user to request
 * Doesn't throw if not authenticated
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.userId && req.session?.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Helper to set user in session after login
 */
export function setSessionUser(req: Request, user: SafeUser): void {
  req.session.userId = user.id;
  req.session.user = user;
}

/**
 * Helper to clear session (logout)
 */
export function clearSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy session', { error: err });
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
