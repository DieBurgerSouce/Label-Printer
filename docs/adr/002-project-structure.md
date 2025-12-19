# ADR-002: Project Structure

## Status

Accepted

## Date

2024-01-01

## Context

We need to define a project structure that:

- Scales as the codebase grows
- Makes it easy to find and modify code
- Supports clear separation of concerns
- Enables effective testing
- Facilitates team collaboration

## Decision

We will use a **feature-based modular structure** with clear separation between layers.

### Directory Structure

```
Screenshot_Algo/
├── src/
│   ├── api/                    # HTTP API Layer
│   │   ├── routes/             # Express route definitions
│   │   ├── middleware/         # Express middleware
│   │   ├── controllers/        # Request handlers
│   │   └── validators/         # Request validation schemas
│   │
│   ├── engine/                 # Screenshot Engine
│   │   ├── ScreenshotEngine.ts # Main engine class
│   │   ├── BrowserManager.ts   # Browser pool management
│   │   ├── PageHandler.ts      # Page interactions
│   │   └── processors/         # Image/PDF processors
│   │
│   ├── queue/                  # Job Queue System
│   │   ├── QueueManager.ts     # Queue orchestration
│   │   ├── workers/            # Job workers
│   │   └── jobs/               # Job definitions
│   │
│   ├── storage/                # Storage Abstraction
│   │   ├── StorageAdapter.ts   # Abstract interface
│   │   ├── S3Storage.ts        # S3 implementation
│   │   └── LocalStorage.ts     # Local implementation
│   │
│   ├── config/                 # Configuration
│   │   ├── index.ts            # Config aggregation
│   │   ├── database.ts         # DB config
│   │   └── browser.ts          # Browser config
│   │
│   ├── types/                  # TypeScript Types
│   │   ├── api.ts              # API types
│   │   ├── screenshot.ts       # Screenshot types
│   │   └── index.ts            # Type exports
│   │
│   ├── utils/                  # Utility Functions
│   │   ├── logger.ts           # Logging utility
│   │   ├── errors.ts           # Custom errors
│   │   └── helpers.ts          # General helpers
│   │
│   └── index.ts                # Application entry point
│
├── __tests__/                  # Test Files
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   ├── e2e/                    # End-to-end tests
│   └── fixtures/               # Test data
│
├── scripts/                    # Build & Utility Scripts
├── docs/                       # Documentation
│   ├── api/                    # API documentation
│   └── adr/                    # Architecture Decision Records
│
├── .github/                    # GitHub Configuration
│   ├── workflows/              # GitHub Actions
│   └── ISSUE_TEMPLATE/         # Issue templates
│
└── docker/                     # Docker Configuration
```

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Files | camelCase | `screenshotEngine.ts` |
| Classes | PascalCase | `ScreenshotEngine` |
| Interfaces | PascalCase with I prefix | `IScreenshotOptions` |
| Types | PascalCase | `ScreenshotResult` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Functions | camelCase | `captureScreenshot()` |

### Import Conventions

```typescript
// 1. Node.js built-ins
import { join } from 'path';
import { readFile } from 'fs/promises';

// 2. External dependencies
import express from 'express';
import { chromium } from 'playwright';

// 3. Internal modules (using path aliases)
import { ScreenshotEngine } from '@/engine';
import { logger } from '@/utils/logger';
import type { ScreenshotOptions } from '@/types';
```

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/api/*": ["./src/api/*"],
      "@/engine/*": ["./src/engine/*"],
      "@/types/*": ["./src/types/*"]
    }
  }
}
```

## Consequences

### Positive

- **Discoverability**: Clear structure makes code easy to find
- **Scalability**: Modules can grow independently
- **Testability**: Each module can be tested in isolation
- **Maintainability**: Clear boundaries reduce coupling
- **Onboarding**: New developers can understand structure quickly

### Negative

- **Initial Setup**: More configuration required upfront
- **Import Complexity**: Path aliases need tooling configuration
- **Over-engineering Risk**: May be overkill for very small projects

### Neutral

- Requires discipline to maintain structure
- Team must agree on placement of new features

## Alternatives Considered

### Flat Structure

- **Pros**: Simple, no nesting, fewer decisions
- **Cons**: Doesn't scale, hard to navigate in larger projects
- **Why not chosen**: Won't scale as project grows

### Domain-Driven Structure

- **Pros**: Strong boundaries, good for complex domains
- **Cons**: Overkill for this project size, more abstraction
- **Why not chosen**: Too complex for current requirements

### Next.js/Framework Conventions

- **Pros**: Established patterns, familiar to many
- **Cons**: Tied to specific framework conventions
- **Why not chosen**: We're building a custom API, not using Next.js

## References

- [Node.js Project Structure Best Practices](https://github.com/goldbergyoni/nodebestpractices#1-project-structure-practices)
- [TypeScript Path Aliases](https://www.typescriptlang.org/tsconfig#paths)
