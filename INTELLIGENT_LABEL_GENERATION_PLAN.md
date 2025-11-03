# 🤖 Intelligente Label-Generierung mit Regelbasiertem Template-Matching

**Datum:** 2025-10-21
**Status:** PLANUNG
**Ziel:** Automatische Template-Auswahl basierend auf Artikel-Eigenschaften

---

## 📋 **ZUSAMMENFASSUNG**

### **Problem:**
- Manche Artikel haben **normalen Preis**, andere haben **Staffelpreise**
- Dafür braucht man **unterschiedliche Label-Templates**
- Aktuell: Nutzer muss manuell Template für jeden Batch wählen
- **Gewünscht:** System wählt automatisch passendes Template pro Artikel

### **Lösung:**
**Regelbasiertes Template-Matching System**
- Templates haben **Regeln** (z.B. "Verwende wenn Staffelpreis vorhanden")
- Bei Bulk-Label-Generation: System matched jeden Artikel mit passendem Template
- Regeln schließen sich **gegenseitig aus** (mutual exclusive)
- Artikel ohne Match werden **übersprungen** (mit Warnung)

---

## 🏗️ **ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────┐
│         FRONTEND: Label Template Editor             │
│  ┌───────────────────────────────────────────────┐ │
│  │  Template Eigenschaften:                      │ │
│  │  - Name: "Label mit Staffelpreisen"           │ │
│  │  - Design: [Drag & Drop Canvas]               │ │
│  │  - Print Layout: A4 Avery 3474                │ │
│  │  │                                             │ │
│  │  NEU: Template Regeln 🔥                      │ │
│  │  ┌─────────────────────────────────────────┐  │ │
│  │  │ ☑ Aktiviere automatisches Matching     │  │ │
│  │  │                                         │  │ │
│  │  │ Verwende dieses Template wenn:         │  │ │
│  │  │                                         │  │ │
│  │  │ [Regel-Builder UI]                     │  │ │
│  │  │  ┌──────────────────────────────────┐  │  │ │
│  │  │  │ Feld:     [Preis-Typ       ▼]   │  │ │ │
│  │  │  │ Operator: [ist              ▼]   │  │ │ │
│  │  │  │ Wert:     [Staffelpreis     ▼]   │  │ │ │
│  │  │  └──────────────────────────────────┘  │  │ │
│  │  │                                         │  │ │
│  │  │  [+ Bedingung hinzufügen]              │  │ │
│  │  │  [UND/ODER Verknüpfung]                │  │ │
│  │  └─────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        ↓
                 [Speichern in localStorage]
                        ↓
┌─────────────────────────────────────────────────────┐
│          FRONTEND: Articles Page                    │
│  ┌───────────────────────────────────────────────┐ │
│  │  [x] Artikel 1 (Preis: 50 EUR)                │ │
│  │  [x] Artikel 2 (Staffelpreise: ab 10: 45 EUR) │ │
│  │  [x] Artikel 3 (Preis: 100 EUR)               │ │
│  │                                                │ │
│  │  [Labels Generieren (3)] ← Click              │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│      AUTO-MATCHING ENGINE (Frontend Logic)          │
│  ┌───────────────────────────────────────────────┐ │
│  │  FOR EACH selectedArticle:                    │ │
│  │                                                │ │
│  │  1. Artikel analysieren:                      │ │
│  │     - Hat Staffelpreis? tieredPrices.length   │ │
│  │     - Hat normalen Preis? price > 0           │ │
│  │                                                │ │
│  │  2. Templates durchgehen:                     │ │
│  │     FOR EACH template WITH rules:             │ │
│  │       - Regel evaluieren (evaluateRule())     │ │
│  │       - Erste passende Regel → MATCH! ✓       │ │
│  │                                                │ │
│  │  3. Match-Ergebnis:                           │ │
│  │     - Match gefunden → templateId speichern   │ │
│  │     - Kein Match → SKIP (in skipList)         │ │
│  │                                                │ │
│  │  Output:                                      │ │
│  │  {                                            │ │
│  │    matched: [                                 │ │
│  │      { articleId: 'a1', templateId: 't1' },   │ │
│  │      { articleId: 'a2', templateId: 't2' }    │ │
│  │    ],                                         │ │
│  │    skipped: ['a3'] // kein passendes Template │ │
│  │  }                                            │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         BATCH LABEL GENERATION (Frontend)           │
│  ┌───────────────────────────────────────────────┐ │
│  │  FOR EACH match in matched:                   │ │
│  │    await labelApi.generateFromArticle(        │ │
│  │      match.articleId,                         │ │
│  │      match.templateId                         │ │
│  │    )                                          │ │
│  │                                                │ │
│  │  Toast Notification:                          │ │
│  │  ✅ 2 Labels generiert                        │ │
│  │  ⚠️ 1 Artikel übersprungen (kein Template)    │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 💾 **DATA MODEL**

### **Template mit Regeln (localStorage)**

```typescript
interface TemplateRule {
  id: string;
  enabled: boolean; // Regel aktiv?
  conditions: RuleCondition[];
  logic: 'AND' | 'OR'; // Verknüpfung der Bedingungen
}

interface RuleCondition {
  field: 'priceType' | 'category' | 'priceRange' | 'manufacturer'; // erweiterbar
  operator: 'is' | 'isNot' | 'greaterThan' | 'lessThan' | 'contains';
  value: string | number;
}

interface LabelTemplate {
  id: string;
  name: string;
  elements: TemplateElement[]; // Canvas-Elemente
  printLayoutId?: string;
  printLayoutName?: string;
  width: number;
  height: number;
  widthMm?: number;
  heightMm?: number;

  // NEU: Template Regeln
  rules?: TemplateRule;
  autoMatchEnabled: boolean; // Für automatisches Matching verwenden?
}
```

### **Beispiel-Templates:**

```typescript
// Template 1: Für normale Preise
{
  id: 'template-normal',
  name: 'Standard Label (Normaler Preis)',
  autoMatchEnabled: true,
  rules: {
    id: 'rule-1',
    enabled: true,
    logic: 'AND',
    conditions: [
      {
        field: 'priceType',
        operator: 'is',
        value: 'normal' // Artikel hat price > 0 und KEINE tieredPrices
      }
    ]
  }
}

// Template 2: Für Staffelpreise
{
  id: 'template-tiered',
  name: 'Label mit Staffelpreisen',
  autoMatchEnabled: true,
  rules: {
    id: 'rule-2',
    enabled: true,
    logic: 'AND',
    conditions: [
      {
        field: 'priceType',
        operator: 'is',
        value: 'tiered' // Artikel hat tieredPrices.length > 0
      }
    ]
  }
}
```

---

## 🎨 **FRONTEND COMPONENTS**

### **1. Rule Builder UI (im Template Editor)**

**Location:** `frontend/src/components/TemplateRuleBuilder.tsx` (NEU)

```tsx
interface TemplateRuleBuilderProps {
  rule?: TemplateRule;
  onChange: (rule: TemplateRule) => void;
}

export function TemplateRuleBuilder({ rule, onChange }: Props) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={rule?.enabled}
          onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
        />
        <label>Aktiviere automatisches Template-Matching</label>
      </div>

      {rule?.enabled && (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Verwende dieses Template wenn:
          </p>

          {rule.conditions.map((condition, index) => (
            <RuleConditionRow
              key={index}
              condition={condition}
              onChange={(newCondition) => {
                const newConditions = [...rule.conditions];
                newConditions[index] = newCondition;
                onChange({ ...rule, conditions: newConditions });
              }}
              onDelete={() => {
                const newConditions = rule.conditions.filter((_, i) => i !== index);
                onChange({ ...rule, conditions: newConditions });
              }}
            />
          ))}

          <button onClick={addCondition}>
            + Bedingung hinzufügen
          </button>

          {rule.conditions.length > 1 && (
            <select
              value={rule.logic}
              onChange={(e) => onChange({ ...rule, logic: e.target.value as 'AND' | 'OR' })}
            >
              <option value="AND">UND (alle Bedingungen müssen erfüllt sein)</option>
              <option value="OR">ODER (mindestens eine Bedingung)</option>
            </select>
          )}
        </>
      )}
    </div>
  );
}
```

**RuleConditionRow Component:**

```tsx
function RuleConditionRow({ condition, onChange, onDelete }) {
  return (
    <div className="flex gap-3 items-center mb-2">
      {/* Feld */}
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        className="border rounded px-3 py-2"
      >
        <option value="priceType">Preis-Typ</option>
        {/* Später: category, priceRange, etc. */}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className="border rounded px-3 py-2"
      >
        <option value="is">ist</option>
        <option value="isNot">ist nicht</option>
      </select>

      {/* Wert */}
      {condition.field === 'priceType' && (
        <select
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="border rounded px-3 py-2"
        >
          <option value="normal">Normaler Preis</option>
          <option value="tiered">Staffelpreis</option>
        </select>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-2 hover:bg-red-50 rounded"
      >
        <Trash2 className="w-4 h-4 text-red-600" />
      </button>
    </div>
  );
}
```

---

### **2. Auto-Matching Engine**

**Location:** `frontend/src/utils/templateMatcher.ts` (NEU)

```typescript
import { Product } from '../services/api';
import { LabelTemplate, TemplateRule, RuleCondition } from '../types';

/**
 * Evaluiert ob ein Artikel die Regel erfüllt
 */
function evaluateCondition(article: Product, condition: RuleCondition): boolean {
  switch (condition.field) {
    case 'priceType':
      const hasTieredPrices = article.tieredPrices && article.tieredPrices.length > 0;
      const hasNormalPrice = typeof article.price === 'number' && article.price > 0;

      if (condition.value === 'tiered') {
        return condition.operator === 'is' ? hasTieredPrices : !hasTieredPrices;
      } else if (condition.value === 'normal') {
        return condition.operator === 'is' ? (hasNormalPrice && !hasTieredPrices) : !(hasNormalPrice && !hasTieredPrices);
      }
      return false;

    // Später: category, priceRange, manufacturer, etc.
    default:
      return false;
  }
}

/**
 * Evaluiert alle Bedingungen einer Regel
 */
function evaluateRule(article: Product, rule: TemplateRule): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  const results = rule.conditions.map(condition => evaluateCondition(article, condition));

  if (rule.logic === 'AND') {
    return results.every(r => r === true);
  } else {
    return results.some(r => r === true);
  }
}

/**
 * Findet passendes Template für einen Artikel
 */
function findMatchingTemplate(
  article: Product,
  templates: LabelTemplate[]
): LabelTemplate | null {
  // Nur Templates mit aktiviertem Auto-Matching
  const autoMatchTemplates = templates.filter(t => t.autoMatchEnabled && t.rules?.enabled);

  // Erstes Match gewinnt (Reihenfolge wichtig!)
  for (const template of autoMatchTemplates) {
    if (template.rules && evaluateRule(article, template.rules)) {
      return template;
    }
  }

  return null; // Kein Match gefunden
}

/**
 * HAUPT-FUNKTION: Matched alle Artikel mit Templates
 */
export function matchArticlesWithTemplates(
  articles: Product[],
  templates: LabelTemplate[]
): {
  matched: Array<{ articleId: string; templateId: string; articleNumber: string }>;
  skipped: Array<{ articleId: string; articleNumber: string; reason: string }>;
} {
  const matched: Array<{ articleId: string; templateId: string; articleNumber: string }> = [];
  const skipped: Array<{ articleId: string; articleNumber: string; reason: string }> = [];

  for (const article of articles) {
    const matchedTemplate = findMatchingTemplate(article, templates);

    if (matchedTemplate) {
      matched.push({
        articleId: article.id,
        templateId: matchedTemplate.id,
        articleNumber: article.articleNumber,
      });
    } else {
      skipped.push({
        articleId: article.id,
        articleNumber: article.articleNumber,
        reason: 'Kein passendes Template gefunden',
      });
    }
  }

  return { matched, skipped };
}
```

---

### **3. Articles Page Integration**

**Location:** `frontend/src/pages/Articles.tsx` (ÄNDERUNGEN)

```typescript
import { matchArticlesWithTemplates } from '../utils/templateMatcher';

// In handleGenerateLabelsClick():
const handleGenerateLabelsClick = () => {
  if (selectedArticles.size === 0) {
    showToast({ type: 'warning', message: 'Bitte wähle Artikel aus!' });
    return;
  }

  // Check if auto-match templates exist
  const autoMatchTemplates = availableTemplates.filter(t => t.autoMatchEnabled && t.rules?.enabled);

  if (autoMatchTemplates.length === 0) {
    // Fallback: Altes Verhalten (manuell Template wählen)
    setShowTemplateSelector(true);
    return;
  }

  // NEU: Automatisches Matching
  const selectedArticleObjects = articles.filter(a => selectedArticles.has(a.id));
  const matchResult = matchArticlesWithTemplates(selectedArticleObjects, availableTemplates);

  // Zeige Matching-Ergebnis
  setMatchResult(matchResult);
  setShowMatchPreview(true);
};

// NEU: Match Preview Modal
const MatchPreviewModal = ({ matchResult, onConfirm, onCancel }) => {
  return (
    <div className="modal">
      <h2>Label-Generierung Vorschau</h2>

      <div className="mb-4">
        <p className="text-green-600">
          ✅ {matchResult.matched.length} Artikel matched
        </p>
        {matchResult.skipped.length > 0 && (
          <p className="text-orange-600">
            ⚠️ {matchResult.skipped.length} Artikel übersprungen
          </p>
        )}
      </div>

      {/* Matched Articles */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Werden generiert:</h3>
        {matchResult.matched.map(match => {
          const template = availableTemplates.find(t => t.id === match.templateId);
          return (
            <div key={match.articleId} className="flex justify-between p-2 bg-green-50 rounded mb-1">
              <span>Artikel {match.articleNumber}</span>
              <span className="text-sm text-gray-600">→ {template?.name}</span>
            </div>
          );
        })}
      </div>

      {/* Skipped Articles */}
      {matchResult.skipped.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-orange-700">Werden übersprungen:</h3>
          {matchResult.skipped.map(skip => (
            <div key={skip.articleId} className="p-2 bg-orange-50 rounded mb-1">
              <span>Artikel {skip.articleNumber}</span>
              <span className="text-sm text-gray-600"> - {skip.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onCancel}>Abbrechen</button>
        <button
          onClick={onConfirm}
          disabled={matchResult.matched.length === 0}
        >
          {matchResult.matched.length} Labels generieren
        </button>
      </div>
    </div>
  );
};
```

---

### **4. Bulk Label Generation mit Matching**

```typescript
// NEU: Mutation für gematchte Artikel
const generateMatchedLabelsMutation = useMutation({
  mutationFn: async (matchResult: MatchResult) => {
    const results = await Promise.allSettled(
      matchResult.matched.map(match =>
        labelApi.generateFromArticle(match.articleId, match.templateId)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      successful,
      failed,
      skipped: matchResult.skipped.length,
      total: matchResult.matched.length + matchResult.skipped.length
    };
  },
  onSuccess: (data) => {
    showToast({
      type: 'success',
      message: `✅ ${data.successful} Labels generiert! ${data.skipped > 0 ? `⚠️ ${data.skipped} übersprungen` : ''}`,
      duration: 7000,
    });
    setSelectedArticles(new Set());
    setShowMatchPreview(false);
  },
});
```

---

## 🔧 **IMPLEMENTATION STEPS**

### **Phase 1: Data Model & Utils** ⏱️ 1-2h

1. ✅ **TypeScript Types erweitern**
   - `TemplateRule` Interface
   - `RuleCondition` Interface
   - `LabelTemplate` um `rules` und `autoMatchEnabled` erweitern
   - File: `frontend/src/types/template.types.ts` (NEU)

2. ✅ **Template Matcher erstellen**
   - `evaluateCondition()` - Einzelne Bedingung prüfen
   - `evaluateRule()` - Alle Bedingungen einer Regel prüfen
   - `findMatchingTemplate()` - Passendes Template finden
   - `matchArticlesWithTemplates()` - Haupt-Matching-Funktion
   - File: `frontend/src/utils/templateMatcher.ts` (NEU)
   - **Tests:** Unit-Tests für Matcher-Logik

---

### **Phase 2: Rule Builder UI** ⏱️ 2-3h

3. ✅ **RuleConditionRow Component**
   - Feld-Auswahl (priceType)
   - Operator-Auswahl (is, isNot)
   - Wert-Auswahl (normal, tiered)
   - Delete Button
   - File: `frontend/src/components/TemplateRuleBuilder/RuleConditionRow.tsx` (NEU)

4. ✅ **TemplateRuleBuilder Component**
   - Checkbox "Auto-Matching aktivieren"
   - Liste von Bedingungen
   - "Bedingung hinzufügen" Button
   - AND/OR Logic Selector
   - Preview der aktuellen Regel (optional)
   - File: `frontend/src/components/TemplateRuleBuilder/TemplateRuleBuilder.tsx` (NEU)

5. ✅ **Integration in Template Editor**
   - Regel-Sektion hinzufügen
   - Speichern & Laden von Regeln (localStorage)
   - File: `frontend/src/pages/LabelTemplateEditor.tsx` (ÄNDERN)

---

### **Phase 3: Match Preview Modal** ⏱️ 1-2h

6. ✅ **MatchPreviewModal Component**
   - Zeigt gematchte Artikel (grün)
   - Zeigt übersprungene Artikel (orange)
   - Template-Name pro Match
   - Bestätigen/Abbrechen Buttons
   - File: `frontend/src/components/MatchPreviewModal.tsx` (NEU)

---

### **Phase 4: Articles Page Integration** ⏱️ 2-3h

7. ✅ **Auto-Matching in Articles Page**
   - `handleGenerateLabelsClick()` erweitern
   - Prüfen ob Auto-Match Templates existieren
   - Matching durchführen
   - Match Preview anzeigen
   - File: `frontend/src/pages/Articles.tsx` (ÄNDERN)

8. ✅ **Bulk Generation Mutation anpassen**
   - `generateMatchedLabelsMutation` erstellen
   - Matched Artikel mit ihren Templates generieren
   - Toast mit Success/Skip Count
   - File: `frontend/src/pages/Articles.tsx` (ÄNDERN)

---

### **Phase 5: UX Verbesserungen** ⏱️ 1h

9. ✅ **Help-Text & Tooltips**
   - Erklärung wie Regeln funktionieren
   - Warnung bei gegenseitigen Regel-Überschneidungen
   - Beispiel-Templates vorschlagen

10. ✅ **Template Reihenfolge**
    - Drag & Drop für Template-Reihenfolge (optional)
    - Oder: Priority-Feld (1, 2, 3, ...)
    - Wichtig: "Erste passende Regel gewinnt"

---

### **Phase 6: Testing & Edge Cases** ⏱️ 1h

11. ✅ **Edge Cases testen**
    - Artikel ohne Preis (weder normal noch tiered)
    - Artikel mit beiden (normal UND tiered) - wie entscheiden?
    - Keine Templates mit Regeln vorhanden
    - Alle Artikel geskipped
    - Template-Regel fehlerhaft

12. ✅ **E2E Test**
    - Template mit Regel erstellen
    - Artikel auswählen (mix von normal/tiered)
    - Bulk-Generation starten
    - Matching prüfen
    - Labels überprüfen

---

## 🧪 **TESTING PLAN**

### **Unit Tests**

```typescript
// templateMatcher.test.ts

describe('evaluateCondition', () => {
  test('priceType = tiered: matches article with tieredPrices', () => {
    const article = { tieredPrices: [{ quantity: 10, price: 50 }] };
    const condition = { field: 'priceType', operator: 'is', value: 'tiered' };
    expect(evaluateCondition(article, condition)).toBe(true);
  });

  test('priceType = normal: matches article with normal price', () => {
    const article = { price: 100, tieredPrices: [] };
    const condition = { field: 'priceType', operator: 'is', value: 'normal' };
    expect(evaluateCondition(article, condition)).toBe(true);
  });
});

describe('matchArticlesWithTemplates', () => {
  test('matches articles correctly', () => {
    const articles = [
      { id: 'a1', price: 50, tieredPrices: [] },
      { id: 'a2', tieredPrices: [{ quantity: 10, price: 45 }] },
    ];
    const templates = [
      { id: 't1', rules: { conditions: [{ field: 'priceType', value: 'normal' }] } },
      { id: 't2', rules: { conditions: [{ field: 'priceType', value: 'tiered' }] } },
    ];

    const result = matchArticlesWithTemplates(articles, templates);

    expect(result.matched).toHaveLength(2);
    expect(result.matched[0].templateId).toBe('t1');
    expect(result.matched[1].templateId).toBe('t2');
  });
});
```

### **Integration Tests**

```typescript
// Articles.integration.test.tsx

test('Bulk label generation with auto-matching', async () => {
  // 1. Setup: Create templates with rules
  const templates = [
    createTemplateWithRule('normal'),
    createTemplateWithRule('tiered'),
  ];

  // 2. Select articles
  const articles = [
    { id: 'a1', price: 50 },
    { id: 'a2', tieredPrices: [...] },
  ];

  // 3. Click "Labels Generieren"
  await userEvent.click(screen.getByText('Labels Generieren'));

  // 4. Verify match preview shows
  expect(screen.getByText('2 Artikel matched')).toBeInTheDocument();

  // 5. Confirm generation
  await userEvent.click(screen.getByText('2 Labels generieren'));

  // 6. Verify API calls
  expect(labelApi.generateFromArticle).toHaveBeenCalledTimes(2);
  expect(labelApi.generateFromArticle).toHaveBeenCalledWith('a1', 't1');
  expect(labelApi.generateFromArticle).toHaveBeenCalledWith('a2', 't2');
});
```

---

## 📊 **BEISPIEL-WORKFLOW**

### **Schritt 1: Templates mit Regeln erstellen**

```
USER → Label Template Editor

Template 1: "Standard Label"
- Design: [Artikel-Nr, Name, Preis, Bild]
- Regel: ☑ Auto-Matching aktiv
  - Preis-Typ [ist] [Normaler Preis]

Template 2: "Staffelpreis Label"
- Design: [Artikel-Nr, Name, Staffelpreis-Tabelle, Bild]
- Regel: ☑ Auto-Matching aktiv
  - Preis-Typ [ist] [Staffelpreis]

→ Speichern
```

### **Schritt 2: Bulk Label Generation**

```
USER → Articles Page

Artikel auswählen:
[x] Artikel 8803 (Preis: 199,99 EUR)
[x] Artikel 9102 (Staffelpreise: ab 7: 190,92 EUR, ab 24: 180,60 EUR)
[x] Artikel 7654 (Preis: 49,99 EUR)

→ Click "Labels Generieren (3)"

AUTO-MATCHING läuft:
- Artikel 8803 → Template "Standard Label" ✓
- Artikel 9102 → Template "Staffelpreis Label" ✓
- Artikel 7654 → Template "Standard Label" ✓

Match Preview Modal:
┌────────────────────────────────────────┐
│ ✅ 3 Artikel matched                   │
│ ⚠️ 0 Artikel übersprungen              │
│                                        │
│ Werden generiert:                      │
│ • Artikel 8803 → Standard Label        │
│ • Artikel 9102 → Staffelpreis Label    │
│ • Artikel 7654 → Standard Label        │
│                                        │
│ [Abbrechen] [3 Labels generieren]      │
└────────────────────────────────────────┘

→ Click "3 Labels generieren"

BATCH GENERATION:
- API Call 1: generateFromArticle('8803', 'template-1') ✓
- API Call 2: generateFromArticle('9102', 'template-2') ✓
- API Call 3: generateFromArticle('7654', 'template-1') ✓

Toast: "✅ 3 Labels erfolgreich generiert!"
```

---

## 🚧 **EDGE CASES & FALLBACKS**

### **Edge Case 1: Kein passendes Template**
```
Artikel: { id: 'a1', price: null, tieredPrices: [] }

Result: Kein Match
→ In matchResult.skipped
→ Toast: "⚠️ 1 Artikel übersprungen (kein passendes Template)"
```

### **Edge Case 2: Artikel mit BEIDEN Preis-Typen**
```
Artikel: { id: 'a1', price: 100, tieredPrices: [{ quantity: 10, price: 90 }] }

Lösung: Priorisierung in evaluateCondition()
- Wenn tieredPrices vorhanden → gilt als "tiered"
- Nur wenn tieredPrices leer → gilt als "normal"
```

### **Edge Case 3: Keine Auto-Match Templates**
```
Alle Templates haben: autoMatchEnabled = false

Fallback: Altes Verhalten
→ Template-Selector Modal öffnen
→ Nutzer wählt manuell
```

### **Edge Case 4: Mehrere Templates matchen (sollte nicht passieren)**
```
Template 1: priceType = tiered
Template 2: priceType = tiered AND category = Werkzeug

Lösung: "Erste passende Regel gewinnt"
→ Template-Reihenfolge wichtig!
→ Spezifischere Regeln zuerst!
```

---

## 📈 **ZUKÜNFTIGE ERWEITERUNGEN**

### **Phase 2: Weitere Regel-Felder** (später)

```typescript
// Kategorie
{
  field: 'category',
  operator: 'is',
  value: 'Werkzeug'
}

// Preis-Bereich
{
  field: 'price',
  operator: 'greaterThan',
  value: 100
}

// Kombination
{
  logic: 'AND',
  conditions: [
    { field: 'priceType', operator: 'is', value: 'tiered' },
    { field: 'category', operator: 'is', value: 'Werkzeug' }
  ]
}
```

### **Phase 3: Template-Vorschläge** (optional)

```
System analysiert Artikel:
- 80% haben Staffelpreise
- 20% haben normalen Preis

Vorschlag:
"Möchtest du 2 Templates erstellen?
 - Template für Staffelpreise (80% deiner Artikel)
 - Template für normale Preise (20% deiner Artikel)"
```

---

## ✅ **SUCCESS METRICS**

Nach Implementation sollte das möglich sein:

1. ✅ **Template mit Regel erstellen**
   - Regel-Builder UI funktioniert
   - Regel wird gespeichert

2. ✅ **Auto-Matching funktioniert**
   - Artikel werden korrekt gematched
   - Skipped Artikel werden erkannt

3. ✅ **Bulk-Generation mit Mix**
   - 50 Artikel auswählen (Mix aus normal/tiered)
   - Click "Labels Generieren"
   - System matched automatisch
   - Labels werden mit korrekten Templates generiert

4. ✅ **User Feedback**
   - Toast zeigt Success/Skip Count
   - Match Preview zeigt welcher Artikel → welches Template

---

## 🎯 **ZUSAMMENFASSUNG DER ÄNDERUNGEN**

| File | Änderung | Typ |
|------|----------|-----|
| `types/template.types.ts` | TemplateRule, RuleCondition Interfaces | NEU |
| `utils/templateMatcher.ts` | Auto-Matching Engine | NEU |
| `components/TemplateRuleBuilder/` | Rule Builder UI Komponenten | NEU |
| `components/MatchPreviewModal.tsx` | Match Preview Modal | NEU |
| `pages/LabelTemplateEditor.tsx` | Regel-Sektion hinzufügen | ÄNDERN |
| `pages/Articles.tsx` | Auto-Matching Integration | ÄNDERN |

**Geschätzte Entwicklungszeit:** 8-10 Stunden

**Komplexität:** Mittel-Hoch

**Backend-Änderungen:** Keine! (Alles Frontend)

---

## 🚀 **READY TO IMPLEMENT!**

Alles geplant - von Data Model über UI bis Testing! 🎉
