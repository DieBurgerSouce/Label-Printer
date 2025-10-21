# 🚀 ENHANCED IMPLEMENTATION PLAN: Automated Label Generation System

## 🎯 Project Vision
Ein vollautomatisches Label-Generierungs-System, das mit nur einer Shop-URL alle Produktlabels erstellt - mit automatischen Screenshots, OCR-Textextraktion, Excel-Datenabgleich und QR-Code-Generierung.

## ⚡ Hauptziele
1. **Ein-Klick-Lösung**: Nur Shop-URL eingeben → Alle Labels automatisch generiert
2. **Intelligente Erkennung**: OCR extrahiert Artikelnummern & Preise aus Screenshots
3. **Automatische Zuordnung**: Excel-Daten werden via Artikelnummer zugeordnet
4. **Zwei-Stufen-Templates**: Label-Templates (Design) + Druck-Templates (Layout)
5. **Realistische Vorschau**: WYSIWYG Druckvorschau mit exakter Darstellung

---

## 📋 Phase 1: Web Scraping & Screenshot Engine

### 1.1 Web Crawler Service
**Datei**: `backend/src/services/web-crawler-service.ts`

```typescript
interface CrawlJob {
  id: string;
  shopUrl: string;
  status: 'pending' | 'crawling' | 'processing' | 'completed' | 'failed';
  config: {
    maxProducts?: number;
    followPagination: boolean;
    screenshotQuality: number;
    waitForImages: boolean;
    customSelectors?: ProductSelectors;
  };
  results: {
    productsFound: number;
    screenshots: Screenshot[];
    errors: CrawlError[];
    duration: number;
  };
}

interface Screenshot {
  id: string;
  url: string;
  productUrl: string;
  imagePath: string;
  metadata: {
    width: number;
    height: number;
    timestamp: Date;
    pageTitle: string;
  };
}

interface ProductSelectors {
  productContainer: string;
  productLink: string;
  productImage: string;
  price: string;
  articleNumber: string;
  productName: string;
  nextPageButton?: string;
}
```

**Implementation Steps:**
- [ ] Install Puppeteer: `npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth`
- [ ] Create crawler class with browser management
- [ ] Implement product page detection algorithm
- [ ] Add pagination handling
- [ ] Screenshot capture with retries
- [ ] Error handling & recovery
- [ ] Progress tracking via WebSocket
- [ ] Queue management with BullMQ

**Features:**
- [ ] Auto-detect product listings
- [ ] Handle dynamic content (SPA)
- [ ] Bypass bot detection
- [ ] Parallel page processing
- [ ] Resume interrupted crawls
- [ ] Custom selector support
- [ ] Rate limiting
- [ ] Proxy support

### 1.2 Smart Product Detector
**Datei**: `backend/src/services/product-detector-service.ts`

```typescript
interface ProductDetectionResult {
  confidence: number;
  products: DetectedProduct[];
  layoutType: 'grid' | 'list' | 'carousel' | 'mixed';
  selectors: AutoDetectedSelectors;
}

interface DetectedProduct {
  boundingBox: BoundingBox;
  elements: {
    image?: HTMLElement;
    title?: HTMLElement;
    price?: HTMLElement;
    articleNumber?: HTMLElement;
  };
  extractedData: {
    imageUrl?: string;
    title?: string;
    price?: string;
    articleNumber?: string;
  };
}
```

**Implementation:**
- [ ] Pattern recognition for product cards
- [ ] Machine learning model for layout detection
- [ ] Heuristic analysis for element identification
- [ ] Confidence scoring system
- [ ] Manual override capability

---

## 📋 Phase 2: OCR & Data Extraction

### 2.1 OCR Engine Service
**Datei**: `backend/src/services/ocr-service.ts`

```typescript
interface OCRJob {
  id: string;
  screenshotId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  engine: 'tesseract' | 'googleVision' | 'aws-textract';
  config: OCRConfig;
  results: OCRResult;
}

interface OCRConfig {
  languages: string[];
  mode: 'fast' | 'accurate' | 'balanced';
  regions?: Region[];
  preprocessing: {
    grayscale: boolean;
    contrast: number;
    sharpen: boolean;
    denoise: boolean;
  };
}

interface OCRResult {
  fullText: string;
  blocks: TextBlock[];
  extractedData: {
    articleNumber?: string;
    price?: string;
    productName?: string;
    description?: string;
    customFields: Record<string, string>;
  };
  confidence: number;
  processingTime: number;
}

interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
  type: 'heading' | 'price' | 'articleNumber' | 'description' | 'unknown';
}
```

**Implementation Steps:**
- [ ] Install Tesseract.js: `npm install tesseract.js`
- [ ] Create OCR processing pipeline
- [ ] Implement image preprocessing
- [ ] Pattern recognition for article numbers
- [ ] Price format detection
- [ ] Multi-language support
- [ ] Batch processing capability
- [ ] Result caching

**Advanced Features:**
- [ ] Region-based OCR (focus on specific areas)
- [ ] Custom training data for better accuracy
- [ ] Format-specific extractors (price, SKU, etc.)
- [ ] Confidence thresholds
- [ ] Manual correction interface
- [ ] Learning from corrections

### 2.2 Data Extraction Patterns
**Datei**: `backend/src/services/extraction-patterns.ts`

```typescript
interface ExtractionPattern {
  name: string;
  type: 'articleNumber' | 'price' | 'productName' | 'custom';
  patterns: RegExp[];
  validators: ValidationRule[];
  transformers: TransformRule[];
}

// Common patterns
const ARTICLE_NUMBER_PATTERNS = [
  /Art\.?\s*Nr\.?\s*:?\s*(\d+[\w-]*)/i,
  /SKU\s*:?\s*(\w+)/i,
  /Item\s*#?\s*:?\s*(\w+)/i,
  /Artikel\s*:?\s*(\d+)/i,
  /Product\s*Code\s*:?\s*(\w+)/i
];

const PRICE_PATTERNS = [
  /(\d+[,.]?\d*)\s*€/,
  /EUR\s*(\d+[,.]?\d*)/,
  /€\s*(\d+[,.]?\d*)/,
  /(\d+[,.]?\d*)\s*Euro/i
];
```

---

## 📋 Phase 3: Smart Matching System

### 3.1 Excel Data Matcher
**Datei**: `backend/src/services/data-matcher-service.ts`

```typescript
interface MatchingJob {
  id: string;
  ocrResults: OCRResult[];
  excelData: ExcelProduct[];
  config: MatchingConfig;
  results: MatchingResult[];
}

interface MatchingConfig {
  strategy: 'exact' | 'fuzzy' | 'ai';
  confidence: number; // 0-100
  fields: string[]; // fields to match on
  fallbackStrategies: MatchingStrategy[];
}

interface MatchingResult {
  ocrId: string;
  excelId?: string;
  confidence: number;
  matchedOn: string[];
  suggestions: AlternativeMatch[];
  requiresReview: boolean;
}

interface AlternativeMatch {
  excelId: string;
  confidence: number;
  reason: string;
}
```

**Implementation:**
- [ ] Install Fuse.js for fuzzy matching: `npm install fuse.js`
- [ ] Exact matching algorithm
- [ ] Fuzzy matching with Levenshtein distance
- [ ] AI-based matching (optional)
- [ ] Multi-field matching
- [ ] Confidence scoring
- [ ] Manual review queue
- [ ] Learning from corrections

### 3.2 Intelligent Mapping
**Datei**: `backend/src/services/intelligent-mapper.ts`

```typescript
interface MappingRule {
  id: string;
  name: string;
  conditions: MappingCondition[];
  actions: MappingAction[];
  priority: number;
}

interface MappingCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'startsWith' | 'endsWith';
  value: string;
}

interface MappingAction {
  type: 'map' | 'transform' | 'combine' | 'skip';
  sourceField: string;
  targetField: string;
  transformer?: (value: any) => any;
}
```

---

## 📋 Phase 4: Advanced Template System mit Dynamic Styling

### 🎨 NEU: Dynamic Text Styling System
**Wichtiges Feature**: Da wir alle Daten via OCR extrahieren, sind wir NICHT an Screenshots gebunden! Wir können alle Textelemente komplett neu stylen und formatieren.

#### 💡 Vorteile der Daten-basierten Lösung vs. Screenshots

**Bisheriger Ansatz (Screenshot-basiert):**
- ❌ Statische Bilder ohne Anpassungsmöglichkeit
- ❌ Schriftart und Farben sind fix
- ❌ Keine Möglichkeit einzelne Elemente zu stylen
- ❌ Qualitätsverlust beim Skalieren
- ❌ Keine Responsivität

**Neuer Ansatz (OCR-Daten-basiert):**
- ✅ **Volle typografische Kontrolle**: Jedes Feld individuell stylbar
- ✅ **Artikelnummern in Fett**: Wie gewünscht komplett anpassbar
- ✅ **Staffelpreise in Blau**: Unterschiedliche Farben für verschiedene Preis-Typen
- ✅ **Normale Preise in Schwarz**: Klare visuelle Hierarchie
- ✅ **Skalierbar ohne Qualitätsverlust**: Vektorbasierte Texte
- ✅ **Responsive**: Automatische Anpassung an verschiedene Label-Größen
- ✅ **Mehrsprachigkeit**: Texte können übersetzt/angepasst werden
- ✅ **Barrierefreiheit**: Echte Texte statt Bilder
- ✅ **Suchbar**: Labels können durchsucht werden
- ✅ **A/B Testing**: Verschiedene Styles einfach testbar

#### Dynamic Field Styling
**Datei**: `frontend/src/components/LabelDesigner/DynamicStyling.tsx`

```typescript
interface DynamicTextStyle {
  id: string;
  fieldType: 'articleNumber' | 'price' | 'tieredPrice' | 'productName' | 'description' | 'custom';
  typography: {
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline' | 'overline' | 'line-through';
    textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    letterSpacing: number;
    lineHeight: number;
    color: string;
    textShadow?: TextShadow;
  };
  effects: {
    backgroundColor?: string;
    border?: BorderStyle;
    borderRadius?: number;
    padding?: Padding;
    margin?: Margin;
    opacity?: number;
    boxShadow?: BoxShadow;
  };
  conditionalStyles?: ConditionalStyle[];
}

interface ConditionalStyle {
  condition: string; // JavaScript expression e.g., "value > 100"
  overrides: Partial<DynamicTextStyle>;
}

// Beispiel: Verschiedene Styles für verschiedene Felder
const fieldStyles: Record<string, DynamicTextStyle> = {
  articleNumber: {
    id: 'art-nr-style',
    fieldType: 'articleNumber',
    typography: {
      fontFamily: 'Arial Black',
      fontSize: 14,
      fontWeight: 'bold',  // Artikelnummer in FETT wie gewünscht!
      color: '#000000',
    }
  },
  tieredPricing: {
    id: 'tier-price-style',
    fieldType: 'tieredPrice',
    typography: {
      fontFamily: 'Arial',
      fontSize: 12,
      fontWeight: 'normal',
      color: '#0066CC',  // Staffelpreise in BLAU wie gewünscht!
    }
  },
  normalPrice: {
    id: 'normal-price-style',
    fieldType: 'price',
    typography: {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      color: '#000000',  // Normale Preise in SCHWARZ wie gewünscht!
    }
  }
};
```

#### Advanced Text Formatting Features
```typescript
interface TextFormattingOptions {
  // Preis-Formatierung
  priceFormatting: {
    currencyPosition: 'before' | 'after';
    currencySymbol: string;
    decimalPlaces: number;
    thousandsSeparator: string;
    decimalSeparator: string;
    showCurrencyCode: boolean;
  };

  // Staffelpreis-Formatierung
  tieredPriceFormatting: {
    layout: 'horizontal' | 'vertical' | 'table';
    separator: string;
    showQuantityLabel: boolean;
    quantityPrefix: string; // z.B. "ab"
    quantitySuffix: string; // z.B. "Stück"
    highlightBestPrice: boolean;
    bestPriceColor: string;
  };

  // Artikelnummer-Formatierung
  articleNumberFormatting: {
    prefix: string; // z.B. "Art.Nr.: "
    casing: 'original' | 'uppercase' | 'lowercase';
    grouping?: {
      enabled: boolean;
      separator: string; // z.B. "-" für "123-456-789"
      pattern: number[]; // z.B. [3, 3, 3]
    };
  };
}
```

### 4.1 Label Template Designer (Enhanced)
**Datei**: `frontend/src/components/LabelDesigner/`

```typescript
interface LabelTemplate {
  id: string;
  name: string;
  version: string;
  dimensions: {
    width: number;  // in mm
    height: number; // in mm
  };
  layers: TemplateLayer[];
  variables: TemplateVariable[];
  styles: GlobalStyles;
  settings: TemplateSettings;
  // NEU: Dynamic Styling
  fieldStyles: DynamicTextStyle[];
  formattingOptions: TextFormattingOptions;
}

interface TemplateLayer {
  id: string;
  type: 'text' | 'image' | 'qrcode' | 'barcode' | 'shape' | 'container';
  position: { x: number; y: number; z: number };
  size: { width: number; height: number };
  rotation: number;
  properties: LayerProperties;
  bindings: DataBinding[];
  conditions: RenderCondition[];
  animations?: LayerAnimation[];
}

interface DataBinding {
  property: string;
  source: 'excel' | 'ocr' | 'manual' | 'computed';
  field: string;
  transformer?: string; // JavaScript expression
  fallback?: any;
}

interface RenderCondition {
  expression: string; // JavaScript expression
  action: 'show' | 'hide' | 'style';
  value?: any;
}
```

**Components to Build:**
- [ ] `CanvasEditor.tsx` - Main visual editor with Fabric.js
- [ ] `LayerPanel.tsx` - Layer management (reorder, visibility, lock)
- [ ] `PropertiesPanel.tsx` - Layer properties editor
- [ ] `DataBindingPanel.tsx` - Connect data sources
- [ ] `StyleEditor.tsx` - Typography, colors, effects
- [ ] **NEU: `DynamicStyleEditor.tsx`** - Individual styling für OCR-extrahierte Felder
- [ ] **NEU: `FieldStylePresets.tsx`** - Vordefinierte Styles für verschiedene Felder
- [ ] **NEU: `ConditionalStyleBuilder.tsx`** - Bedingte Formatierung basierend auf Werten
- [ ] `VariablesPanel.tsx` - Template variables management
- [ ] `PreviewMode.tsx` - Live preview with sample data
- [ ] `TemplateLibrary.tsx` - Pre-made templates

**Features:**
- [ ] Drag & drop interface
- [ ] Snap to grid (customizable)
- [ ] Alignment guides
- [ ] Ruler & measurements
- [ ] Undo/Redo (Ctrl+Z/Y)
- [ ] Copy/Paste layers
- [ ] Group/Ungroup
- [ ] Lock/Unlock layers
- [ ] Keyboard shortcuts
- [ ] Import/Export templates
- [ ] **NEU: Live Style Preview** - Änderungen sofort sichtbar
- [ ] **NEU: Style Inheritance** - Globale und lokale Styles
- [ ] **NEU: Style Presets** - Speicherbare Style-Kombinationen

### 4.2 Print Template System
**Datei**: `frontend/src/components/PrintDesigner/`

```typescript
interface PrintTemplate {
  id: string;
  name: string;
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  layout: PrintLayout;
  labelArrangement: LabelArrangement;
  printSettings: PrintSettings;
  preview: PrintPreview;
}

interface LabelArrangement {
  strategy: 'grid' | 'flow' | 'custom';
  grid?: {
    columns: number;
    rows: number;
    gutterX: number; // mm
    gutterY: number; // mm
  };
  flow?: {
    direction: 'horizontal' | 'vertical';
    wrap: boolean;
    spacing: number;
  };
  custom?: {
    positions: Array<{
      labelId: string;
      x: number;
      y: number;
      scale: number;
      rotation: number;
    }>;
  };
}

interface PrintSettings {
  dpi: number;
  colorMode: 'rgb' | 'cmyk' | 'grayscale';
  margins: Margins;
  bleed: number;
  cropMarks: boolean;
  registrationMarks: boolean;
  colorBars: boolean;
  pageInfo: boolean;
}

interface PrintPreview {
  mode: 'screen' | 'print' | 'realistic';
  zoom: number;
  showGuides: boolean;
  showMeasurements: boolean;
  paperTexture?: string;
  lighting?: 'flat' | 'studio' | 'natural';
}
```

**Components:**
- [ ] `PrintCanvas.tsx` - WYSIWYG print preview
- [ ] `ArrangementControls.tsx` - Label positioning
- [ ] `PrintSettingsPanel.tsx` - Print configuration
- [ ] `PreviewControls.tsx` - View options
- [ ] `ExportDialog.tsx` - Export settings
- [ ] `BatchPrintQueue.tsx` - Multiple pages

**Realistic Preview Features:**
- [ ] Paper texture overlay
- [ ] 3D perspective view
- [ ] Shadows & depth
- [ ] Print simulation (ink density)
- [ ] Color profile preview
- [ ] Actual size preview (1:1)

#### 🎯 Praktisches Beispiel: Von OCR zu gestyltem Label

**Workflow:**
```typescript
// 1. OCR extrahiert Rohdaten aus Screenshot
const ocrResult = {
  articleNumber: "123456789",
  productName: "Premium Widget XL",
  price: "49.99",
  tieredPrices: [
    { quantity: 10, price: 45.99 },
    { quantity: 50, price: 42.99 },
    { quantity: 100, price: 39.99 }
  ]
};

// 2. Template wendet Dynamic Styles an
const styledLabel = {
  articleNumber: {
    text: "Art.Nr.: 123456789",
    style: {
      fontWeight: "bold",        // FETT wie gewünscht!
      fontSize: 14,
      color: "#000000"
    }
  },
  price: {
    text: "49,99 €",
    style: {
      fontWeight: "bold",
      fontSize: 24,
      color: "#000000"           // SCHWARZ wie gewünscht!
    }
  },
  tieredPrices: {
    text: "ab 10 Stk: 45,99 € | ab 50 Stk: 42,99 € | ab 100 Stk: 39,99 €",
    style: {
      fontSize: 11,
      color: "#0066CC",           // BLAU wie gewünscht!
      backgroundColor: "#F0F8FF",
      padding: 5,
      borderRadius: 3
    }
  }
};

// 3. Render auf Canvas mit vollständiger Kontrolle
renderToCanvas(styledLabel);
```

**UI für Style-Anpassung:**
```typescript
const StyleControlPanel = () => {
  return (
    <div className="style-panel">
      {/* Artikelnummer Styling */}
      <FieldStyleEditor
        fieldName="Artikelnummer"
        currentStyle={styles.articleNumber}
        presets={[
          { name: "Standard", style: { fontWeight: "normal", color: "#000" }},
          { name: "Fett", style: { fontWeight: "bold", color: "#000" }},     // ✓ Ausgewählt
          { name: "Hervorgehoben", style: { fontWeight: "bold", color: "#FF0000" }}
        ]}
      />

      {/* Staffelpreis Styling */}
      <FieldStyleEditor
        fieldName="Staffelpreise"
        currentStyle={styles.tieredPrices}
        presets={[
          { name: "Dezent", style: { color: "#666", fontSize: 10 }},
          { name: "Blau", style: { color: "#0066CC", fontSize: 11 }},        // ✓ Ausgewählt
          { name: "Highlight", style: { color: "#FFF", backgroundColor: "#0066CC" }}
        ]}
      />

      {/* Live Preview */}
      <LabelPreview data={ocrResult} styles={styles} />
    </div>
  );
};
```

---

## 📋 Phase 5: One-Click Automation

### 5.1 Automation Dashboard
**Datei**: `frontend/src/pages/AutomationDashboard.tsx`

```typescript
interface AutomationJob {
  id: string;
  name: string;
  shopUrl: string;
  status: JobStatus;
  steps: AutomationStep[];
  config: AutomationConfig;
  results: AutomationResults;
}

interface AutomationStep {
  id: string;
  type: 'crawl' | 'ocr' | 'match' | 'generate' | 'export';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  output?: any;
}

interface AutomationConfig {
  crawlSettings: CrawlConfig;
  ocrSettings: OCRConfig;
  matchingSettings: MatchingConfig;
  templateSettings: {
    labelTemplate: string;
    printTemplate: string;
    autoPosition: boolean;
  };
  exportSettings: ExportConfig;
  notifications: NotificationConfig;
}
```

**UI Components:**
- [ ] `QuickStartWizard.tsx` - Simple URL input with smart defaults
- [ ] `AutomationPipeline.tsx` - Visual pipeline editor
- [ ] `JobMonitor.tsx` - Real-time progress tracking
- [ ] `ResultsGallery.tsx` - Preview generated labels
- [ ] `ErrorHandler.tsx` - Error recovery options
- [ ] `BatchControl.tsx` - Multiple URL processing

**Features:**
- [ ] Drag & drop URL list
- [ ] Template presets
- [ ] Progress notifications
- [ ] Pause/Resume capability
- [ ] Export to multiple formats
- [ ] Email when complete

### 5.2 Real-time Updates
**Datei**: `backend/src/websocket/automation-socket.ts`

```typescript
interface SocketEvents {
  // Client → Server
  'automation:start': (config: AutomationConfig) => void;
  'automation:pause': (jobId: string) => void;
  'automation:resume': (jobId: string) => void;
  'automation:cancel': (jobId: string) => void;

  // Server → Client
  'job:created': (job: AutomationJob) => void;
  'step:started': (step: AutomationStep) => void;
  'step:progress': (data: ProgressData) => void;
  'step:completed': (step: AutomationStep) => void;
  'screenshot:ready': (screenshot: Screenshot) => void;
  'ocr:result': (result: OCRResult) => void;
  'label:generated': (label: GeneratedLabel) => void;
  'job:completed': (results: AutomationResults) => void;
  'error:occurred': (error: ErrorInfo) => void;
}
```

---

## 📋 Phase 6: API Endpoints

### 6.1 Crawler API
```typescript
POST   /api/crawler/start          // Start crawling a shop URL
GET    /api/crawler/jobs/:id       // Get crawl job status
POST   /api/crawler/stop/:id       // Stop crawl job
GET    /api/crawler/screenshots/:id // Get screenshots for job
POST   /api/crawler/detect         // Auto-detect product selectors
```

### 6.2 OCR API
```typescript
POST   /api/ocr/process           // Process screenshot with OCR
POST   /api/ocr/batch             // Batch OCR processing
GET    /api/ocr/results/:id       // Get OCR results
PUT    /api/ocr/correct/:id       // Manual correction
POST   /api/ocr/train             // Train with corrections
```

### 6.3 Matching API
```typescript
POST   /api/match/auto            // Automatic matching
POST   /api/match/manual          // Manual match override
GET    /api/match/suggestions     // Get match suggestions
POST   /api/match/learn           // Learn from corrections
```

### 6.4 Template API
```typescript
// Label Templates
GET    /api/templates/labels      // List label templates
POST   /api/templates/labels      // Create label template
PUT    /api/templates/labels/:id  // Update label template
DELETE /api/templates/labels/:id  // Delete label template
POST   /api/templates/labels/duplicate/:id
GET    /api/templates/labels/:id/preview

// Print Templates
GET    /api/templates/print       // List print templates
POST   /api/templates/print       // Create print template
PUT    /api/templates/print/:id   // Update print template
DELETE /api/templates/print/:id   // Delete print template
```

### 6.5 Automation API
```typescript
POST   /api/automation/create     // Create automation job
POST   /api/automation/start/:id  // Start automation
GET    /api/automation/status/:id // Get job status
POST   /api/automation/pause/:id  // Pause job
POST   /api/automation/resume/:id // Resume job
DELETE /api/automation/cancel/:id // Cancel job
GET    /api/automation/results/:id // Get results
```

---

## 📋 Phase 7: Database Schema

### 7.1 New Tables
```sql
-- Crawl jobs table
CREATE TABLE crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  config JSONB NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  products_found INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Screenshots table
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL,
  image_path TEXT NOT NULL,
  thumbnail_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OCR results table
CREATE TABLE ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID REFERENCES screenshots(id) ON DELETE CASCADE,
  engine VARCHAR(50) NOT NULL,
  full_text TEXT,
  blocks JSONB,
  extracted_data JSONB,
  confidence FLOAT,
  processing_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matching results table
CREATE TABLE matching_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_result_id UUID REFERENCES ocr_results(id),
  excel_product_id UUID,
  confidence FLOAT NOT NULL,
  matched_fields JSONB,
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Label templates table
CREATE TABLE label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL,
  dimensions JSONB NOT NULL,
  layers JSONB NOT NULL,
  variables JSONB,
  styles JSONB,
  settings JSONB,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Print templates table
CREATE TABLE print_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  paper_size VARCHAR(50) NOT NULL,
  orientation VARCHAR(20) NOT NULL,
  layout JSONB NOT NULL,
  arrangement JSONB NOT NULL,
  settings JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automation jobs table
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  shop_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  config JSONB NOT NULL,
  steps JSONB,
  results JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 Phase 8: Dependencies & Setup

### 8.1 Backend Dependencies
```json
{
  "dependencies": {
    // Web Scraping
    "puppeteer": "^21.0.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",

    // OCR
    "tesseract.js": "^5.0.0",
    "sharp": "^0.33.0",

    // Matching
    "fuse.js": "^7.0.0",
    "string-similarity": "^4.0.4",

    // Queue & Jobs
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.2",

    // WebSocket
    "socket.io": "^4.6.0",

    // Database
    "prisma": "^5.7.0",
    "@prisma/client": "^5.7.0",

    // Utils
    "jimp": "^0.22.10",
    "pdf-lib": "^1.17.1",
    "qrcode": "^1.5.3"
  }
}
```

### 8.2 Frontend Dependencies
```json
{
  "dependencies": {
    // UI Framework
    "react": "^18.2.0",
    "react-dom": "^18.2.0",

    // Canvas & Design
    "fabric": "^5.3.0",
    "konva": "^9.2.0",
    "react-konva": "^18.2.10",

    // State Management
    "zustand": "^4.4.0",
    "immer": "^10.0.3",

    // WebSocket
    "socket.io-client": "^4.6.0",

    // UI Components
    "react-color": "^2.19.3",
    "react-dropzone": "^14.2.3",
    "react-beautiful-dnd": "^13.1.1",
    "react-hotkeys-hook": "^4.4.1",

    // Utils
    "lodash": "^4.17.21",
    "dayjs": "^1.11.10",
    "file-saver": "^2.0.5"
  }
}
```

---

## 📋 Phase 9: Testing Strategy

### 9.1 Unit Tests
```javascript
// backend/src/__tests__/
- crawler-service.test.ts
- ocr-service.test.ts
- matcher-service.test.ts
- template-engine.test.ts
```

### 9.2 Integration Tests
```javascript
// backend/src/__tests__/integration/
- crawl-to-ocr.test.ts
- ocr-to-match.test.ts
- end-to-end-automation.test.ts
```

### 9.3 E2E Tests
```javascript
// e2e/
- automation-workflow.spec.ts
- template-designer.spec.ts
- print-preview.spec.ts
```

---

## 📋 Phase 10: Performance Optimization

### 10.1 Caching Strategy
- Redis for OCR results
- CDN for screenshots
- Browser cache for templates
- IndexedDB for offline mode

### 10.2 Optimization Techniques
- Lazy loading components
- Virtual scrolling for lists
- Image optimization (WebP)
- Code splitting
- Web Workers for heavy processing

---

## 🚀 Implementation Timeline

### Week 1: Foundation (Days 1-7)
- [ ] Day 1-2: Setup project, install dependencies
- [ ] Day 3-4: Web crawler service
- [ ] Day 5-6: OCR integration
- [ ] Day 7: Basic UI scaffolding

### Week 2: Core Features (Days 8-14)
- [ ] Day 8-9: Smart matching system
- [ ] Day 10-11: Label template designer
- [ ] Day 12-13: Print template system
- [ ] Day 14: Integration testing

### Week 3: Automation (Days 15-21)
- [ ] Day 15-16: Automation pipeline
- [ ] Day 17-18: Real-time updates
- [ ] Day 19-20: One-click workflow
- [ ] Day 21: Error handling

### Week 4: Polish & Deploy (Days 22-28)
- [ ] Day 22-23: UI/UX refinement
- [ ] Day 24-25: Performance optimization
- [ ] Day 26-27: Testing & bug fixes
- [ ] Day 28: Deployment

---

## 🎯 Success Metrics

### Performance Targets
- **Crawling Speed**: < 2 seconds per product
- **OCR Accuracy**: > 95% for article numbers
- **Matching Accuracy**: > 90% automatic matches
- **Generation Time**: < 500ms per label
- **UI Responsiveness**: < 100ms interaction delay

### Quality Metrics
- **Print Quality**: 300+ DPI output
- **Color Accuracy**: Delta E < 2
- **Position Accuracy**: ± 0.1mm
- **Template Compatibility**: 100% cross-browser

### User Experience
- **One-Click Success Rate**: > 80%
- **Manual Intervention**: < 5% of labels
- **Learning Curve**: < 30 minutes
- **Error Recovery**: 100% resumable

---

## ✅ Definition of Done

### Feature Completion
- [ ] All acceptance criteria met
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Accessibility standards met (WCAG 2.1 AA)

### Deployment Ready
- [ ] Docker images built
- [ ] Environment configs set
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] SSL certificates installed
- [ ] Load testing completed

---

## 🎊 Final Deliverables

### Core System
1. **Web Crawler**: Fully automated product detection and screenshot capture
2. **OCR Engine**: 95%+ accuracy text extraction with learning capability
3. **Smart Matcher**: Intelligent Excel data mapping with confidence scoring
4. **Template Designer**: Professional drag-drop label designer with data binding
5. **Print System**: WYSIWYG print preview with realistic rendering
6. **Automation Dashboard**: One-click label generation from URL
7. **Real-time Updates**: WebSocket-based progress tracking
8. **Batch Processing**: Handle hundreds of products efficiently

### Documentation
- User Guide (with screenshots)
- API Documentation (OpenAPI)
- Template Creation Tutorial
- Troubleshooting Guide
- Video Walkthrough

### Support Files
- Docker Compose setup
- Environment templates
- Sample templates library
- Test data sets
- Backup scripts

---

## 🚦 Quick Start Commands

```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Setup database
npx prisma migrate dev

# Start services
docker-compose up -d redis
npm run dev:backend
npm run dev:frontend

# Run tests
npm run test:unit
npm run test:integration
npm run test:e2e

# Build for production
npm run build:all
docker build -t label-system .

# Deploy
docker-compose up -d
```

---

This enhanced implementation plan provides a complete roadmap for building the automated label generation system with all requested features!