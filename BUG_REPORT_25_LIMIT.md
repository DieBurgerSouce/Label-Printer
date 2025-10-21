# BUG REPORT: Crawler stoppt bei exakt 25 Artikeln

## PROBLEMBESCHREIBUNG
Der Crawler verarbeitet IMMER exakt 25 Artikel und stoppt dann, unabhängig von der Konfiguration oder der Anzahl verfügbarer Produkte.

## ROOT CAUSE ANALYSE

### Gefundene Stelle 1: BATCH_SIZE = 5 in automation-service.ts

**Datei**: `C:\Users\benfi\Screenshot_Algo\backend\src\services\automation-service.ts`
**Zeile**: 286

```typescript
const BATCH_SIZE = 5; // Process 5 screenshots at a time
```

Der OCR-Step verarbeitet Screenshots in Batches von jeweils 5:

```typescript
// Zeilen 285-383
// CRITICAL: Process in batches to avoid memory/worker exhaustion
const BATCH_SIZE = 5; // Process 5 screenshots at a time
let processed = 0;

// Split screenshots into batches
const batches: typeof uniqueScreenshots[] = [];
for (let i = 0; i < uniqueScreenshots.length; i += BATCH_SIZE) {
  batches.push(uniqueScreenshots.slice(i, i + BATCH_SIZE));
}

console.log(`  📦 Processing ${uniqueScreenshots.length} screenshots in ${batches.length} batches of ${BATCH_SIZE}...`);

for (const batch of batches) {
  console.log(`  🔄 Processing batch ${Math.floor(processed / BATCH_SIZE) + 1}/${batches.length}...`);
  
  const batchPromises = batch.map(async (screenshot) => {
    // ... OCR processing for each screenshot
    processed++;
    // ... status updates
  });
  
  // Wait for batch to complete before starting next batch
  await Promise.all(batchPromises);
  
  // Add delay between batches to let workers breathe
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### Gefundene Stelle 2: 5 elementMappings in ocr-service.ts

**Datei**: `C:\Users\benfi\Screenshot_Algo\backend\src\services\ocr-service.ts`
**Zeile**: 84-90

```typescript
const elementMappings = [
  { file: 'article-number.png', field: 'articleNumber', clean: true },
  { file: 'title.png', field: 'productName', clean: false },
  { file: 'description.png', field: 'description', clean: false },
  { file: 'price.png', field: 'price', clean: true },
  { file: 'price-table.png', field: 'tieredPrices', table: true }
];

for (const mapping of elementMappings) {
  // Process each element mapping...
}
```

### DIE MATHEMATIK DES BUGS

**BATCH_SIZE × elementMappings.length = 5 × 5 = 25**

Der Crawler verarbeitet:
- Batch 1: 5 Screenshots (5 elementMappings pro Screenshot = 25 Element-Verarbeitungen)
- Aber es verarbeitet auch nur 5 Batches, bevor...?

NEIN, das ist nicht es. Der Bug ist woanders!

### Gefundene Stelle 3: robustOCRService batchSize

**Datei**: `C:\Users\benfi\Screenshot_Algo\backend\src\services\robust-ocr-service.ts`
**Zeile**: 22

```typescript
const DEFAULT_CONFIG: OCRConfig = {
  maxRetries: 3,
  batchSize: 10,
  workerCount: 4,
  timeout: 30000
};
```

**ABER** wird dieser Service überhaupt genutzt in automation-service? Lassen Sie mich prüfen...

### ECHTE ROOT CAUSE - Element Processing Loop!

Die OCR-Service macht:
- **5 elementMappings** für JEDES Screenshot
- Diese werden SEQUENZIELL verarbeitet (Zeile 95: `for (const mapping of elementMappings)`)
- Pro Screenshot: 5 Element-Verarbeitungen

Wenn die Automation-Service mit **BATCH_SIZE = 5**:
- Pro Batch: 5 Screenshots
- Pro Screenshot: 5 Elements
- **Total pro Batch**: 5 × 5 = 25 Element-Verarbeitungen

## WAHRSCHEINLICHE FEHLERQUELLE: Worker-Erschöpfung oder Timeout

**Datei**: `C:\Users\benfi\Screenshot_Algo\backend\src\services\ocr-service.ts`
**Zeile**: 27

```typescript
private readonly maxWorkers = 4;
```

### DIE ECHTE MATHEMATIK:

```
Erste Batch (5 Screenshots):
- Screenshot 1: 5 Elements (Tesseract Worker 1 beginnt)
- Screenshot 2: 5 Elements (Tesseract Worker 2 beginnt)
- Screenshot 3: 5 Elements (Tesseract Worker 3 beginnt)
- Screenshot 4: 5 Elements (Tesseract Worker 4 beginnt)
- Screenshot 5: 5 Elements (⚠️ WORKER POOL VOLL - MUSS WARTEN!)

Wenn Worker nach 5 Screenshots hängen bleiben oder 1000ms delay (Zeile 382):
await new Promise(resolve => setTimeout(resolve, 1000));
```

## DER ECHTE BUG: Promise.all() mit maxWorkers=4 und Screenshots=5+

Wenn:
- BATCH_SIZE = 5 Screenshots
- maxWorkers = 4
- Jedes Screenshot = 5 Element-Prozesse (5 × 4 = 20 parallel Tasks)

**UND DANN**:
- Nach der ersten Batch: 1000ms delay
- Nach der zweiten Batch: 1000ms delay
- Nach jeder Batch braucht es Zeit, und wenn Elements nicht alle abgeschlossen sind...

## DIE VERMUTETE ROOT CAUSE

### Szenario A: Exception bei 25 Element-Verarbeitungen

```
Batch 1 (5 Screenshots × 5 Elements = 25):
  - Tesseract Worker 1 verarbeitet Elements 1-5
  - Tesseract Worker 2 verarbeitet Elements 6-10
  - Tesseract Worker 3 verarbeitet Elements 11-15
  - Tesseract Worker 4 verarbeitet Elements 16-20
  - ⚠️ Element 21-25: WORKER EXHAUSTED!
  
  Problem: Wenn nach 25 Elements ein Worker stirbt oder exception wirft,
  stoppt die gesamte Promise.all() und das Batch Processing hört auf!
```

### Szenario B: Hard Limit in Tesseract.js

Es könnte sein, dass Tesseract.js intern ein Limit von 25 Operationen pro Worker hat, bevor es einen Reset braucht.

### Szenario C: Memory oder Timeout nach 5 Batches

Nach 5 × 5 = 25 Verarbeitungen tritt ein memory limit oder prozess-timeout auf.

## VERDÄCHTIGE LINIEN IM CODE

1. **automation-service.ts:291-292** - Batch splitting
2. **automation-service.ts:300-376** - Batch processing loop
3. **automation-service.ts:379** - `await Promise.all(batchPromises);` 
4. **automation-service.ts:382** - `await new Promise(resolve => setTimeout(resolve, 1000));`
5. **ocr-service.ts:25-47** - Worker initialization (nur 4!)
6. **ocr-service.ts:95-134** - Element mapping loop
7. **ocr-service.ts:467-471** - Round-robin worker selection

## KOMMENDE SCHRITTE ZUM FIX

1. BATCH_SIZE erhöhen von 5 auf 10 oder 20
2. maxWorkers erhöhen von 4 auf 8
3. Der Delay zwischen Batches reduzieren
4. Exception handling verbessern in Promise.all()
5. Tesseract.js Worker Lifecycle prüfen
6. Log-Ausgaben vor/nach Promise.all() hinzufügen um zu sehen wo es stoppt

