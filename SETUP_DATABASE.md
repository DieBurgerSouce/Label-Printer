# 🔧 Datenbank Setup - Products Tabelle

## ⚠️ Problem

Die Supabase-Credentials in der `.env` sind abgelaufen oder ungültig.

## ✅ Lösung

### Option 1: Supabase UI (EMPFOHLEN - am einfachsten!)

1. **Gehe zu Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Wähle dein Projekt: `jctdnesaafgncovopnyx`

2. **Öffne den SQL Editor:**
   - Linke Sidebar → SQL Editor
   - Klicke auf "+ New query"

3. **Kopiere & Führe dieses SQL aus:**

```sql
-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "tieredPrices" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "ean" TEXT,
    "category" TEXT,
    "manufacturer" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "crawlJobId" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_articleNumber_key" ON "products"("articleNumber");

-- CreateIndex
CREATE INDEX "products_articleNumber_idx" ON "products"("articleNumber");

-- CreateIndex
CREATE INDEX "products_crawlJobId_idx" ON "products"("crawlJobId");

-- CreateIndex
CREATE INDEX "products_published_idx" ON "products"("published");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");
```

4. **Klicke auf "Run" (oder Strg+Enter)**

5. **Fertig!** Die Tabelle ist erstellt.

---

### Option 2: Neue Supabase Credentials holen

Falls du die Migration via Prisma ausführen willst:

1. **Supabase Dashboard öffnen:**
   - https://supabase.com/dashboard
   - Projekt auswählen

2. **Settings → Database → Connection String:**
   - Kopiere die "Direct connection" URL
   - **WICHTIG:** Wähle "Transaction" Modus (Port 5432, NICHT 6543!)

3. **Update `backend/.env`:**
   ```env
   DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@db.jctdnesaafgncovopnyx.supabase.co:5432/postgres"
   ```

4. **Migration ausführen:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

---

## 🚀 Danach: Alles funktioniert automatisch!

```
1. Shop URL eingeben: shop.firmenich.de
   ↓
2. Crawler läuft → findet alle Produkte
   ↓
3. Screenshots werden gemacht
   ↓
4. OCR extrahiert: Art.Nr., Preis, Staffelpreise
   ↓
5. ✅ AUTOMATISCH in products-Tabelle gespeichert!
   ↓
6. Artikel-Seite zeigt alle Artikel
   ↓
7. Labels generieren!
```

---

## 📋 Was wurde bereits implementiert:

✅ **Backend:**
- `/api/articles` - Alle CRUD Endpoints
- `ProductService` - Automatisches Speichern nach OCR
- `automation-service.ts` - Integration in Workflow (Step 2.5)

✅ **Frontend:**
- `/articles` - Artikel-Verwaltungsseite
- Suche, Filter, Pagination
- Bulk Actions (Delete, Export, Labels)
- Excel/DB-ähnliche Tabelle

✅ **Workflow:**
- Nach OCR wird automatisch `ProductService.processOcrResultsFromCrawlJob()` aufgerufen
- Alle Produkte mit Art.Nr. werden in DB gespeichert

---

## 🧪 Testen nach Setup:

1. Öffne: http://localhost:5173/automation
2. Gib ein: `shop.firmenich.de`
3. Starte Automation
4. Warte bis fertig (~5-10 Min bei 50 Produkten)
5. Öffne: http://localhost:5173/articles
6. **BOOM!** Alle Artikel sind da! 🎉

---

**Alles ist bereit! Nur die Datenbank-Tabelle muss noch erstellt werden.**
