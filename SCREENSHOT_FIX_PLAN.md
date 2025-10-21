# Screenshot-Probleme: Analyse & Lösungsplan

## 🔍 Probleme (Aktueller Stand)

### 1. ✅ Cookie-Banner Problem - GELÖST
- **Problem**: Cookie-Banner wurde NICHT akzeptiert, erschien in allen Screenshots
- **Ursache**: Code verwendete Playwright-Syntax (`:has-text()`) statt Puppeteer XPath
- **Lösung**: Neue `acceptCookies()` Funktion mit XPath-Suche implementiert
- **Status**: ✅ Funktioniert jetzt! (siehe Test-Crawl 4a9f09d9)

### 2. ❌ Preis-Screenshots - KRITISCHES PROBLEM
- **Problem**: Keine/wenige Preis-Screenshots werden erstellt
- **Symptome**:
  - Crawl c45af749: 0 von ~50 Produkten haben `_price.png` Screenshot
  - Bei vorhandenen Preis-Screenshots: Overlays/Popups in der Ecke sichtbar
- **Ursache**:
  - Selector findet Element NICHT (oder zu spät)
  - Overlays/Popups blockieren den Screenshot

### 3. ⚠️ Inkonsistenz bei Screenshots
- **Problem**: Manche Produkte haben 1, 4 oder 5 Screenshots
- **Beispiel** (Crawl c45af749):
  - Produkt 1: 5 Screenshots (vollständig)
  - Produkt 2: 4 Screenshots (fehlt: price)
  - Produkt 3: 1 Screenshot (nur product-image)

---

## 📊 Analyse-Ergebnisse (shop.firmenich.de)

### Erfolgreiche Preis-Tabellen-Analyse
Test-URL: `https://shop.firmenich.de/Kartons/Spargelkarton-5-kg-neutral-bedruckt`

**Gefundene Preis-Elemente:**
```
✓ Selector: table.product-block-prices-grid
  - Tag: TABLE
  - Class: "table product-block-prices-grid"
  - Position: (48, 1169), Größe: 704x208
  - 5 Reihen (Staffelpreise)
  - SICHTBAR und funktionsfähig

✓ Alle Preis-Klassen gefunden:
  - product-block-prices
  - product-block-prices-grid
  - product-block-prices-body
  - product-block-prices-cell
  - product-block-prices-row
  - product-block-prices-quantity
```

### Aktuelle Selectors im Code (web-crawler-service.ts:862-868)
```typescript
const elementsToCapture = [
  { type: 'product-image', selector: 'img[itemprop="image"]', fallback: selectors.productImage },
  { type: 'article-number', selector: '[itemprop="sku"]', fallback: selectors.articleNumber },
  { type: 'title', selector: 'h1', fallback: selectors.productName },
  { type: 'price', selector: 'table.product-block-prices-grid', fallback: '.product-price' },
  { type: 'description', selector: '[itemprop="description"]', fallback: selectors.description },
];
```

**Bewertung**: ✅ Selector `table.product-block-prices-grid` ist KORREKT!

---

## 🐛 Root Cause: Warum keine Preis-Screenshots?

### Hypothese 1: Timing-Problem
- Preis-Tabelle lädt nach `networkidle0`
- Element existiert noch nicht, wenn `page.$()` aufgerufen wird
- **Lösung**: Explizites Warten auf Element mit `page.waitForSelector()`

### Hypothese 2: Lazy Loading
- Preis-Tabelle ist weit unten auf der Seite (Position Y: 1169px)
- Wird erst geladen, wenn in den Viewport gescrollt wird
- **Lösung**: Vor Screenshot zum Element scrollen, dann warten

### Hypothese 3: JavaScript-Rendering
- Preis-Tabelle wird durch JavaScript generiert
- Benötigt zusätzliche Zeit nach `networkidle0`
- **Lösung**: Generelles Delay nach Page-Load

### Hypothese 4: Overlays blockieren
- Beratungs-Popups, Chat-Widgets, Cookie-Reminder erscheinen
- Werden über Preis-Tabelle gelegt
- **Lösung**: Systematisches Schließen aller Overlays VOR Screenshots

---

## 🎯 Lösungsplan

### Phase 1: Debug & Diagnose
**Ziel**: Verstehen, WARUM Preis-Element nicht gefunden wird

1. **Debug-Logging hinzufügen**
   ```typescript
   // In captureTargetedScreenshots() NACH Zeile 874
   console.log(`🔍 Searching for ${elementConfig.type}:`);
   console.log(`   Primary: ${selector}`);
   console.log(`   Fallback: ${elementConfig.fallback}`);

   const element = await page.$(selector);
   console.log(`   Found with primary? ${!!element}`);

   if (!element && elementConfig.fallback) {
     element = await page.$(elementConfig.fallback);
     console.log(`   Found with fallback? ${!!element}`);
   }
   ```

2. **HTML-Dump bei Fehler**
   ```typescript
   if (!element) {
     // Save page HTML for debugging
     const html = await page.content();
     const debugPath = path.join(this.screenshotsDir, jobId, `${screenshotId}_${elementConfig.type}_DEBUG.html`);
     await fs.writeFile(debugPath, html);
     console.log(`⚠️  Element not found, saved HTML to: ${debugPath}`);
   }
   ```

### Phase 2: Robuste Element-Suche
**Ziel**: Element zuverlässig finden, auch bei Lazy Loading

1. **Explizites Warten auf Preis-Element**
   ```typescript
   if (elementConfig.type === 'price') {
     try {
       // Wait up to 5 seconds for price table to appear
       await page.waitForSelector(selector, { timeout: 5000 });
       console.log(`✓ Price table appeared after waiting`);
     } catch (e) {
       console.log(`⚠️  Price table did not appear after 5s`);
       // Try fallback
       if (elementConfig.fallback) {
         await page.waitForSelector(elementConfig.fallback, { timeout: 3000 });
       }
     }
   }
   ```

2. **Scroll zu Element VOR Screenshot**
   ```typescript
   // Für ALLE Elemente, nicht nur price
   if (element) {
     await element.evaluate((el) => {
       el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
     });
     await new Promise(r => setTimeout(r, 500)); // Wait for scroll + lazy loading
   }
   ```

### Phase 3: Overlay-Management
**Ziel**: Alle störenden Popups/Overlays schließen

1. **Globales Overlay-Schließen vor ALLEN Screenshots**
   ```typescript
   // NEUE Funktion: closeAllOverlays()
   private async closeAllOverlays(page: Page): Promise<void> {
     const overlaySelectors = [
       // Close buttons
       'button[aria-label*="Close" i]',
       'button[aria-label*="Schließen" i]',
       '[class*="close"][class*="button" i]',
       '.modal-close',
       '.popup-close',
       '.overlay-close',
       '.offcanvas-close',

       // Chat widgets
       '#chat-widget-minimized',
       '.chat-bubble',
       '[class*="chat"][class*="widget"]',

       // Beratungs-Popups
       'button:has-text("Konfigurieren")',
       'button:has-text("Später")',
       'button:has-text("Nein danke")',
     ];

     for (const selector of overlaySelectors) {
       try {
         const elements = await page.$$(selector);
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

   // AUFRUF: In captureTargetedScreenshots() VOR der Schleife
   await this.closeAllOverlays(page);
   ```

### Phase 4: Spezielle Preis-Handling
**Ziel**: Preis-Screenshots ohne Overlays, vollständig sichtbar

1. **Erweiterte Preis-Screenshot-Logik**
   ```typescript
   if (elementConfig.type === 'price') {
     // 1. Scroll table into view (TOP alignment for tall tables)
     await element.evaluate((el) => {
       const height = el.offsetHeight;
       const alignment = height > 600 ? 'start' : 'center';
       el.scrollIntoView({ behavior: 'instant', block: alignment });
     });

     // 2. Wait for scroll
     await new Promise(r => setTimeout(r, 500));

     // 3. Close overlays AGAIN (might have appeared during scroll)
     await this.closeAllOverlays(page);

     // 4. Final wait for animations
     await new Promise(r => setTimeout(r, 300));
   }
   ```

### Phase 5: Fehler-Recovery
**Ziel**: Wenn Preis-Element fehlt, nicht den ganzen Crawl abbrechen

1. **Fehler-Handling verbessern**
   ```typescript
   // In captureTargetedScreenshots() - bereits vorhanden, aber:
   // NICHT bei fehlendem Element werfen, sondern nur loggen
   if (!element) {
     console.log(`⚠️  Element not found: ${elementConfig.type}`);
     // KEIN throw - einfach weiter mit nächstem Element
     continue;
   }
   ```

---

## 📋 Implementierungs-Checkliste

### Schritt 1: Debug-Version erstellen
- [ ] Debug-Logging zu captureTargetedScreenshots() hinzufügen
- [ ] HTML-Dump bei fehlenden Elementen speichern
- [ ] Test-Crawl mit 3 Produkten durchführen
- [ ] Logs analysieren: Welche Selectors funktionieren?

### Schritt 2: Element-Suche verbessern
- [ ] `waitForSelector()` für Preis-Element implementieren
- [ ] Scroll-to-Element für ALLE Screenshots hinzufügen
- [ ] Delay nach Scroll für Lazy Loading

### Schritt 3: Overlay-Management
- [ ] `closeAllOverlays()` Funktion erstellen
- [ ] Vor Screenshots aufrufen
- [ ] Nach Scroll zu Preis-Tabelle nochmal aufrufen

### Schritt 4: Preis-spezifische Fixes
- [ ] Intelligentes Alignment (start vs center) basierend auf Tabellenhöhe
- [ ] Mehrere Wartezeiten für Animationen
- [ ] Overlay-Schließung speziell für Preis-Screenshots

### Schritt 5: Validierung
- [ ] Test-Crawl mit 10 Produkten
- [ ] Prüfen: Wie viele haben Preis-Screenshots?
- [ ] Prüfen: Sind Overlays weg?
- [ ] Prüfen: Ist Cookie-Banner weg?

### Schritt 6: Vollständiger Crawl
- [ ] Crawl mit 50+ Produkten
- [ ] Statistik: % der Produkte mit vollständigen Screenshots
- [ ] Manuelle Prüfung von 10 zufälligen Preis-Screenshots

---

## 🎯 Erfolgs-Kriterien

| Metrik | Aktuell | Ziel |
|--------|---------|------|
| Cookie-Banner in Screenshots | 100% ❌ | 0% ✅ |
| Produkte MIT Preis-Screenshot | ~0% ❌ | >90% ✅ |
| Preis-Screenshots MIT Overlays | 100% ❌ | <5% ✅ |
| Vollständige Screenshot-Sets (5 Stück) | ~20% ❌ | >85% ✅ |

---

## 💡 Alternative Ansätze (falls Plan A nicht funktioniert)

### Plan B: Shopware-spezifische Selectors
Falls `table.product-block-prices-grid` inkonsistent ist:
- Verwende `.product-detail-buy` Container
- Finde ALLE Tabellen darin: `await page.$$('.product-detail-buy table')`
- Screenshot der ERSTEN sichtbaren Tabelle

### Plan C: Vollbild-Screenshot + Crop
Falls Elemente nicht isoliert werden können:
- Fullpage-Screenshot der Produktseite
- OCR auf GESAMTEM Bild
- Region-Detection für Preis-Tabelle via Bildverarbeitung

### Plan D: JavaScript-Extraktion
Falls Screenshots zu problematisch:
- Preis-Daten direkt aus DOM extrahieren (JavaScript)
- JSON mit Staffelpreisen erstellen
- Nur für Validierung/Backup Screenshots machen

---

## 🚀 Nächster Schritt

**START**: Schritt 1 der Checkliste - Debug-Logging implementieren

**Datei**: `backend/src/services/web-crawler-service.ts`
**Zeilen**: 853-950 (captureTargetedScreenshots Funktion)

Nach Debug-Crawl: Logs analysieren und Hypothese validieren!
