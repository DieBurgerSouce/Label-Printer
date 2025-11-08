# Template Systems Documentation

## Overview

The Screenshot_Algo project uses **TWO separate template systems** with different purposes. Understanding this distinction is crucial!

---

## 1. Label Templates

**Purpose:** Define **matching rules** for auto-assigning templates to articles based on price type

**Location:** `backend/data/label-templates/`

**Files:**
- `normal-price-auto-match.json` - For normal priced products
- `tiered-price-auto-match.json` - For tiered price products
- `auf-anfrage-auto-match.json` - For "on request" products

**Structure:**
```json
{
  "id": "template-uuid",
  "name": "Normal Price Template",
  "description": "For products with normal pricing",
  "autoMatchRules": {
    "priceType": ["normal"],
    "conditions": []
  },
  "layers": [
    {
      "type": "text",
      "content": "{{productName}}",
      "position": { "x": 10, "y": 10 }
    }
  ]
}
```

**Key Features:**
- **Auto-matching logic:** Automatically assigns template based on article's `priceType`
- **Rules-based:** Uses `autoMatchRules` to determine which template to use
- **Managed by:** `LabelTemplateService`
- **Used by:** Articles API when generating labels

**Code:**
- Service: `backend/src/services/label-template-service.ts`
- API: `backend/src/api/routes/label-templates.ts`

---

## 2. Rendering Templates

**Purpose:** Define **visual design** and layout for rendering labels

**Location:** `backend/data/templates/` (print templates directory)

**Structure:**
```json
{
  "id": "rendering-uuid",
  "name": "Standard Label Design",
  "width": 105,
  "height": 74,
  "layers": [
    {
      "type": "text",
      "content": "{{articleNumber}}",
      "font": "Arial",
      "fontSize": 12,
      "position": { "x": 5, "y": 5 }
    },
    {
      "type": "qrcode",
      "content": "{{url}}",
      "size": 20,
      "position": { "x": 80, "y": 50 }
    }
  ]
}
```

**Key Features:**
- **Visual design:** Defines fonts, colors, positions, sizes
- **Rendering engine:** Used by PDFKit to generate actual PDF/PNG labels
- **Layer-based:** Multiple layers (text, images, QR codes, shapes)
- **Managed by:** `TemplateStorageService` and `TemplateEngine`
- **Used by:** Print Service when creating PDFs

**Code:**
- Storage: `backend/src/services/template-storage-service.ts`
- Engine: `backend/src/services/template-engine.ts`
- API: `backend/src/api/routes/templates.ts`

---

## 3. The Bridge: Label-to-Rendering Converter

**Purpose:** Convert Label Templates to Rendering Templates

**Why needed?**
- Label Templates define WHAT to show (data + rules)
- Rendering Templates define HOW to show it (visual design)

**Service:** `backend/src/services/label-to-rendering-converter.ts`

**What it does:**
```typescript
// Takes a Label Template (with auto-match rules)
const labelTemplate = { /* ... */ };

// Converts to Rendering Template (with visual design)
const renderingTemplate = convertLabelTemplateToRenderingTemplate(labelTemplate);

// Now can be rendered by TemplateEngine
const pdf = await templateEngine.renderTemplate(renderingTemplate, data);
```

---

## 4. Prisma Template Model

**Status:** ❌ **DEFINED BUT UNUSED**

**Location:** `backend/prisma/schema.prisma`

```prisma
model Template {
  id      String   @id @default(uuid())
  name    String
  layers  Json
  // ... more fields
}
```

**Problem:**
- Schema defines database storage for templates
- **BUT**: Code uses file-based storage instead!
- **Result:** Model is never queried, tables exist but empty

**Why?**
- Original plan was to store templates in database
- Implementation used file-based storage for simplicity
- Database model was never removed

**Should we migrate?**
- **Pros:** Better version control, user permissions, backups
- **Cons:** More complexity, migration effort
- **Decision:** Keep file-based for now, migrate later if needed

---

## Data Flow

### Creating a Label

```
1. User selects articles in frontend
   ↓
2. Frontend calls /api/labels/generate-from-articles
   ↓
3. LabelTemplateService.autoMatchTemplates(articles)
   - Checks each article's priceType
   - Matches to appropriate Label Template
   ↓
4. LabelToRenderingConverter.convert(labelTemplate)
   - Converts to Rendering Template format
   ↓
5. TemplateEngine.renderTemplate(renderingTemplate, articleData)
   - Uses PDFKit to render actual label
   - Generates PNG/PDF with text, QR codes, etc.
   ↓
6. Returns generated label to frontend
```

---

## Key Files

### Label Templates System
- `backend/src/services/label-template-service.ts` - Template management & auto-matching
- `backend/src/api/routes/label-templates.ts` - CRUD API for label templates
- `backend/data/label-templates/*.json` - Actual template files

### Rendering Templates System
- `backend/src/services/template-engine.ts` - Renders templates to PDF/PNG
- `backend/src/services/template-storage-service.ts` - File-based storage
- `backend/src/api/routes/templates.ts` - CRUD API for rendering templates
- `backend/data/templates/*.json` - Actual template files (if any)

### Bridge
- `backend/src/services/label-to-rendering-converter.ts` - Converts between formats

### Print Service
- `backend/src/services/print-service.ts` - Uses templates to generate print PDFs
- `backend/src/api/routes/print.ts` - Print API endpoints

---

## Common Confusion

### ❌ "Why do we have so many template systems?"
**Answer:** They serve different purposes:
- **Label Templates** = Business logic (matching rules)
- **Rendering Templates** = Visual design (how it looks)
- Both are needed for the complete workflow

### ❌ "Why not use the Prisma Template model?"
**Answer:**
- Originally planned but not implemented
- File-based storage was simpler for MVP
- Can migrate later if database storage is needed

### ❌ "Can I delete one of the template systems?"
**Answer:** NO! Both are required:
- Without Label Templates: No auto-matching logic
- Without Rendering Templates: No way to render to PDF

---

## Future Improvements

### Option 1: Migrate to Database
- Move all templates from files to PostgreSQL
- Use Prisma Template model
- Add versioning, permissions, auditing
- **Effort:** 2-3 days

### Option 2: Consolidate Systems
- Merge Label + Rendering templates into one format
- Simplify data model
- **Risk:** Breaking changes, need migration
- **Effort:** 1 week

### Option 3: Keep As-Is
- File-based storage works fine
- Easy to version control (Git)
- Simple backup (copy files)
- **Recommendation:** Keep for now unless scaling issues

---

## Quick Reference

**Need to add a new template?**
1. Create JSON file in `backend/data/label-templates/`
2. Define `autoMatchRules` for matching
3. Define `layers` for content
4. Restart backend (templates loaded on startup)

**Need to change how labels look?**
1. Update Rendering Template in `backend/data/templates/`
2. OR update `template-engine.ts` rendering logic
3. Test with Print Preview

**Need to debug template matching?**
1. Check `LabelTemplateService.autoMatchTemplates()` logs
2. Verify article's `priceType` field
3. Check `autoMatchRules` in template JSON

---

**Generated:** 2025-11-07
**Version:** 1.0
**Status:** ✅ Complete and Accurate
