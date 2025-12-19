# Code Conventions

Code style and conventions for Screenshot_Algo.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript](#typescript)
- [React](#react)
- [API Design](#api-design)
- [Database](#database)
- [Testing](#testing)
- [Git](#git)

## General Principles

### KISS - Keep It Simple

- Write simple, readable code
- Avoid premature optimization
- Prefer clarity over cleverness

### DRY - Don't Repeat Yourself

- Extract common logic into utilities
- Use shared types and interfaces
- But don't over-abstract

### SOLID Principles

- **S**ingle Responsibility
- **O**pen/Closed
- **L**iskov Substitution
- **I**nterface Segregation
- **D**ependency Inversion

## TypeScript

### Strict Mode

Always use strict TypeScript:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Types vs Interfaces

```typescript
// Use interfaces for object shapes
interface User {
  id: string;
  email: string;
  name: string;
}

// Use types for unions, primitives, utilities
type Status = 'pending' | 'processing' | 'completed' | 'failed';
type UserId = string;
type Nullable<T> = T | null;
```

### Naming Conventions

```typescript
// PascalCase for types, interfaces, classes, components
interface ScreenshotRequest { }
class ScreenshotService { }
function UserProfile() { }

// camelCase for variables, functions, methods
const screenshotCount = 0;
function processScreenshot() { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const API_TIMEOUT = 30000;

// kebab-case for file names
// user-service.ts, screenshot-worker.ts
```

### Avoid `any`

```typescript
// ❌ Bad
function process(data: any) { }

// ✅ Good
function process(data: ScreenshotRequest) { }

// ✅ When truly unknown
function parse(data: unknown) {
  if (isScreenshotRequest(data)) {
    // Now TypeScript knows the type
  }
}
```

### Prefer `const` and `readonly`

```typescript
// ❌ Bad
let config = { timeout: 5000 };

// ✅ Good
const config = { timeout: 5000 } as const;

// ✅ For class properties
class Service {
  readonly timeout: number;
}
```

## React

### Functional Components

```typescript
// ✅ Preferred
interface Props {
  url: string;
  onCapture: (result: Screenshot) => void;
}

export function ScreenshotForm({ url, onCapture }: Props) {
  return <form>...</form>;
}
```

### Hooks

```typescript
// Custom hooks start with 'use'
function useScreenshot(url: string) {
  const [data, setData] = useState<Screenshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ...

  return { data, loading, error };
}
```

### Component Structure

```typescript
// 1. Imports
import { useState } from 'react';

// 2. Types
interface Props { }

// 3. Component
export function Component({ prop }: Props) {
  // 3.1 Hooks
  const [state, setState] = useState();

  // 3.2 Derived state
  const computed = useMemo(() => {}, []);

  // 3.3 Effects
  useEffect(() => {}, []);

  // 3.4 Handlers
  const handleClick = () => {};

  // 3.5 Render
  return <div />;
}
```

## API Design

### RESTful Endpoints

```
GET    /api/screenshots          # List
POST   /api/screenshots          # Create
GET    /api/screenshots/:id      # Read
PUT    /api/screenshots/:id      # Update
DELETE /api/screenshots/:id      # Delete
```

### Response Format

```typescript
// Success
{
  "status": "success",
  "data": { ... }
}

// Error
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid URL provided",
    "details": { ... }
  }
}

// Paginated
{
  "status": "success",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

## Database

### Prisma Schema

```prisma
model Screenshot {
  id        String   @id @default(cuid())
  url       String
  status    Status   @default(PENDING)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}

enum Status {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

### Naming

- Tables: PascalCase singular (`User`, `Screenshot`)
- Columns: camelCase (`createdAt`, `userId`)
- Indexes: descriptive (`idx_screenshots_status`)

## Testing

### Test File Naming

```
component.tsx       → component.test.tsx
service.ts          → service.test.ts
api-endpoint.ts     → api-endpoint.integration.test.ts
```

### Test Structure

```typescript
describe('ScreenshotService', () => {
  describe('capture', () => {
    it('should capture screenshot for valid URL', async () => {
      // Arrange
      const url = 'https://example.com';

      // Act
      const result = await service.capture(url);

      // Assert
      expect(result).toHaveProperty('id');
    });

    it('should throw for invalid URL', async () => {
      await expect(service.capture('invalid'))
        .rejects.toThrow('Invalid URL');
    });
  });
});
```

## Git

### Branch Naming

```
feature/add-screenshot-caching
fix/memory-leak-worker
docs/update-api-reference
refactor/extract-validation
```

### Commit Messages

```
feat(api): add screenshot caching endpoint
fix(worker): resolve memory leak in image processing
docs(readme): update installation instructions
refactor(core): extract URL validation to utility
test(api): add integration tests for auth endpoints
chore(deps): update dependencies
```

### PR Guidelines

- Keep PRs small and focused
- Include tests for new features
- Update documentation as needed
- Request review from appropriate team members

---

Questions? Open an issue or ask in discussions.
