# 🔧 Backend Articles API - Implementierung Abgeschlossen

**Datum:** 2025-10-17
**Status:** ✅ **COMPLETE**

---

## 📊 Zusammenfassung

Die Artikel-Verwaltungs-API wurde vollständig implementiert. Diese API ermöglicht es, gecrawlte Produkte zu speichern, zu verwalten und zu bearbeiten, bevor Labels generiert werden.

---

## 🗄️ Datenbank-Schema

### Neue Tabelle: `products`

```prisma
model Product {
  id            String   @id @default(uuid())

  // Core product data
  articleNumber String   @unique
  productName   String
  description   String?  @db.Text

  // Pricing
  price         Float
  tieredPrices  Json?    // [{quantity: 10, price: 45.99}, ...]
  currency      String   @default("EUR")

  // Images
  imageUrl      String?  // Product image from shop
  thumbnailUrl  String?  // Thumbnail version

  // Additional data
  ean           String?
  category      String?
  manufacturer  String?

  // Source information
  sourceUrl     String   // Original product URL
  crawlJobId    String?  // Which crawl job found this product

  // OCR confidence
  ocrConfidence Float?   // 0-1

  // Status
  verified      Boolean  @default(false) // Manual verification
  published     Boolean  @default(true)  // Show in article list

  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("products")
  @@index([articleNumber])
  @@index([crawlJobId])
  @@index([published])
  @@index([createdAt])
}
```

---

## 🚀 API Endpoints

### Base URL: `http://localhost:3001/api/articles`

### 1. GET `/api/articles`
**List alle Produkte mit Pagination, Filterung und Suche**

**Query Parameters:**
- `page` (number, default: 1) - Seite
- `limit` (number, default: 20, max: 100) - Anzahl pro Seite
- `search` (string) - Suche in Artikelnummer, Name, Beschreibung
- `category` (string) - Filter nach Kategorie
- `verified` (boolean) - Filter nach Verifikationsstatus
- `published` (boolean) - Filter nach Veröffentlichungsstatus
- `sortBy` (enum) - Sortierung: 'createdAt', 'updatedAt', 'articleNumber', 'productName', 'price'
- `sortOrder` (enum) - Sortierreihenfolge: 'asc', 'desc'

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "articleNumber": "FIR-001",
      "productName": "Duftöl Rose",
      "description": "Premium Rosenöl...",
      "price": 49.99,
      "tieredPrices": [
        { "quantity": 10, "price": 45.99 },
        { "quantity": 50, "price": 42.99 }
      ],
      "currency": "EUR",
      "imageUrl": "https://...",
      "thumbnailUrl": "https://...",
      "ean": "1234567890123",
      "category": "Duftöle",
      "manufacturer": "Firmenich",
      "sourceUrl": "https://shop.firmenich.de/product-1",
      "crawlJobId": "uuid",
      "ocrConfidence": 0.95,
      "verified": true,
      "published": true,
      "createdAt": "2025-01-17T10:30:00Z",
      "updatedAt": "2025-01-17T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 2. GET `/api/articles/stats`
**Statistiken über Produkte**

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "withImages": 142,
    "verified": 120,
    "published": 148,
    "categories": [
      { "name": "Duftöle", "count": 45 },
      { "name": "Essenzen", "count": 38 }
    ]
  }
}
```

### 3. GET `/api/articles/:id`
**Einzelnes Produkt abrufen**

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "articleNumber": "FIR-001",
    ...
  }
}
```

### 4. POST `/api/articles`
**Neues Produkt erstellen**

**Request Body:**
```json
{
  "articleNumber": "FIR-001",
  "productName": "Duftöl Rose",
  "description": "Premium Rosenöl...",
  "price": 49.99,
  "tieredPrices": [
    { "quantity": 10, "price": 45.99 }
  ],
  "currency": "EUR",
  "imageUrl": "https://...",
  "sourceUrl": "https://shop.firmenich.de/product-1"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

### 5. PUT `/api/articles/:id`
**Produkt aktualisieren**

**Request Body:** (Alle Felder optional)
```json
{
  "productName": "Neuer Name",
  "price": 54.99,
  "verified": true
}
```

### 6. DELETE `/api/articles/:id`
**Produkt löschen**

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### 7. POST `/api/articles/bulk-delete`
**Mehrere Produkte löschen**

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deleted 3 products",
  "deletedCount": 3
}
```

### 8. POST `/api/articles/bulk-update`
**Mehrere Produkte aktualisieren**

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2"],
  "data": {
    "verified": true,
    "category": "Premium"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Updated 2 products",
  "updatedCount": 2
}
```

### 9. POST `/api/articles/export`
**Produkte als CSV/JSON exportieren**

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2"],  // Optional, ohne IDs = alle exportieren
  "format": "csv"  // oder "json"
}
```

**Response (CSV):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="articles-2025-01-17.csv"

"Artikelnummer","Produktname","Beschreibung","Preis","Staffelpreise","Währung",...
"FIR-001","Duftöl Rose","Premium Rosenöl",49.99,"[{quantity:10,price:45.99}]","EUR",...
```

**Response (JSON):**
```json
{
  "success": true,
  "data": [ ... ]
}
```

---

## 🛠️ Product Service

### `ProductService.createOrUpdateFromOcr()`
Erstellt oder aktualisiert ein Produkt aus OCR-Ergebnissen.

```typescript
const product = await ProductService.createOrUpdateFromOcr({
  ocrResult: ocrData,
  screenshot: screenshotData,
  crawlJobId: 'uuid'
});
```

### `ProductService.batchCreateFromOcr()`
Batch-Erstellung von Produkten aus mehreren OCR-Ergebnissen.

```typescript
const results = await ProductService.batchCreateFromOcr(ocrResults, crawlJobId);
// returns: { created: 45, updated: 3, skipped: 2, errors: 0 }
```

### `ProductService.processOcrResultsFromCrawlJob()`
Verarbeitet alle OCR-Ergebnisse eines Crawl-Jobs und erstellt Produkte.

```typescript
const results = await ProductService.processOcrResultsFromCrawlJob(crawlJobId);
```

---

## 🎨 Frontend Integration

### API Client (`articlesApi`)

```typescript
import { articlesApi } from '@/services/api';

// Alle Artikel abrufen
const articles = await articlesApi.getAll({ page: 1, limit: 50, search: 'Rose' });

// Statistiken abrufen
const stats = await articlesApi.getStats();

// Artikel erstellen
const newArticle = await articlesApi.create({ ... });

// Artikel aktualisieren
const updated = await articlesApi.update('uuid', { price: 54.99 });

// Artikel löschen
await articlesApi.delete('uuid');

// Bulk löschen
await articlesApi.bulkDelete(['uuid1', 'uuid2']);

// Bulk update
await articlesApi.bulkUpdate(['uuid1', 'uuid2'], { verified: true });

// Export
const blob = await articlesApi.export(['uuid1'], 'csv');
```

### React Query Integration

```typescript
// In Articles.tsx
const { data, isLoading } = useQuery({
  queryKey: ['articles', { page, search }],
  queryFn: () => articlesApi.getAll({ page, search }),
});

const deleteMutation = useMutation({
  mutationFn: articlesApi.delete,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  },
});
```

---

## 📁 Dateistruktur

```
backend/
├── prisma/
│   └── schema.prisma                 ✅ Erweitert mit Product Model
├── src/
│   ├── api/
│   │   └── routes/
│   │       └── articles.ts           ✅ NEU! Alle API Endpoints
│   ├── services/
│   │   └── product-service.ts        ✅ NEU! Product Management Service
│   └── index.ts                      ✅ Route registriert

frontend/
├── src/
│   ├── pages/
│   │   └── Articles.tsx              ✅ Aktualisiert mit echter API
│   └── services/
│       └── api.ts                    ✅ Erweitert mit articlesApi
```

---

## 🔄 Workflow: Von Crawl zu Artikel

```
1. Shop Automation startet
   ↓
2. Crawler läuft durch alle Produktseiten
   ↓
3. Screenshots werden gemacht & gespeichert
   ↓
4. OCR extrahiert Daten (Art.Nr., Preis, etc.)
   ↓
5. ProductService.processOcrResultsFromCrawlJob()
   ↓
6. Produkte werden in `products` Tabelle gespeichert
   ↓
7. Artikel-Seite zeigt alle Produkte
   ↓
8. Benutzer wählt Artikel aus
   ↓
9. Labels werden generiert
```

---

## ✅ Features

### Suche & Filter
- ✅ Volltextsuche in Artikelnummer, Name, Beschreibung
- ✅ Filter nach Kategorie
- ✅ Filter nach Verifikationsstatus
- ✅ Filter nach Veröffentlichungsstatus
- ✅ Sortierung nach verschiedenen Feldern

### CRUD Operations
- ✅ Create (einzeln & batch)
- ✅ Read (einzeln & paginiert)
- ✅ Update (einzeln & batch)
- ✅ Delete (einzeln & batch)

### Export
- ✅ CSV Export (mit BOM für Excel)
- ✅ JSON Export
- ✅ Export ausgewählter Artikel
- ✅ Export aller Artikel

### UI Features
- ✅ Excel/DB-ähnliche Tabellen-Ansicht
- ✅ Checkbox-Auswahl (einzeln & alle)
- ✅ Bulk Actions (Löschen, Update, Export)
- ✅ Pagination
- ✅ Loading States
- ✅ Error States
- ✅ Empty States mit CTA
- ✅ Statistiken Dashboard
- ✅ Bilder-Preview
- ✅ Link zum Original-Shop
- ✅ Staffelpreise Anzeige

---

## 🧪 Testen

### Manueller Test

```bash
# Backend starten
cd backend
npm run dev

# Test: Liste alle Artikel
curl http://localhost:3001/api/articles

# Test: Statistiken
curl http://localhost:3001/api/articles/stats

# Test: Artikel erstellen
curl -X POST http://localhost:3001/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "articleNumber": "TEST-001",
    "productName": "Test Produkt",
    "price": 29.99,
    "sourceUrl": "https://example.com/product"
  }'

# Test: Export
curl -X POST http://localhost:3001/api/articles/export \
  -H "Content-Type: application/json" \
  -d '{"format": "csv"}' \
  -o articles.csv
```

### Frontend Test

1. Öffne: `http://localhost:5173/articles`
2. Teste Suche, Filter, Auswahl
3. Teste Bulk Actions
4. Teste Export
5. Teste Labels Generierung

---

## 📝 TODO / Zukünftige Erweiterungen

- [ ] Batch-Edit Modal (mehrere Artikel gleichzeitig bearbeiten)
- [ ] Advanced Filters (Preis-Range, Datum-Range)
- [ ] Duplikat-Erkennung
- [ ] Import von CSV/Excel
- [ ] Bilder-Upload
- [ ] Kategorie-Management
- [ ] Artikel-Vergleich
- [ ] Audit Log (Änderungshistorie)

---

## ✅ Status

**API:** ✅ 100% Complete
**Frontend:** ✅ 100% Complete
**Service:** ✅ 100% Complete
**Dokumentation:** ✅ Complete

Die Artikel-API ist vollständig implementiert und einsatzbereit! 🚀
