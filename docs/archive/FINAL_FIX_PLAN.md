# Screenshot-Fix: Der wahre Plan (ehrlich)

## 🔍 Die Fakten (aus echter Analyse)

### Layout 1: Einfacher Preis
**Beispiel**: https://shop.firmenich.de/CAS/Akku-fuer-PR-II-und-SW-II

```
✓ Selector: .product-detail-price
  Tag: P
  Position: (48, 1073)
  Size: 704x38
  Text: "19,61 €*"
```

### Layout 2: Staffelpreis-Tabelle
**Beispiel**: https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt

```
✓ Selector: table.product-block-prices-grid
  Tag: TABLE
  Position: (48, 1169)
  Size: 704x208
  Text: "Anzahl... Stückpreis..."
```

---

## ❌ DAS PROBLEM

**Aktueller Code** (web-crawler-service.ts:866):
```typescript
{ type: 'price', selector: 'table.product-block-prices-grid', fallback: '.product-price' }
```

**Was passiert**:
1. Code sucht nach `table.product-block-prices-grid` ✅ (funktioniert für Staffelpreise)
2. Wenn nicht gefunden → Fallback zu `.product-price` ❌ **FALSCHER SELECTOR!**
3. `.product-price` existiert NICHT → Element nicht gefunden → KEIN Screenshot

**Der richtige Fallback**: `.product-detail-price` (NICHT `.product-price`)

---

## ✅ DIE LÖSUNG (simple)

### Fix 1: Korrekter Fallback-Selector
**Datei**: `backend/src/services/web-crawler-service.ts`
**Zeile**: 866

**Ändern von**:
```typescript
{ type: 'price', selector: 'table.product-block-prices-grid', fallback: '.product-price' }
```

**Ändern zu**:
```typescript
{ type: 'price', selector: 'table.product-block-prices-grid', fallback: '.product-detail-price' }
```

**Das war's.** Das ist der Hauptfehler.

---

## 🐛 Weitere Probleme (bestätigt)

### Problem 2: Overlays bei Staffelpreis-Screenshots
**Symptom**: Weißes Popup unten links in Preis-Screenshots
**Ursache**: Beratungs-Popups/Chat-Widgets erscheinen während Screenshot
**Position Preis-Tabelle**: Y=1169px (weit unten → viel scrollen → Overlays erscheinen)

**Lösung bereits implementiert** (Zeilen 885-900):
- Scroll zu Element
- Overlay-Schließung
- Wartezeiten

**Status**: ✅ Bereits im Code, aber muss getestet werden

### Problem 3: Cookie-Banner
**Status**: ✅ GELÖST (neue acceptCookies Funktion funktioniert)

---

## 📋 Implementierungs-Plan (realistisch)

### Schritt 1: Selector-Fix (1 Zeile ändern) ⭐ KRITISCH
```typescript
// Zeile 866
{ type: 'price', selector: 'table.product-block-prices-grid', fallback: '.product-detail-price' }
```

**Erwartung**: 95% der fehlenden Preis-Screenshots sollten jetzt funktionieren

### Schritt 2: Robuste Element-Suche
**Problem**: Element ist weit unten (Y=1073 bzw Y=1169), könnte lazy-loaded sein

**Lösung**:
```typescript
// VOR Zeile 874: Explizit auf Preis-Element warten
if (elementConfig.type === 'price') {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
  } catch (e) {
    if (elementConfig.fallback) {
      await page.waitForSelector(elementConfig.fallback, { timeout: 3000 });
    }
  }
}
```

### Schritt 3: Scroll für ALLE Elemente (nicht nur price)
**Warum**: Alle Target-Elemente können lazy-loaded sein

```typescript
// NACH Zeile 878, VOR dem "if (!element)" Check
if (element) {
  // Scroll element into view
  await element.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await new Promise(r => setTimeout(r, 500)); // Wait for lazy loading
}
```

### Schritt 4: Globales Overlay-Management
**Neue Funktion** (vor captureTargetedScreenshots):

```typescript
private async closeAllOverlays(page: Page): Promise<void> {
  const overlaySelectors = [
    'button[aria-label*="Close" i]',
    'button[aria-label*="Schließen" i]',
    '.modal-close',
    '.popup-close',
    '.overlay-close',
    '.offcanvas-close',
    '[class*="chat"]',
  ];

  for (const sel of overlaySelectors) {
    try {
      const elements = await page.$$(sel);
      for (const el of elements) {
        const box = await el.boundingBox();
        if (box) {
          await el.click();
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (e) {
      // Continue
    }
  }
}
```

**Aufruf**: In captureTargetedScreenshots, NACH Zeile 869 (vor Schleife):
```typescript
await this.closeAllOverlays(page);
```

### Schritt 5: Debug-Logging (optional, für Validierung)
```typescript
// NACH Zeile 874
console.log(`🔍 [${elementConfig.type}] Searching...`);
const element = await page.$(selector);
console.log(`   Primary (${selector}): ${element ? '✓' : '✗'}`);

if (!element && elementConfig.fallback) {
  element = await page.$(elementConfig.fallback);
  console.log(`   Fallback (${elementConfig.fallback}): ${element ? '✓' : '✗'}`);
}
```

---

## 🎯 Test-Plan

### Test 1: Quick Fix Validation
**Nach Schritt 1** (nur Selector-Fix):
- Test-Crawl mit 5 Produkten (2 einfach, 3 Staffelpreis)
- **Erwartung**: Alle 5 haben jetzt price-Screenshots

### Test 2: Overlay-Check
**Nach Schritt 4** (Overlay-Management):
- Prüfe 10 zufällige price-Screenshots
- **Erwartung**: <1 hat Overlays

### Test 3: Vollständiger Crawl
**Nach allen Schritten**:
- Crawl mit 50 Produkten
- **Erwartung**: >95% haben vollständige 5 Screenshots

---

## 📊 Erfolgs-Metriken

| Was | Vorher | Ziel | Messung |
|-----|--------|------|---------|
| Produkte MIT price-Screenshot | ~0% | >95% | Anzahl *_price.png Dateien |
| Screenshots MIT Cookie-Banner | 100% | 0% | Manuelle Stichprobe (10 Bilder) |
| Screenshots MIT Overlays | ~100% | <5% | Manuelle Stichprobe (10 price.png) |
| Vollständige Sets (5 Screenshots) | ~20% | >90% | Zähle Produkte mit 5 Dateien |

---

## 🚀 Priorisierung

**MUST HAVE** (kritisch):
- ✅ Schritt 1: Selector-Fix (`.product-detail-price`)

**SHOULD HAVE** (wichtig):
- ✅ Schritt 2: waitForSelector für robustes Finden
- ✅ Schritt 3: Scroll für alle Elemente

**NICE TO HAVE** (optional):
- ⚠️ Schritt 4: Overlay-Management (bereits teilweise implementiert)
- ⚠️ Schritt 5: Debug-Logging (nur für Diagnose)

---

## ⏱️ Zeitschätzung

- **Schritt 1**: 30 Sekunden (1 Zeile ändern)
- **Schritt 2**: 5 Minuten (waitForSelector hinzufügen)
- **Schritt 3**: 5 Minuten (Scroll-Logik)
- **Schritt 4**: 10 Minuten (neue Funktion + Integration)
- **Schritt 5**: 5 Minuten (Debug-Logging)
- **Test 1**: 2 Minuten (Quick test)
- **Test 2**: 5 Minuten (Overlay-Check)
- **Test 3**: 10 Minuten (Full crawl + validation)

**Total**: ~45 Minuten

---

## 💡 Warum es bisher nicht funktionierte

1. **Falscher Fallback-Selector**: Code suchte `.product-price`, korrekt ist `.product-detail-price`
2. **Keine Wartezeit**: Elemente sind lazy-loaded, brauchen `waitForSelector`
3. **Overlays erscheinen während Scroll**: Staffelpreis-Tabelle ist weit unten, beim Scrollen triggern Overlays

**Der Haupt-Grund**: Punkt 1 - ein simpler Tippfehler/falscher Selector.

---

## ✅ Start

**Beginne mit**: Schritt 1 (Selector-Fix)
**Datei**: `backend/src/services/web-crawler-service.ts`
**Zeile**: 866
**Änderung**: `.product-price` → `.product-detail-price`

Nach dem Fix: Sofort Test-Crawl!
