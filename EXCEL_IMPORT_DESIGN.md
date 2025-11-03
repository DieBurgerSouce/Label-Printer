# Excel-Import mit dynamischem Mapping - Design-Dokumentation

## Übersicht

Dieses Dokument beschreibt die Architektur und Implementierung des dynamischen Excel-Import-Systems für die Screenshot Automation & Label Generation Anwendung.

## Problemstellung

Die aktuelle Excel-Import-Funktion ist statisch und speichert Daten nur in einem In-Memory-Cache. Es gibt keine Möglichkeit, bestehende Artikel in der Datenbank basierend auf Excel-Daten zu aktualisieren.

## Lösung

Ein mehrstufiger Import-Wizard, der es Usern ermöglicht:
1. Excel-Dateien hochzuladen
2. Dynamisch zu konfigurieren, welche Spalten welchen Datenbankfeldern zugeordnet werden
3. Bestehende Artikel basierend auf Artikelnummer zu matchen und zu aktualisieren

## Architektur

### Frontend-Komponenten

```
ExcelImportNew (Page)
├── ImportWizard (Container)
│   ├── Step 1: FileUpload & Preview
│   ├── Step 2: MatchColumnSelector
│   ├── Step 3: FieldMapper
│   └── Step 4: ImportExecutor
```

### Backend-Services

```
ArticlesExcelRouter
├── POST /api/articles/excel-preview
└── POST /api/articles/excel-import
    └── DynamicExcelImportService
        ├── parseExcelWithConfig()
        ├── matchArticles()
        └── bulkUpdateArticles()
```

## Datenfluss

### 1. Excel-Upload & Preview

```
User → Upload File → Backend
Backend → Parse first 10 rows → Return preview data
Frontend → Display preview table with column indices (A, B, C...)
```

### 2. Match-Spalte konfigurieren

```
User selects match column method:
- By Column Index (A, B, C...)
- By Header Name (Artikelnummer, Art-Nr, SKU)
- Auto-detect (find common article number column names)

Frontend → Validate selection → Enable next step
```

### 3. Feld-Mapping

```
For each Excel column (except match column):
  User maps to DB field:
  - description
  - price
  - category
  - manufacturer
  - ean
  - etc.

Frontend → Build mapping config → Send to backend
```

### 4. Import-Ausführung

```
Frontend → Send { file, config } → Backend

Backend:
1. Parse Excel with config
2. For each row:
   a. Extract article number from match column
   b. Search article in DB
   c. If found: Apply field mappings, update article
   d. If not found: Skip (only update existing articles)
3. Bulk update all changed articles
4. Return statistics

Frontend → Display result (X updated, Y skipped, Z errors)
```

## API-Spezifikation

### POST /api/articles/excel-preview

**Request:**
```typescript
{
  file: File (multipart/form-data)
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    headers: string[];           // ['Artikelnummer', 'Beschreibung', 'Preis', ...]
    rows: any[][];               // First 10 data rows
    totalRows: number;           // Total number of rows in Excel
    columnIndices: string[];     // ['A', 'B', 'C', 'D', ...]
  }
}
```

### POST /api/articles/excel-import

**Request:**
```typescript
{
  file: File (multipart/form-data),
  config: {
    matchColumn: {
      type: 'index' | 'header';
      value: string;              // 'A' or 'Artikelnummer'
    };
    fieldMappings: Array<{
      excelColumn: string;        // Column identifier (index or header)
      dbField: string;            // DB field name
      type?: 'index' | 'header';  // How to identify the column
    }>;
    startRow?: number;            // Default: 2 (skip header)
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    totalRows: number;
    matchedArticles: number;
    updatedArticles: number;
    skippedArticles: number;
    errors: Array<{
      row: number;
      articleNumber: string;
      message: string;
    }>;
  }
}
```

## Datenbank-Felder

Mapping von Excel-Spalten zu Article-Feldern:

| Excel-Spalte (Beispiel) | DB-Feld | Typ | Beschreibung |
|---|---|---|---|
| Artikelnummer | articleNumber | string | **Match-Spalte** (nicht überschreibbar) |
| Beschreibung | description | string | Produktbeschreibung |
| Preis | price | number | Basis-Preis |
| Währung | currency | string | EUR, USD, etc. |
| Kategorie | category | string | Produktkategorie |
| Hersteller | manufacturer | string | Hersteller |
| EAN | ean | string | EAN-Code |
| Produktname | productName | string | Name des Produkts |

## Spalten-Identifikation

### Methode 1: Nach Index (A, B, C...)

```typescript
// Excel column A = index 0
const columnIndex = columnLetter.charCodeAt(0) - 65; // 'A' = 0, 'B' = 1, ...

// Get value from row
const value = row[columnIndex];
```

### Methode 2: Nach Header-Name

```typescript
// Assume first row is header
const headers = excelRows[0];

// Find column by header name
const columnIndex = headers.findIndex(h =>
  h.toLowerCase().trim() === searchHeader.toLowerCase().trim()
);

// Get value from subsequent rows
const value = row[columnIndex];
```

### Methode 3: Auto-Detection

```typescript
const articleNumberPatterns = [
  'artikelnummer',
  'article number',
  'art-nr',
  'art.nr',
  'sku',
  'item number',
  'product number'
];

const matchedHeader = headers.find(h =>
  articleNumberPatterns.some(pattern =>
    h.toLowerCase().includes(pattern)
  )
);
```

## Fehlerbehandlung

### Validierung vor Import

1. **Match-Spalte validieren**
   - Muss existieren
   - Darf nicht leer sein
   - Muss eindeutige Werte haben

2. **Feld-Mappings validieren**
   - Gemappte Spalten müssen existieren
   - DB-Felder müssen gültig sein
   - Typ-Kompatibilität prüfen (z.B. price muss Zahl sein)

3. **Excel-Format validieren**
   - Muss .xlsx oder .xls sein
   - Muss mindestens 2 Zeilen haben (Header + Daten)
   - Maximale Dateigröße: 10MB

### Fehler während Import

```typescript
try {
  // Parse row
  const articleNumber = getValueFromColumn(row, matchColumn);

  // Find article
  const article = await findArticleByNumber(articleNumber);

  if (!article) {
    skipped++;
    continue; // Skip non-existing articles
  }

  // Apply mappings
  for (const mapping of fieldMappings) {
    const value = getValueFromColumn(row, mapping.excelColumn);
    article[mapping.dbField] = convertValue(value, mapping.dbField);
  }

  updatedArticles.push(article);

} catch (error) {
  errors.push({
    row: rowIndex,
    articleNumber: articleNumber || 'N/A',
    message: error.message
  });
}
```

## UI/UX-Spezifikation

### Step 1: File Upload & Preview

**Layout:**
```
┌─────────────────────────────────────────┐
│ Schritt 1/4: Excel-Datei hochladen     │
├─────────────────────────────────────────┤
│                                         │
│  [Drag & Drop Zone]                     │
│  oder klicken zum Auswählen             │
│                                         │
├─────────────────────────────────────────┤
│ Vorschau (erste 10 Zeilen):             │
│                                         │
│  A  │  B          │  C     │  D         │
│  ─────────────────────────────────────  │
│  Nr │ Beschreibung│ Preis  │ Kategorie  │
│  123│ Product 1   │ 19.99  │ Tools      │
│  456│ Product 2   │ 29.99  │ Hardware   │
│  ...│ ...         │ ...    │ ...        │
│                                         │
│          [Weiter →]                     │
└─────────────────────────────────────────┘
```

### Step 2: Match-Spalte konfigurieren

**Layout:**
```
┌─────────────────────────────────────────┐
│ Schritt 2/4: Artikelnummer-Spalte       │
├─────────────────────────────────────────┤
│                                         │
│ Wie soll nach Artikelnummern gesucht   │
│ werden?                                 │
│                                         │
│ ○ Nach Spalte                           │
│   [A ▼] (Dropdown: A, B, C, D...)       │
│                                         │
│ ○ Nach Header-Name                      │
│   [Artikelnummer ▼] (Dropdown: Headers) │
│                                         │
│ ○ Auto-Detect                           │
│   ✓ Gefunden: Spalte A "Artikelnummer"  │
│                                         │
│ ℹ Diese Spalte wird zum Matchen mit     │
│   Artikeln in der Datenbank verwendet   │
│                                         │
│  [← Zurück]          [Weiter →]         │
└─────────────────────────────────────────┘
```

### Step 3: Feld-Mappings

**Layout:**
```
┌─────────────────────────────────────────┐
│ Schritt 3/4: Felder zuordnen            │
├─────────────────────────────────────────┤
│                                         │
│ Welche Felder sollen überschrieben      │
│ werden?                                 │
│                                         │
│ Excel-Spalte → Datenbank-Feld           │
│ ─────────────────────────────────────── │
│                                         │
│ ☑ B (Beschreibung) → Description        │
│ ☑ C (Preis)        → Price              │
│ ☐ D (Kategorie)    → Category           │
│ ☐ E (Hersteller)   → Manufacturer       │
│                                         │
│ + Weitere Spalte hinzufügen             │
│                                         │
│  [← Zurück]          [Weiter →]         │
└─────────────────────────────────────────┘
```

### Step 4: Import durchführen

**Layout:**
```
┌─────────────────────────────────────────┐
│ Schritt 4/4: Import starten             │
├─────────────────────────────────────────┤
│                                         │
│ Zusammenfassung:                        │
│ • Excel-Zeilen: 150                     │
│ • Match-Spalte: A (Artikelnummer)       │
│ • Zu aktualisierende Felder: 2          │
│   - Beschreibung                        │
│   - Preis                               │
│                                         │
│ ⚠ Achtung: Existierende Daten werden    │
│   überschrieben!                        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ████████████░░░░░░░░░░░░░░ 50%      │ │
│ │ 75 von 150 verarbeitet...           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Ergebnis:                               │
│ ✓ 120 Artikel aktualisiert              │
│ ⊘ 25 übersprungen (nicht in DB)         │
│ ✗ 5 Fehler                              │
│                                         │
│  [← Zurück]    [Import starten]         │
└─────────────────────────────────────────┘
```

## Performance-Überlegungen

### Bulk-Updates

Statt einzelne Artikel zu updaten, sammeln wir alle Änderungen und führen ein Bulk-Update durch:

```typescript
// Bad: N queries
for (const article of articles) {
  await db.articles.update(article.id, article);
}

// Good: 1 query
await db.articles.bulkUpdate(articles);
```

### Excel-Parsing

Für große Dateien nur relevante Daten parsen:

```typescript
// Parse nur benötigte Spalten
const columnIndices = getColumnIndicesFromMappings(config);
const rows = parseExcelColumns(file, columnIndices);
```

### Frontend-Performance

Virtualisierte Tabellen für große Vorschauen:

```tsx
import { VirtualTable } from 'react-virtualized';
// Rendert nur sichtbare Zeilen
```

## Sicherheit

### Validierung

1. **Dateigröße**: Max 10MB
2. **Dateiformat**: Nur .xlsx, .xls
3. **Injection-Schutz**: Sanitize Excel-Werte
4. **Rate-Limiting**: Max 10 Imports pro Minute

### Berechtigungen

```typescript
// Nur authentifizierte User
router.post('/excel-import', authenticateUser, async (req, res) => {
  // Import logic
});
```

## Testing-Strategie

### Unit Tests

```typescript
describe('DynamicExcelImportService', () => {
  it('should parse Excel with column index mapping', () => {
    const config = {
      matchColumn: { type: 'index', value: 'A' },
      fieldMappings: [
        { excelColumn: 'B', dbField: 'description', type: 'index' }
      ]
    };

    const result = service.parseExcel(excelBuffer, config);
    expect(result.rows[0].description).toBe('Expected value');
  });

  it('should skip non-existing articles', () => {
    // Test logic
  });
});
```

### Integration Tests

```typescript
describe('Excel Import API', () => {
  it('should import and update existing articles', async () => {
    const response = await request(app)
      .post('/api/articles/excel-import')
      .attach('file', excelFile)
      .field('config', JSON.stringify(config));

    expect(response.status).toBe(200);
    expect(response.body.data.updatedArticles).toBe(10);
  });
});
```

## Zukünftige Erweiterungen

1. **Vorschau vor Import**: Zeige welche Artikel geändert werden
2. **Undo-Funktion**: Möglichkeit letzte Importe rückgängig zu machen
3. **Scheduled Imports**: Regelmäßige automatische Imports
4. **Custom Transformers**: User-definierte Datenkonvertierungen
5. **Multi-File Support**: Mehrere Excel-Dateien gleichzeitig
6. **Export-Template**: Excel-Template mit aktuellen Daten generieren

## Referenzen

- [xlsx Library Dokumentation](https://docs.sheetjs.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Express Multer](https://github.com/expressjs/multer)

---

**Letzte Aktualisierung**: 2025-10-21
**Version**: 1.0.0
**Autor**: Claude Code
