/**
 * OpenAPI/Swagger Configuration
 * Auto-generates API documentation from JSDoc comments
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Screenshot Algo API',
      version: '1.0.0',
      description: `
        Enterprise-grade Label Generation System API.

        ## Features
        - Web scraping & product data extraction
        - OCR text recognition
        - Professional label generation
        - Batch processing & automation

        ## Authentication
        Most endpoints require authentication via session cookies.
        Login first at \`/api/v1/auth/login\` to obtain a session.
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'Articles',
        description: 'Product/Article management',
      },
      {
        name: 'Labels',
        description: 'Label generation and management',
      },
      {
        name: 'Templates',
        description: 'Label template management',
      },
      {
        name: 'Automation',
        description: 'Automated workflow endpoints',
      },
      {
        name: 'OCR',
        description: 'Optical Character Recognition',
      },
      {
        name: 'Crawler',
        description: 'Web scraping endpoints',
      },
      {
        name: 'Excel',
        description: 'Excel file processing',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie from login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
        Article: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            articleNumber: { type: 'string', example: 'ABC-123' },
            productName: { type: 'string', example: 'Test Product' },
            description: { type: 'string', nullable: true },
            price: { type: 'number', nullable: true, example: 29.99 },
            currency: { type: 'string', example: 'EUR' },
            imageUrl: { type: 'string', format: 'uri', nullable: true },
            sourceUrl: { type: 'string', format: 'uri', nullable: true },
            ean: { type: 'string', nullable: true },
            category: { type: 'string', nullable: true },
            manufacturer: { type: 'string', nullable: true },
            verified: { type: 'boolean', default: false },
            published: { type: 'boolean', default: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Label: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            articleId: { type: 'string', format: 'uuid', nullable: true },
            templateId: { type: 'string', format: 'uuid', nullable: true },
            data: { type: 'object' },
            imagePath: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'generated', 'failed'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AutomationJob: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'crawling', 'ocr', 'generating', 'completed', 'failed'],
            },
            progress: {
              type: 'object',
              properties: {
                current: { type: 'number' },
                total: { type: 'number' },
                stage: { type: 'string' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', description: 'Uptime in seconds' },
            checks: {
              type: 'object',
              properties: {
                database: { $ref: '#/components/schemas/HealthCheckResult' },
                redis: { $ref: '#/components/schemas/HealthCheckResult' },
                queue: { $ref: '#/components/schemas/HealthCheckResult' },
                memory: { $ref: '#/components/schemas/HealthCheckResult' },
              },
            },
          },
        },
        HealthCheckResult: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            message: { type: 'string' },
            latencyMs: { type: 'number' },
            details: { type: 'object' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        BadRequest: {
          description: 'Invalid request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    security: [
      {
        sessionAuth: [],
      },
    ],
  },
  apis: ['./src/api/routes/**/*.ts', './src/api/routes/**/*.js'],
};

// Generate OpenAPI specification
export const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 */
export function setupSwagger(app: Express): void {
  // Serve Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Screenshot Algo API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showCommonExtensions: true,
      },
    })
  );

  // Serve raw OpenAPI spec as JSON
  app.get('/api/docs/spec.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve raw OpenAPI spec as YAML
  app.get('/api/docs/spec.yaml', (_req, res) => {
    const yaml = jsonToYaml(swaggerSpec);
    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml);
  });
}

/**
 * Simple JSON to YAML converter
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null) return 'null';
  if (obj === undefined) return '';
  if (typeof obj === 'string')
    return obj.includes('\n')
      ? `|\n${obj
          .split('\n')
          .map((l) => spaces + '  ' + l)
          .join('\n')}`
      : JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => `${spaces}- ${jsonToYaml(item, indent + 1).trim()}`).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, value]) => {
        const valueStr = jsonToYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        return `${spaces}${key}: ${valueStr}`;
      })
      .join('\n');
  }

  return String(obj);
}
