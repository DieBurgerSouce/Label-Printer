/**
 * Label Printer Backend Server
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import * as Sentry from '@sentry/node';
import v1Router from './api/routes/v1';
import healthRouter, { markStartupComplete, markStartupFailed } from './api/routes/health';
import { setupSwagger } from './config/swagger';
import { StorageService } from './services/storage-service';
import { ocrService } from './services/ocr-service';
import { webCrawlerService } from './services/web-crawler-service';
import { automationService } from './services/automation-service';
import { initializeWebSocketServer } from './websocket/socket-server';
import { getMetrics, getContentType, healthStatus } from './utils/metrics';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { errorHandler } from './middleware/errorHandler';
import { createSessionMiddleware } from './middleware/auth';
import { requestIdMiddleware } from './middleware/requestId';
import logger from './utils/logger';

// Initialize Sentry for error tracking (must be first)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `screenshot-algo@${process.env.npm_package_version || '1.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
    beforeSend: (event) => {
      // Skip in development unless explicitly testing
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_TEST) {
        return null;
      }
      // Sanitize sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
    ignoreErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'AbortError'],
  });
  logger.info('Sentry initialized for error tracking');
}

// __filename and __dirname are available globally in CommonJS

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Security Middleware - Helmet for HTTP security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow loading external resources
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CORS
    // SECURITY: HSTS with preload for strict HTTPS enforcement
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // SECURITY: Strict referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// SECURITY: Permissions-Policy header (restrict browser features)
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  next();
});

// Request ID middleware for tracing (early in chain for all requests)
app.use(requestIdMiddleware);

// Rate Limiting - Protect against brute force and DoS attacks
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit requests per window
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => {
    // Skip rate limiting for health checks and metrics
    return req.path === '/metrics' || req.path.startsWith('/health');
  },
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

// Strict rate limiter for authentication endpoints (5 attempts per 15 min)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
  },
  keyGenerator: (req) => {
    // Rate limit by IP + email to prevent distributed attacks
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  },
});

// Strict rate limiter for password changes (3 attempts per 15 min)
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password change attempts. Please try again later.',
  },
});

// API rate limiter - per-user or per-IP for non-authenticated requests
// More lenient than global, but prevents abuse of specific endpoints
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 60 : 300, // 60 req/min in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for authenticated requests (more lenient per-user)
    // Use IP for non-authenticated requests
    const userId = req.session?.userId;
    if (userId) {
      return `user:${userId}`;
    }
    return `ip:${req.ip}`;
  },
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
});

// Strict rate limiter for data modification operations (POST/PUT/DELETE)
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 30 : 100, // 30 mutations/min
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.session?.userId;
    if (userId) {
      return `mutation:user:${userId}`;
    }
    return `mutation:ip:${req.ip}`;
  },
  skip: (req) => {
    // Only apply to mutating methods
    return !['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  },
  message: {
    success: false,
    error: 'Too many write operations. Please slow down.',
  },
});

// Batch operation limiter - very strict to prevent abuse
export const batchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // Only 5 batch ops/min
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.session?.userId;
    if (userId) {
      return `batch:user:${userId}`;
    }
    return `batch:ip:${req.ip}`;
  },
  message: {
    success: false,
    error: 'Too many batch operations. Please wait before trying again.',
  },
});

app.use(globalLimiter);

// Middleware - Configure CORS with explicit origins
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.) in development
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // Check if origin is in allowed list
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin: origin?.substring(0, 100) });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// SECURITY: Limit request body size to prevent DoS attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Session middleware (Redis-backed sessions)
app.use(createSessionMiddleware());

// Prometheus metrics middleware (tracks request duration and counts)
app.use(metricsMiddleware);

// Request logging with structured logger (includes request ID for tracing)
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.path}`, {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', getContentType());
    res.end(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics', error);
    res.status(500).end('Error generating metrics');
  }
});

// Health check routes (Kubernetes-compatible probes)
// Mount at /health for K8S probes
app.use('/health', healthRouter);

// OpenAPI/Swagger documentation
setupSwagger(app);

// API v1 Routes (versioned API)
app.use('/api/v1', v1Router);

// Backwards compatibility: /api/* redirects to /api/v1/*
// This allows existing clients to continue working
app.use('/api', v1Router);

// Serve frontend static files in production
// Check for Docker volume first, then fallback to local development path
const dockerFrontendPath = path.join(__dirname, '../frontend-build');
const localFrontendPath = path.join(__dirname, '../../frontend/dist');
const frontendDistPath = fs.existsSync(dockerFrontendPath) ? dockerFrontendPath : localFrontendPath;

if (fs.existsSync(frontendDistPath)) {
  logger.info('Serving frontend static files', { path: frontendDistPath });
  app.use(express.static(frontendDistPath));

  // SPA fallback - send index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  logger.warn('Frontend dist folder not found', {
    dockerPath: dockerFrontendPath,
    localPath: localFrontendPath,
    hint: 'For Docker: Ensure frontend-builder has run. For local dev: Run npm run build in frontend directory',
  });

  // 404 handler for API-only mode
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found - Frontend not built',
    });
  });
}

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler - handles all errors with proper responses
app.use(errorHandler);

// Initialize storage and start server
async function start() {
  try {
    logger.info('Initializing storage...');
    await StorageService.init();

    logger.info('Initializing OCR service...');
    await ocrService.initialize();

    logger.info('Initializing automation service (BullMQ)...');
    const queueReady = await automationService.initialize();
    if (queueReady) {
      logger.info('Automation service initialized with BullMQ queue');
    } else {
      logger.warn('Automation service running without BullMQ (in-memory fallback)');
    }

    logger.info('Initializing WebSocket server...');
    const wsServer = initializeWebSocketServer(httpServer);

    // Make WebSocket server available to routes/services
    app.locals.wsServer = wsServer;

    httpServer.listen(PORT, () => {
      // Mark startup as complete after server is listening
      markStartupComplete();

      // Update health metrics
      healthStatus.set({ component: 'api' }, 1);
      healthStatus.set({ component: 'storage' }, 1);
      healthStatus.set({ component: 'ocr' }, 1);
      healthStatus.set({ component: 'websocket' }, 1);

      logger.info(`Label Printer Backend running on http://localhost:${PORT}`);
      logger.info(`WebSocket server ready for real-time updates`);
      logger.info('API Endpoints available (v1)', {
        apiVersion: `/api/v1`,
        auth: `/api/v1/auth`,
        labels: `/api/v1/labels`,
        articles: `/api/v1/articles`,
        templates: `/api/v1/templates`,
        excel: `/api/v1/excel`,
        crawler: `/api/v1/crawler`,
        ocr: `/api/v1/ocr`,
        automation: `/api/v1/automation`,
        health: `/health`,
        metrics: `/metrics`,
        k8sProbes: `/health/live|ready|startup`,
        deprecatedNotice: 'Legacy /api/* routes are forwards-compatible but deprecated',
      });
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    markStartupFailed(errorMsg);
    healthStatus.set({ component: 'api' }, 0);
    logger.error('Failed to start server', error);

    // Report to Sentry before exit
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
      await Sentry.flush(2000);
    }

    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await Promise.all([
    ocrService.shutdown(),
    webCrawlerService.shutdown(),
    automationService.shutdown(),
  ]);
  if (process.env.SENTRY_DSN) {
    await Sentry.flush(2000);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await Promise.all([
    ocrService.shutdown(),
    webCrawlerService.shutdown(),
    automationService.shutdown(),
  ]);
  if (process.env.SENTRY_DSN) {
    await Sentry.flush(2000);
  }
  process.exit(0);
});

start();
