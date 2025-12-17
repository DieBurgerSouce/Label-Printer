/**
 * Label Printer Backend Server
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import labelsRouter from './api/routes/labels';
import excelRouter from './api/routes/excel';
import printRouter from './api/routes/print';
import crawlerRouter from './api/routes/crawler';
import ocrRouter from './api/routes/ocr';
import templatesRouter from './api/routes/templates';
import labelTemplatesRouter from './api/routes/label-templates';
import automationRouter from './api/routes/automation';
import articlesRouter from './api/routes/articles';
import imagesRouter from './api/routes/images';
import lexwareRouter from './api/routes/lexware';
import { StorageService } from './services/storage-service';
import { ocrService } from './services/ocr-service';
import { webCrawlerService } from './services/web-crawler-service';
import { initializeWebSocketServer } from './websocket/socket-server';

// __filename and __dirname are available globally in CommonJS

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

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
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/labels', labelsRouter);
app.use('/api/excel', excelRouter);
app.use('/api/print', printRouter);
app.use('/api/crawler', crawlerRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/label-templates', labelTemplatesRouter);
app.use('/api/automation', automationRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/images', imagesRouter);
app.use('/api/lexware', lexwareRouter);

// Health check
app.get('/api/health', (_req, res) => {
  const memUsage = process.memoryUsage();
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  const usedMemory = totalMemory - freeMemory;

  res.json({
    success: true,
    message: 'Server is running',
    memory: {
      process: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      system: {
        total: Math.round(totalMemory / 1024 / 1024), // MB
        free: Math.round(freeMemory / 1024 / 1024), // MB
        used: Math.round(usedMemory / 1024 / 1024), // MB
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
    },
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static files in production
// Check for Docker volume first, then fallback to local development path
const dockerFrontendPath = path.join(__dirname, '../frontend-build');
const localFrontendPath = path.join(__dirname, '../../frontend/dist');
const frontendDistPath = fs.existsSync(dockerFrontendPath) ? dockerFrontendPath : localFrontendPath;

if (fs.existsSync(frontendDistPath)) {
  console.log('✅ Serving frontend static files from:', frontendDistPath);
  app.use(express.static(frontendDistPath));

  // SPA fallback - send index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.log(
    '⚠️  Frontend dist folder not found at:',
    dockerFrontendPath,
    'or',
    localFrontendPath
  );
  console.log('    For Docker: Ensure frontend-builder has run successfully');
  console.log('    For local dev: Run "npm run build" in frontend directory');

  // 404 handler for API-only mode
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found - Frontend not built',
    });
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Initialize storage and start server
async function start() {
  try {
    console.log('Initializing storage...');
    await StorageService.init();

    console.log('Initializing OCR service...');
    await ocrService.initialize();

    console.log('Initializing WebSocket server...');
    const wsServer = initializeWebSocketServer(httpServer);

    // Make WebSocket server available to routes/services
    app.locals.wsServer = wsServer;

    httpServer.listen(PORT, () => {
      console.log(`🚀 Label Printer Backend running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket server ready for real-time updates`);
      console.log(`📋 API Endpoints:`);
      console.log(`   - Labels:     http://localhost:${PORT}/api/labels`);
      console.log(`   - Excel:      http://localhost:${PORT}/api/excel`);
      console.log(`   - Print:      http://localhost:${PORT}/api/print`);
      console.log(`   - Crawler:    http://localhost:${PORT}/api/crawler`);
      console.log(`   - OCR:        http://localhost:${PORT}/api/ocr`);
      console.log(`   - Templates:  http://localhost:${PORT}/api/templates`);
      console.log(`   - Automation: http://localhost:${PORT}/api/automation`);
      console.log(`   - Articles:   http://localhost:${PORT}/api/articles`);
      console.log(`   - Health:     http://localhost:${PORT}/api/health`);
      console.log(`\n💡 Connect to WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await Promise.all([ocrService.shutdown(), webCrawlerService.shutdown()]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await Promise.all([ocrService.shutdown(), webCrawlerService.shutdown()]);
  process.exit(0);
});

start();
