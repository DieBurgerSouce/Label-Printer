/**
 * Label Printer Backend Server
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import labelsRouter from './api/routes/labels.js';
import excelRouter from './api/routes/excel.js';
import printRouter from './api/routes/print.js';
import crawlerRouter from './api/routes/crawler.js';
import ocrRouter from './api/routes/ocr.js';
import templatesRouter from './api/routes/templates.js';
import automationRouter from './api/routes/automation.js';
import testWebSocketRouter from './api/routes/test-websocket.js';
import articlesRouter from './api/routes/articles.js';
import imagesRouter from './api/routes/images.js';
import { StorageService } from './services/storage-service.js';
import { ocrService } from './services/ocr-service.js';
import { initializeWebSocketServer } from './websocket/socket-server.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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
app.use('/api/automation', automationRouter);
app.use('/api/test-websocket', testWebSocketRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/images', imagesRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

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
  await ocrService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await ocrService.shutdown();
  process.exit(0);
});

start();
