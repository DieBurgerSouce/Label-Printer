# 🔴 KRITISCHER IMPORT FIX - Job 226bbb3f

## AKTUELLE KATASTROPHE
- **Job ID:** 226bbb3f-d859-45eb-9d31-2e9832d024f3
- **Crawl Job ID:** c1ebc5c1-fd0f-4815-8567-16735dd18e8d
- **Status:** 1327 OCR completed, aber 0 Produkte in DB
- **Nach Reprocess:** Nur 770 von 1327 importiert, OHNE Preise/URLs!

## PROBLEM-ANALYSE

### 1. FEHLENDE HTML-DATEN (557 von 1327)
```bash
# Gefunden: 1337 Verzeichnisse
# Aber nur: 770 html-data.json Dateien
# Fehlen: 557 HTML-Extraktionen!
```

**URSACHE:** HTML-Extraction ist für 557 Artikel fehlgeschlagen oder wurde nicht ausgeführt!

### 2. FEHLERHAFTE DATEN BEI 770 IMPORTIERTEN
Die importierten Produkte haben:
- ❌ **price:** null oder 0 (obwohl html-data.json Preise hat!)
- ❌ **priceType:** nicht korrekt (auf_anfrage wird nicht erkannt)
- ❌ **sourceUrl:** '' (leerer String statt echter URL)
- ❌ **tieredPrices:** [] (leer obwohl Staffelpreise vorhanden)
- ❌ **QR-Code:** fehlt komplett

## SOFORT-FIX PLAN

### SCHRITT 1: Vollständige HTML-Extraction für ALLE 1337 Artikel
```javascript
// Für jedes Verzeichnis ohne html-data.json:
// 1. Screenshots laden
// 2. HTML-Extraction neu durchführen
// 3. html-data.json erstellen
```

### SCHRITT 2: Korrektes Reprocess-Script
```javascript
// FIX 1: sourceUrl aus Screenshot-Metadaten
const screenshotMeta = JSON.parse(fs.readFileSync(
  path.join(articlePath, 'screenshot-metadata.json')
));
const sourceUrl = screenshotMeta.productUrl || screenshotMeta.url;

// FIX 2: Preise korrekt mappen
const price = htmlData.priceType === 'auf_anfrage'
  ? null
  : (htmlData.price || 0);

// FIX 3: tieredPrices als JSON
const tieredPrices = htmlData.tieredPrices || [];

// FIX 4: QR-Code generieren
const qrCode = generateQRCode(sourceUrl);
```

### SCHRITT 3: Varianten korrekt verarbeiten
```javascript
// Artikel mit Größen-Varianten (S, M, L, XL, XXL, XXXL)
// Jede Variante = eigener DB-Eintrag mit suffix
// 7034 → 7034-S, 7034-M, 7034-L, etc.
```

## ERWARTETE RESULTATE NACH FIX

| Metrik | IST (Kaputt) | SOLL (Nach Fix) |
|--------|-------------|-----------------|
| Produkte in DB | 770 | ~1900 |
| Mit Preisen | 0 | ~1500 |
| "Auf Anfrage" | 0 | ~400 |
| Mit URLs | 0 | 1900 |
| Mit QR-Codes | 0 | 1900 |
| Varianten | ? | ~600 zusätzlich |

## KRITISCHE DATEIEN ZUM FIXEN

1. **backend/src/services/automation-service.ts**
   - Zeile 366-411: OCR Result Mapping
   - FIX: Korrekte Datenstruktur

2. **backend/src/services/product-service.ts**
   - Zeile 25-40: createProductFromOcr
   - FIX: Alle Felder korrekt mappen

3. **backend/src/services/html-extraction-service.ts**
   - FIX: Muss für ALLE 1337 Artikel laufen

4. **backend/reprocess-job-226bbb3f.js**
   - KOMPLETT NEU SCHREIBEN
   - Mit korrektem Mapping
   - Mit URL-Loading
   - Mit QR-Code Generation

## SOFORT-AKTIONEN

```bash
# 1. Fehlende HTML-Daten generieren
docker exec screenshot-algo-backend node generate-missing-html.js

# 2. Alle Produkte löschen (falsche Daten)
docker exec screenshot-algo-postgres psql -U postgres -d screenshot_algo \
  -c "DELETE FROM products WHERE \"crawlJobId\" = 'c1ebc5c1-fd0f-4815-8567-16735dd18e8d';"

# 3. Neu importieren mit korrektem Script
docker exec screenshot-algo-backend node reprocess-complete.js
```

## VERIFIZIERUNG

Nach dem Fix MUSS gelten:
```sql
SELECT COUNT(*),
       COUNT(CASE WHEN price > 0 THEN 1 END) as with_price,
       COUNT(CASE WHEN "priceType" = 'auf_anfrage' THEN 1 END) as auf_anfrage,
       COUNT(CASE WHEN "sourceUrl" != '' THEN 1 END) as with_url
FROM products
WHERE "crawlJobId" = 'c1ebc5c1-fd0f-4815-8567-16735dd18e8d';

-- Erwartung:
-- count: ~1900
-- with_price: ~1500
-- auf_anfrage: ~400
-- with_url: 1900
```

## TIMELINE
- **JETZT:** Analyse abgeschlossen
- **+10 Min:** HTML-Generation für fehlende 557
- **+20 Min:** Korrektes Import-Script fertig
- **+30 Min:** ALLE 1900 Produkte korrekt in DB
- **+35 Min:** Verifizierung & Test