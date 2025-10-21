# Label Printer Backend

Backend API for the Label Printer WebApp.

## Features

- **Excel Import**: Parse Excel files for product descriptions
- **Label Management**: CRUD operations for price labels
- **Print Service**: Generate PDFs/PNGs with configurable layouts
- **Storage Service**: File-based label storage with metadata
- **RESTful API**: Clean, type-safe API endpoints

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Excel**: xlsx
- **PDF**: PDFKit
- **Image**: Sharp (for future image processing)
- **Storage**: File-based (JSON + images)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Labels (`/api/labels`)
- `POST /` - Create label
- `GET /` - Get all labels (with filters & pagination)
- `GET /:id` - Get single label
- `PUT /:id` - Update label
- `DELETE /:id` - Delete label
- `POST /batch` - Batch operations
- `POST /duplicate/:id` - Duplicate label
- `GET /stats/summary` - Get statistics

### Excel (`/api/excel`)
- `POST /upload` - Upload & parse Excel
- `GET /products` - Get all products
- `GET /product/:articleNumber` - Get single product
- `PUT /product/:articleNumber` - Update product
- `POST /product` - Add product
- `DELETE /product/:articleNumber` - Delete product
- `DELETE /cache` - Clear cache
- `GET /stats/summary` - Get stats
- `GET /template` - Download template
- `GET /export` - Export to Excel

### Print (`/api/print`)
- `POST /preview` - Generate preview
- `POST /export` - Export to PDF/PNG
- `GET /formats` - Get paper formats
- `POST /calculate-grid` - Calculate optimal grid

## Project Structure

```
backend/
├── src/
│   ├── api/
│   │   └── routes/
│   │       ├── labels.ts
│   │       ├── excel.ts
│   │       └── print.ts
│   ├── services/
│   │   ├── excel-parser-service.ts
│   │   ├── label-generator-service.ts
│   │   ├── storage-service.ts
│   │   └── print-service.ts
│   ├── types/
│   │   └── label-types.ts
│   └── index.ts
├── data/
│   ├── labels/
│   ├── cache/
│   └── exports/
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build TypeScript
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
