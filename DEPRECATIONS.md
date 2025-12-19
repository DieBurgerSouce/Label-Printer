# Deprecations

This document tracks deprecated features, APIs, and configurations in Screenshot_Algo.

## Deprecation Policy

- **Warning Period**: 2 major versions before removal
- **Notification**: Console warnings, documentation, changelog
- **Migration Path**: Always provided with deprecation notice

## Currently Deprecated

### API Endpoints

#### `POST /api/screenshot` (v1 endpoint)

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0
**Replacement**: `POST /api/v2/screenshots`

```diff
- POST /api/screenshot
+ POST /api/v2/screenshots

- { "url": "https://example.com", "width": 1920 }
+ { "url": "https://example.com", "viewport": { "width": 1920 } }
```

**Migration**:
```javascript
// Before
const result = await fetch('/api/screenshot', {
  method: 'POST',
  body: JSON.stringify({ url, width: 1920 })
});

// After
const result = await fetch('/api/v2/screenshots', {
  method: 'POST',
  body: JSON.stringify({
    url,
    viewport: { width: 1920 }
  })
});
```

---

#### `GET /api/articles/:id/image`

**Deprecated in**: v2.1.0
**Removal in**: v4.0.0
**Replacement**: `GET /api/v2/articles/:id/screenshots`

**Reason**: Renamed for clarity and consistency

---

### Configuration Options

#### `storage.type`

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0
**Replacement**: `storage.provider`

```diff
// config.js
module.exports = {
  storage: {
-   type: 'local',
+   provider: 'local',

-   path: './screenshots',
+   basePath: './data/screenshots',
  }
};
```

---

#### `browser.timeout`

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0
**Replacement**: `screenshot.timeout`

```diff
module.exports = {
- browser: {
-   timeout: 30000
- },
+ screenshot: {
+   timeout: 30000,
+   navigationTimeout: 15000
+ }
};
```

---

#### `SCREENSHOT_API_KEY` environment variable

**Deprecated in**: v2.2.0
**Removal in**: v4.0.0
**Replacement**: `API_KEY`

```diff
- SCREENSHOT_API_KEY=your-key
+ API_KEY=your-key
```

---

### SDK Methods

#### `screenshotAlgo.capture(url, options)`

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0
**Replacement**: `screenshotAlgo.screenshot.capture(options)`

```javascript
// Before (deprecated)
const result = await screenshotAlgo.capture('https://example.com', {
  width: 1920,
  height: 1080
});

// After
const result = await screenshotAlgo.screenshot.capture({
  url: 'https://example.com',
  viewport: {
    width: 1920,
    height: 1080
  }
});
```

---

#### `article.getImage()`

**Deprecated in**: v2.1.0
**Removal in**: v4.0.0
**Replacement**: `article.getScreenshot()`

```javascript
// Before (deprecated)
const image = await article.getImage();

// After
const screenshot = await article.getScreenshot();
```

---

### Event Names

#### `screenshot:complete`

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0
**Replacement**: `screenshot:completed`

```javascript
// Before (deprecated)
emitter.on('screenshot:complete', handler);

// After
emitter.on('screenshot:completed', handler);
```

---

### Database Columns

#### `articles.image_url`

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0
**Replacement**: Use `screenshots` table with relationship

**Migration**: Run `npm run db:migrate` to add new tables

---

### Response Formats

#### Legacy Error Format

**Deprecated in**: v2.0.0
**Removal in**: v4.0.0

```diff
// Before (deprecated)
- { "error": "Not found" }

// After (RFC 7807 Problem Details)
+ {
+   "type": "https://api.screenshot-algo.com/errors/not-found",
+   "title": "Not Found",
+   "status": 404,
+   "detail": "Article with ID 123 was not found"
+ }
```

---

## Removed (Historical)

### v2.0.0 Removals

| Feature | Removed | Alternative |
|---------|---------|-------------|
| XML export | v2.0.0 | JSON export |
| PhantomJS renderer | v2.0.0 | Puppeteer (default) |
| `--legacy` CLI flag | v2.0.0 | None |

### v3.0.0 Removals

| Feature | Removed | Alternative |
|---------|---------|-------------|
| Legacy webhook format | v3.0.0 | CloudEvents format |
| HTTP/1.0 support | v3.0.0 | HTTP/1.1 or HTTP/2 |

---

## Deprecation Warnings

When using deprecated features, you'll see console warnings:

```
[DEPRECATED] storage.type is deprecated and will be removed in v4.0.0.
             Use storage.provider instead.
             See: https://docs.screenshot-algo.com/migration#storage-type
```

### Suppress Warnings (not recommended)

```bash
# Environment variable
SUPPRESS_DEPRECATION_WARNINGS=true

# Or in code (not recommended)
screenshotAlgo.config.suppressDeprecationWarnings = true;
```

---

## Upcoming Deprecations

### Planned for v3.0.0

| Feature | Reason | Replacement |
|---------|--------|-------------|
| Callback-style API | Modernization | Promise/async API |
| `format: 'jpeg'` | Typo | `format: 'jpg'` |

### Planned for v4.0.0

| Feature | Reason | Replacement |
|---------|--------|-------------|
| All v1 endpoints | API cleanup | v2 endpoints |
| Legacy configs | Simplification | New config format |

---

## Feedback

Have concerns about a deprecation? Let us know:
- GitHub Issues with `deprecation` label
- Email: feedback@example.com

We consider community feedback when planning deprecations and may extend warning periods for widely-used features.
