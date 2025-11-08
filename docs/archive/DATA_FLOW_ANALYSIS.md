# 🔍 DATENFLUSS-ANALYSE - Warum Produkte nicht gespeichert werden

## VOLLSTÄNDIGER DATENFLUSS

### 1️⃣ HTML-Extraction Service
**File:** `backend/src/services/html-extraction-service.ts`

**Output Struktur:**
```typescript
{
  extractedData: {
    articleNumber: "7034",
    productName: "Pflanzenschutzhandschuh",
    description: "...",
    price: 12.50,
    priceType: "tiered",
    tieredPrices: [...],
    tieredPricesText: "ab 7 Stück: 10.00 EUR..."
  },
  confidence: { overall: 1.0, ... },
  status: "completed",
  screenshotId: "...",
  id: "..."
}
```

### 2️⃣ Automation Service (Phase 2.5)
**File:** `backend/src/services/automation-service.ts:395-412`

**Was es macht:**
```javascript
job.results.ocrResults.push({
  screenshotId: result.screenshotId,
  ocrResultId: result.id,
  extractedData: result.extractedData,  // ✅ Originaldaten

  // ❌ ÜBERFLÜSSIGES Top-Level Mapping (wird nicht verwendet!)
  articleNumber: result.extractedData?.articleNumber,
  productName: result.extractedData?.productName,
  price: result.extractedData?.price,
  priceType: result.extractedData?.priceType,
  // ...

  productUrl: screenshot.productUrl || screenshot.url, // ✅ Wichtig!
  confidence: result.confidence?.overall || 0.5,
  success: result.status === 'completed',
  status: result.status
} as any);
```

### 3️⃣ Product Service
**File:** `backend/src/services/product-service.ts:157-230`

**Was es erwartet:**
```javascript
// Line 177: Check
if (!ocrResult.extractedData?.articleNumber) {
  // ❌ SKIPPED! "Skipping product: No article number"
  return;
}

// Line 183: Extract
const extractedData = ocrResult.extractedData;

// Line 215-230: Create product
const productData = {
  articleNumber: extractedData.articleNumber,      // ✅ Von extractedData
  productName: extractedData.productName,          // ✅ Von extractedData
  price: extractedData.price,                      // ✅ Von extractedData
  priceType: extractedData.priceType,              // ✅ Von extractedData
  sourceUrl: ocrResult.productUrl || '...',        // ✅ Von top-level!
  // ...
};
```

## ❓ WARUM WURDEN KEINE PRODUKTE GESPEICHERT?

### Problem 1: Keine HTML-Data für 557 Artikel
- **1337 Verzeichnisse** existieren
- **Nur 770 html-data.json** Dateien
- **557 fehlen** komplett!

**Ursache:** HTML-Extraction wurde für 557 Artikel NICHT ausgeführt oder fehlgeschlagen!

### Problem 2: extractedData.articleNumber war undefined
**Log:** "Skipping product: No article number"

**Mögliche Ursachen:**
1. HTML-Extraction hat articleNumber NICHT gesetzt
2. Die Datenstruktur wurde falsch übergeben
3. result.extractedData war undefined

## 🔍 VERIFIKATION BENÖTIGT

### Check 1: Was gibt HTML-Extraction wirklich zurück?
```javascript
// In html-extraction-service.ts nach HTML load:
console.log('🔍 HTML Extraction Result:', {
  hasExtractedData: !!result.extractedData,
  articleNumber: result.extractedData?.articleNumber,
  productName: result.extractedData?.productName,
  priceType: result.extractedData?.priceType
});
```

### Check 2: Was kommt in automation-service an?
```javascript
// In automation-service.ts nach OCR processing:
console.log('🔍 Before push to ocrResults:', {
  resultType: typeof result,
  hasExtractedData: !!result.extractedData,
  articleNumber: result.extractedData?.articleNumber,
  fullResult: JSON.stringify(result).substring(0, 500)
});
```

### Check 3: Was bekommt product-service?
```javascript
// In product-service.ts:
console.log('🔍 Received in processOcrResultsFromAutomation:', {
  ocrResultsCount: ocrResults.length,
  firstResult: ocrResults[0] ? {
    hasExtractedData: !!ocrResults[0].extractedData,
    articleNumber: ocrResults[0].extractedData?.articleNumber,
    topLevelFields: Object.keys(ocrResults[0])
  } : null
});
```

## 🎯 GARANTIERTER FIX

### Strategie 1: Defensive Checks überall
```typescript
// In product-service.ts Line 177:
if (!ocrResult?.extractedData?.articleNumber && !ocrResult?.articleNumber) {
  // Try BOTH paths!
  console.log('⚠️ Skipping product: No article number', {
    hasOcrResult: !!ocrResult,
    hasExtractedData: !!ocrResult?.extractedData,
    extractedDataType: typeof ocrResult?.extractedData,
    fullOcrResult: JSON.stringify(ocrResult).substring(0, 200)
  });
  results.skipped++;
  continue;
}

// Use whichever exists
const extractedData = ocrResult.extractedData || ocrResult;
```

### Strategie 2: Ensure HTML-Extraction läuft für ALLE
```typescript
// In automation-service.ts after screenshots:
console.log(`📊 Phase 2 Summary:`);
console.log(`   📸 Screenshots created: ${uniqueScreenshots.length}`);
console.log(`   🔍 HTML extractions: TODO - verify ALL have html-data.json`);

// Add check:
const withoutHtml = uniqueScreenshots.filter(s => {
  const htmlPath = path.join(s.imagePath, '..', 'html-data.json');
  return !fs.existsSync(htmlPath);
});

if (withoutHtml.length > 0) {
  console.log(`⚠️ ${withoutHtml.length} screenshots missing HTML data - retrying...`);
  // RETRY HTML extraction for these!
}
```

## 📋 NÄCHSTE SCHRITTE

1. **Logging hinzufügen** zu allen 3 Services
2. **Neuen Test-Job starten** (10 Produkte)
3. **Logs analysieren** wo Daten verloren gehen
4. **Fix implementieren** basierend auf echten Daten
5. **Full Job starten** mit allen 1900 Artikeln