# OCR Services Documentation

## Overview

There are TWO separate OCR services with different purposes:

### 1. `ocr-service.ts` - Single Screenshot Processing

**Purpose:** Process individual screenshots via API

**Used by:**
- `src/api/routes/ocr.ts` - API endpoint `/api/ocr/process`
- Direct API calls for single screenshot OCR

**Key Methods:**
- `processScreenshot(imagePath, config, jobId)` - Process a single screenshot
- Returns OCR result with extracted text and data

**Use Case:**
- Manual screenshot uploads
- Single image processing
- API-based OCR requests

---

### 2. `robust-ocr-service.ts` - Batch Article Processing

**Purpose:** Process multiple article screenshots in batch mode

**Used by:**
- `src/services/automation-service.ts` - Automated crawling workflows

**Key Methods:**
- `initialize()` - Initialize Tesseract workers
- `processArticleElements(screenshots)` - Process multiple screenshots for one article
- `processBatch(articleNumbers, screenshots)` - Process multiple articles
- `shutdown()` - Cleanup workers

**Use Case:**
- Automated crawling of multiple products
- Batch processing with worker pool
- Memory-optimized multi-article OCR

**Features:**
- Worker pool management (prevents memory leaks)
- Retry logic
- Batch optimization
- Progress tracking

---

## Why Two Services?

These are **NOT duplicates** - they serve different architectural needs:

1. **ocr-service** = Simple, stateless, API-friendly
2. **robust-ocr-service** = Complex, stateful, batch-optimized

**DO NOT** try to merge them without understanding the architectural implications!

---

## Technical Details

### ocr-service.ts
- File size: ~766 lines
- Tesseract workers: Created per request
- Memory: Garbage collected after each request
- Performance: Optimized for single requests

### robust-ocr-service.ts
- File size: ~600 lines
- Tesseract workers: Pooled and reused
- Memory: Managed manually to prevent leaks
- Performance: Optimized for batch processing

---

## Migration Path (Future)

If you want to consolidate in the future:

1. Add `processScreenshot()` method to `robust-ocr-service`
2. Update `/api/ocr/process` route to use robust-ocr-service
3. Remove old ocr-service.ts
4. Test thoroughly!

**Estimated effort:** 4-8 hours
**Risk:** Medium (API compatibility)
