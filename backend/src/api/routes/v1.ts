/**
 * API v1 Router
 * Groups all v1 API routes under /api/v1 prefix
 *
 * This enables API versioning for future breaking changes.
 * The /api/ routes are kept for backwards compatibility.
 */

import { Router } from 'express';
import labelsRouter from './labels';
import excelRouter from './excel';
import printRouter from './print';
import crawlerRouter from './crawler';
import ocrRouter from './ocr';
import templatesRouter from './templates';
import labelTemplatesRouter from './label-templates';
import automationRouter from './automation';
import articlesRouter from './articles';
import imagesRouter from './images';
import lexwareRouter from './lexware';
import authRouter from './auth';
import healthRouter from './health';
import featureFlagsRouter from './feature-flags';

const v1Router = Router();

// Authentication
v1Router.use('/auth', authRouter);

// Core business endpoints
v1Router.use('/labels', labelsRouter);
v1Router.use('/articles', articlesRouter);
v1Router.use('/templates', templatesRouter);
v1Router.use('/label-templates', labelTemplatesRouter);

// Data import/export
v1Router.use('/excel', excelRouter);
v1Router.use('/lexware', lexwareRouter);

// Processing services
v1Router.use('/crawler', crawlerRouter);
v1Router.use('/ocr', ocrRouter);
v1Router.use('/automation', automationRouter);

// Utilities
v1Router.use('/print', printRouter);
v1Router.use('/images', imagesRouter);

// Health (also available at /health directly for K8S probes)
v1Router.use('/health', healthRouter);

// Feature Flags
v1Router.use('/features', featureFlagsRouter);

// API version info endpoint
v1Router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      version: 'v1',
      status: 'stable',
      endpoints: {
        auth: '/api/v1/auth',
        labels: '/api/v1/labels',
        articles: '/api/v1/articles',
        templates: '/api/v1/templates',
        'label-templates': '/api/v1/label-templates',
        excel: '/api/v1/excel',
        lexware: '/api/v1/lexware',
        crawler: '/api/v1/crawler',
        ocr: '/api/v1/ocr',
        automation: '/api/v1/automation',
        print: '/api/v1/print',
        images: '/api/v1/images',
        health: '/api/v1/health',
        features: '/api/v1/features',
      },
      documentation: 'See /api/v1/docs for API documentation',
    },
  });
});

export default v1Router;
