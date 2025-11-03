# 🖨️ Bulk Print Implementation Plan

**Feature**: Bulk PDF Print für mehrere Labels
**Datum**: 2025-10-21
**Status**: Planning Phase

---

## 📋 OVERVIEW

Implementierung einer Bulk Print Funktion, die es ermöglicht:
- Mehrere ausgewählte Labels als **ein PDF** zu exportieren
- PDF wird automatisch im Print-Layout (Grid) angeordnet
- Direkt druckbar oder als Download verfügbar
- Mit Progress Tracking für große Batches

---

## 🎯 USER STORY

```
Als Nutzer möchte ich:
- Mehrere Labels (z.B. 50) auswählen
- Auf "X Labels drucken (PDF)" klicken
- Ein PDF mit allen Labels im konfigurierten Grid-Layout erhalten
- Das PDF direkt drucken oder herunterladen können
```

**Use Cases:**
1. **LivePreview Page**: Interaktiver Canvas → Export als PDF
2. **PrintPreview Page**: Statische Vorschau → Export/Drucken

---

## 🔍 CURRENT STATE ANALYSIS

### ✅ Was bereits existiert:

#### Backend
- **`/api/print/export`** (backend/src/api/routes/print.ts:67-116)
  - Nimmt `layout`, `labelIds`, `format` entgegen
  - Generiert PDF mit `PrintService.generatePDF()`
  - Liefert PDF als Binary Response
  - ✅ Funktioniert bereits!

#### Frontend
- **batchExportService** (frontend/src/services/batchExportService.ts)
  - Sequential Export Processing
  - Progress Tracking
  - Error Handling
  - ⚠️ Aktuell nur für einzelne Label-Exports (nicht für Bulk PDF)

- **printStore** (frontend/src/store/printStore.ts)
  - Layout Configuration
  - Paper Format, Grid Config, Settings
  - ✅ Alles vorhanden!

- **labelStore** (frontend/src/store/labelStore.ts)
  - Selected Labels Tracking
  - ✅ Kann genutzt werden!

- **LivePreview.tsx** (frontend/src/pages/LivePreview.tsx)
  - Line 245-247: "Print" Button ohne Funktion
  - ⚠️ Muss implementiert werden!

- **PrintPreview.tsx** (frontend/src/pages/PrintPreview.tsx)
  - Line 164-169: "Exportieren" Button ohne Funktion
  - Line 170-176: "Drucken" Button ruft `window.print()` auf
  - ⚠️ Muss implementiert werden!

### ❌ Was fehlt:

1. **Frontend API Client** für `/api/print/export`
2. **Bulk Print Service** für einfache API-Calls
3. **UI Implementation** in LivePreview & PrintPreview
4. **Loading States** & **Error Handling**
5. **Success Feedback** (Toast)
6. **PDF Download/Print Logic**

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                 USER CLICKS BUTTON                  │
│          "50 Labels drucken (PDF)"                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│         Frontend: LivePreview / PrintPreview        │
│  - Collect selected labels                          │
│  - Get layout config from printStore                │
│  - Show loading state                               │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│         bulkPrintService.exportPDF()                │
│  - Prepare request payload                          │
│  - Call printApi.exportPDF()                        │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│         printApi.exportPDF()                        │
│  POST /api/print/export                             │
│  {                                                  │
│    layout: { paperFormat, gridLayout, settings },   │
│    labelIds: ['id1', 'id2', ...],                   │
│    format: 'pdf'                                    │
│  }                                                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│         Backend: /api/print/export                  │
│  - Fetch labels from StorageService                 │
│  - Call PrintService.generatePDF()                  │
│  - Return PDF Buffer                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│         Frontend: Response Handling                 │
│  - Convert Blob to URL                              │
│  - Download PDF OR Open Print Dialog                │
│  - Show success toast                               │
│  - Clear loading state                              │
└─────────────────────────────────────────────────────┘
```

---

## 📦 IMPLEMENTATION PHASES

### **Phase 1: Frontend API Client** ⚙️

**File**: `frontend/src/services/api.ts`

**Changes**:
```typescript
// Add to existing api.ts

export const printApi = {
  /**
   * Export labels as PDF
   * @param layout - Print layout configuration
   * @param labelIds - Array of label IDs to export
   * @returns PDF Blob
   */
  async exportPDF(
    layout: PrintLayout,
    labelIds: string[]
  ): Promise<Blob> {
    const response = await axios.post(
      '/api/print/export',
      {
        layout,
        labelIds,
        format: 'pdf'
      },
      {
        responseType: 'blob', // Important!
        headers: {
          'Accept': 'application/pdf'
        }
      }
    );
    return response.data;
  },

  /**
   * Generate print preview
   * @param layout - Print layout configuration
   * @param labelIds - Array of label IDs
   * @returns Preview data
   */
  async generatePreview(
    layout: PrintLayout,
    labelIds: string[]
  ): Promise<any> {
    const response = await axios.post('/api/print/preview', {
      layout,
      labelIds
    });
    return response.data;
  }
};
```

**Why**:
- Reuse existing `/api/print/export` endpoint
- `responseType: 'blob'` ensures binary data handling
- Type-safe with PrintLayout interface

---

### **Phase 2: Bulk Print Service** 🚀

**File**: `frontend/src/services/bulkPrintService.ts` *(NEW)*

**Implementation**:
```typescript
/**
 * Bulk Print Service
 * Handles bulk PDF export and printing
 */
import { printApi } from './api';
import type { PrintLayout } from '../store/printStore';

export interface BulkPrintOptions {
  labelIds: string[];
  layout: PrintLayout;
  action: 'download' | 'print'; // Download PDF or Open Print Dialog
}

export interface BulkPrintResult {
  success: boolean;
  url?: string;
  error?: string;
  labelCount: number;
}

export class BulkPrintService {
  /**
   * Export multiple labels as single PDF
   */
  async exportAsPDF(options: BulkPrintOptions): Promise<BulkPrintResult> {
    const { labelIds, layout, action } = options;

    if (labelIds.length === 0) {
      return {
        success: false,
        error: 'No labels selected',
        labelCount: 0
      };
    }

    try {
      // Call API to generate PDF
      const blob = await printApi.exportPDF(layout, labelIds);

      // Create object URL
      const url = URL.createObjectURL(blob);

      // Perform action
      if (action === 'download') {
        this.downloadPDF(url, labelIds.length);
      } else if (action === 'print') {
        this.printPDF(url);
      }

      return {
        success: true,
        url,
        labelCount: labelIds.length
      };
    } catch (error) {
      console.error('Bulk print failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        labelCount: labelIds.length
      };
    }
  }

  /**
   * Download PDF file
   */
  private downloadPDF(url: string, labelCount: number): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = `labels-${labelCount}-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up URL after download
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Open print dialog with PDF
   */
  private printPDF(url: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      iframe.contentWindow?.print();

      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  }

  /**
   * Check if browser supports PDF printing
   */
  canPrint(): boolean {
    return typeof window.print === 'function';
  }
}

// Singleton instance
export const bulkPrintService = new BulkPrintService();
```

**Why**:
- Single Responsibility: One PDF for all labels
- Action-based: Download OR Print
- Browser-compatible: Works in all modern browsers
- Clean-up: URL.revokeObjectURL() prevents memory leaks

---

### **Phase 3: LivePreview.tsx Integration** 🎨

**File**: `frontend/src/pages/LivePreview.tsx`

**Changes**:

1. **Import**:
```typescript
import { bulkPrintService } from '../services/bulkPrintService';
import { Printer } from 'lucide-react';
```

2. **State**:
```typescript
const [isPrinting, setIsPrinting] = useState(false);
```

3. **Handler Function**:
```typescript
const handleBulkPrint = async (action: 'download' | 'print') => {
  if (selectedLabels.length === 0) {
    showToast({
      type: 'warning',
      message: 'Keine Labels ausgewählt'
    });
    return;
  }

  setIsPrinting(true);

  try {
    const result = await bulkPrintService.exportAsPDF({
      labelIds: selectedLabels.map(l => l.id),
      layout,
      action
    });

    if (result.success) {
      showToast({
        type: 'success',
        message: `✅ ${result.labelCount} Labels ${action === 'download' ? 'heruntergeladen' : 'zum Drucken vorbereitet'}!`
      });
    } else {
      showToast({
        type: 'error',
        message: `❌ Fehler: ${result.error}`
      });
    }
  } catch (error) {
    showToast({
      type: 'error',
      message: `❌ Fehler beim ${action === 'download' ? 'Download' : 'Drucken'}`
    });
  } finally {
    setIsPrinting(false);
  }
};
```

4. **UI Update** (replace line 245-247):
```tsx
<div className="space-y-3">
  <button
    onClick={() => setShowExportOptions(true)}
    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
    disabled={isExporting || isPrinting}
  >
    <Download className="w-4 h-4" />
    Konfigurieren & Export
  </button>

  {/* NEW: Bulk Print Button */}
  <button
    onClick={() => handleBulkPrint('print')}
    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    disabled={selectedLabels.length === 0 || isPrinting || isExporting}
  >
    <Printer className="w-4 h-4" />
    {isPrinting ? 'Druckt...' : `${selectedLabels.length} Labels drucken (PDF)`}
  </button>

  {/* NEW: Download PDF Button */}
  <button
    onClick={() => handleBulkPrint('download')}
    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    disabled={selectedLabels.length === 0 || isPrinting || isExporting}
  >
    <Download className="w-4 h-4" />
    {isPrinting ? 'Lädt...' : 'PDF herunterladen'}
  </button>
</div>

<p className="text-xs text-gray-500 mt-3">
  {selectedLabels.length} Label{selectedLabels.length !== 1 ? 's' : ''} ausgewählt
</p>
```

**Why**:
- Two separate buttons: Print vs. Download
- Disabled state when no selection
- Loading states with text change
- User feedback via Toast

---

### **Phase 4: PrintPreview.tsx Integration** 🖼️

**File**: `frontend/src/pages/PrintPreview.tsx`

**Changes**:

1. **Import**:
```typescript
import { bulkPrintService } from '../services/bulkPrintService';
```

2. **State**:
```typescript
const [isPrinting, setIsPrinting] = useState(false);
```

3. **Handler Function**:
```typescript
const handleBulkPrint = async (action: 'download' | 'print') => {
  const labelIds = articlesToDisplay.map((item: any) => item.id);

  if (labelIds.length === 0) {
    alert('Keine Labels zum Drucken verfügbar');
    return;
  }

  setIsPrinting(true);

  try {
    const result = await bulkPrintService.exportAsPDF({
      labelIds,
      layout,
      action
    });

    if (!result.success) {
      alert(`Fehler: ${result.error}`);
    }
  } catch (error) {
    console.error('Print error:', error);
    alert('Fehler beim Drucken');
  } finally {
    setIsPrinting(false);
  }
};
```

4. **UI Update** (replace lines 156-176):
```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => navigate('/print')}
    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
  >
    <Settings className="w-4 h-4" />
    Einstellungen
  </button>

  {/* Updated: Exportieren Button */}
  <button
    onClick={() => handleBulkPrint('download')}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
    disabled={isPrinting || articlesToDisplay.length === 0}
  >
    <Download className="w-4 h-4" />
    {isPrinting ? 'Exportiert...' : 'PDF herunterladen'}
  </button>

  {/* Updated: Drucken Button */}
  <button
    onClick={() => handleBulkPrint('print')}
    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
    disabled={isPrinting || articlesToDisplay.length === 0}
  >
    <Printer className="w-4 h-4" />
    {isPrinting ? 'Druckt...' : `${articlesToDisplay.length} Labels drucken`}
  </button>
</div>
```

**Why**:
- Reuse same `bulkPrintService`
- Two clear actions: Download vs. Print
- Disabled when no data
- Loading feedback

---

### **Phase 5: Type Definitions** 📝

**File**: `frontend/src/services/api.ts`

**Add Import**:
```typescript
import type { PrintLayout } from '../store/printStore';
```

**Why**:
- Type-safe API calls
- Reuse existing PrintLayout type
- No duplication

---

### **Phase 6: Error Handling & Edge Cases** ⚠️

**Scenarios to handle**:

1. **No Labels Selected**:
   - Disable button
   - Show warning toast if clicked

2. **API Error (500)**:
   - Catch error
   - Show error toast with message
   - Log to console

3. **Network Error**:
   - Axios will throw
   - Show generic error toast

4. **Large Batch (100+ labels)**:
   - Backend may timeout
   - Consider showing progress modal (future enhancement)

5. **Browser Compatibility**:
   - PDF download works in all modern browsers
   - Print dialog requires iframe trick (implemented)

**Implementation**:
- All handlers use try/catch
- Toast notifications for all outcomes
- Loading states prevent double-clicks
- Disabled states when no data

---

## 🧪 TESTING CHECKLIST

### Test Scenario 1: LivePreview - Single Label Print
1. ✅ Go to LivePreview page
2. ✅ Select 1 label
3. ✅ Click "1 Labels drucken (PDF)"
4. ✅ Expected: Print dialog opens with PDF

### Test Scenario 2: LivePreview - Bulk Print
1. ✅ Go to LivePreview page
2. ✅ Select 10 labels
3. ✅ Click "10 Labels drucken (PDF)"
4. ✅ Expected: Print dialog opens with 10 labels in grid

### Test Scenario 3: LivePreview - PDF Download
1. ✅ Go to LivePreview page
2. ✅ Select 5 labels
3. ✅ Click "PDF herunterladen"
4. ✅ Expected: PDF file downloads (labels-5-{timestamp}.pdf)

### Test Scenario 4: PrintPreview - Export from Template
1. ✅ Go to Templates page
2. ✅ Click "Preview" on a template with printLayoutId
3. ✅ PrintPreview opens with articles
4. ✅ Click "PDF herunterladen"
5. ✅ Expected: PDF downloads with template-rendered labels

### Test Scenario 5: PrintPreview - Direct Print
1. ✅ Go to PrintPreview page
2. ✅ Click "X Labels drucken"
3. ✅ Expected: Print dialog opens

### Test Scenario 6: No Selection
1. ✅ Go to LivePreview
2. ✅ Deselect all labels
3. ✅ Both print buttons should be disabled
4. ✅ Expected: Buttons show disabled state

### Test Scenario 7: Loading States
1. ✅ Click print button
2. ✅ Button text changes to "Druckt..." / "Lädt..."
3. ✅ Button is disabled during processing
4. ✅ Expected: Prevents double-clicks

### Test Scenario 8: Error Handling
1. ✅ Simulate API error (backend down)
2. ✅ Click print button
3. ✅ Expected: Error toast appears
4. ✅ Button returns to normal state

### Test Scenario 9: Grid Layout Verification
1. ✅ Configure custom grid (3×4)
2. ✅ Select 12 labels
3. ✅ Export PDF
4. ✅ Expected: PDF has exactly 3 columns, 4 rows

### Test Scenario 10: Multiple Pages
1. ✅ Configure grid 2×3 (6 labels per page)
2. ✅ Select 15 labels
3. ✅ Export PDF
4. ✅ Expected: PDF has 3 pages (6+6+3 labels)

---

## 📊 IMPLEMENTATION CHECKLIST

### Phase 1: API Client ✅
- [ ] Add `printApi.exportPDF()` to `frontend/src/services/api.ts`
- [ ] Add `printApi.generatePreview()` (optional, future enhancement)
- [ ] Add type imports for PrintLayout
- [ ] Test API call with Postman/Thunder Client

### Phase 2: Bulk Print Service ✅
- [ ] Create `frontend/src/services/bulkPrintService.ts`
- [ ] Implement `BulkPrintService` class
- [ ] Implement `exportAsPDF()` method
- [ ] Implement `downloadPDF()` helper
- [ ] Implement `printPDF()` helper
- [ ] Export singleton instance
- [ ] Test download flow
- [ ] Test print flow

### Phase 3: LivePreview Integration ✅
- [ ] Import `bulkPrintService`
- [ ] Add `isPrinting` state
- [ ] Implement `handleBulkPrint()` handler
- [ ] Update button UI (2 buttons: Print + Download)
- [ ] Add loading states
- [ ] Add disabled states
- [ ] Test with 1 label
- [ ] Test with 10 labels
- [ ] Test with 50+ labels

### Phase 4: PrintPreview Integration ✅
- [ ] Import `bulkPrintService`
- [ ] Add `isPrinting` state
- [ ] Implement `handleBulkPrint()` handler
- [ ] Update "Exportieren" button
- [ ] Update "Drucken" button
- [ ] Add loading states
- [ ] Test export flow
- [ ] Test print flow

### Phase 5: Type Safety ✅
- [ ] Verify PrintLayout import
- [ ] Add BulkPrintOptions interface
- [ ] Add BulkPrintResult interface
- [ ] Run `tsc --noEmit` → 0 errors

### Phase 6: Quality Assurance ✅
- [ ] Run ESLint → 0 errors
- [ ] Test all 10 test scenarios
- [ ] Test error handling
- [ ] Test edge cases (0 labels, 100+ labels)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile testing (responsive)

### Phase 7: Documentation ✅
- [ ] Update IMPLEMENTATION_PLAN.md
- [ ] Mark Schritt 3 as completed
- [ ] Add usage examples to README (optional)
- [ ] Create test report

---

## 🎯 SUCCESS CRITERIA

✅ **Feature is considered DONE when**:

1. ✅ User can select multiple labels in LivePreview
2. ✅ User can click "X Labels drucken (PDF)" button
3. ✅ PDF is generated with correct grid layout
4. ✅ Print dialog opens with PDF OR PDF downloads
5. ✅ Loading states work correctly
6. ✅ Error states work correctly
7. ✅ Toast notifications appear for success/error
8. ✅ Works with 1 label, 10 labels, 50+ labels
9. ✅ Works in LivePreview AND PrintPreview pages
10. ✅ 0 TypeScript errors
11. ✅ 0 Linting errors
12. ✅ All 10 test scenarios pass

---

## 🚀 ESTIMATED EFFORT

| Phase | Task | Time |
|-------|------|------|
| 1 | API Client | 15 min |
| 2 | Bulk Print Service | 30 min |
| 3 | LivePreview Integration | 20 min |
| 4 | PrintPreview Integration | 15 min |
| 5 | Type Checking | 5 min |
| 6 | Testing (all scenarios) | 30 min |
| 7 | Documentation | 10 min |
| **TOTAL** | | **~2 hours** |

---

## 🔧 TECHNICAL NOTES

### PDF Generation Backend (bereits implementiert)
- **Endpoint**: `POST /api/print/export`
- **Method**: `PrintService.generatePDF(layout, labels)`
- **Response**: Binary PDF (application/pdf)
- **Tested**: ✅ Funktioniert bereits!

### Frontend PDF Handling
- **Blob Response**: `responseType: 'blob'` in Axios
- **Object URL**: `URL.createObjectURL(blob)`
- **Download**: `<a>` Element mit `download` Attribut
- **Print**: Hidden `<iframe>` mit `contentWindow.print()`
- **Cleanup**: `URL.revokeObjectURL(url)` nach Nutzung

### Grid Layout Logic
- **Backend**: PrintService berechnet Grid-Positionen automatisch
- **Frontend**: Übergibt nur `layout.gridLayout` (columns, rows, spacing, margins)
- **Multi-Page**: Backend erstellt automatisch mehrere Seiten wenn nötig

### Browser Compatibility
- **Download**: ✅ Chrome, Firefox, Safari, Edge
- **Print**: ✅ Chrome, Firefox, Safari, Edge
- **Mobile**: ⚠️ Print may not work on iOS Safari (known limitation)

---

## 🎨 UI/UX CONSIDERATIONS

### Button Placement
- **LivePreview**: Sidebar (rechts) unter "Export Options"
- **PrintPreview**: Header (oben rechts) neben Einstellungen

### Button States
```
Default:    "X Labels drucken (PDF)" - Grün, enabled
Loading:    "Druckt..." - Grün, disabled
No Select:  "0 Labels drucken (PDF)" - Grau, disabled
Error:      Zurück zu Default + Toast
```

### User Feedback
- **Before**: Button zeigt Label-Count
- **During**: Button disabled + "Druckt..."
- **Success**: Toast "✅ 10 Labels zum Drucken vorbereitet!"
- **Error**: Toast "❌ Fehler: ..."

### Loading Indicator
- Button text changes to "Druckt..." / "Lädt..."
- Optional: Spinner icon (future enhancement)
- Disabled state prevents multiple clicks

---

## 🔮 FUTURE ENHANCEMENTS (Optional)

1. **Progress Modal** (for large batches):
   - Show modal during PDF generation
   - Display progress bar
   - "Generating PDF... 45%"
   - Cancel button

2. **Preview Before Print**:
   - Modal mit PDF-Vorschau
   - Bestätigen/Abbrechen

3. **Print Settings**:
   - Copies (Anzahl Kopien)
   - Duplex (beidseitig)
   - Color/Grayscale

4. **Batch Optimization**:
   - Server-side compression
   - Parallel PDF generation
   - Caching

5. **Export Formats**:
   - Export as PNG images (one per label)
   - Export as SVG (vector)

---

## 📝 IMPLEMENTATION NOTES

### Why NOT use window.print()?
- `window.print()` druckt die GANZE Seite (inkl. UI)
- Wir wollen NUR die Labels drucken
- Lösung: Hidden iframe mit PDF → `iframe.contentWindow.print()`

### Why Blob + Object URL?
- Axios `responseType: 'blob'` gibt Binary Data zurück
- `URL.createObjectURL()` erstellt temporäre URL
- Download/Print braucht URL
- `URL.revokeObjectURL()` verhindert Memory Leaks

### Why Singleton Service?
- Eine Instanz für gesamte App
- Kein State-Management nötig
- Einfach importierbar

### Why Separate Buttons (Print vs. Download)?
- User hat klare Kontrolle
- Print: Öffnet Druck-Dialog
- Download: Speichert Datei
- Beide Aktionen sind common use-cases

---

## ✅ FINAL DELIVERABLES

1. **Code**:
   - `frontend/src/services/api.ts` (updated)
   - `frontend/src/services/bulkPrintService.ts` (new)
   - `frontend/src/pages/LivePreview.tsx` (updated)
   - `frontend/src/pages/PrintPreview.tsx` (updated)

2. **Documentation**:
   - This file: `BULK_PRINT_IMPLEMENTATION_PLAN.md`
   - Updated: `IMPLEMENTATION_PLAN.md` (mark Schritt 3 done)
   - Test Report: `TESTING_CHECKLIST.md` (updated)

3. **Quality**:
   - 0 TypeScript Errors
   - 0 Linting Errors
   - All test scenarios pass

---

## 🎉 SUMMARY

Wir implementieren eine **Bulk PDF Print Funktion**, die:
- ✅ Mehrere Labels als **ein PDF** exportiert
- ✅ Automatisch im Grid-Layout anordnet
- ✅ **Direkt druckbar** (Print Dialog) ODER **downloadbar** ist
- ✅ In **LivePreview** UND **PrintPreview** verfügbar ist
- ✅ Mit Loading States, Error Handling, Toast Feedback
- ✅ In **~2 Stunden** implementierbar ist

**User Flow**:
```
1. Nutzer wählt 50 Labels aus
2. Nutzer klickt "50 Labels drucken (PDF)"
3. Button zeigt "Druckt..."
4. PDF wird generiert (Backend)
5. Print Dialog öffnet sich mit PDF
6. Nutzer druckt auf Drucker
7. Toast: "✅ 50 Labels zum Drucken vorbereitet!"
```

**Alternative Flow (Download)**:
```
1. Nutzer wählt 50 Labels aus
2. Nutzer klickt "PDF herunterladen"
3. Button zeigt "Lädt..."
4. PDF wird generiert (Backend)
5. PDF-Datei wird heruntergeladen
6. Toast: "✅ 50 Labels heruntergeladen!"
```

**SO EINFACH!** 🚀

---

**Ready to implement?** Let's go! 🎯
