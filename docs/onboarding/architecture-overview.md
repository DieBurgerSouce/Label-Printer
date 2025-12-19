# Architecture Overview

## System Overview

Screenshot_Algo is a high-performance screenshot and label generation system for product management.

```
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                    SCREENSHOT_ALGO                       │
                                    │                   System Architecture                    │
                                    └─────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│                  │       │                  │       │                  │       │                  │
│    Frontend      │◄─────►│    Backend       │◄─────►│   Database       │       │   File Storage   │
│    (React)       │       │    (Node.js)     │       │   (PostgreSQL)   │       │   (Local/S3)     │
│                  │       │                  │       │                  │       │                  │
└──────────────────┘       └────────┬─────────┘       └──────────────────┘       └──────────────────┘
                                    │
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │  Screenshot  │ │    Label     │ │     OCR      │
           │   Service    │ │   Generator  │ │   Service    │
           │ (Puppeteer)  │ │  (PDFKit)    │ │ (Tesseract)  │
           └──────────────┘ └──────────────┘ └──────────────┘
```

## Core Components

### 1. Frontend (React + TypeScript)

**Location**: `frontend/`

**Responsibilities**:
- User interface for article management
- Template editing and preview
- Real-time WebSocket updates
- Screenshot preview and download

**Key Technologies**:
- React 18 with TypeScript
- Vite for bundling
- TanStack Query for data fetching
- Tailwind CSS for styling

**Entry Points**:
- `frontend/src/main.tsx` - Application bootstrap
- `frontend/src/App.tsx` - Root component

### 2. Backend (Node.js + Express)

**Location**: `backend/`

**Responsibilities**:
- REST API for all operations
- WebSocket server for real-time updates
- Job queue management
- Authentication and authorization

**Key Technologies**:
- Node.js 18+
- Express.js
- WebSocket (ws)
- Bull for job queues

**Entry Points**:
- `backend/server.js` - Main server
- `backend/routes/` - API routes

### 3. Screenshot Service

**Location**: `backend/services/screenshot/`

**Responsibilities**:
- Capture screenshots of products
- Handle dynamic content loading
- Manage browser pool
- Optimize image output

**Key Technologies**:
- Puppeteer for browser automation
- Sharp for image processing
- Chrome/Chromium headless

**Flow**:
```
Request → Queue → Browser Pool → Navigate → Wait → Capture → Process → Store
```

### 4. Label Generator

**Location**: `backend/services/label/`

**Responsibilities**:
- Generate PDF labels
- Support multiple templates
- Handle barcodes and QR codes
- Batch processing

**Key Technologies**:
- PDFKit for PDF generation
- JsBarcode for barcodes
- QRCode for QR codes

### 5. OCR Service

**Location**: `backend/services/ocr/`

**Responsibilities**:
- Extract text from images
- Auto-fill article data
- Validate extracted data

**Key Technologies**:
- Tesseract.js for OCR
- Custom preprocessing

## Data Flow

### Screenshot Generation Flow

```
1. User Request
   └─► Frontend sends POST /api/screenshots
       └─► Backend validates request
           └─► Job added to Bull queue
               └─► Worker picks up job
                   └─► Browser navigates to URL
                       └─► Screenshot captured
                           └─► Image processed
                               └─► Stored in filesystem/S3
                                   └─► WebSocket notifies frontend
                                       └─► User sees result
```

### Article CRUD Flow

```
1. Create Article
   └─► POST /api/articles
       └─► Validate input
           └─► Store in PostgreSQL
               └─► Trigger screenshot job
                   └─► Return article with status

2. Read Article(s)
   └─► GET /api/articles/:id
       └─► Query PostgreSQL
           └─► Join with screenshots/labels
               └─► Return formatted response

3. Update Article
   └─► PUT /api/articles/:id
       └─► Validate changes
           └─► Update PostgreSQL
               └─► Optionally re-trigger screenshot
                   └─► Return updated article

4. Delete Article
   └─► DELETE /api/articles/:id
       └─► Soft delete in PostgreSQL
           └─► Clean up associated files
               └─► Return success
```

## Database Schema

### Core Tables

```sql
-- Articles
articles (
    id SERIAL PRIMARY KEY,
    article_number VARCHAR(50) UNIQUE,
    name VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(100),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
)

-- Screenshots
screenshots (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    url VARCHAR(500),
    file_path VARCHAR(500),
    status VARCHAR(50),
    captured_at TIMESTAMP
)

-- Labels
labels (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    template_id INTEGER REFERENCES templates(id),
    file_path VARCHAR(500),
    generated_at TIMESTAMP
)

-- Templates
templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50),
    config JSONB,
    is_default BOOLEAN
)
```

## API Structure

### REST Endpoints

```
/api
├── /articles
│   ├── GET    /           - List all articles
│   ├── POST   /           - Create article
│   ├── GET    /:id        - Get single article
│   ├── PUT    /:id        - Update article
│   ├── DELETE /:id        - Delete article
│   └── POST   /:id/screenshot - Generate screenshot
│
├── /screenshots
│   ├── GET    /           - List screenshots
│   ├── GET    /:id        - Get screenshot
│   └── POST   /bulk       - Bulk screenshot
│
├── /labels
│   ├── GET    /           - List labels
│   ├── POST   /generate   - Generate labels
│   └── GET    /:id/download - Download label
│
├── /templates
│   ├── GET    /           - List templates
│   ├── POST   /           - Create template
│   ├── PUT    /:id        - Update template
│   └── DELETE /:id        - Delete template
│
└── /health
    └── GET    /           - Health check
```

### WebSocket Events

```javascript
// Client → Server
{ type: 'subscribe', channel: 'screenshots' }
{ type: 'unsubscribe', channel: 'screenshots' }

// Server → Client
{ type: 'screenshot:started', data: { articleId, jobId } }
{ type: 'screenshot:progress', data: { jobId, progress } }
{ type: 'screenshot:completed', data: { articleId, screenshot } }
{ type: 'screenshot:failed', data: { articleId, error } }
```

## Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Storage
STORAGE_TYPE=s3  # or 'local'
S3_BUCKET=screenshots
S3_REGION=eu-central-1

# Browser
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
BROWSER_POOL_SIZE=5

# Queue
REDIS_URL=redis://localhost:6379
QUEUE_CONCURRENCY=3
```

### Feature Flags

```javascript
// config/features.js
module.exports = {
  OCR_ENABLED: true,
  BULK_SCREENSHOTS: true,
  PDF_EXPORT: true,
  WEBSOCKET_UPDATES: true
};
```

## Deployment Architecture

### Production Environment

```
                         ┌─────────────────┐
                         │   Load Balancer │
                         │    (nginx)      │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
       │   Node.js   │    │   Node.js   │    │   Node.js   │
       │  Instance 1 │    │  Instance 2 │    │  Instance 3 │
       └─────────────┘    └─────────────┘    └─────────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
       │ PostgreSQL  │    │   Redis     │    │     S3      │
       │   (RDS)     │    │(ElastiCache)│    │  (Storage)  │
       └─────────────┘    └─────────────┘    └─────────────┘
```

### Kubernetes Deployment

See `k8s/` directory for:
- Deployment manifests
- Service definitions
- ConfigMaps and Secrets
- HPA configuration
- Network policies

## Security

### Authentication
- JWT-based authentication
- Refresh token rotation
- API key for service-to-service

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions

### Data Protection
- Encryption at rest (database, S3)
- TLS for all connections
- Secrets management via Vault/K8s secrets

## Monitoring

### Metrics (Prometheus)
- Request latency
- Error rates
- Queue depth
- Browser pool utilization

### Logging (ELK/Loki)
- Structured JSON logs
- Request tracing
- Error aggregation

### Alerting
- Prometheus Alertmanager
- PagerDuty integration
- Slack notifications

## Performance Considerations

### Bottlenecks
1. **Browser pool**: Limit concurrent screenshots
2. **Database**: Index optimization, connection pooling
3. **Storage I/O**: Async operations, CDN caching

### Optimization Strategies
- Connection pooling (pg-pool)
- Redis caching for frequent queries
- Image compression and lazy loading
- Horizontal scaling for stateless services

## Further Reading

- [API Documentation](../api/)
- [Database Migrations](../../backend/migrations/)
- [Deployment Guide](../../DEPLOYMENT.md)
- [Testing Guide](../../TESTING.md)

---

**Questions?** Ask in #architecture channel
**Updates?** Submit a PR to this document
