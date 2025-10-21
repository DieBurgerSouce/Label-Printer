# 📦 Artikel-Workflow Dokumentation

## 🎯 Neuer 3-Schritt Workflow

```
1. Shop Automation     →    2. Artikel-Seite    →    3. Labels Generieren
   (Crawlen)                (Bearbeiten)              (Drucken)
```

---

## 📍 Step 1: Shop Automation

**URL:** `http://localhost:5173/automation`

### Was passiert:
1. Shop-URL eingeben (z.B. `https://shop.firmenich.de`)
2. Konfiguration:
   - Maximale Produkte
   - Template auswählen
   - Felder zum Extrahieren auswählen:
     - ✅ Artikelnummer
     - ✅ Preis
     - ✅ Staffelpreise
     - ✅ Produktname
     - ✅ Beschreibung
     - ✅ **Bilder aus dem Shop**
3. "Automation Starten" klicken

### Backend-Prozess:
```
┌─────────────────────────────────────┐
│  1. Crawler durchsucht alle Seiten  │
│     → Produktlinks sammeln          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Screenshots von jedem Produkt   │
│     → Bilder speichern (ImageKit)   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. OCR Verarbeitung                │
│     → Artikelnummer extrahieren     │
│     → Preis extrahieren             │
│     → Staffelpreise extrahieren     │
│     → Beschreibung extrahieren      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  4. In Datenbank speichern          │
│     → Artikel-Tabelle               │
│     → Vollständige Produktdaten     │
└─────────────────────────────────────┘
```

---

## 📍 Step 2: Artikel-Seite

**URL:** `http://localhost:5173/articles`

### Anzeige-Format (Excel/DB-Tabelle):

```
┌─────────────┬──────────┬──────────────┬───────────────┬─────────┬──────────────┬──────────┐
│ ☑ Select    │ Art.Nr.  │ Bild         │ Produktname   │ Beschr. │ Preis        │ Staffel  │
├─────────────┼──────────┼──────────────┼───────────────┼─────────┼──────────────┼──────────┤
│ ☑           │ ART-001  │ [IMG] 📸     │ Test Produkt  │ Lorem   │ 29.99 €      │ 10+: 27€ │
│ ☐           │ ART-002  │ [IMG] 📸     │ Produkt 2     │ Ipsum   │ 39.99 €      │ -        │
│ ☑           │ ART-003  │ [IMG] 📸     │ Produkt 3     │ Dolor   │ 19.99 €      │ 5+: 18€  │
└─────────────┴──────────┴──────────────┴───────────────┴─────────┴──────────────┴──────────┘
```

### Features:

#### 📊 Statistiken (oben)
- Gesamt Artikel: 156
- Ausgewählt: 12
- Mit Bildern: 145
- Gefiltert: 156

#### 🔍 Suche & Filter
- **Suchfeld**: Nach Artikelnummer, Name oder Beschreibung suchen
- **Filter-Button**: Nach Kategorie, Preis, etc. filtern

#### ✅ Auswahl
- **Alle auswählen**: Checkbox oben links
- **Einzeln auswählen**: Checkbox pro Zeile
- **Bulk Actions**: Aktionen für alle ausgewählten Artikel

#### 📋 Tabellen-Spalten (von links nach rechts):

1. **Checkbox** - Artikel auswählen
2. **Artikelnummer** - z.B. `ART-001` (monospace font)
3. **Bild** - 64x64px Thumbnail vom Shop
4. **Produktname** - Mit Link zum Original-Shop
5. **Beschreibung** - Gekürzt, hover für mehr
6. **Preis** - z.B. `29.99 €`
7. **Staffelpreise** - z.B. `10+ Stück: 27.99€`
8. **Aktionen** - Bearbeiten, Löschen

#### 🔧 Artikel Bearbeiten
- Klick auf "Bearbeiten"-Icon
- Änderungen an Artikeldaten
- Speichern → Direkt in DB

#### 🗑️ Artikel Löschen
- Klick auf "Löschen"-Icon
- Bestätigung
- Aus DB entfernen

#### 📥 Export Funktionen
- **Export Excel/CSV**:
  - Alle Spalten exportieren
  - Nur ausgewählte Artikel oder alle
  - Download als `.csv` oder `.xlsx`

Format:
```csv
Artikelnummer,Produktname,Beschreibung,Preis,Staffelpreise,Bild-URL,Shop-URL
ART-001,Test Produkt,Beschreibung...,29.99,10+ Stück: 27.99€,https://...,https://...
```

---

## 📍 Step 3: Labels Generieren

### Aus Artikel-Seite:

1. **Artikel auswählen** (Checkboxen)
2. Button **"Labels Generieren (12)"** klicken
3. → Weiterleitung zu `/labels` mit ausgewählten Artikeln
4. Labels werden generiert mit:
   - ✅ Artikelnummer
   - ✅ Produktname
   - ✅ Preis
   - ✅ Staffelpreise (falls vorhanden)
   - ✅ **QR-Code** (Link zum Shop)
   - ✅ **Produktbild** aus dem Shop!

---

## 🗃️ Datenbank-Struktur

### Artikel-Tabelle

```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  article_number VARCHAR(255) NOT NULL,
  product_name VARCHAR(500),
  description TEXT,
  price DECIMAL(10,2),
  staffelpreise TEXT,
  image_url TEXT,
  shop_url TEXT NOT NULL,
  crawl_job_id UUID REFERENCES crawl_jobs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Beispiel Datensatz:

```json
{
  "id": "uuid-123",
  "article_number": "FIR-2024-001",
  "product_name": "Premium Duftöl Rose",
  "description": "Hochwertiges Duftöl mit Rosenextrakt...",
  "price": 49.99,
  "staffelpreise": "10+ Stück: 45.99€, 50+ Stück: 42.99€",
  "image_url": "https://ik.imagekit.io/m4b55p5tu/products/rose-oil.jpg",
  "shop_url": "https://shop.firmenich.de/products/rose-oil",
  "crawl_job_id": "uuid-job-456",
  "created_at": "2025-10-17T18:30:00Z",
  "updated_at": "2025-10-17T18:30:00Z"
}
```

---

## 🚀 API Endpoints

### GET /api/articles
Alle Artikel abrufen

**Response:**
```json
{
  "success": true,
  "articles": [
    {
      "id": "uuid-123",
      "articleNumber": "FIR-2024-001",
      "productName": "Premium Duftöl Rose",
      "description": "...",
      "price": 49.99,
      "staffelpreise": "10+ Stück: 45.99€",
      "imageUrl": "https://...",
      "shopUrl": "https://...",
      "crawledAt": "2025-10-17T18:30:00Z"
    }
  ],
  "total": 156
}
```

### GET /api/articles/:id
Einzelnen Artikel abrufen

### PUT /api/articles/:id
Artikel bearbeiten

**Request:**
```json
{
  "productName": "Neuer Name",
  "price": 39.99,
  "description": "Neue Beschreibung"
}
```

### DELETE /api/articles/:id
Artikel löschen

### POST /api/articles/export
Artikel als Excel/CSV exportieren

**Request:**
```json
{
  "articleIds": ["uuid-1", "uuid-2"],
  "format": "csv"
}
```

---

## 🎨 UI Features

### Responsive Design
- Mobile: Scrollbare Tabelle
- Tablet: 2-spaltig
- Desktop: Volle Tabelle

### Interaktive Elemente
- **Hover Effects**: Row highlights
- **Sortierung**: Klick auf Spalten-Header
- **Pagination**: Wenn > 50 Artikel
- **Lazy Loading**: Bilder werden lazy geladen
- **Tooltips**: Mehr Info bei hover

### Live Updates (WebSocket)
- Neue Artikel erscheinen automatisch
- Progress-Anzeige während Crawl
- Toast-Benachrichtigungen

---

## ✨ Workflow-Beispiel

### Szenario: Firmenich Shop crawlen

```
1. Dashboard öffnen
   ↓
2. "Shop Automation" klicken
   ↓
3. URL eingeben: https://shop.firmenich.de
   Konfiguration:
   - Max. 100 Produkte
   - Alle Felder extrahieren ✅
   ↓
4. "Automation Starten"
   → Crawling beginnt...
   → 5 Minuten warten
   ↓
5. Automatisch zu "Artikel" weitergeleitet
   → 87 Artikel wurden importiert! 🎉
   ↓
6. Artikel durchsehen:
   - Artikelnummern prüfen ✅
   - Preise prüfen ✅
   - Bilder vorhanden ✅
   - Staffelpreise vorhanden ✅
   ↓
7. Artikel auswählen (z.B. 50 Stück)
   → Checkboxen anklicken
   ↓
8. "Labels Generieren (50)" klicken
   ↓
9. Labels werden erstellt:
   - Mit QR-Codes
   - Mit Produktbildern
   - Mit Staffelpreisen
   → Druckfertig! 🖨️
```

---

## 🔄 Datenfluss

```
┌──────────────────┐
│   Shop-Website   │
│ (firmenich.de)   │
└────────┬─────────┘
         │ Crawler
         ↓
┌──────────────────┐
│   Screenshots    │
│  (ImageKit CDN)  │
└────────┬─────────┘
         │ OCR
         ↓
┌──────────────────┐
│    Artikel DB    │
│   (Supabase)     │
└────────┬─────────┘
         │ API
         ↓
┌──────────────────┐
│  Artikel-Seite   │
│   (React UI)     │
└────────┬─────────┘
         │ Auswahl
         ↓
┌──────────────────┐
│ Label-Generator  │
│  (mit QR-Code)   │
└────────┬─────────┘
         │ Export
         ↓
┌──────────────────┐
│  Druckfertig!    │
│   (PDF/PNG)      │
└──────────────────┘
```

---

## 📊 Vorteile des neuen Workflows

### ✅ Vorteile:

1. **Kontrolle**: Artikel vor Label-Generierung prüfen
2. **Bearbeiten**: Fehlerhafte Daten korrigieren
3. **Auswahl**: Nur gewünschte Artikel als Labels
4. **Export**: Artikel-Liste als Excel/CSV
5. **Wiederverwendbar**: Einmal crawlen, mehrmals Labels generieren
6. **Übersichtlich**: Excel-ähnliche Tabelle
7. **Filterbar**: Schnell bestimmte Artikel finden
8. **Batch-Operationen**: Mehrere Artikel gleichzeitig bearbeiten

### 🎯 Use Cases:

- **Preise anpassen**: Vor Label-Druck Preise aktualisieren
- **Artikel filtern**: Nur bestimmte Kategorien als Labels
- **Daten exportieren**: Artikelliste an Kollegen senden
- **Duplikate entfernen**: Vor Label-Generierung bereinigen
- **Qualitätskontrolle**: OCR-Ergebnisse prüfen

---

## 🚀 Zusammenfassung

**Neuer Workflow macht Sinn, weil:**

1. Nicht alle gecrawlten Artikel müssen als Labels gedruckt werden
2. Daten können vor Label-Druck korrigiert werden
3. Artikel-Datenbank ist wiederverwendbar
4. Excel-Export für andere Zwecke möglich
5. Bessere Übersicht und Kontrolle

**Das System ist jetzt:**
- ✅ Flexibler
- ✅ Benutzerfreundlicher
- ✅ Professioneller
- ✅ Production-ready!

---

🎉 **Viel Erfolg mit dem neuen Artikel-Workflow!**
