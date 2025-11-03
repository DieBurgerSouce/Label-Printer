# "AUF ANFRAGE" ARTIKEL - VOLLSTÄNDIGE IMPLEMENTIERUNG

## ✅ STATUS: VOLLSTÄNDIG IMPLEMENTIERT

### Was wurde gemacht:

## 1. BACKEND ANPASSUNGEN

### Validierung erweitert (articles.ts)
```javascript
// VORHER: Artikel brauchten price > 0 ODER tieredPrices
// JETZT: Artikel können auch "Auf Anfrage" sein

const isAufAnfrage = data.tieredPricesText &&
                     data.tieredPricesText.toLowerCase().includes('auf anfrage');
return hasPrice || hasTieredPrices || isAufAnfrage;
```

**Datei:** `backend/src/api/routes/articles.ts` (Zeile 41-54)

## 2. TEMPLATE-MATCHER ERWEITERT

### Neuer Preis-Typ: "auf-anfrage"
```javascript
// templateMatcher.ts - 3 Preistypen:
let articlePriceType: 'normal' | 'tiered' | 'auf-anfrage' | 'none';

if (hasTieredPrices) {
  articlePriceType = 'tiered';
} else if (isAufAnfrage) {
  articlePriceType = 'auf-anfrage';  // NEU!
} else if (hasNormalPrice) {
  articlePriceType = 'normal';
} else {
  articlePriceType = 'none';
}
```

**Datei:** `frontend/src/utils/templateMatcher.ts` (Zeile 14-42)

## 3. UI KOMPONENTEN

### Template Rule Builder erweitert
```html
<option value="normal">Normaler Preis</option>
<option value="tiered">Staffelpreis</option>
<option value="auf-anfrage">Auf Anfrage</option>  <!-- NEU! -->
```

**Datei:** `frontend/src/components/TemplateRuleBuilder/RuleConditionRow.tsx` (Zeile 103-105)

## 4. DREI SPEZIALISIERTE TEMPLATES

### Template 1: Standard-Label (Normalpreis)
- **ID:** `normal-price-auto-match`
- **Größe:** 400x250px
- **Auto-Match:** `priceType = "normal"`
- **Besonderheit:** Große Preisanzeige (36pt)

### Template 2: Staffelpreis-Label
- **ID:** `tiered-price-auto-match`
- **Größe:** 400x350px (größer!)
- **Auto-Match:** `priceType = "tiered"`
- **Besonderheit:** Gelb-umrandete Preisstaffel-Box

### Template 3: Auf Anfrage Label ✨ NEU!
- **ID:** `auf-anfrage-auto-match`
- **Größe:** 400x280px
- **Auto-Match:** `priceType = "auf-anfrage"`
- **Besonderheiten:**
  - Blau gestrichelte Box mit "Preis auf Anfrage"
  - Kontakt-Hinweis: "Kontaktieren Sie uns für ein Angebot!"
  - Blaues Farbschema (#0066CC)

## 5. TEST-ARTIKEL ERSTELLT

```json
{
  "id": "f3758e51-a7b6-4169-8b31-93a8865ae291",
  "articleNumber": "1050",
  "productName": "Kistenwaschmaschine Teco",
  "price": 0,
  "tieredPricesText": "Auf Anfrage",
  "sourceUrl": "https://shop.firmenich.de/Kistenwaschmaschinen/Kistenwaschmaschine-Teco"
}
```

## WIE ES FUNKTIONIERT

### Artikel-Klassifizierung:
```
1. Hat Staffelpreise? → "tiered"
2. Hat "Auf Anfrage" im Text? → "auf-anfrage"
3. Hat normalen Preis > 0? → "normal"
4. Sonst → "none" (wird übersprungen)
```

### Prioritäten:
- **Staffelpreise** haben HÖCHSTE Priorität
- **"Auf Anfrage"** hat MITTLERE Priorität
- **Normalpreis** hat NIEDRIGSTE Priorität

**Wichtig:** Wenn ein Artikel MEHRERE Preistypen hat, gewinnt die höchste Priorität!

## AUTOMATISCHER WORKFLOW

1. **Artikel wird gecrawlt/importiert**
   - System prüft automatisch Preisfelder
   - Erkennt "Auf Anfrage" in tieredPricesText

2. **Label-Generierung**
   - User wählt Artikel aus
   - System matched automatisch das richtige Template
   - "Auf Anfrage" Artikel → Blaues Template

3. **Ergebnis**
   - Professionelles Label ohne Preis
   - Stattdessen "Preis auf Anfrage" mit Kontakthinweis

## TEST-ANLEITUNG

### So testest du das System:

1. **Öffne:** http://localhost:3001
2. **Gehe zu:** Artikel
3. **Suche:** Artikel Nr. 1050
4. **Wähle aus** und klicke "Labels generieren"
5. **Siehe:** Auto-Match erkennt "Auf Anfrage" Template
6. **Bestätige** und Label wird generiert

## ÜBERSICHT ALLER ARTIKEL-TYPEN

| Artikel-Typ | Anzahl | Template | Erkennungsmerkmal |
|------------|--------|----------|-------------------|
| Normalpreis | 14 | Standard-Label | `price > 0` |
| Staffelpreis | 3 | Staffelpreis-Label | `tieredPrices.length > 0` |
| Auf Anfrage | 1 | Auf Anfrage Label | `tieredPricesText` enthält "auf anfrage" |
| Ohne Preis | 3 | - | Wird übersprungen |

## DATEIEN DIE GEÄNDERT WURDEN

1. **Backend:**
   - `backend/src/api/routes/articles.ts` → Validierung erweitert

2. **Frontend:**
   - `frontend/src/utils/templateMatcher.ts` → "auf-anfrage" Typ hinzugefügt
   - `frontend/src/components/TemplateRuleBuilder/RuleConditionRow.tsx` → UI Option

3. **Templates:**
   - `backend/data/label-templates/normal-price-template.json`
   - `backend/data/label-templates/tiered-price-template.json`
   - `backend/data/label-templates/auf-anfrage-template.json` ← NEU!

## WICHTIGE HINWEISE

### Docker Build erforderlich:
Nach Backend-Änderungen MUSS der Container neu gebaut werden:
```bash
docker-compose build backend
docker-compose up -d backend
```

### Template-Reihenfolge:
Das ERSTE passende Template wird verwendet. Reihenfolge ist wichtig!

### Fallback:
Artikel ohne Match können manuell einem Template zugewiesen werden.

## STATUS

✅ **VOLLSTÄNDIG IMPLEMENTIERT UND GETESTET**

Das System kann jetzt automatisch erkennen:
- Normalpreise
- Staffelpreise
- **"Auf Anfrage" Artikel** ← NEU!

Und weist jedem Artikel-Typ das passende Label-Template zu!

---

**Erstellt am:** 02.11.2025
**Von:** Claude Code Assistant
**Für:** Screenshot_Algo Label Generation System