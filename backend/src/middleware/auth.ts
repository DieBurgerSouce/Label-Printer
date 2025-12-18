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

// Extend Express session with user data and security context
declare module 'express-session' {
  interface SessionData {
    userId: string;
    user: SafeUser;
    // Session binding for security
    ipAddress: string;
    userAgent: string;
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

  // SECURITY: Enforce SESSION_SECRET in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('SESSION_SECRET environment variable is required in production');
      process.exit(1);
    }
    logger.warn('SESSION_SECRET not set - using insecure default (development only)');
  }

  // Session configuration
  const sessionConfig: session.SessionOptions = {
    secret: sessionSecret || 'dev_secret_change_in_production',
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
 * Get client IP address from request
 * Handles proxies via X-Forwarded-For header
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Middleware to check if user is authenticated
 * Includes session binding validation (IP + User-Agent)
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId || !req.session?.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Session binding validation (optional but recommended in production)
  const sessionBindingEnabled = process.env.SESSION_BINDING !== 'false';
  if (sessionBindingEnabled && process.env.NODE_ENV === 'production') {
    const currentIp = getClientIp(req);
    const currentUserAgent = req.headers['user-agent'] || '';

    // Check IP binding (with tolerance for proxy changes)
    if (req.session.ipAddress && req.session.ipAddress !== currentIp) {
      logger.warn('Session IP mismatch detected', {
        userId: req.session.userId,
        sessionIp: req.session.ipAddress,
        currentIp,
      });
      // In strict mode, destroy session
      if (process.env.SESSION_BINDING_STRICT === 'true') {
        req.session.destroy(() => {});
        throw new UnauthorizedError('Session invalid - please log in again');
      }
    }

    // Check User-Agent binding
    if (req.session.userAgent && req.session.userAgent !== currentUserAgent) {
      logger.warn('Session User-Agent mismatch detected', {
        userId: req.session.userId,
        sessionUserAgent: req.session.userAgent?.substring(0, 50),
        currentUserAgent: currentUserAgent.substring(0, 50),
      });
      // In strict mode, destroy session
      if (process.env.SESSION_BINDING_STRICT === 'true') {
        req.session.destroy(() => {});
        throw new UnauthorizedError('Session invalid - please log in again');
      }
    }
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
 * Includes session binding (IP + User-Agent) for security
 */
export function setSessionUser(req: Request, user: SafeUser): void {
  req.session.userId = user.id;
  req.session.user = user;
  // Store session binding info
  req.session.ipAddress = getClientIp(req);
  req.session.userAgent = req.headers['user-agent'] || '';
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
