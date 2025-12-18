# Screenshot_Algo - System Architecture

## Overview

Screenshot_Algo is an automated label generation system for product catalogs. It combines web scraping, OCR text recognition, and professional label printing into a single workflow.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCREENSHOT_ALGO                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐          ┌──────────────────┐                         │
│  │    Frontend      │◀────────▶│   Backend API    │                         │
│  │  (React + Vite)  │  HTTP/WS │  (Express.js)    │                         │
│  │  Port 3001       │          │  Port 3001       │                         │
│  └──────────────────┘          └────────┬─────────┘                         │
│                                         │                                    │
│           ┌─────────────────────────────┼─────────────────────────────┐     │
│           │                             │                             │     │
│           ▼                             ▼                             ▼     │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐│
│  │   PostgreSQL    │         │     Redis       │         │    Puppeteer    ││
│  │   (Prisma ORM)  │         │  (BullMQ Jobs)  │         │  (Web Scraping) ││
│  │   Port 5432     │         │   Port 6379     │         │                 ││
│  └─────────────────┘         └─────────────────┘         └─────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Workflows

### 1. One-Click Label Generation (Automation)
```
Shop URL → Web Crawler → Product Data → OCR Enhancement → Label Generation → PDF Export
```

### 2. Excel Import
```
Excel File → Column Mapping → Data Validation → Database Import → Label Generation
```

### 3. Manual Label Creation
```
Template Editor → Product Selection → Preview → Print/Export
```

---

## Backend Architecture

### Directory Structure
```
backend/src/
├── api/routes/           # REST API endpoints
│   ├── articles.ts       # Product CRUD operations
│   ├── automation.ts     # One-click workflow
│   ├── crawler.ts        # Web scraping endpoints
│   ├── excel.ts          # Excel import/export
│   ├── health.ts         # K8S health probes
│   ├── images.ts         # Screenshot management
│   ├── label-templates.ts# Template CRUD
│   ├── labels.ts         # Label generation
│   ├── lexware.ts        # Lexware ERP integration
│   ├── ocr.ts            # OCR processing
│   ├── print.ts          # Print queue
│   └── templates.ts      # Rendering templates
│
├── services/             # Business logic
│   ├── automation-service.ts     # Workflow orchestration
│   ├── web-crawler-service.ts    # Puppeteer scraping
│   ├── robust-ocr-service.ts     # Tesseract.js OCR
│   ├── label-generator-service.ts# PDFKit label creation
│   ├── article-service.ts        # Product management
│   ├── matcher-service.ts        # Fuzzy article matching
│   │
│   ├── crawling/         # Web scraping modules
│   │   ├── cookie-handler.ts     # Cookie consent
│   │   ├── page-analyzer.ts      # DOM analysis
│   │   ├── product-collector.ts  # Link extraction
│   │   ├── category-navigator.ts # Category traversal
│   │   └── url-utils.ts          # URL parsing
│   │
│   ├── ocr/              # OCR modules
│   │   ├── text-utils.ts         # Text extraction
│   │   └── file-utils.ts         # File handling
│   │
│   └── automation/       # Automation modules
│       └── ws-notifier.ts        # WebSocket progress
│
├── lib/                  # Shared utilities
│   ├── prisma.ts         # Database client
│   └── imagekit.ts       # Image CDN
│
├── utils/                # Helper functions
│   ├── api-response.ts   # Unified API responses
│   └── logger.ts         # Winston logging
│
├── types/                # TypeScript definitions
│   ├── automation-types.ts
│   ├── crawler-types.ts
│   ├── label-types.ts
│   ├── ocr-types.ts
│   └── template-types.ts
│
├── websocket/            # Real-time updates
│   └── socket-server.ts
│
└── index.ts              # Server entry point
```

### Key Services

| Service | Purpose | Size |
|---------|---------|------|
| `web-crawler-service.ts` | Puppeteer-based product scraping | ~850 LOC |
| `robust-ocr-service.ts` | Tesseract.js OCR with fallbacks | ~880 LOC |
| `automation-service.ts` | One-click workflow orchestration | ~750 LOC |
| `label-generator-service.ts` | PDFKit label rendering | ~160 LOC |
| `print-service.ts` | Print queue management | ~700 LOC |
| `data-validation-service.ts` | Tiered price parsing & validation | ~400 LOC |
| `lexware-import-service.ts` | Lexware ERP data import | ~300 LOC |
| `html-extraction-service.ts` | Product data extraction from HTML | ~500 LOC |
| `excel-parser-service.ts` | Excel file parsing & import | ~250 LOC |

### API Response Format
All endpoints use a unified response format:
```typescript
// Success
{ success: true, data: T, message?: string }

// Error
{ success: false, error: string, code?: string, details?: unknown }
```

---

## Frontend Architecture

### Directory Structure
```
frontend/src/
├── pages/                # Route components
│   ├── Dashboard.tsx     # Overview & stats
│   ├── Articles.tsx      # Product management
│   ├── LabelTemplateEditor.tsx  # Visual template editor
│   ├── RenderingTemplateEditor.tsx
│   ├── ExcelImportNew.tsx# Excel import wizard
│   ├── PrintPreview.tsx  # Print configuration
│   ├── Automation.tsx    # One-click workflow
│   ├── LabelLibrary.tsx  # Label management
│   ├── JobMonitor.tsx    # Job monitoring
│   ├── Settings.tsx      # App settings
│   └── ShopAutomation.tsx# Shop automation
│
├── components/           # Reusable UI
│   ├── common/           # Layout, Header, Toast, ErrorBoundary
│   ├── ui/               # shadcn/ui components
│   ├── PreviewCanvas/    # Konva.js label preview
│   ├── LabelManager/     # Label CRUD
│   ├── TemplateManager/  # Template CRUD
│   └── ExcelImporter/    # Import wizard steps
│
├── hooks/                # Custom React hooks
│   ├── useWebSocket.ts   # Real-time updates
│   ├── useKeyboardShortcuts.ts
│   └── useTemplates.ts
│
├── services/             # API client
│   └── api.ts            # Axios wrapper
│
├── store/                # Zustand state
│   ├── uiStore.ts        # Toast, modals
│   ├── labelStore.ts     # Label state
│   └── printStore.ts     # Print queue state
│
└── App.tsx               # Router & ErrorBoundary
```

### State Management
- **Zustand** for global UI state (toasts, modals)
- **TanStack Query** for server state caching
- **Local state** for component-specific data

---

## Database Schema (Prisma)

### All Models (9 total)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Product` | Consolidated articles | articleNumber, price, tieredPrices, priceType |
| `Template` | Label templates | width, height, layers (JSON), dpi |
| `Label` | Rendered labels | templateId, data, imageUrl, status |
| `CrawlJob` | Web scraping jobs | targetUrl, status, productsFound |
| `Screenshot` | Product screenshots | imageUrl, crawlJobId, productUrl |
| `OcrResult` | OCR results | screenshotId, articleNumber, tieredPrices |
| `Match` | OCR-Excel matches | ocrResultId, matchType, confidence |
| `AutomationJob` | One-click workflows | config, currentStage, progress |
| `ExcelData` | Cached Excel imports | fileName, data (JSON), headers |

### Key Model Details
```prisma
model Product {
  articleNumber String   @unique
  productName   String
  price         Float?
  priceType     String   @default("normal") // 'normal', 'tiered', 'auf_anfrage'
  tieredPrices  Json?    // [{quantity: 10, price: 45.99}]
  sourceUrl     String
  ocrConfidence Float?
  verified      Boolean  @default(false)
}

model Template {
  name        String
  width       Float    // in mm
  height      Float    // in mm
  layers      Json     // [{type: 'text', properties: {...}}]
  dpi         Int      @default(300)
}
```

---

## Infrastructure

### Docker Compose Services
| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `backend` | Node 20 | 3001 | API Server |
| `postgres` | PostgreSQL 16 | 5432 | Database |
| `redis` | Redis 7 | 6379 | Job Queue |

### Health Check Endpoints
| Endpoint | Purpose | K8S Probe |
|----------|---------|-----------|
| `/health/live` | Process alive | Liveness |
| `/health/ready` | Can accept traffic | Readiness |
| `/health/startup` | Finished starting | Startup |

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/screenshot_algo

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
NODE_ENV=production

# Optional
LOG_LEVEL=info
IMAGEKIT_PUBLIC_KEY=...
IMAGEKIT_PRIVATE_KEY=...
```

---

## Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Express.js | ^4.x |
| ORM | Prisma | ^6.x |
| Job Queue | BullMQ | ^5.x |
| Web Scraping | Puppeteer | ^24.x |
| OCR | Tesseract.js | ^6.x |
| PDF Generation | PDFKit | ^0.15.x |
| Image Processing | Sharp | ^0.33.x |
| Logging | Winston | ^3.x |
| Validation | Zod | ^3.x |

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | ^18.x |
| Build Tool | Vite | ^7.x |
| Styling | Tailwind CSS | ^4.x |
| Components | shadcn/ui | - |
| Canvas | Konva.js | ^10.x |
| State | Zustand | ^5.x |
| Data Fetching | TanStack Query | ^5.x |

### Testing
| Tool | Purpose |
|------|---------|
| Vitest | Unit & Integration Tests |
| Testing Library | React component tests |
| Playwright | E2E Tests |

---

## Data Flow

### Web Scraping Flow
```
1. User submits shop URL
2. Puppeteer loads page with stealth plugin
3. Cookie consent accepted automatically
4. Category links extracted
5. Product pages crawled in parallel
6. HTML parsed for product data
7. Screenshots taken for OCR
8. Data validated and stored
9. WebSocket updates sent to frontend
```

### Label Generation Flow
```
1. User selects products and template
2. Template rules applied (tiered pricing, etc.)
3. Label layout calculated
4. PDFKit renders label to buffer
5. Sharp optimizes image
6. PDF returned or queued for batch print
```

---

## Security Considerations

- CORS configured for specific origins
- Input validation with Zod schemas
- Path traversal prevention on file routes
- Rate limiting on API endpoints
- Prisma parameterized queries (SQL injection prevention)

---

## Performance Optimizations

- Redis caching for frequent queries
- BullMQ for background job processing
- Puppeteer browser pool reuse
- Image optimization with Sharp
- React lazy loading for routes
- Memoized hooks to prevent re-renders

---

*Last Updated: 2025-12-18*
*Version: 1.0*
