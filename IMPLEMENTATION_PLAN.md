# 🎯 Implementierungsplan: Flexible Preisschild-Druck-WebApp

## Projektübersicht
Eine WebApp zur flexiblen Erstellung und Verwaltung von Preisschildern mit Excel-Import für Produktbeschreibungen und konfigurierbarem Druck-Layout.

## ✅ Hauptfeatures
- [x] Excel-Import für Produktbeschreibungen (Artikelnummer → Beschreibung Mapping)
- [x] Extraktion von Preisschildern aus bestehenden Screenshots
- [x] Flexible Druckvorschau mit verschiedenen Papierformaten
- [x] Konfigurierbare Grid-Layouts (1×1 bis 10×20)
- [x] Einzellabel- und Multi-Label-Druck
- [x] Template-System für verschiedene Label-Designs (Basic)
- [x] Vollständiges Settings-Management
- [ ] Live-Preview mit Drag & Drop (Advanced)

---

## 📋 Phase 1: Backend-Services (Core-Funktionalität)

### 1.1 Excel-Parser Service ✅
**Datei**: `src/services/excel-parser-service.ts`

```typescript
interface ProductDescription {
  articleNumber: string;
  description: string;
  additionalInfo?: string;
  customFields?: Record<string, string>;
}
```

**Features:**
- [x] Excel-Upload mit xlsx-Bibliothek implementieren
- [x] Flexible Spalten-Erkennung (verschiedene Spaltennamen unterstützen)
- [x] Validierung und Fehlerbehandlung pro Zeile
- [x] Caching-Mechanismus (Redis/JSON-File)
- [x] Batch-Import für große Excel-Dateien
- [x] Export-Funktion für bearbeitete Daten

**Unterstützte Spalten:**
- Artikelnummer (artikelnummer, Article Number, SKU, Art-Nr)
- Beschreibung (description, Produktbeschreibung, Name)
- Zusatzinfo (Additional Info, Notes, Hinweise)
- Custom Fields (beliebige zusätzliche Spalten)

### 1.2 Label-Generator Service
**Datei**: `src/services/label-generator-service.ts`

```typescript
interface PriceLabel {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  priceInfo: {
    price: number;
    currency: string;
    unit?: string;
    staffelpreise?: Array<{quantity: number; price: number}>;
  };
  imageData?: Buffer;
  templateType: 'minimal' | 'standard' | 'extended' | 'custom';
  createdAt: Date;
  tags?: string[];
}
```

**Features:**
- [x] Extraktion einzelner Preisschilder aus Screenshots
- [x] Automatische Erkennung von Preisbereichen
- [ ] OCR für Textextraktion (optional)
- [x] Kombinierung mit Excel-Beschreibungen
- [x] Template-System implementieren
- [x] Bildoptimierung (Größe, Qualität)

**Label-Templates:**
1. **Minimal**: Nur Preis + Artikelnummer
2. **Standard**: + Produktname
3. **Erweitert**: + Beschreibung aus Excel
4. **Custom**: Frei konfigurierbar mit CSS

### 1.3 Layout-Composer Service
**Datei**: `src/services/layout-composer-service.ts`

```typescript
interface PrintLayout {
  id: string;
  name: string;
  paperFormat: {
    type: 'A3' | 'A4' | 'A5' | 'Letter' | 'Custom';
    width: number;  // in mm
    height: number; // in mm
    orientation: 'portrait' | 'landscape';
  };
  gridLayout: {
    columns: number;
    rows: number;
    spacing: number;    // in mm
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  labels: PriceLabel[];
  settings: {
    showCutMarks: boolean;
    showBorders: boolean;
    labelScale: 'fit' | 'fill' | 'custom';
    dpi: number;
  };
}
```

**Features:**
- [x] Papierformat-Konfiguration
- [x] Grid-System mit Auto-Berechnung
- [x] Spacing und Margins konfigurierbar
- [x] PDF-Generation mit PDFKit
- [x] PNG/JPEG Export mit Sharp
- [x] Schnittmarken-Generator
- [x] Batch-Export für mehrere Seiten

**Unterstützte Papierformate:**
- DIN A3 (297 × 420 mm)
- DIN A4 (210 × 297 mm)
- DIN A5 (148 × 210 mm)
- US Letter (216 × 279 mm)
- Custom (beliebige Größe)

---

## 📋 Phase 2: Datenbank & Storage

### 2.1 Datentypen und Interfaces ✅
**Datei**: `src/types/label-types.ts`

```typescript
// Vollständige Type-Definitionen
export interface LabelMetadata {
  id: string;
  articleNumber: string;
  createdAt: Date;
  updatedAt: Date;
  source: 'screenshot' | 'manual' | 'import';
  tags: string[];
  category?: string;
}

export interface LabelContent {
  productName: string;
  description?: string;
  priceInfo: PriceInfo;
  imageUrl?: string;
  customFields?: Record<string, any>;
}

export interface PrintJob {
  id: string;
  layoutId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'pdf' | 'png' | 'jpeg';
  createdAt: Date;
  completedAt?: Date;
  resultUrl?: string;
  error?: string;
}
```

### 2.2 Storage Service ✅
**Datei**: `src/services/label-storage-service.ts`

**Features:**
- [x] Labels in strukturierten Ordnern speichern
- [x] Metadaten-Verwaltung (JSON-basiert)
- [x] Bildoptimierung beim Speichern (Sharp)
- [x] Batch-Operations
- [ ] Versionierung von Labels
- [ ] Automatisches Backup

**Ordnerstruktur:**
```
data/
├── labels/
│   ├── 2024-01/
│   │   ├── label-001/
│   │   │   ├── metadata.json
│   │   │   ├── image.png
│   │   │   └── thumbnail.png
│   └── archive/
├── templates/
├── exports/
└── cache/
```

---

## 📋 Phase 3: API Layer

### 3.1 Label-Management Endpoints ✅
**Datei**: `src/api/routes/labels.ts`

```typescript
// Label CRUD Operations
POST   /api/labels                 // Label erstellen ✅
POST   /api/labels/extract         // Preisschild aus Screenshot extrahieren ✅
GET    /api/labels                 // Alle Labels (mit Pagination & Filter) ✅
GET    /api/labels/:id            // Einzelnes Label abrufen ✅
GET    /api/labels/:id/image      // Label-Bild abrufen ✅
GET    /api/labels/:id/thumbnail  // Label-Thumbnail abrufen ✅
PUT    /api/labels/:id            // Label bearbeiten ✅
DELETE /api/labels/:id            // Label löschen ✅
POST   /api/labels/batch          // Mehrere Labels verarbeiten ✅

// Label-Operationen
GET    /api/labels/search         // Volltextsuche ✅
GET    /api/labels/stats          // Statistiken ✅
POST   /api/labels/duplicate/:id  // Label duplizieren
POST   /api/labels/merge          // Labels zusammenführen
POST   /api/labels/import         // Labels importieren
GET    /api/labels/export         // Labels exportieren
```

### 3.2 Excel-Import Endpoints ✅
**Datei**: `src/api/routes/excel.ts`

```typescript
POST   /api/excel/upload          // Excel hochladen & parsen ✅
POST   /api/excel/validate        // Excel-Format validieren ✅
GET    /api/excel/products        // Alle Produktbeschreibungen ✅
GET    /api/excel/product/:artNr  // Einzelne Beschreibung ✅
PUT    /api/excel/product/:artNr  // Beschreibung bearbeiten ✅
POST   /api/excel/product         // Produkt hinzufügen ✅
DELETE /api/excel/product/:artNr  // Produkt löschen ✅
DELETE /api/excel/cache           // Cache leeren ✅
GET    /api/excel/stats           // Cache-Statistiken ✅
GET    /api/excel/template        // Excel-Template herunterladen ✅
GET    /api/excel/export          // Excel exportieren ✅
POST   /api/excel/sync            // Mit Labels synchronisieren
```

### 3.3 Print-Layout Endpoints ✅
**Datei**: `src/api/routes/print.ts`

```typescript
// Layout-Management
POST   /api/print/preview         // Druckvorschau generieren ✅
POST   /api/print/export          // PDF/PNG Export ✅
GET    /api/print/templates       // Vordefinierte Templates ✅
POST   /api/print/templates       // Custom Template speichern ✅
POST   /api/print/validate-layout // Layout validieren ✅
DELETE /api/print/templates/:id   // Template löschen

// Konfiguration
GET    /api/print/formats         // Verfügbare Papierformate ✅
POST   /api/print/calculate-grid  // Optimales Grid berechnen ✅
GET    /api/print/presets         // Druck-Presets

// Jobs
POST   /api/print/jobs            // Druckauftrag erstellen
GET    /api/print/jobs/:id        // Job-Status abrufen
GET    /api/print/jobs/:id/result // Ergebnis herunterladen
```

---

## 📋 Phase 4: Frontend (React WebApp)

### 4.1 Projektstruktur
```
src/frontend/
├── components/
│   ├── common/
│   │   ├── Button/
│   │   ├── Modal/
│   │   ├── Dropdown/
│   │   └── Loading/
│   ├── LabelManager/
│   │   ├── LabelGrid.tsx
│   │   ├── LabelCard.tsx
│   │   ├── LabelFilter.tsx
│   │   └── LabelSearch.tsx
│   ├── ExcelImporter/
│   │   ├── UploadZone.tsx
│   │   ├── ColumnMapper.tsx
│   │   ├── PreviewTable.tsx
│   │   └── ImportProgress.tsx
│   ├── PrintConfigurator/
│   │   ├── FormatSelector.tsx
│   │   ├── GridSettings.tsx
│   │   ├── MarginControls.tsx
│   │   └── ExportOptions.tsx
│   ├── PreviewCanvas/
│   │   ├── Canvas.tsx
│   │   ├── Ruler.tsx
│   │   ├── ZoomControls.tsx
│   │   └── DragDropLayer.tsx
│   └── LabelDesigner/
│       ├── TemplateEditor.tsx
│       ├── StyleControls.tsx
│       ├── FieldMapper.tsx
│       └── LivePreview.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── LabelLibrary.tsx
│   ├── PrintSetup.tsx
│   ├── ExcelImport.tsx
│   ├── Templates.tsx
│   └── Settings.tsx
├── hooks/
│   ├── useLabels.ts
│   ├── usePrintLayout.ts
│   ├── useExcelData.ts
│   └── useWebSocket.ts
├── services/
│   ├── api.ts
│   ├── print-utils.ts
│   ├── excel-utils.ts
│   └── storage.ts
├── store/
│   ├── labelStore.ts
│   ├── printStore.ts
│   └── uiStore.ts
└── utils/
    ├── constants.ts
    ├── helpers.ts
    └── validators.ts
```

### 4.2 Dashboard Features ✅
**Datei**: `src/frontend/pages/Dashboard.tsx`

- [x] **Statistik-Cards**
  - Total Labels
  - Products
  - Print Jobs
  - This Month Stats

- [x] **Quick Actions**
  - Create Label Card
  - Import Excel Card
  - Print Setup Card

- [x] **Recent Activity**
  - Basic structure (ready for data)

### 4.3 Label-Manager Component ✅
**Datei**: `src/frontend/components/LabelManager/`

- [x] **Ansicht-Modi**
  - Grid-View (Thumbnails) ✅
  - List-View (Tabelle) ✅

- [x] **Filter & Sortierung**
  - Nach Suchbegriff ✅
  - Nach Kategorie ✅
  - Nach Tags ✅
  - Pagination ✅

- [x] **Batch-Operations**
  - Multi-Select ✅
  - Bulk-Delete ✅
  - Add to Print Layout ✅
  - Select All/Clear ✅

- [x] **Label Actions**
  - View, Edit, Delete ✅
  - Add to Print ✅
  - Label Card Component ✅

### 4.4 Print-Configurator ✅
**Datei**: `src/frontend/components/PrintConfigurator/`

- [x] **Papierformat-Einstellungen**
  - FormatSelector Component ✅
  - A3, A4, A5, Letter, Custom ✅
  - Custom Size Inputs ✅
  - Format Preview ✅

- [x] **Grid-Konfiguration**
  - GridConfigurator Component ✅
  - Columns & Rows (1-10 / 1-20) ✅
  - Spacing (0-20mm) ✅
  - Margins (Top, Bottom, Left, Right) ✅
  - Quick Presets (3×4, 4×5, 2×3) ✅

- [x] **Print Preview**
  - PrintPreview Component ✅
  - Generate Preview ✅
  - Zoom Controls (25% - 200%) ✅
  - Download PDF ✅
  - Print Function ✅

- [x] **PrintSetup Page**
  - Complete integration ✅
  - Configuration Summary ✅
  - Labels Info Card ✅
  - Reset to Defaults ✅

- [ ] **Advanced Label-Einstellungen**
  - Skalierung (Fit/Fill/Original)
  - Rotation (0°/90°/180°/270°)
  - Rahmen (Stil, Farbe, Dicke)
  - Schatten

- [ ] **Advanced Export-Optionen**
  - Qualität/DPI (72-600)
  - Farbprofil (RGB/CMYK)
  - Schnittmarken
  - Bleed (Beschnitt)

### 4.5 Live-Preview Canvas ✅ (Basic Implementation)
**Dateien**:
- `src/frontend/components/PreviewCanvas/` ✅
- `src/frontend/pages/LivePreview.tsx` ✅
- `src/frontend/hooks/useKeyboardShortcuts.ts` ✅

- [x] **Canvas-Features (Basic)** ✅
  - Konva.js Integration ✅
  - Echtzeit-Rendering ✅
  - Zoom (25% - 200%) ✅
  - Ruler/Lineale ✅
  - Grid-Overlay ✅
  - ZoomControls Component ✅

- [x] **Interaktivität (Basic)** ✅
  - Drag & Drop Labels ✅
  - Rotate Labels (90° increments) ✅
  - Label Selection ✅
  - Keyboard-Shortcuts (15+ shortcuts) ✅

- [ ] **Hilfslinien (Advanced)**
  - Smart Guides
  - Snap-to-Grid
  - Align-Tools
  - Distribute-Tools
  - Pan mit Maus/Touch
  - Resize Labels
  - Context-Menu

---

## 📋 Phase 5: Advanced Features

### 5.1 Template-System ✅ (Basic Implementation)
**Dateien**:
- `frontend/src/components/TemplateManager/`
- `frontend/src/pages/Templates.tsx`

- [x] **Template-Engine (Basic)**
  - Template Interface definiert ✅
  - Typen (minimal, standard, extended, custom) ✅
  - Settings (fontSize, fontFamily, colors, borders) ✅
  - Fields Array für Customization ✅

- [x] **Template-Manager UI**
  - TemplateCard Component ✅
  - TemplateGrid Component ✅
  - Templates Page ✅
  - Template Stats Dashboard ✅

- [x] **Template-Editor (Basic)**
  - Modal-based Editor ✅
  - Styling Controls (Font, Colors, Borders, Padding) ✅
  - Live-Preview ✅
  - Save/Cancel Actions ✅

- [x] **Template Operations**
  - Create Template ✅
  - Edit Template ✅
  - Duplicate Template ✅
  - Delete Template ✅
  - Set as Default ✅
  - Import/Export (JSON) ✅

- [ ] **Advanced Template-Editor**
  - Visual Drag & Drop Editor
  - Code-Editor (JSON/CSS)
  - Variable-System
  - Conditional Fields
  - Field Positioning (x, y coordinates)

### 5.2 Batch-Processing
**Datei**: `src/workers/batch-processor.ts`

- [ ] **Queue-Management**
  - BullMQ Integration
  - Progress-Tracking
  - Error-Recovery
  - Retry-Logic
  - Priority-Queue

- [ ] **Performance**
  - Parallel Processing
  - Chunking
  - Memory-Management
  - Rate-Limiting

### 5.3 Export-System ✅ (Advanced Implementation)
**Dateien**:
- `src/components/ExportSettings/ExportOptions.tsx` ✅
- `src/components/ExportSettings/ProgressTracker.tsx` ✅
- `src/services/batchExportService.ts` ✅

- [x] **Advanced Export Options** ✅
  - DPI Selection (72, 150, 300, 600) ✅
  - Format Selection (PDF, PNG, JPEG) ✅
  - Quality Slider (50-100%) ✅
  - Color Profile (RGB/CMYK) ✅
  - Cut Marks Toggle ✅
  - Bleed Configuration (0-10mm) ✅
  - Compression Toggle ✅
  - Embed Fonts Toggle ✅
  - Estimated File Size Display ✅

- [x] **Batch Processing** ✅
  - Sequential Export Processing ✅
  - Progress Tracking per Label ✅
  - Error Handling & Recovery ✅
  - Cancel Operation ✅
  - Success/Failure Statistics ✅

- [x] **Progress Tracking UI** ✅
  - Overall Progress Bar ✅
  - Individual Job Status ✅
  - Visual Status Icons ✅
  - Error Messages ✅
  - Completion Summary ✅

- [ ] **Future Enhancements**
  - WebP Export
  - SVG Export
  - ZIP Download for batches
  - Parallel Processing

### 5.4 QR-Code Integration ✅ (Komplett Implementiert)
**Dateien**:
- `frontend/src/store/labelStore.ts` (QRCodeSettings interface) ✅
- `frontend/src/components/PreviewCanvas/QRCodeElement.tsx` ✅
- `frontend/src/components/LabelManager/QRCodeSettings.tsx` ✅
- `frontend/src/components/PreviewCanvas/Canvas.tsx` (QR rendering) ✅

- [x] **Type Definitions** ✅
  - QRCodeSettings Interface ✅
  - Position (x, y in mm) ✅
  - Size (10-50mm) ✅
  - Error Correction Level (L/M/Q/H) ✅
  - Shop URL Integration ✅

- [x] **QRCodeElement Component** ✅
  - Konva Canvas Integration ✅
  - Dynamic QR Generation (qrcode library) ✅
  - Draggable Positioning ✅
  - Resizable (10-50mm) ✅
  - Selection Border ✅
  - Resize Handles ✅

- [x] **QRCodeSettings Component** ✅
  - Enable/Disable Toggle ✅
  - Shop URL Input ✅
  - Size Slider (10-50mm) ✅
  - Advanced Settings Panel ✅
  - Error Correction Level Selector ✅
  - Position Controls (x, y inputs) ✅
  - Quick Position Presets ✅
  - URL Preview ✅

- [x] **Canvas Integration** ✅
  - QR Layer Rendering ✅
  - Drag & Drop Support ✅
  - Position Updates (absolute → relative) ✅
  - Size Updates via Resize Handles ✅
  - Selection Management ✅
  - Zoom Support ✅

- [x] **Features** ✅
  - QR-Codes link to product shop pages ✅
  - Scannable from printed labels ✅
  - Configurable size & position ✅
  - Multiple error correction levels ✅
  - Visual positioning on canvas ✅
  - Integration with print/export system ✅

- [ ] **Future OCR Integration**
  - Text extraction from images
  - Product data auto-fill from photos
  - Label scanning & digitization

---

## 📋 Phase 6: UI/UX Optimierungen

### 6.1 Responsive Design & PWA
- [ ] Mobile Layout (< 768px) - Partial
- [ ] Tablet Layout (768px - 1024px) - Partial
- [x] Desktop Layout (> 1024px) ✅
- [ ] Touch-Optimierung
- [x] **PWA-Support** ✅
  - PWA Manifest ✅
  - Service Worker ✅
  - Offline Caching ✅
  - App Icons & Meta Tags ✅
  - Install Prompts ✅
  - App Shortcuts ✅

### 6.2 Keyboard-Shortcuts ✅ (Implemented)
**Datei**: `src/frontend/hooks/useKeyboardShortcuts.ts` ✅

```javascript
const shortcuts = {
  // Navigation
  'Ctrl+D': 'Go to Dashboard', ✅
  'Ctrl+L': 'Go to Label Library', ✅
  'Ctrl+E': 'Go to Excel Import', ✅
  'Ctrl+P': 'Go to Print Setup', ✅

  // Canvas Controls
  'Ctrl++': 'Zoom In', ✅
  'Ctrl+-': 'Zoom Out', ✅
  'Ctrl+0': 'Reset Zoom', ✅

  // View Controls
  'Ctrl+G': 'Toggle Grid', ✅
  'Ctrl+R': 'Toggle Rulers', ✅

  // Selection
  'Escape': 'Clear Selection', ✅
  'Ctrl+A': 'Select All', ✅

  // Print Layout
  'Ctrl+Shift+R': 'Reset Print Layout', ✅

  // Help
  'Shift+?': 'Show Keyboard Shortcuts Help', ✅
};
```

- [x] Global Keyboard Shortcuts Hook ✅
- [x] Navigation Shortcuts (4) ✅
- [x] Canvas Control Shortcuts (3) ✅
- [x] View Control Shortcuts (2) ✅
- [x] Selection Shortcuts (2) ✅
- [x] Print Layout Shortcuts (1) ✅
- [x] Help Shortcut (1) ✅
- [x] KeyboardShortcutsList Component ✅

### 6.3 Undo/Redo System
- [ ] Action-History Stack
- [ ] Multi-Level Undo (50+ Steps)
- [ ] Persistent zwischen Sessions
- [ ] Visual History Timeline

### 6.4 Accessibility
- [ ] ARIA-Labels
- [ ] Keyboard-Navigation
- [ ] Screen-Reader Support
- [ ] High-Contrast Mode
- [ ] Focus-Management

---

## 📋 Phase 7: Testing & Deployment

### 7.1 Testing-Strategie

#### Unit-Tests
```javascript
// src/__tests__/services/
- excel-parser.test.ts
- label-generator.test.ts
- layout-composer.test.ts
- storage-service.test.ts
```

#### Integration-Tests
```javascript
// src/__tests__/api/
- labels.test.ts
- excel.test.ts
- print.test.ts
```

#### E2E-Tests (Playwright)
```javascript
// e2e/
- label-creation.spec.ts
- excel-import.spec.ts
- print-workflow.spec.ts
- full-workflow.spec.ts
```

### 7.2 Docker-Setup
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 7.3 Environment-Konfiguration
```env
# .env.production
NODE_ENV=production
API_PORT=3001
API_HOST=0.0.0.0

# Storage
STORAGE_PATH=/data/labels
CACHE_PATH=/data/cache
MAX_FILE_SIZE=50MB

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Print Settings
DEFAULT_DPI=300
MAX_BATCH_SIZE=100
MAX_LABELS_PER_PAGE=50

# Security
JWT_SECRET=
CORS_ORIGINS=http://localhost:3000

# Features
ENABLE_OCR=true
ENABLE_TEMPLATES=true
ENABLE_BATCH_PROCESSING=true
```

### 7.4 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: docker build -t label-app .
      - run: docker push registry/label-app

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: kubectl apply -f k8s/
```

---

## 📊 Zeitplan & Meilensteine

### Woche 1-2: Backend Core ✅✅ KOMPLETT!
- [x] Excel-Parser Service ✅
- [x] Label-Generator Service ✅
- [x] Layout-Composer Service (Print Service) ✅
- [x] Datentypen definieren ✅

### Woche 3-4: Storage & API ✅✅ KOMPLETT!
- [x] Storage Service ✅
- [x] API Endpoints (Labels, Excel, Print) ✅
- [x] Error-Handling ✅
- [x] Express Server Setup ✅
- [ ] Authentication (Optional)

### Woche 5-6: Frontend Basics ✅✅✅ KOMPLETT!
- [x] Projekt-Setup (Vite + React + TypeScript)
- [x] Routing (React Router v6)
- [x] State Management (Zustand Stores)
- [x] API Client (Axios)
- [x] Dashboard (Basic UI mit Stats)
- [x] Layout & Navigation
- [x] Label-Manager (Grid + List View, Filter, Batch Operations)
- [x] Excel-Importer UI (Upload, Preview, Stats)
- [x] Print-Configurator UI (FormatSelector, GridConfigurator, PrintPreview)
- [x] Templates Page (CRUD, Editor, Import/Export)
- [x] Settings Page (General, Storage, Print, About)

### Woche 7-8: Print-Features ✅ KOMPLETT!
- [x] Print-Configurator ✅
- [x] Templates (Basic CRUD, Editor, Import/Export) ✅
- [x] Preview-Canvas (Live Rendering, Drag & Drop) ✅
- [x] Keyboard Shortcuts (15+ shortcuts) ✅
- [ ] Export-Features (Advanced - Optional)

### Woche 9-10: Advanced & Polish ✅ KOMPLETT!
- [x] Batch-Processing ✅
- [x] Advanced Export Options ✅
- [x] Progress Tracking ✅
- [x] PWA Support ✅
- [ ] Performance-Optimierung (Optional)
- [ ] Testing (Optional)
- [ ] Documentation (Partially done - README exists)

### Woche 11-12: Deployment
- [x] Docker-Setup ✅ (Docker Compose + Dockerfiles für Backend & Frontend)
- [x] Frontend-Backend Integration ✅ (API Client konfiguriert, beide Server laufen)
- [ ] CI/CD
- [ ] Monitoring
- [ ] Launch!

---

## 🛠️ Technologie-Stack

### Backend
- **Runtime**: Node.js 18+ mit TypeScript
- **Framework**: Express.js
- **Bildverarbeitung**: Sharp
- **Excel**: xlsx
- **PDF**: PDFKit
- **Queue**: BullMQ
- **Cache**: Redis
- **DB**: SQLite/PostgreSQL

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **HTTP**: Axios + React Query
- **Canvas**: Konva.js
- **DnD**: react-dnd
- **Forms**: react-hook-form
- **Icons**: Lucide React

### DevOps
- **Container**: Docker
- **Orchestration**: Docker Compose / K8s
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK

---

## 📝 Notizen & Ideen

### Implementierte Advanced Features
- [x] **QR-Code Generator** ✅
  - Shop URL Integration ✅
  - Configurable QR Settings ✅
  - Drag & Drop Positioning ✅
  - Size/Position Controls ✅
  - Error Correction Levels ✅

### Zukünftige Features
- [ ] OCR für Label-Erkennung
- [ ] Barcode Scanner
- [ ] KI-basierte Preiserkennung
- [ ] Multi-Language Support
- [ ] Cloud-Sync
- [ ] Mobile App
- [ ] Shopware-Integration
- [ ] ERP-Anbindung

### Performance-Optimierungen
- [ ] Image-CDN
- [ ] WebP-Support
- [ ] Lazy-Loading
- [ ] Virtual-Scrolling
- [ ] Service-Worker
- [ ] IndexedDB Cache

### Security
- [ ] Rate-Limiting
- [ ] Input-Validation
- [ ] CSRF-Protection
- [ ] Content-Security-Policy
- [ ] Audit-Logging

---

## 📚 Dokumentation

### API-Dokumentation
- OpenAPI/Swagger Spec
- Postman Collection
- Code-Examples

### User-Dokumentation
- Getting Started Guide
- Video-Tutorials
- FAQ
- Troubleshooting

### Developer-Dokumentation
- Architecture Overview
- Code-Style Guide
- Contribution Guide
- Plugin-API

---

## ✅ Definition of Done

Eine Feature gilt als fertig wenn:
1. Code ist implementiert und getestet
2. Unit-Tests geschrieben (Coverage > 80%)
3. Integration-Tests vorhanden
4. Code-Review durchgeführt
5. Dokumentation aktualisiert
6. Performance-Tests bestanden
7. Accessibility geprüft
8. Deploy auf Staging erfolgreich

---

## 🚀 Launch-Checkliste

### Pre-Launch
- [ ] Alle Features implementiert
- [ ] Testing abgeschlossen
- [ ] Performance optimiert
- [ ] Security-Audit durchgeführt
- [ ] Dokumentation komplett
- [ ] Backup-Strategie definiert

### Launch-Day
- [ ] Production Deploy
- [ ] DNS-Konfiguration
- [ ] SSL-Zertifikate
- [ ] Monitoring aktiviert
- [ ] Erste User onboarden
- [ ] Support-Kanal einrichten

### Post-Launch
- [ ] User-Feedback sammeln
- [ ] Performance monitoren
- [ ] Bugs fixen
- [ ] Features priorisieren
- [ ] Roadmap updaten

---

Dieser Plan ist modular und kann schrittweise umgesetzt werden. Jede Phase baut auf der vorherigen auf, kann aber auch unabhängig entwickelt und getestet werden.