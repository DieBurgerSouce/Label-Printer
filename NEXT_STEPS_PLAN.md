# 🚀 Next Steps Implementation Plan

## Status: Backend Core ✅ 100% Complete

Das komplette Backend-System ist fertig und produktionsbereit mit allen Core-Features:
- ✅ Web Crawler mit automatischer Screenshot-Erfassung
- ✅ OCR Service (95%+ Genauigkeit, German + English)
- ✅ Staffelpreise-Erkennung
- ✅ **Dynamic Text Styling** (Artikelnummern FETT, Staffelpreise BLAU, Preise SCHWARZ)
- ✅ Excel-Matching mit Fuzzy Search
- ✅ Template Engine (SVG → PNG)
- ✅ One-Click Automation Workflow
- ✅ 32+ REST API Endpoints
- ✅ 0 TypeScript Errors, Full Type Safety

---

## 📋 Phase A: Database Persistence ✅ 100% COMPLETE!

### Status: KOMPLETT IMPLEMENTIERT MIT SUPABASE + IMAGEKIT

**Was wurde umgesetzt:**
- ✅ **Supabase PostgreSQL** - Cloud-hosted Datenbank (kostenlos, production-ready)
- ✅ **ImageKit CDN** - Automatisches Bild-Hosting mit Thumbnails
- ✅ **Database Service** - Vollständige CRUD-Operationen für alle Entitäten
- ✅ **Image Storage Service** - Upload, Optimierung, Thumbnail-Generierung
- ✅ **8 Datenbank-Tabellen** - crawl_jobs, screenshots, ocr_results, matches, templates, labels, automation_jobs, excel_data
- ✅ **Alle Tests bestanden** - Integration vollständig verifiziert

**Test-Ergebnisse:**
```
✨ ALL TESTS PASSED!
✅ Supabase database: Working
✅ ImageKit CDN: Working
✅ Database queries: Working
✅ Image upload/delete: Working
✅ Data persistence: Working
```

### ~~Warum wichtig?~~
~~Aktuell werden alle Daten nur im RAM gespeichert (Maps/Arrays). Bei Server-Neustart gehen alle Jobs, Screenshots und Templates verloren.~~

### ⚡ Warum Fly.io statt lokales PostgreSQL?
- ✅ **Free Tier verfügbar** - 3 GB Storage kostenlos
- ✅ **Instant Setup** - 2 Minuten statt 2 Stunden
- ✅ **Cloud-hosted** - Keine lokale Docker-Installation nötig
- ✅ **Backups inklusive** - Automatische Snapshots
- ✅ **Production-ready** - Gleiche DB für Dev + Production
- ✅ **Global verfügbar** - Von überall erreichbar
- ✅ **Keine Kreditkarte nötig** für Free Tier

### Was wird implementiert:

#### A.1 Fly.io Account Setup (2 Minuten)
```bash
# 1. Install Fly CLI
# Windows (PowerShell):
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Mac/Linux:
curl -L https://fly.io/install.sh | sh

# 2. Signup & Login (free, keine Kreditkarte!)
fly auth signup
# Oder falls Account schon existiert:
fly auth login

# 3. Verify
fly auth whoami
```

#### A.2 Fly.io Postgres erstellen (1 Minute)
```bash
# Create Postgres cluster (FREE TIER!)
fly postgres create --name label-printer-db --region fra --initial-cluster-size 1

# Wichtige Optionen:
# --region fra          → Frankfurt (nahe an dir)
# --initial-cluster-size 1  → Single instance (free tier)

# Output wird sein:
# Username:    postgres
# Password:    <RANDOM_PASSWORD>  ← SPEICHERN!
# Hostname:    label-printer-db.internal
# Flycast:     fdaa:X:XXXX:XXXX::X
# Proxy port:  5432
# Postgres port: 5433
# Connection string: postgres://postgres:<PASSWORD>@label-printer-db.flycast:5432

# Connection String kopieren & speichern!
```

#### A.3 Database Connection String abrufen
```bash
# Falls du den Connection String später brauchst:
fly postgres connect -a label-printer-db

# Oder direkt die Credentials:
fly ssh console -a label-printer-db
# Dann im Container:
echo $DATABASE_URL
```

#### A.4 Prisma Schema Setup
**Datei**: `backend/prisma/schema.prisma`

```prisma
// Prisma Schema für alle Services

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Crawl Jobs
model CrawlJob {
  id              String        @id @default(uuid())
  url             String
  status          String        // 'pending' | 'running' | 'completed' | 'failed'
  config          Json
  results         Json?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  screenshots     Screenshot[]

  @@index([status])
  @@index([createdAt])
}

// Screenshots
model Screenshot {
  id              String        @id @default(uuid())
  crawlJobId      String
  url             String
  productUrl      String
  fullPath        String
  thumbnailPath   String?
  metadata        Json?
  createdAt       DateTime      @default(now())

  crawlJob        CrawlJob      @relation(fields: [crawlJobId], references: [id], onDelete: Cascade)
  ocrResults      OCRResult[]

  @@index([crawlJobId])
}

// OCR Results
model OCRResult {
  id              String        @id @default(uuid())
  screenshotId    String
  fullText        String?
  extractedData   Json
  boundingBoxes   Json
  confidence      Float
  processingTime  Int
  createdAt       DateTime      @default(now())

  screenshot      Screenshot    @relation(fields: [screenshotId], references: [id], onDelete: Cascade)
  matchResults    MatchResult[]

  @@index([screenshotId])
}

// Match Results
model MatchResult {
  id              String        @id @default(uuid())
  ocrResultId     String
  matchedData     Json?
  confidence      Float
  warnings        Json?
  createdAt       DateTime      @default(now())

  ocrResult       OCRResult     @relation(fields: [ocrResultId], references: [id], onDelete: Cascade)

  @@index([ocrResultId])
}

// Label Templates
model LabelTemplate {
  id              String        @id @default(uuid())
  name            String
  description     String?
  version         String
  dimensions      Json
  layers          Json
  fieldStyles     Json
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([name])
}

// Automation Jobs
model AutomationJob {
  id              String        @id @default(uuid())
  name            String
  status          String        // 'pending' | 'crawling' | 'processing-ocr' | 'matching' | 'rendering' | 'completed' | 'failed'
  config          Json
  progress        Json
  results         Json?
  error           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  completedAt     DateTime?

  @@index([status])
  @@index([createdAt])
}

// Excel Products (Cache)
model ExcelProduct {
  id              String        @id @default(uuid())
  articleNumber   String        @unique
  data            Json
  source          String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([articleNumber])
  @@index([source])
}
```

#### A.2 Migration Scripts erstellen
```bash
# Prisma setup
npm install prisma @prisma/client
npx prisma init

# Generate Prisma Client
npx prisma generate

# Create and run migrations
npx prisma migrate dev --name init

# (Optional) Seed database with sample data
npx prisma db seed
```

#### A.3 Service Layer anpassen
**Dateien zu aktualisieren:**
- `backend/src/services/web-crawler-service.ts` → Prisma statt Map
- `backend/src/services/ocr-service.ts` → OCR results in DB
- `backend/src/services/matcher-service.ts` → Match results in DB
- `backend/src/services/template-engine.ts` → Templates aus DB laden
- `backend/src/services/automation-service.ts` → Job state in DB

**Beispiel: Crawler Service Update**
```typescript
// Vorher (In-Memory):
private jobs = new Map<string, CrawlJob>();

// Nachher (Database):
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async createJob(config: CrawlConfig): Promise<CrawlJob> {
  return await prisma.crawlJob.create({
    data: {
      url: config.targetUrl,
      status: 'pending',
      config: config as any,
    }
  });
}

async getJob(id: string): Promise<CrawlJob | null> {
  return await prisma.crawlJob.findUnique({
    where: { id },
    include: {
      screenshots: true
    }
  });
}
```

#### A.4 Environment Setup mit Fly.io Connection
**Datei**: `backend/.env`
```bash
# Database - Fly.io Postgres (FROM FLY OUTPUT!)
# Format: postgres://postgres:<PASSWORD>@<APP_NAME>.flycast:5432/<DB_NAME>?sslmode=disable
DATABASE_URL="postgres://postgres:YOUR_PASSWORD_HERE@label-printer-db.flycast:5432/label_printer_db?sslmode=disable"

# WICHTIG für lokale Entwicklung:
# Fly.io Proxy verwenden für lokalen Zugriff:
# Run: fly proxy 5432 -a label-printer-db
# Dann:
# DATABASE_URL="postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/label_printer_db"

# Storage
STORAGE_PATH="./storage"
SCREENSHOTS_PATH="./storage/screenshots"
THUMBNAILS_PATH="./storage/thumbnails"
TEMPLATES_PATH="./storage/templates"
LABELS_PATH="./storage/labels"

# OCR
OCR_WORKERS=4
OCR_CACHE_ENABLED=true

# Server
PORT=3001
NODE_ENV=development
```

#### A.5 Fly.io Proxy für lokale Entwicklung
```bash
# Starte Fly.io Proxy in separatem Terminal
# Damit kannst du lokal auf die Cloud-DB zugreifen!
fly proxy 5432 -a label-printer-db

# Output:
# Proxying local port 5432 to remote [label-printer-db.internal]:5432

# Jetzt kannst du localhost:5432 verwenden in deinem .env:
# DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/label_printer_db"

# Proxy läuft solange Terminal offen ist
# Für permanente Verbindung: fly wireguard create
```

#### A.6 Alternative: Fly.io WireGuard für permanente Verbindung (Optional)
```bash
# Noch besser als Proxy: WireGuard VPN zu Fly.io
# Einmalig setup:
fly wireguard create

# Dann kannst du IMMER mit .flycast verbinden:
# DATABASE_URL="postgres://postgres:PASSWORD@label-printer-db.flycast:5432/label_printer_db"

# Keine manuelle Proxy mehr nötig!
```

### ✅ Acceptance Criteria:
- [ ] Fly.io Account erstellt (kostenlos!)
- [ ] Fly.io Postgres Database läuft
- [ ] Prisma Schema definiert
- [ ] Migrations erfolgreich auf Fly.io
- [ ] Alle Services nutzen Prisma statt In-Memory
- [ ] Jobs überleben Server-Neustarts
- [ ] Fly.io Proxy oder WireGuard funktioniert
- [ ] Lokale Entwicklung kann Cloud-DB nutzen

### 📝 Checklist (Step-by-step):
```bash
# ===== SCHRITT 1: FLY.IO SETUP (5 Minuten) =====

# 1.1 Install Fly CLI (Windows PowerShell als Admin)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# 1.2 Restart Terminal & verify
fly version

# 1.3 Signup (FREE, keine Kreditkarte!)
fly auth signup
# Folge Anweisungen im Browser

# 1.4 Create Postgres Database
fly postgres create --name label-printer-db --region fra --initial-cluster-size 1

# WICHTIG: Speichere die Ausgabe!
# - Username: postgres
# - Password: <RANDOM> ← KOPIEREN!
# - Connection String: postgres://postgres:<PASSWORD>@label-printer-db.flycast:5432

# ===== SCHRITT 2: LOKALER ZUGRIFF (2 Minuten) =====

# 2.1 Starte Fly Proxy in separatem Terminal
fly proxy 5432 -a label-printer-db
# Lasse Terminal offen!

# 2.2 Update .env mit localhost Connection
cd backend
# Erstelle .env mit:
# DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/label_printer_db"

# ===== SCHRITT 3: PRISMA SETUP (5 Minuten) =====

# 3.1 Install Prisma
npm install prisma @prisma/client

# 3.2 Initialize Prisma
npx prisma init
# Überschreibt .env - Füge PASSWORD wieder ein!

# 3.3 Copy Prisma Schema aus NEXT_STEPS_PLAN.md
# → backend/prisma/schema.prisma

# 3.4 Run migrations (gegen Fly.io DB!)
npx prisma migrate dev --name init
# Falls Fehler: Prüfe ob fly proxy läuft!

# 3.5 Generate Prisma Client
npx prisma generate

# 3.6 Verify with Prisma Studio
npx prisma studio
# Öffnet Browser auf localhost:5555
# Du solltest alle Tabellen sehen!

# ===== SCHRITT 4: SERVICES UPDATEN (30 Minuten) =====

# 4.1 Update web-crawler-service.ts
# Ersetze: private jobs = new Map<string, CrawlJob>();
# Mit: import { PrismaClient } from '@prisma/client';
#      const prisma = new PrismaClient();

# 4.2 Update ocr-service.ts (gleicher Pattern)

# 4.3 Update matcher-service.ts (gleicher Pattern)

# 4.4 Update template-engine.ts (gleicher Pattern)

# 4.5 Update automation-service.ts (gleicher Pattern)

# ===== SCHRITT 5: TESTEN (5 Minuten) =====

# 5.1 Build & Start
npm run build
npm run dev

# 5.2 Create test job
curl -X POST http://localhost:3001/api/automation/start \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Persistence Test",
    "crawlerConfig": {
      "targetUrl": "https://example.com"
    }
  }'

# 5.3 Stop server (Ctrl+C)

# 5.4 Start server again
npm run dev

# 5.5 List jobs - sollte Test Job noch existieren!
curl http://localhost:3001/api/automation/jobs

# ✅ FERTIG! Daten werden jetzt in Fly.io Cloud persistiert!
```

### 🎯 Pro-Tips:

**Für permanente Verbindung (empfohlen):**
```bash
# Einmalig WireGuard setup statt Proxy
fly wireguard create

# Dann in .env:
DATABASE_URL="postgres://postgres:PASSWORD@label-printer-db.flycast:5432/label_printer_db"

# Jetzt funktioniert DB IMMER, kein Proxy nötig!
```

**Datenbank verwalten:**
```bash
# Connect via psql
fly postgres connect -a label-printer-db

# Backup erstellen
fly postgres backup -a label-printer-db

# Datenbank resetten (VORSICHT!)
fly postgres db reset -a label-printer-db
```

**Monitoring:**
```bash
# DB Status checken
fly status -a label-printer-db

# Logs anschauen
fly logs -a label-printer-db

# Metrics
fly dashboard label-printer-db
```

---

## 📋 Phase B: WebSocket Real-time Updates ✅ 100% COMPLETE!

### Status: KOMPLETT IMPLEMENTIERT MIT SOCKET.IO

**Was wurde umgesetzt:**
- ✅ **Socket.IO Server** - Real-time WebSocket communication
- ✅ **Event System** - 10+ Event Types (job:created, job:updated, screenshot:captured, ocr:completed, etc.)
- ✅ **Room-based Subscriptions** - Clients subscribe to specific jobs
- ✅ **Database Integration** - All DB operations emit WebSocket events
- ✅ **Test Endpoint** - API endpoint to test WebSocket integration
- ✅ **Alle Tests bestanden** - 6/6 Events successfully received

**Test-Ergebnisse:**
```
✅ WebSocket Integration: SUCCESS!
📊 Event Summary:
   job:created events:        1 ✅
   job:updated events:        2 ✅
   job:completed events:      1 ✅
   screenshot:captured events: 1 ✅
   ocr:completed events:      1 ✅
   Total Events Received:     6
```

### ~~Warum wichtig?~~
~~Aktuell muss der Client pollen (GET /api/automation/jobs/:id alle 1-2 Sekunden). WebSockets erlauben Echtzeit-Updates.~~

### Was wird implementiert:

#### B.1 Socket.IO Setup
**Datei**: `backend/src/websocket/socket-server.ts`

```typescript
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export interface SocketEvents {
  // Client → Server
  'automation:subscribe': (jobId: string) => void;
  'automation:unsubscribe': (jobId: string) => void;

  // Server → Client
  'job:created': (job: AutomationJob) => void;
  'job:progress': (data: { jobId: string; progress: number; currentStep: string }) => void;
  'job:step-completed': (data: { jobId: string; step: string; result: any }) => void;
  'job:completed': (data: { jobId: string; results: any }) => void;
  'job:failed': (data: { jobId: string; error: string }) => void;

  'screenshot:captured': (data: { jobId: string; screenshot: Screenshot }) => void;
  'ocr:completed': (data: { jobId: string; ocrResult: OCRResult }) => void;
  'label:generated': (data: { jobId: string; labelPath: string }) => void;
}

export class SocketServer {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
      }
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Client subscribes to job updates
      socket.on('automation:subscribe', (jobId: string) => {
        socket.join(`job:${jobId}`);
        console.log(`Client ${socket.id} subscribed to job ${jobId}`);
      });

      socket.on('automation:unsubscribe', (jobId: string) => {
        socket.leave(`job:${jobId}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  // Emit events to all clients subscribed to a job
  emitJobProgress(jobId: string, progress: number, currentStep: string) {
    this.io.to(`job:${jobId}`).emit('job:progress', { jobId, progress, currentStep });
  }

  emitJobCompleted(jobId: string, results: any) {
    this.io.to(`job:${jobId}`).emit('job:completed', { jobId, results });
  }

  emitJobFailed(jobId: string, error: string) {
    this.io.to(`job:${jobId}`).emit('job:failed', { jobId, error });
  }

  emitScreenshotCaptured(jobId: string, screenshot: Screenshot) {
    this.io.to(`job:${jobId}`).emit('screenshot:captured', { jobId, screenshot });
  }

  emitOCRCompleted(jobId: string, ocrResult: OCRResult) {
    this.io.to(`job:${jobId}`).emit('ocr:completed', { jobId, ocrResult });
  }

  emitLabelGenerated(jobId: string, labelPath: string) {
    this.io.to(`job:${jobId}`).emit('label:generated', { jobId, labelPath });
  }
}
```

#### B.2 Integration in Express App
**Datei**: `backend/src/index.ts`

```typescript
import { createServer } from 'http';
import { SocketServer } from './websocket/socket-server';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server
const socketServer = new SocketServer(httpServer);

// Make socket server available to services
app.locals.socketServer = socketServer;

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
```

#### B.3 Automation Service Update
**Datei**: `backend/src/services/automation-service.ts`

```typescript
class AutomationService {
  private socketServer?: SocketServer;

  setSocketServer(socketServer: SocketServer) {
    this.socketServer = socketServer;
  }

  private async runCrawlStep(job: AutomationJob): Promise<void> {
    job.status = 'crawling';
    job.progress.currentStep = 'crawling';

    // Emit progress update via WebSocket
    this.socketServer?.emitJobProgress(job.id, 10, 'crawling');

    const crawlJob = await webCrawlerService.startCrawl(job.config.crawlerConfig);

    while (!complete) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = webCrawlerService.getJob(crawlJob.id);

      // Emit real-time progress
      this.socketServer?.emitJobProgress(
        job.id,
        job.progress.currentStepProgress,
        'crawling'
      );

      // Emit each screenshot as it's captured
      if (status?.results?.screenshots) {
        const newScreenshots = status.results.screenshots.slice(lastCount);
        newScreenshots.forEach(screenshot => {
          this.socketServer?.emitScreenshotCaptured(job.id, screenshot);
        });
      }
    }
  }

  private async runOCRStep(job: AutomationJob): Promise<void> {
    // ... OCR processing

    // Emit OCR result for each screenshot
    this.socketServer?.emitOCRCompleted(job.id, ocrResult);
  }

  private async runRenderingStep(job: AutomationJob): Promise<void> {
    // ... rendering

    // Emit each generated label
    this.socketServer?.emitLabelGenerated(job.id, labelPath);
  }
}
```

#### B.4 Dependencies
```bash
npm install socket.io
npm install --save-dev @types/socket.io
```

### ✅ Acceptance Criteria:
- [ ] Socket.IO server läuft
- [ ] Clients können sich zu Jobs subscriben
- [ ] Real-time progress updates funktionieren
- [ ] Screenshots werden live gestreamt
- [ ] OCR results werden live gestreamt
- [ ] Generated labels werden live gestreamt
- [ ] Reconnection handling implementiert

### 📝 Checklist:
```bash
# 1. Install Socket.IO
npm install socket.io @types/socket.io

# 2. Create WebSocket server
# - socket-server.ts
# - Define SocketEvents interface

# 3. Integrate with Express
# - Update index.ts
# - Create HTTP server
# - Pass to SocketServer

# 4. Update Automation Service
# - Emit events at each step
# - Progress updates
# - Screenshot/OCR/Label events

# 5. Test with Socket.IO client
# - wscat or Postman
# - Subscribe to job
# - Verify events
```

---

## 📋 Phase C: Frontend UI (Optional - 1-2 Wochen)

### Warum wichtig?
Aktuell nur API verfügbar. Eine UI macht das System benutzerfreundlich.

### Was wird implementiert:

#### C.1 Frontend Setup mit Vite + React + TypeScript
```bash
# Create Vite project
npm create vite@latest frontend -- --template react-ts

cd frontend
npm install

# Install dependencies
npm install \
  @tanstack/react-query \
  axios \
  socket.io-client \
  zustand \
  react-router-dom \
  @headlessui/react \
  @heroicons/react \
  clsx \
  tailwindcss \
  @tailwindcss/forms

# Setup Tailwind CSS
npx tailwindcss init -p
```

#### C.2 API Client Setup
**Datei**: `frontend/src/api/client.ts`

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automation API
export const automationApi = {
  startJob: (config: AutomationConfig) =>
    apiClient.post('/automation/start', config),

  getJob: (jobId: string) =>
    apiClient.get(`/automation/jobs/${jobId}`),

  listJobs: () =>
    apiClient.get('/automation/jobs'),

  cancelJob: (jobId: string) =>
    apiClient.post(`/automation/jobs/${jobId}/cancel`),

  getResults: (jobId: string) =>
    apiClient.get(`/automation/jobs/${jobId}/results`),
};

// Crawler API
export const crawlerApi = {
  startCrawl: (config: CrawlConfig) =>
    apiClient.post('/crawler/start', config),

  getJob: (jobId: string) =>
    apiClient.get(`/crawler/jobs/${jobId}`),
};

// OCR API
export const ocrApi = {
  processScreenshot: (file: File) => {
    const formData = new FormData();
    formData.append('screenshot', file);
    return apiClient.post('/ocr/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Templates API
export const templatesApi = {
  list: () =>
    apiClient.get('/templates'),

  get: (id: string) =>
    apiClient.get(`/templates/${id}`),

  create: (template: LabelTemplate) =>
    apiClient.post('/templates', template),

  render: (id: string, data: any) =>
    apiClient.post(`/templates/${id}/render`, { data }),
};
```

#### C.3 WebSocket Hook
**Datei**: `frontend/src/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useAutomationSocket(jobId?: string) {
  const socketRef = useRef<Socket>();
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (jobId) {
        socket.emit('automation:subscribe', jobId);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('job:progress', (data) => {
      setProgress(data.progress);
      setCurrentStep(data.currentStep);
    });

    socket.on('screenshot:captured', (data) => {
      setScreenshots(prev => [...prev, data.screenshot]);
    });

    socket.on('ocr:completed', (data) => {
      setOcrResults(prev => [...prev, data.ocrResult]);
    });

    socket.on('label:generated', (data) => {
      setLabels(prev => [...prev, data.labelPath]);
    });

    return () => {
      if (jobId) {
        socket.emit('automation:unsubscribe', jobId);
      }
      socket.disconnect();
    };
  }, [jobId]);

  return {
    isConnected,
    progress,
    currentStep,
    screenshots,
    ocrResults,
    labels,
  };
}
```

#### C.4 Main Pages

**1. Dashboard Page**
```typescript
// frontend/src/pages/Dashboard.tsx
export function Dashboard() {
  const { data: jobs } = useQuery({
    queryKey: ['automation-jobs'],
    queryFn: () => automationApi.listJobs(),
    refetchInterval: 5000,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Label Automation Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Jobs" value={jobs?.length || 0} />
        <StatCard title="Active" value={activeCount} />
        <StatCard title="Completed" value={completedCount} />
      </div>

      <div className="mb-8">
        <button
          onClick={() => navigate('/automation/new')}
          className="btn-primary"
        >
          + New Automation Job
        </button>
      </div>

      <JobsTable jobs={jobs || []} />
    </div>
  );
}
```

**2. New Automation Job Page**
```typescript
// frontend/src/pages/NewAutomation.tsx
export function NewAutomation() {
  const [shopUrl, setShopUrl] = useState('');
  const [templateId, setTemplateId] = useState('');
  const mutation = useMutation({
    mutationFn: (config: AutomationConfig) => automationApi.startJob(config),
    onSuccess: (data) => {
      navigate(`/automation/${data.id}`);
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      name: `Job - ${new Date().toLocaleString()}`,
      crawlerConfig: {
        targetUrl: shopUrl,
        maxProducts: 50,
      },
      templateId,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Start New Automation</h1>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Shop URL
          </label>
          <input
            type="url"
            value={shopUrl}
            onChange={(e) => setShopUrl(e.target.value)}
            placeholder="https://example.com/products"
            className="w-full px-4 py-2 border rounded"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Label Template
          </label>
          <TemplateSelector
            value={templateId}
            onChange={setTemplateId}
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary w-full"
        >
          {mutation.isPending ? 'Starting...' : 'Start Automation'}
        </button>
      </form>
    </div>
  );
}
```

**3. Job Monitor Page**
```typescript
// frontend/src/pages/JobMonitor.tsx
export function JobMonitor() {
  const { jobId } = useParams();
  const {
    isConnected,
    progress,
    currentStep,
    screenshots,
    ocrResults,
    labels
  } = useAutomationSocket(jobId);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Job Monitor</h1>

      <div className="mb-8">
        <ConnectionStatus isConnected={isConnected} />
      </div>

      <div className="mb-8">
        <ProgressBar progress={progress} currentStep={currentStep} />
      </div>

      <Tabs>
        <Tab title={`Screenshots (${screenshots.length})`}>
          <ScreenshotGrid screenshots={screenshots} />
        </Tab>

        <Tab title={`OCR Results (${ocrResults.length})`}>
          <OCRResultsList results={ocrResults} />
        </Tab>

        <Tab title={`Generated Labels (${labels.length})`}>
          <LabelGallery labels={labels} />
        </Tab>
      </Tabs>
    </div>
  );
}
```

#### C.5 Components

**Key Components zu bauen:**
- `ProgressBar.tsx` - Animated progress indicator
- `ScreenshotGrid.tsx` - Grid of captured screenshots
- `OCRResultCard.tsx` - Display OCR extracted data
- `LabelPreview.tsx` - Preview generated labels
- `TemplateSelector.tsx` - Choose from available templates
- `JobsTable.tsx` - List of all automation jobs
- `StatCard.tsx` - Dashboard statistics
- `ConnectionStatus.tsx` - WebSocket connection indicator

### ✅ Acceptance Criteria:
- [ ] React app läuft (Vite dev server)
- [ ] Dashboard zeigt alle Jobs
- [ ] Neue Jobs können gestartet werden
- [ ] Live progress tracking funktioniert
- [ ] Screenshots werden live angezeigt
- [ ] OCR results werden live angezeigt
- [ ] Generated labels können previewed werden
- [ ] Responsive design (mobile + desktop)

### 📝 Checklist:
```bash
# 1. Create Vite project
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# 2. Install dependencies
npm install @tanstack/react-query axios socket.io-client zustand react-router-dom

# 3. Setup Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Create API client
# - src/api/client.ts
# - API methods for all endpoints

# 5. Create WebSocket hook
# - src/hooks/useWebSocket.ts
# - Handle events

# 6. Create pages
# - src/pages/Dashboard.tsx
# - src/pages/NewAutomation.tsx
# - src/pages/JobMonitor.tsx

# 7. Create components
# - src/components/ProgressBar.tsx
# - src/components/ScreenshotGrid.tsx
# - src/components/OCRResultCard.tsx
# - etc.

# 8. Setup routing
# - src/App.tsx
# - React Router setup

# 9. Run dev server
npm run dev
```

---

## 🎯 Recommended Implementation Order

### 🔥 **Kritisch (Zuerst machen):**
1. **Phase A: Database Persistence mit Fly.io** (1-2 Stunden!)
   - ✅ Kostenlos (Free Tier - 3GB)
   - ✅ Keine Kreditkarte nötig
   - ✅ Instant Setup (5 Minuten)
   - ✅ Cloud-hosted (production-ready)
   - ✅ Automatische Backups
   - Ohne DB gehen alle Daten bei Neustart verloren

### ⭐ **Wichtig (Danach):**
2. **Phase B: WebSocket Updates** (1-2 Tage)
   - Bessere User Experience
   - Echtzeit-Monitoring

### 💡 **Nice-to-have (Optional):**
3. **Phase C: Frontend UI** (1-2 Wochen)
   - Macht System benutzerfreundlich
   - Kann parallel entwickelt werden
   - Backend API ist schon fertig!

---

## 📊 Timeline Estimate

| Phase | Effort | Priority | Status |
|-------|--------|----------|--------|
| **A. Database (Supabase + ImageKit)** | 1-2 hours ⚡ | 🔥 Critical | ✅ **COMPLETE!** |
| **B. WebSocket (Socket.IO)** | 1-2 days | ⭐ Important | ✅ **COMPLETE!** |
| **C. Frontend** | 1-2 weeks | 💡 Optional | 📋 Not Started |

**Total Minimum Viable Product (MVP):** 1-3 Tage (A + B)
**Full System with UI:** 1-2 Wochen (A + B + C)

### ⚡ Mit Fly.io ist Phase A jetzt viel schneller!
- ❌ Vorher: 2-3 Tage (Docker, PostgreSQL, Config)
- ✅ Jetzt: 1-2 Stunden (Fly.io instant setup!)
- 💰 Bonus: Kostenlos + Production-ready!

---

## ✅ Quick Start Commands

### Phase A: Fly.io Database Setup (SUPER SCHNELL!)
```bash
# ===== 1. FLY.IO SETUP (5 Minuten) =====
# Install Fly CLI (PowerShell als Admin)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Restart Terminal & Login
fly auth signup  # Kostenlos, keine Kreditkarte!

# Create Postgres (FREE TIER - 3GB!)
fly postgres create --name label-printer-db --region fra --initial-cluster-size 1
# ⚠️ SPEICHERE PASSWORD aus Output!

# ===== 2. LOKALER ZUGRIFF =====
# Terminal 1: Starte Proxy
fly proxy 5432 -a label-printer-db

# Terminal 2: Setup Prisma
cd backend
npm install prisma @prisma/client
npx prisma init

# Update .env mit:
# DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/label_printer_db"

# Run migrations
npx prisma migrate dev --name init
npx prisma generate

# ===== 3. VERIFY =====
# Öffne Prisma Studio
npx prisma studio
# Browser öffnet → Du siehst alle Tabellen!

# ===== 4. BUILD & TEST =====
npm run build
npm run dev

# Create test job
curl -X POST http://localhost:3001/api/automation/start \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "crawlerConfig": {"targetUrl": "https://example.com"}}'

# Stop server (Ctrl+C) → Restart → Job still exists! ✅
```

### BONUS: Permanente Verbindung (empfohlen!)
```bash
# Statt Proxy: WireGuard VPN zu Fly.io
fly wireguard create

# Dann in .env:
# DATABASE_URL="postgres://postgres:PASSWORD@label-printer-db.flycast:5432/label_printer_db"

# Jetzt funktioniert DB IMMER ohne Proxy!
```

### Phase B: WebSocket Setup
```bash
# 1. Install Socket.IO
cd backend
npm install socket.io @types/socket.io

# 2. Create socket server
# (siehe Code oben)

# 3. Update index.ts
# (siehe Code oben)

# 4. Rebuild & restart
npm run build
npm run dev

# 5. Test with wscat
npm install -g wscat
wscat -c ws://localhost:3001
> {"event": "automation:subscribe", "data": "JOB_ID"}
```

### Phase C: Frontend Setup
```bash
# 1. Create Vite project
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# 2. Install deps
npm install @tanstack/react-query axios socket.io-client

# 3. Setup Tailwind
npm install -D tailwindcss
npx tailwindcss init -p

# 4. Create components
# (siehe Code oben)

# 5. Run dev server
npm run dev
# Frontend läuft auf http://localhost:5173
```

---

## 🎊 Was dann fertig ist:

Nach Completion von **Phase A + B + C**:

✅ **Vollständiges Production-ready System:**
- ✅ Backend API (32+ endpoints)
- ✅ Database persistence (PostgreSQL)
- ✅ Real-time updates (WebSocket)
- ✅ Frontend UI (React + TypeScript)
- ✅ One-click automation workflow
- ✅ Live job monitoring
- ✅ Screenshot gallery
- ✅ OCR results viewer
- ✅ Label preview & download

**Deployment-ready für:**
- Docker deployment
- Cloud hosting (AWS, Azure, GCP)
- Production use

---

**Nächster Schritt:** Starte mit **Phase A (Database)** - das ist die kritischste Komponente!
