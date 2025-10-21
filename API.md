# Screenshot Scraper API Documentation

## Overview

REST API und Bull Board UI für den Screenshot Scraper. Bietet vollständige Kontrolle über Queue, Screenshots und Monitoring.

## Quick Start

```bash
# API Server starten (Port 3001)
npm run api

# Im Browser öffnen
# API: http://localhost:3001
# Bull Board: http://localhost:3001/admin/queues
```

## Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-09T22:20:56.393Z",
  "queue": {
    "isReady": true,
    "isPaused": false,
    "stats": {
      "waiting": 0,
      "active": 0,
      "completed": 44,
      "failed": 0,
      "delayed": 0
    }
  },
  "browser": {
    "total": 3,
    "available": 3,
    "inUse": 0,
    "healthy": 3
  },
  "uptime": 51.92,
  "memory": { "rss": 103698432, "heapTotal": 30760960, "heapUsed": 28717288 }
}
```

### Queue Statistics

```bash
GET /api/queue/stats
```

**Response:**
```json
{
  "waiting": 0,
  "active": 0,
  "completed": 44,
  "failed": 0,
  "delayed": 0
}
```

### Create Screenshot Job

```bash
POST /api/screenshot
Content-Type: application/json

{
  "url": "https://shop.firmenich.de/detail/test123",
  "productId": "test123",
  "category": "test",
  "priority": 0
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "53f0aed6e997724adcd7e807239ae740",
  "message": "Screenshot job created successfully"
}
```

### Bulk Create Screenshot Jobs

```bash
POST /api/screenshot/bulk
Content-Type: application/json

{
  "jobs": [
    { "url": "https://example.com/1", "productId": "prod1" },
    { "url": "https://example.com/2", "productId": "prod2" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "message": "2 screenshot jobs created successfully"
}
```

### Get Job Status

```bash
GET /api/screenshot/:jobId
```

**Example:**
```bash
curl http://localhost:3001/api/screenshot/53f0aed6e997724adcd7e807239ae740
```

**Response:**
```json
{
  "id": "53f0aed6e997724adcd7e807239ae740",
  "data": {
    "url": "https://shop.firmenich.de/detail/test123",
    "productId": "test123"
  },
  "state": "completed",
  "progress": 100,
  "attemptsMade": 1,
  "timestamp": 1760047625855,
  "processedOn": 1760047625856,
  "finishedOn": 1760047645123,
  "returnvalue": {
    "success": true,
    "filepath": "C:\\Users\\benfi\\Screenshot_Algo\\screenshots\\test123_20251010_v01.png",
    "fileSize": 1234567
  }
}
```

### Retry Failed Job

```bash
POST /api/screenshot/:jobId/retry
```

**Response:**
```json
{
  "success": true,
  "message": "Job retry initiated"
}
```

### Get Failed Jobs

```bash
GET /api/queue/failed?start=0&end=10
```

**Response:**
```json
{
  "count": 0,
  "jobs": []
}
```

### Get Completed Jobs

```bash
GET /api/queue/completed?start=0&end=3
```

**Response:**
```json
{
  "count": 44,
  "jobs": [
    {
      "id": "9e99e4a9241a348db38572cdcb0e14a5",
      "data": { "url": "https://shop.firmenich.de/detail/..." },
      "returnvalue": {
        "success": true,
        "filepath": "C:\\Users\\benfi\\Screenshot_Algo\\screenshots\\...png",
        "fileSize": 1201900
      },
      "processedOn": 1760047532657,
      "finishedOn": 1760047558864
    }
  ]
}
```

### Cache Statistics

```bash
GET /api/cache/stats
```

**Response:**
```json
{
  "keys": 137,
  "memoryUsage": "2.38M",
  "hitRate": 57.62
}
```

### Clear Cache

```bash
DELETE /api/cache
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

### Pause Queue

```bash
POST /api/queue/pause
```

**Response:**
```json
{
  "success": true,
  "message": "Queue paused"
}
```

### Resume Queue

```bash
POST /api/queue/resume
```

**Response:**
```json
{
  "success": true,
  "message": "Queue resumed"
}
```

## Bull Board UI

Dashboard für Queue-Monitoring mit visueller Übersicht aller Jobs.

**URL:** `http://localhost:3001/admin/queues`

**Features:**
- ✅ Real-time Queue-Statistiken
- ✅ Job-Details und Logs
- ✅ Retry fehlgeschlagener Jobs
- ✅ Job-Suche und Filterung
- ✅ Job-Prioritäten anpassen
- ✅ Queue pausieren/fortsetzen

**Basic Auth:**
- Username: `admin` (aus `.env` `BULL_BOARD_USERNAME`)
- Password: Setze `BULL_BOARD_PASSWORD` in `.env`

## Configuration

In `.env` konfigurieren:

```env
# API Server
APP_PORT=3000

# Bull Board
BULL_BOARD_ENABLED=true
BULL_BOARD_PORT=3001
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=your_secure_password
```

## Error Handling

Alle Endpoints geben bei Fehlern folgendes Format zurück:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Erfolg
- `201` - Ressource erstellt
- `400` - Ungültige Anfrage
- `404` - Nicht gefunden
- `500` - Server-Fehler
- `503` - Service nicht verfügbar

## Examples

### Mit curl

```bash
# Health Check
curl http://localhost:3001/health

# Screenshot erstellen
curl -X POST http://localhost:3001/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","productId":"prod123"}'

# Job-Status abrufen
curl http://localhost:3001/api/screenshot/JOB_ID

# Queue-Statistiken
curl http://localhost:3001/api/queue/stats
```

### Mit JavaScript/Node.js

```javascript
const axios = require('axios');

// Screenshot erstellen
async function createScreenshot(url, productId) {
  const response = await axios.post('http://localhost:3001/api/screenshot', {
    url,
    productId,
  });

  return response.data.jobId;
}

// Job-Status prüfen
async function checkJobStatus(jobId) {
  const response = await axios.get(`http://localhost:3001/api/screenshot/${jobId}`);
  return response.data;
}

// Verwendung
const jobId = await createScreenshot('https://example.com', 'prod123');
console.log('Job created:', jobId);

// Warten und Status prüfen
setTimeout(async () => {
  const status = await checkJobStatus(jobId);
  console.log('Job status:', status.state);
  if (status.state === 'completed') {
    console.log('Screenshot saved:', status.returnvalue.filepath);
  }
}, 30000); // 30 Sekunden warten
```

### Mit Python

```python
import requests
import time

# Screenshot erstellen
def create_screenshot(url, product_id):
    response = requests.post('http://localhost:3001/api/screenshot', json={
        'url': url,
        'productId': product_id
    })
    return response.json()['jobId']

# Job-Status prüfen
def check_job_status(job_id):
    response = requests.get(f'http://localhost:3001/api/screenshot/{job_id}')
    return response.json()

# Verwendung
job_id = create_screenshot('https://example.com', 'prod123')
print(f'Job created: {job_id}')

# Warten und Status prüfen
time.sleep(30)
status = check_job_status(job_id)
print(f'Job status: {status["state"]}')
if status['state'] == 'completed':
    print(f'Screenshot saved: {status["returnvalue"]["filepath"]}')
```

## Production Deployment

### Mit PM2

```bash
# Build
npm run build

# Start mit PM2
pm2 start dist/api/index.js --name "screenshot-api"
pm2 save
pm2 startup
```

### Mit Docker

```dockerfile
# Dockerfile für API Server
FROM mcr.microsoft.com/playwright:focal

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/api/index.js"]
```

```bash
# Build und run
docker build -t screenshot-api .
docker run -d -p 3001:3001 --name screenshot-api screenshot-api
```

## Monitoring

### Metriken

Health-Endpoint liefert wichtige Metriken:
- System-Uptime
- Memory-Usage (RSS, Heap)
- Browser-Pool-Status
- Queue-Statistiken
- Redis-Verbindungsstatus

### Logging

Alle API-Requests werden geloggt:

```bash
# Logs anzeigen
tail -f logs/app.log

# Nur Errors
tail -f logs/error.log
```

## Security

**Basic Auth für Bull Board:**
- Setze `BULL_BOARD_USERNAME` und `BULL_BOARD_PASSWORD`
- Standard: `admin` (kein Passwort - NICHT für Production!)

**API Endpoints:**
- CORS standardmäßig aktiviert (`Access-Control-Allow-Origin: *`)
- Für Production: CORS einschränken
- Rate-Limiting empfohlen (z.B. mit `express-rate-limit`)
- HTTPS verwenden in Production

## Troubleshooting

### API Server startet nicht

```bash
# Port bereits belegt?
netstat -ano | findstr :3001

# Redis läuft?
docker ps | grep redis

# Browser-Pool-Initialisierung fehlgeschlagen?
npx playwright install chromium
```

### Bull Board nicht erreichbar

```bash
# Basic Auth aktiviert?
# Überprüfe .env: BULL_BOARD_USERNAME und BULL_BOARD_PASSWORD

# Server läuft?
curl http://localhost:3001/health
```

### Jobs werden nicht verarbeitet

```bash
# Worker läuft?
npm run worker

# Queue-Status prüfen
curl http://localhost:3001/api/queue/stats
```

## Support

- GitHub Issues: [Link zu deinem Repo]
- Dokumentation: README.md
- Mission: Mission.md

---

**Built with** Express, Bull Board, BullMQ, TypeScript
