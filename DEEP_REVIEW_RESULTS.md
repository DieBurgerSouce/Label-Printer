# TIEFE DATENBANK-ANALYSE - ERGEBNISSE & FIXES

## 📊 ZUSAMMENFASSUNG

**Gesamte Produkte**: 49
**Problematische Produkte**: 4 (8%)  
**Fehlende Screenshots**: 30 Artikel ohne `price.png`

---

## 🔍 PROBLEM 1: ARTIKEL 4091 - FALSCHE URL GECRAWLT

### Symptome:
- ❌ productName: "Unknown Product" (statt echtem Namen)
- ❌ price: 0 EUR
- ❌ Keine Screenshots erstellt (nur html-data.json)
- ✅ Description teilweise vorhanden: "gerades Klemmanschlussstück mit O-RingIP7742000A770"

### Root Cause:
Der Crawler hat die FALSCHE Produktseite aufgerufen!

**Sollte crawlen**: `https://shop.firmenich.de/product/4091`
**Hat stattdessen gecrawlt**: `https://shop.firmenich.de/Schwalbenschwanz-Stechmesser/Das-Kurze-Schwalbenschwanz-Stechmesser-wie-4091-nur-7-cm-kuerzer`

Das ist ein ANDERES Produkt das sich auf 4091 bezieht ("wie 4091, nur 7 cm kürzer").

### HTML-Extraction Ergebnis:
\`\`\`json
{
  "confidence": {
    "productName": 0,      ❌
    "description": 1,      ✅
    "articleNumber": 0,    ❌
    "price": 0,            ❌
    "tieredPrices": 0      ❌
  }
}
\`\`\`

### Betroffene Dateien:
- `web-crawler-service.ts` oder URL-Generierungs-Logik
- Crawler verwendet möglicherweise Links aus der Kategorieübersicht statt `/product/{articleNumber}`

### Fix-Strategie:
1. **Sofort**: URL-Validierung einbauen - prüfen ob gecrawlte URL `/{articleNumber}` oder `/product/{articleNumber}` enthält
2. **Langfristig**: Crawler sollte IMMER die kanonische URL `/product/{articleNumber}` verwenden
3. **Workaround**: Artikel 4091 manuell neu crawlen mit korrekter URL

---

## 🔍 PROBLEM 2: "AUF ANFRAGE" PREISE - 3 ASAL ARTIKEL

### Betroffene Artikel:
- **2188**: ASAL Sauce Hollandaise kalorienreduziert
- **2195**: ASAL Sauce Hollandaise ... (ähnliches Produkt)
- **2199**: ASAL Sauce Hollandaise ... (ähnliches Produkt)

### Symptome:
- ✅ productName: vollständig extrahiert
- ✅ description: sehr ausführlich (1000+ Zeichen)
- ✅ articleNumber: korrekt
- ❌ price: 0 EUR
- ❌ tieredPrices: leer
- ❌ Kein `price.png` Screenshot

### Root Cause:
Diese Produkte haben auf der Website **KEINE angezeigten Preise** - wahrscheinlich "Preis auf Anfrage" oder B2B-Konditionen.

### HTML-Extraction Ergebnis:
\`\`\`json
{
  "confidence": {
    "productName": 1,      ✅
    "description": 1,      ✅
    "articleNumber": 1,    ✅
    "price": 0,            ❌ Nicht gefunden
    "tieredPrices": 0      ❌ Nicht gefunden
  },
  "hasAllFields": false
}
\`\`\`

### Fix-Strategie:
1. **HTML-Extraction erweitern**: Suche nach "Auf Anfrage" Text-Patterns
2. **Neues Feld**: `priceOnRequest: boolean` in Datenbank
3. **Selektoren erweitern**: Prüfe nach:
   - "Preis auf Anfrage"
   - "auf Anfrage"
   - "Kontaktieren Sie uns"
   - ".price-on-request" CSS-Klasse
4. **Validation anpassen**: Produkte mit `priceOnRequest=true` sind valid OHNE Preis

---

## 📊 PROBLEM 3: FEHLENDE price.png SCREENSHOTS

### Statistik:
- **24 Artikel MIT `price.png`** (40%)
- **30 Artikel OHNE `price.png`** (60%)  ← Alle haben aber tieredPrices in HTML! ✅

### Analyse:
Dies ist **KEIN Problem**! Alle 30 Artikel ohne `price.png` haben:
- ✅ Tiered prices in HTML extrahiert (3-4 Stufen)
- ✅ `tieredPricesText` vollständig
- ✅ Produktdaten komplett

### Grund:
- Produkte mit **Staffelpreisen** (tiered prices) haben keinen einzelnen `price.png` Screenshot
- Der Screenshot-Service erstellt nur `price.png` für Produkte mit **Einzelpreis**
- Bei Staffelpreisen wird die komplette Tabelle in HTML erfasst (besser als Screenshot!)

### Ergebnis:
✅ **Kein Fix nötig** - dies ist erwartetes Verhalten!

---

## 🎯 ZUSAMMENFASSUNG DER FIXES

| Problem | Priorität | Fix | Betroffene Dateien |
|---------|-----------|-----|-------------------|
| 4091 URL falsch | 🔴 HOCH | URL-Validierung + Kanonische URL | `web-crawler-service.ts` |
| "Auf Anfrage" | 🟡 MITTEL | HTML-Pattern-Erkennung | `html-extraction-service.ts`, `schema.prisma` |
| price.png fehlt | 🟢 NIEDRIG | Kein Fix nötig | - |

---

## ✅ NÄCHSTE SCHRITTE

### 1. Sofort-Fix für Artikel 4091:
Manuell neu crawlen mit korrekter URL über Frontend

### 2. URL-Validierung einbauen
Wird in web-crawler-service.ts implementiert

### 3. "Auf Anfrage" Erkennung
Wird in html-extraction-service.ts implementiert

### 4. Datenbank-Schema erweitern  
Neues Feld `priceOnRequest` in Product model

---

**Erstellt**: 2025-11-05
**Status**: ANALYSIERT - FIXES AUSSTEHEND
