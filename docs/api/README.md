# Screenshot Algo API Documentation

## Overview

Screenshot Algo is a professional label generation and product management system that provides:
- **Product/Article Management** - CRUD operations for products with prices, images, and metadata
- **Label Generation** - Create printable price labels from product data
- **Template Management** - Customize label layouts and designs
- **Excel Import** - Bulk import product data from Excel files
- **Web Crawling** - Automatic product data extraction from websites
- **OCR Processing** - Text extraction from product images

## Base URL

| Environment | URL |
|-------------|-----|
| Local Development | `http://localhost:3001` |
| Docker | `http://localhost:3001` |

## Authentication

The API uses session-based authentication for most endpoints.

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

## API Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| GET | `/api/status` | System status |

### Articles (Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/articles` | List all articles with pagination |
| GET | `/api/articles/:id` | Get single article |
| POST | `/api/articles` | Create new article |
| PUT | `/api/articles/:id` | Update article |
| DELETE | `/api/articles/:id` | Delete article |
| GET | `/api/articles/stats` | Get article statistics |

#### Query Parameters for GET /api/articles

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 2000) |
| `search` | string | - | Search in articleNumber, productName, description |
| `category` | string | - | Filter by category |
| `verified` | boolean | - | Filter by verified status |
| `published` | boolean | - | Filter by published status |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort order (asc/desc) |

### Labels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/labels` | List all labels |
| GET | `/api/labels/:id` | Get single label |
| POST | `/api/labels` | Create new label |
| PUT | `/api/labels/:id` | Update label |
| DELETE | `/api/labels/:id` | Delete label |
| GET | `/api/labels/:id/image` | Get label image |
| GET | `/api/labels/:id/thumbnail` | Get label thumbnail |
| POST | `/api/labels/batch` | Batch operations |
| POST | `/api/labels/duplicate/:id` | Duplicate a label |
| POST | `/api/labels/generate-from-article` | Generate label from article |
| GET | `/api/labels/stats` | Get label statistics |

### Label Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/label-templates` | List all templates |
| GET | `/api/label-templates/:id` | Get single template |
| POST | `/api/label-templates` | Create new template |
| PUT | `/api/label-templates/:id` | Update template |
| DELETE | `/api/label-templates/:id` | Delete template |

### Print Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/print/templates` | List print templates |
| POST | `/api/print/templates` | Create print template |
| DELETE | `/api/print/templates/:id` | Delete print template |
| POST | `/api/print/preview` | Generate print preview |
| POST | `/api/print/generate` | Generate printable PDF |

### Excel Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/excel/upload` | Upload Excel file |
| POST | `/api/excel/preview` | Preview Excel data |
| POST | `/api/excel/import` | Import Excel data |
| GET | `/api/excel/valid-fields` | Get valid database fields |

### Automation & Crawling

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/start-simple` | Start simple crawl job |
| GET | `/api/automation/jobs` | List crawl jobs |
| GET | `/api/automation/jobs/:id` | Get job status |
| POST | `/api/crawler/start` | Start crawler |
| GET | `/api/crawler/status/:id` | Get crawler status |

### OCR

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ocr/extract` | Extract text from image |

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "articles": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

## Rate Limiting

Rate limiting is applied to protect the API:

| Route Type | Limit |
|------------|-------|
| General API | 100 requests/minute |
| Mutations | 30 requests/minute |
| Batch Operations | 10 requests/minute |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704110400
```

## WebSocket Events

Real-time updates are available via WebSocket connection to `ws://localhost:3001`.

### Events

| Event | Description |
|-------|-------------|
| `job:progress` | Crawl job progress update |
| `job:complete` | Crawl job completed |
| `job:error` | Crawl job error |
| `label:created` | New label created |
| `label:updated` | Label updated |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Authentication required |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Examples

### Create a Label from Article

```bash
curl -X POST http://localhost:3001/api/labels/generate-from-article \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": "uuid-of-article",
    "templateId": "uuid-of-template"
  }'
```

### Import Excel Data

```bash
# 1. Upload file
curl -X POST http://localhost:3001/api/excel/upload \
  -F "file=@products.xlsx"

# 2. Preview data
curl -X POST http://localhost:3001/api/excel/preview \
  -H "Content-Type: application/json" \
  -d '{"fileId": "uploaded-file-id"}'

# 3. Import with mapping
curl -X POST http://localhost:3001/api/excel/import \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "uploaded-file-id",
    "matchColumn": {"type": "header", "value": "Artikelnummer"},
    "fieldMappings": [
      {"excelColumn": "B", "dbField": "productName", "type": "index"},
      {"excelColumn": "C", "dbField": "price", "type": "index"}
    ]
  }'
```

### Batch Delete Labels

```bash
curl -X POST http://localhost:3001/api/labels/batch \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "delete",
    "labelIds": ["id1", "id2", "id3"]
  }'
```

## OpenAPI Specification

The full OpenAPI specification is available at:
- [openapi.yaml](../../openapi.yaml) - YAML format

## Support

- GitHub Issues: [github.com/screenshot-algo/issues](https://github.com/screenshot-algo/issues)
- Documentation: See `/docs` folder
