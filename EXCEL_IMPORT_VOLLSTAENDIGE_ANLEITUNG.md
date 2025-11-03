# 📊 Excel-Import - Vollständige Anleitung

## 🎯 Was kann das System?

Das Excel-Import-System kann:
- ✅ **Existierende Artikel aktualisieren** (basierend auf Artikelnummer)
- ✅ **Flexible Feld-Zuordnung** (du wählst, welche Spalten welche Felder updaten)
- ✅ **Nur ausgewählte Felder überschreiben** (z.B. nur Beschreibung, nicht Preis)
- ✅ **Preview vor Import** (siehst die ersten 10 Zeilen)
- ✅ **Import-Statistik** (wie viele gematched/geskipped/updated)
- ⚠️ **Artikel die NICHT in DB gefunden wurden** → Werden gezählt aber NICHT einzeln aufgelistet

---

## 🚀 Schritt-für-Schritt: Excel hochladen

### Schritt 1: Excel-Datei vorbereiten

Deine Excel sollte so aussehen:

| Artikelnummer | Beschreibung | Preis | Kategorie |
|---------------|--------------|-------|-----------|
| 1234 | Premium Produkt | 99.99 | Tools |
| 5678 | Standard Artikel | 19.99 | Hardware |
| 9999 | Neuer Artikel | 49.99 | Supplies |

**Wichtig:**
- **Erste Zeile = Header** (Spaltennamen)
- **Artikelnummer-Spalte MUSS existieren** (zum Matchen)
- Andere Spalten sind optional

---

### Schritt 2: Excel hochladen & Preview

1. **Öffne:** http://localhost:3001
2. **Gehe zu:** "Excel Import" (Sidebar)
3. **Datei hochladen:**
   - Drag & Drop ODER
   - Klick zum Auswählen

4. **Du siehst Preview:**
   ```
   Vorschau (erste 10 Zeilen):

   A  │  B           │  C     │  D
   ───────────────────────────────
   Nr │ Beschreibung │ Preis  │ Kategorie
   1234│ Premium...  │ 99.99  │ Tools
   5678│ Standard... │ 19.99  │ Hardware
   ...
   ```

---

### Schritt 3: Match-Spalte konfigurieren

**Das System muss wissen:** In welcher Spalte steht die Artikelnummer?

**3 Optionen:**

#### Option A: Nach Spalten-Buchstabe (empfohlen)
- Wähle: `Nach Spalte`
- Wähle aus Dropdown: `A` (wenn Artikelnummer in Spalte A)

#### Option B: Nach Header-Name
- Wähle: `Nach Header-Name`
- Wähle aus Dropdown: `Artikelnummer` (exakter Name aus Excel)

#### Option C: Auto-Detect (meistens automatisch)
- Wähle: `Auto-Detect`
- System findet Spalte mit "Artikelnummer", "Art-Nr", "SKU", etc.

**Klicke:** "Weiter"

---

### Schritt 4: Felder zuordnen (DAS IST DER WICHTIGSTE SCHRITT!)

Hier entscheidest du, **welche Felder** upgedated werden!

**Beispiel-Szenario 1: Nur Beschreibung updaten**

```
Excel-Spalte → Datenbank-Feld
─────────────────────────────────
☑ B (Beschreibung) → Description
☐ C (Preis)        → Price        ← NICHT aktiviert!
☐ D (Kategorie)    → Category     ← NICHT aktiviert!
```

→ **Nur die Beschreibung wird upgedated, Preis & Kategorie bleiben unverändert!**

**Beispiel-Szenario 2: Beschreibung UND Preis updaten**

```
Excel-Spalte → Datenbank-Feld
─────────────────────────────────
☑ B (Beschreibung) → Description
☑ C (Preis)        → Price        ← Jetzt aktiviert!
☐ D (Kategorie)    → Category
```

→ **Beschreibung UND Preis werden upgedated!**

**Verfügbare Felder:**
- `description` - Produktbeschreibung
- `productName` - Produktname
- `price` - Einzelpreis
- `tieredPricesText` - Staffelpreise (Text)
- `category` - Kategorie
- `manufacturer` - Hersteller
- `ean` - EAN-Code
- `currency` - Währung (EUR, USD, etc.)
- `imageUrl` - Bild-URL
- `thumbnailUrl` - Thumbnail-URL
- `sourceUrl` - Quelle-URL
- `verified` - Verifiziert (true/false)
- `published` - Veröffentlicht (true/false)

**Klicke:** "Weiter"

---

### Schritt 5: Import starten & Ergebnis sehen

**Zusammenfassung wird angezeigt:**

```
Zusammenfassung:
• Excel-Zeilen: 150
• Match-Spalte: A (Artikelnummer)
• Zu aktualisierende Felder: 1
  - Beschreibung

⚠️ Achtung: Existierende Daten werden überschrieben!
```

**Klicke:** "Import starten"

**Progress wird angezeigt:**
```
████████████░░░░░░░░░░░░░░ 50%
75 von 150 verarbeitet...
```

**ERGEBNIS:**
```
✓ 120 Artikel aktualisiert
⊘ 25 übersprungen (nicht in DB)
✗ 5 Fehler
```

**Was bedeutet das?**

| Status | Bedeutung | Beispiel |
|--------|-----------|----------|
| **Aktualisiert** | Artikel war in DB UND wurde geupdated | Art.Nr. 1234 war da → Beschreibung wurde aktualisiert |
| **Übersprungen** | Artikel war NICHT in DB | Art.Nr. 9999 existiert nicht → wird übersprungen |
| **Fehler** | Fehler beim Processing | Art.Nr. fehlt in Excel-Zeile |

---

## 🔍 Was passiert mit Artikeln die NICHT in DB gefunden wurden?

### Aktueller Stand:

✅ **Sie werden gezählt:** `skippedArticles: 25`
❌ **Sie werden NICHT aufgelistet:** Keine Liste mit den fehlenden Artikelnummern

### Das Problem:

Du siehst:
```
⊘ 25 übersprungen (nicht in DB)
```

Aber du weißt NICHT:
- Welche 25 Artikel das sind
- Welche Artikelnummern fehlen
- Ob das gewollt war oder ein Fehler

### Die Lösung (manuelle Überprüfung):

**Schritt 1: Alle Artikel aus DB exportieren**
```bash
# In Artikel-Seite:
1. Klicke "Alle auswählen"
2. Klicke "Export" → JSON/Excel
3. Speichere als "system-artikel.json"
```

**Schritt 2: Mit Excel vergleichen (Python/Excel)**
```python
# Python-Script um fehlende zu finden:
import pandas as pd

# Lade Excel
excel_df = pd.read_excel('deine-excel.xlsx')
excel_nummern = set(excel_df['Artikelnummer'])

# Lade System-Export
system_df = pd.read_json('system-artikel.json')
system_nummern = set(system_df['articleNumber'])

# Fehlende finden
fehlende = excel_nummern - system_nummern

print(f"Fehlende Artikel: {len(fehlende)}")
for nummer in sorted(fehlende):
    print(nummer)
```

---

## 🎯 Häufige Use-Cases

### Use-Case 1: "Ich will nur die Beschreibungen updaten"

**Problem:** Ich habe neue Beschreibungstexte, aber will Preise NICHT anfassen!

**Lösung:**

1. Excel vorbereiten:
   ```
   Artikelnummer | Neue Beschreibung
   1234          | Verbesserte Produktbeschreibung...
   5678          | Aktualisierter Text...
   ```

2. Import-Config:
   ```
   Match-Spalte: A (Artikelnummer)

   Feld-Mappings:
   ☑ B → description    ← NUR das!
   ☐ Alle anderen NICHT aktiviert
   ```

3. **Ergebnis:**
   - Beschreibungen werden upgedated
   - Preise bleiben unverändert ✅
   - Kategorien bleiben unverändert ✅

---

### Use-Case 2: "Ich will neue Artikel NICHT erstellen, nur existierende updaten"

**Problem:** Meine Excel hat 200 Artikel, aber nur 150 sind im System. Ich will KEINE neuen erstellen!

**Lösung:**

Das System macht das **automatisch**! 🎉

```
Excel: 200 Artikel
System: 150 Artikel

Import-Ergebnis:
✓ 150 Artikel aktualisiert   ← Existierende
⊘ 50 übersprungen            ← Nicht in DB = werden ignoriert
```

**KEINE neuen Artikel werden erstellt!**

---

### Use-Case 3: "Ich will wissen WELCHE Artikel fehlen"

**Problem:** Import zeigt "50 übersprungen" - aber WELCHE?

**Aktueller Workaround:**

**Option A: Vor dem Import checken**
```bash
# Node.js Script (check-missing-articles.js):
const excelData = await parseExcel('deine-excel.xlsx');
const systemData = await fetch('http://localhost:3001/api/articles').then(r => r.json());

const excelNumbers = new Set(excelData.map(a => a.articleNumber));
const systemNumbers = new Set(systemData.map(a => a.articleNumber));

const missing = [...excelNumbers].filter(num => !systemNumbers.has(num));

console.log('Fehlende Artikel:', missing);
// Speichern in JSON
fs.writeFileSync('missing-articles.json', JSON.stringify(missing, null, 2));
```

**Option B: Nach dem Import (aus Errors)**
```javascript
// Nach Import die Errors prüfen:
const result = await importExcel(file, config);

console.log('Skipped:', result.skippedArticles);
console.log('Errors:', result.errors);

// Errors enthalten Row-Nummern, daraus kannst du die Artikel-Nummern ableiten
```

**Option C: Feature-Request (noch nicht implementiert)**

Das wäre ideal:
```typescript
interface ImportResult {
  // ... existing fields
  skippedArticlesList: string[];  // ← Liste der nicht gefundenen Artikelnummern
}
```

---

## 🛠️ Erweiterte Konfiguration

### Staffelpreise importieren

**Excel-Format:**
```
Artikelnummer | Preis_1 | Ab_Menge_1 | Preis_2 | Ab_Menge_2
1234          | 10.00   | 1          | 8.50    | 50
```

**Import-Config:**
```
Match-Spalte: A

Feld-Mappings:
☑ B → price (für Einzelpreis)
☑ C+D → tieredPricesText (als JSON-String formatieren)
```

**Hinweis:** Staffelpreise müssen aktuell manuell als JSON formatiert werden:
```json
"[{\"quantity\": 1, \"price\": 10.00}, {\"quantity\": 50, \"price\": 8.50}]"
```

---

## ⚠️ Wichtige Hinweise

### 1. Artikel werden NUR upgedated, NIE neu erstellt

```
Excel hat:  [1234, 5678, 9999]
System hat: [1234, 5678]

Ergebnis:
✓ 1234 upgedated
✓ 5678 upgedated
⊘ 9999 übersprungen (nicht erstellt!)
```

### 2. Artikelnummer ist NICHT überschreibbar

Die Artikelnummer wird **NUR zum Matchen** verwendet!

```
Match-Spalte: A (Artikelnummer)

Feld-Mappings:
☑ B → description    ✅ OK
☑ C → price          ✅ OK
☐ A → articleNumber  ❌ NICHT MÖGLICH!
```

### 3. Leere Werte werden als NULL behandelt

```
Excel:
Artikelnummer | Beschreibung | Preis
1234          | Text         |       ← Leer!

Ergebnis:
article.description = "Text"
article.price = null  ← Wird auf NULL gesetzt!
```

**Wenn du Felder NICHT überschreiben willst** → Einfach NICHT in Feld-Mappings aufnehmen!

### 4. Nur Änderungen werden gespeichert

Das System ist **smart**:
```javascript
// Wenn Excel-Wert = DB-Wert:
if (excelValue === dbValue) {
  // NICHTS TUN - kein unnötiges Update!
}
```

→ Nur tatsächlich geänderte Artikel werden upgedated (Performance!)

---

## 📊 Import-Statistiken verstehen

```
Ergebnis:
✓ 120 Artikel aktualisiert
⊘ 25 übersprungen
✗ 5 Fehler
```

**Was bedeutet das genau?**

### Aktualisiert (120)
- Artikel war in DB
- Match erfolgreich (Artikelnummer gefunden)
- Mindestens ein Feld hatte einen neuen Wert
- Update wurde durchgeführt

### Übersprungen (25)
- **Fall 1:** Artikel war NICHT in DB → wird ignoriert (häufigster Fall)
- **Fall 2:** Artikelnummer war leer in Excel-Zeile
- **Fall 3:** Artikel war in DB, aber KEINE Werte haben sich geändert

### Fehler (5)
- **Fall 1:** Spalte nicht gefunden (z.B. Mapping falsch konfiguriert)
- **Fall 2:** Falscher Datentyp (z.B. "ABC" in Preis-Feld)
- **Fall 3:** Datenbank-Fehler (z.B. Constraint Violation)

**Details zu Fehlern:**
```json
{
  "errors": [
    {
      "row": 15,
      "articleNumber": "1234",
      "message": "Invalid price format"
    },
    {
      "row": 42,
      "articleNumber": "",
      "message": "Article number is empty"
    }
  ]
}
```

---

## 🎯 Best Practices

### 1. Immer mit kleiner Testmenge starten

```
Excel: 1000 Artikel
→ Teste ZUERST mit 10 Artikeln!
→ Prüfe Ergebnis
→ Dann alle importieren
```

### 2. Backup vor großen Imports

```bash
# Exportiere alle Artikel VOR Import:
1. Artikel-Seite öffnen
2. "Alle auswählen"
3. "Export" → JSON
4. Speichern als "backup-vor-import.json"
```

### 3. Preview nutzen

```
Schritt 1: Upload → Schau dir Preview an
Schritt 2: Prüfe ob Spalten richtig erkannt wurden
Schritt 3: Erst dann Import starten
```

### 4. Nur notwendige Felder mappen

```
SCHLECHT:
☑ B → description
☑ C → price
☑ D → category
☑ E → manufacturer
☑ F → ean
☑ G → sourceUrl
... (alles aktiviert)

GUT (wenn du nur Beschreibung willst):
☑ B → description
☐ Alle anderen DEAKTIVIERT!
```

---

## 🚀 Workflow-Beispiel (komplett)

**Szenario:** Beschreibungen für 500 Artikel updaten

### Vorbereitung (einmalig)

1. **Export aktueller Stand:**
   - Artikel-Seite → Alle auswählen → Export
   - Speichern als `backup.json`

2. **Excel vorbereiten:**
   ```
   Artikelnummer | Neue Beschreibung
   1234          | Verbesserte Beschreibung...
   5678          | Aktualisierter Text...
   ... (500 Zeilen)
   ```

### Import durchführen

1. **Excel Import öffnen:**
   - http://localhost:3001 → Excel Import

2. **Datei hochladen:**
   - Drag & Drop `beschreibungen-update.xlsx`

3. **Preview prüfen:**
   - Spalten korrekt? ✅
   - Artikelnummern erkennbar? ✅
   - Weiter klicken

4. **Match-Spalte:**
   - "Auto-Detect" wählen ✅
   - System findet "Artikelnummer" in Spalte A
   - Weiter klicken

5. **Feld-Mapping:**
   ```
   ☑ B (Neue Beschreibung) → description
   ☐ Alle anderen DEAKTIVIERT
   ```
   - Weiter klicken

6. **Import starten:**
   - Zusammenfassung prüfen
   - "Import starten" klicken
   - Warten...

7. **Ergebnis:**
   ```
   ✓ 485 Artikel aktualisiert
   ⊘ 15 übersprungen (nicht in DB)
   ✗ 0 Fehler
   ```

8. **Verifizierung:**
   - Artikel-Seite öffnen
   - Stichproben prüfen (5-10 Artikel)
   - Beschreibungen upgedated? ✅
   - Preise unverändert? ✅

### Nacharbeit

**15 Artikel fehlen?** → Checken:

```bash
# check-missing.js:
const excelData = parseExcel('beschreibungen-update.xlsx');
const systemData = await fetch('/api/articles');

const missing = excelData
  .map(a => a.articleNumber)
  .filter(num => !systemData.some(s => s.articleNumber === num));

console.log('Fehlende:', missing);
// z.B.: ['9999', '8888', '7777', ...]

→ Artikel manuell im Shop suchen
→ Oder: Artikel wurden noch nicht gecrawlt
```

---

## 🐛 Troubleshooting

### Problem: "Match column not found"

**Fehler:**
```
Match column "Artikelnummer" not found in headers
```

**Lösung:**
- Prüfe Excel: Ist die Spalte wirklich "Artikelnummer"?
- Typo? (Leerzeichen, Groß-/Kleinschreibung?)
- Versuche "Auto-Detect" statt Header-Name

---

### Problem: "Invalid database field"

**Fehler:**
```
Invalid database field: productTitle
```

**Lösung:**
- Feld heißt `productName`, nicht `productTitle`
- Siehe Liste der gültigen Felder oben
- Nur diese Felder sind erlaubt!

---

### Problem: "Alle Artikel werden übersprungen"

**Symptom:**
```
✓ 0 Artikel aktualisiert
⊘ 500 übersprungen
```

**Mögliche Ursachen:**

1. **Artikelnummern stimmen nicht überein:**
   ```
   Excel:  "1234"  (als Text)
   System: "1234"  (als Text) → sollte matchen

   Excel:  "1234 " (mit Leerzeichen!)
   System: "1234"  → matcht NICHT!
   ```

   **Lösung:** Excel-Zellen trimmen (Leerzeichen entfernen)

2. **Falsche Spalte als Match gewählt:**
   ```
   Match-Spalte: C
   Aber Artikelnummern stehen in A!
   ```

   **Lösung:** Richtige Spalte wählen

3. **Artikel existieren wirklich nicht:**
   ```
   Excel: Neue Artikel die noch nicht gecrawlt wurden
   ```

   **Lösung:** Erst crawlen, dann importieren

---

### Problem: "Import dauert sehr lange"

**Symptom:**
```
████░░░░░░░░░░░░░░░░░░ 10%
20 von 1000 verarbeitet...
(nach 5 Minuten)
```

**Ursache:**
- Jeder Artikel wird einzeln upgedated (kein Bulk-Update)

**Lösung:**
- Geduldig sein (bei 1000 Artikeln kann es 10-20 Min dauern)
- Oder in kleineren Batches importieren (je 100-200 Artikel)

---

## 📝 Excel-Template

**Minimalbeispiel:**
```
Artikelnummer | Beschreibung
1234          | Produktbeschreibung hier
5678          | Weitere Beschreibung
```

**Vollständiges Beispiel:**
```
Artikelnummer | Produktname | Beschreibung | Preis | Währung | Kategorie | Hersteller | EAN
1234          | Premium Prod| Lange Beschr.| 99.99 | EUR     | Tools     | Bosch      | 4012345678901
```

**Download Template:**
- Excel Import Seite → "Download Template" Button
- Enthält alle Spalten mit Beispieldaten

---

## 🔮 Zukünftige Features (noch nicht implementiert)

### Feature 1: Liste der fehlenden Artikel

```typescript
interface ImportResult {
  // ... existing
  skippedArticlesList: Array<{
    articleNumber: string;
    reason: 'not_found_in_db' | 'empty_article_number' | 'no_changes';
  }>;
}
```

**Dann würdest du sehen:**
```
⊘ 25 übersprungen:
  - 9999 (nicht in DB)
  - 8888 (nicht in DB)
  - 7777 (nicht in DB)
  ...
```

### Feature 2: Artikel erstellen (optional)

```
Config:
☑ Neue Artikel erstellen (wenn nicht in DB)
```

**Dann:**
```
Excel: 200 Artikel
System: 150 Artikel

Ergebnis:
✓ 150 Artikel aktualisiert
+ 50 Artikel NEU erstellt
```

### Feature 3: Undo-Funktion

```
Import durchgeführt
→ "Undo letzten Import" Button
→ Alle Änderungen werden rückgängig gemacht
```

---

## ✅ Zusammenfassung

**Was das System KANN:**
- ✅ Existierende Artikel updaten
- ✅ Flexible Feld-Auswahl
- ✅ Nur ausgewählte Felder überschreiben
- ✅ Preview & Validation
- ✅ Import-Statistiken

**Was das System NICHT KANN:**
- ❌ Neue Artikel erstellen
- ❌ Liste der fehlenden Artikel anzeigen (nur Anzahl)
- ❌ Undo-Funktion
- ❌ Scheduled/Automatische Imports

**Workaround für fehlende Artikel:**
- Vor Import: Vergleichs-Script laufen lassen
- Nach Import: Errors durchgehen & Artikel manuell prüfen

---

**Viel Erfolg beim Excel-Import!** 🎉

*Erstellt am: 03.11.2025*
*Version: 1.0*
*Für: Screenshot_Algo Excel Import System*
