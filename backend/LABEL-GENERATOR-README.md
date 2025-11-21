# Product Label Generator - A3 Format

Professioneller Label-Generator für Produktetiketten im A3 Landscape Format (3x3 Grid).

## 📋 Features

- **A3 Landscape Format** (420 x 297 mm)
- **3x3 Grid** - 9 Labels pro Seite
- **Drei Preistypen:**
  - Staffelpreise mit Tabelle ("Bis X" Format)
  - Einzelpreise
  - "Preis auf Anfrage"
- **Design:**
  - Blaue Preisboxen (#1E4D8B)
  - QR-Codes mit "Scannen & im Shop ansehen"
  - Automatisch skalierte Produktbilder
  - Zentrierte Produktnamen
  - Graue Beschreibungen
- **Feste Positionen:** Alle Elemente haben fixe Positionen, unabhängig vom Inhalt

## 🚀 Verwendung

```bash
cd backend
npx tsx generate-product-labels-a3.ts
```

## 📤 Output

**Datei:** `backend/labels-STYLED-FINAL.pdf`

Das PDF enthält:
- 4 Artikel mit Staffelpreisen
- 3 Artikel mit Einzelpreisen
- 3 Artikel mit "Preis auf Anfrage"
- Insgesamt 9 Labels (falls alle Bilder vorhanden)

## 🎨 Layout-Spezifikationen

### Feste Positionen (pro Label):

| Element | Y-Position | Beschreibung |
|---------|-----------|--------------|
| Produktname | y + 10 | Blau, zentriert, max 2 Zeilen |
| Beschreibung | y + 45 | Grau, 8pt, max 80pt Höhe |
| Preisbox | y + 140 | Variabel nach Typ |
| Produktbild | y + 60 | Max 65x90 Punkte |
| QR-Code | y + 165 | 65x65 Punkte |
| Artikel-Nr | y + cellHeight - 12 | Unten links |

### Design-Farben:

```typescript
BLUE_BOX: '#1E4D8B'    // Preisboxen, Titel
DARK_TEXT: '#1a1a1a'   // Normaler Text
GRAY_TEXT: '#666666'   // Beschreibungen
WHITE: '#FFFFFF'       // Weiß
BORDER: '#CCCCCC'      // Zellrahmen
```

### Staffelpreis-Tabelle:

- **Header:** Blauer Hintergrund (#1E4D8B), weißer Text
- **Spalten:** Menge | Einheit | Preis
- **Datenzeilen:** Weißer Hintergrund, dunkler Text
- **Format:** "Bis X" statt "Ab X"
- **Max. Zeilen:** 4 Staffeln

## 📝 Datenquellen

Der Generator holt Daten aus der PostgreSQL-Datenbank:

1. **Staffelpreise:** `products` mit `tieredPricesText` (ohne "auf anfrage")
2. **Einzelpreise:** `products` mit `price` (ohne `tieredPricesText`)
3. **Auf Anfrage:** `products` mit `tieredPricesText ILIKE '%auf anfrage%'`

**Bedingungen:**
- `imageUrl IS NOT NULL`
- `published = true`

## 🔧 Anpassungen

### Anzahl der Labels ändern:

```typescript
// In generate-product-labels-a3.ts, Zeile ~32:
LIMIT 4  // Anzahl Staffelpreis-Artikel
LIMIT 3  // Anzahl Einzelpreis-Artikel
LIMIT 3  // Anzahl Auf-Anfrage-Artikel
```

### Farben ändern:

```typescript
// Zeile ~18-24:
const COLORS = {
  BLUE_BOX: '#1E4D8B',        // Deine Farbe
  DARK_TEXT: '#1a1a1a',       // Deine Farbe
  GRAY_TEXT: '#666666',       // Deine Farbe
  // ...
};
```

### Positionen anpassen:

```typescript
// Zeile ~150-153:
const titleY = y + padding;
const titleHeight = 32;
const descriptionY = y + padding + titleHeight + 3;
const priceBoxY = y + padding + 130;
```

## ⚠️ Wichtige Hinweise

1. **Backend muss laufen:** Der Image-Server muss auf `localhost:3001` erreichbar sein
2. **Bilder erforderlich:** Artikel ohne gültige Bilder werden übersprungen
3. **Feste Positionen:** Alle Elemente haben fixe Y-Koordinaten - Layout bleibt konsistent
4. **Beschreibung:** Maximal 80pt Höhe, wird mit "..." abgeschnitten wenn zu lang
5. **Produktbild:** Wird auf max 65px Breite begrenzt, damit es nicht über Grenzen ragt

## 📂 Dateien

| Datei | Beschreibung |
|-------|--------------|
| `generate-product-labels-a3.ts` | Haupt-Generator (gut dokumentiert) |
| `create-pdf-styled.ts` | Original-Entwicklungsversion |
| `LABEL-GENERATOR-README.md` | Diese Dokumentation |

## 🐛 Fehlerbehandlung

- Artikel ohne Bilder werden automatisch übersprungen
- QR-Code-Fehler werden geloggt, brechen aber nicht ab
- Bild-Fehler werden geloggt, brechen aber nicht ab
- Mindestens 1 Label wird immer generiert (falls Daten vorhanden)

## 📊 Beispiel-Output

```
🔍 Schritt 1: Artikel auswählen...
✅ 10 Artikel ausgewählt

🔍 Schritt 2: Bilder und QR-Codes laden...
  ✅ 4145-E
  ✅ 6476
  ✅ 1995
  ...
✅ 9 Artikel geladen

🔍 Schritt 3: PDF generieren (A3 Landscape, 3x3 Grid)...
📐 Grid: 3x3, Cell: 369x252 points

✅ PDF erfolgreich erstellt!
📄 Pfad: /path/to/labels-STYLED-FINAL.pdf
📊 Größe: 1412.51 KB
🏷️  Labels: 9
```

---

**Erstellt:** 2025-11-11
**Version:** 1.0
**Autor:** Claude Code
