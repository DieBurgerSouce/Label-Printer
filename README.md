# Screenshot Scraper für shop.firmenich.de

Production-ready Screenshot-System für automatisierte Produktseiten-Erfassung mit Playwright, BullMQ und Redis.

## Features

- **Browser-Pooling**: Effiziente Wiederverwendung von Browser-Instanzen (3-12 parallel)
- **Queue-System**: BullMQ mit Redis für Job-Management und Retry-Logic
- **Wait-Strategien**: Kombinierte Network-Idle, Element-Visibility und Custom-Conditions
- **Lazy-Loading**: Automatisches Scrollen und Image-Load-Detection
- **Konsistenz**: Deaktivierte Animationen, Fixed-Viewport (1920x1080 Retina)
- **Caching**: Redis-basiert mit Content-Hash-Deduplizierung
- **File-Management**: Hierarchische Struktur (by-category, by-date, by-status)
- **Error-Handling**: Exponentielles Backoff mit 3 Retry-Attempts
- **Monitoring**: Strukturiertes Logging mit Winston

## Voraussetzungen

- Node.js >= 18.0.0
- Redis (via Docker oder lokal)
- ~16GB RAM für Production (8 Browser * 2GB)

## Installation

```bash
# Dependencies installieren
npm install

# Playwright Browser installieren
npx playwright install chromium

# Environment-Variablen konfigurieren
cp .env.example .env
# .env anpassen (SHOP_URL, REDIS_HOST, etc.)
```

## Quick Start

### 1. Redis starten

```bash
# Mit Docker Compose
docker-compose up -d

# Oder lokal
redis-server
```

### 2. URLs extrahieren und in Queue laden

```bash
npm run dev
```

Dies:
- Lädt die Sitemap von `shop.firmenich.de`
- Extrahiert alle Produkt-URLs
- Fügt Jobs zur Queue hinzu

### 3. Worker starten (Screenshots erstellen)

```bash
npm run worker
```

Der Worker:
- Verarbeitet Jobs aus der Queue
- Erstellt Screenshots mit Playwright
- Speichert sie in `./screenshots`
- Verwendet Browser-Pooling für Performance

## Architektur

```
┌─────────────────┐
│   index.ts      │  Sitemap → URLs → Queue
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Queue (Redis)  │  Job-Management & Retry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Screenshot      │  8-12 Concurrent Workers
│ Worker          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Browser Manager │  Pool: 3-12 Browser-Instanzen
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Screenshot      │  Wait-Strategien + Lazy-Loading
│ Service         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Storage Service │  /screenshots/by-category/...
└─────────────────┘
```

## Konfiguration

Alle Einstellungen in `.env`:

### Screenshot-Settings

```env
SCREENSHOT_WIDTH=1920
SCREENSHOT_HEIGHT=1080
SCREENSHOT_DEVICE_SCALE_FACTOR=2  # Retina-Qualität
SCREENSHOT_TIMEOUT=30000          # 30 Sekunden
SCREENSHOT_WAIT_AFTER_LOAD=1000   # 1 Sekunde Post-Wait
```

### Browser-Pool

```env
BROWSER_POOL_MIN=3
BROWSER_POOL_MAX=12
BROWSER_RECYCLE_AFTER=100  # Browser nach 100 Requests recyclen
```

### Queue-Konfiguration

```env
QUEUE_CONCURRENCY=8        # 8 parallele Jobs
QUEUE_MAX_ATTEMPTS=3       # 3 Retry-Versuche
QUEUE_BACKOFF_DELAY=2000   # 2s, 4s, 8s Backoff
```

### Features

```env
ENABLE_AUTO_SCROLL=true           # Lazy-Loading-Fix
ENABLE_LAZY_LOADING_FIX=true
DISABLE_ANIMATIONS=true
CHUNKED_SCREENSHOT_THRESHOLD=6000 # Chunked für Seiten >6000px
```

## Performance

**Erwartete Durchsatzrate:**
- **8 concurrent workers**: 3-5 Seiten/Sekunde
- **12 concurrent workers**: 5-8 Seiten/Sekunde
- **2500 Produktseiten**: 8-12 Minuten (ohne Cache)
- **Mit 70% Cache-Hit**: 3-5 Minuten

**Resource-Usage:**
- CPU: 8 vCPUs empfohlen (1 pro concurrent worker)
- RAM: 16GB (ca. 600MB pro Browser + 4GB System)
- Disk: ~50MB pro 1000 Screenshots (PNG, fullPage)

## Output-Struktur

```
screenshots/
├── by-category/
│   ├── electronics/
│   │   └── SKU12345_electronics_20250110_v01.png
│   └── clothing/
│       └── PROD789_clothing_20250110_v01.png
├── by-date/
│   └── 2025/
│       └── 01/
│           └── 10/
│               └── SKU12345_electronics_20250110_v01.png
└── by-status/
    ├── pending/
    ├── approved/
    └── failed/
```

### File-Naming-Convention

Format: `[ProductID]_[Category]_[YYYYMMDD]_[Version].png`

**Beispiele:**
- `SKU12345_electronics_20250110_v01.png`
- `PROD789_clothing_20250110_v02.png`

**Best Practices** (Harvard/Library of Congress):
- Lowercase only
- Underscores statt Leerzeichen
- ISO-Datum (YYYYMMDD)
- Max. 40-50 Zeichen
- Leading Zeros für Sequenzen

## Monitoring

### Logs

```bash
# Live-Logs anzeigen
tail -f logs/app.log

# Nur Errors
tail -f logs/error.log
```

### Queue-Stats

```typescript
import { getQueueService } from './src/services/queue-service';

const queueService = getQueueService();
const stats = await queueService.getStats();

console.log(stats);
// { waiting: 1500, active: 8, completed: 500, failed: 2, delayed: 0 }
```

### Browser-Pool-Status

```typescript
import { getBrowserManager } from './src/services/browser-manager';

const browserManager = getBrowserManager();
const status = browserManager.getStatus();

console.log(status);
// { total: 8, available: 3, inUse: 5, healthy: 8 }
```

## Troubleshooting

### Problem: "Redis connection refused"

```bash
# Redis starten
docker-compose up -d redis

# Oder lokal
redis-server

# Connection testen
redis-cli ping  # Sollte "PONG" ausgeben
```

### Problem: Screenshots sind inkonsistent

```env
# In .env setzen:
DISABLE_ANIMATIONS=true
SCREENSHOT_WAIT_AFTER_LOAD=2000  # Auf 2 Sekunden erhöhen
```

### Problem: "Browser launch failed"

```bash
# Playwright Browser neu installieren
npx playwright install --with-deps chromium
```

### Problem: Worker hängt

```bash
# Worker neu starten
pkill -f screenshot-worker
npm run worker
```

### Problem: Speicherplatz voll

```bash
# Alte Screenshots bereinigen
npm run cleanup -- --days 30  # Älter als 30 Tage
```

## Development

### Build

```bash
npm run build
```

### Lint & Format

```bash
npm run lint
npm run format
```

### Testing

```bash
# Unit-Tests
npm test

# Mit Coverage
npm run test:coverage
```

## Production-Deployment

### Option 1: Lokal mit PM2

```bash
# PM2 installieren
npm install -g pm2

# Build
npm run build

# Start mit PM2
pm2 start dist/workers/screenshot-worker.js -i 4  # 4 Worker-Instanzen
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright:focal

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

CMD ["node", "dist/workers/screenshot-worker.js"]
```

```bash
docker build -t screenshot-scraper .
docker run -d --name worker1 screenshot-scraper
```

### Option 3: AWS ECS / Kubernetes

Siehe `Mission.md` für detaillierte Cloud-Deployment-Anleitung.

## Roadmap

- [ ] Bull Board UI (Queue Monitoring)
- [ ] S3/CloudFlare R2 Upload
- [ ] Prometheus-Metriken
- [ ] Grafana-Dashboard
- [ ] Shopware 6 Store API Integration
- [ ] Webhook-Support für Auto-Updates
- [ ] REST API für On-Demand-Screenshots
- [ ] Template-System-Integration (BarTender, Templated.io)

## Performance-Tuning

### Für maximale Geschwindigkeit

```env
BROWSER_POOL_MAX=16
QUEUE_CONCURRENCY=16
CACHE_ENABLED=true
DISABLE_ANIMATIONS=true
SCREENSHOT_WAIT_AFTER_LOAD=500  # Reduzieren auf 0.5s
```

### Für maximale Konsistenz

```env
BROWSER_POOL_MAX=6
QUEUE_CONCURRENCY=6
SCREENSHOT_WAIT_AFTER_LOAD=2000  # Erhöhen auf 2s
ENABLE_AUTO_SCROLL=true
CHUNKED_SCREENSHOT_THRESHOLD=4000
```

## License

MIT

## Support

- GitHub Issues: [Link zu deinem Repo]
- Email: [Your Email]

---

**Built with** Playwright, BullMQ, Redis, TypeScript

**Inspired by** Mission.md Best Practices
