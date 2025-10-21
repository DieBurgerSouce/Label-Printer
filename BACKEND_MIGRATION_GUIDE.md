# 🚀 Backend Migration Guide - Sauberes Neusetup

**Ziel:** Komplett sauberes Backend mit neuer Supabase-Datenbank

**Dauer:** ~1 Stunde

---

## 📋 Voraussetzungen

- [ ] Node.js 20.19+ installiert
- [ ] npm installiert
- [ ] Supabase Account (kostenlos)
- [ ] ImageKit Account (optional, für CDN)

---

## Schritt 1: Neues Supabase Projekt erstellen (10 Min)

### 1.1 Supabase Dashboard öffnen

1. Gehe zu: https://supabase.com/dashboard
2. Klicke auf "New Project"

### 1.2 Projekt konfigurieren

```
Name: label-printer-production
Region: Europe West (eu-central-1) - Frankfurt
Database Password: [STARK & SICHER - SPEICHERN!]
Pricing Plan: Free
```

**⚠️ WICHTIG:** Speichere das Database Password sofort in einem Passwort-Manager!

### 1.3 Warte auf Projekt-Setup

- Dauer: ~2 Minuten
- Status wird angezeigt oben rechts

---

## Schritt 2: Credentials holen (5 Min)

### 2.1 Project URL & API Keys

1. **Settings** (linke Sidebar) → **API**
2. Kopiere:
   - Project URL
   - anon public Key
   - service_role Key (secret!)

### 2.2 Database Connection Strings

1. **Settings** → **Database** → **Connection string**
2. Wähle **"Transaction"** Mode
3. Kopiere die **Direct connection** URL:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**⚠️ Port 5432 ist wichtig!** (Nicht 6543!)

---

## Schritt 3: .env Datei erstellen (3 Min)

### 3.1 Template kopieren

```bash
cd backend
cp .env.example .env
```

### 3.2 .env ausfüllen

Öffne `backend/.env` und trage ein:

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase Database
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[IHR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="[IHR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[IHR-SERVICE-ROLE-KEY]"

# ImageKit (behalten von alter .env)
IMAGEKIT_PUBLIC_KEY="..."
IMAGEKIT_PRIVATE_KEY="..."
IMAGEKIT_URL_ENDPOINT="..."

# Storage
STORAGE_PATH="./storage"
SCREENSHOTS_PATH="./storage/screenshots"
THUMBNAILS_PATH="./storage/thumbnails"
LABELS_PATH="./storage/labels"
TEMP_PATH="./storage/temp"
```

### 3.3 Prüfe die .env

```bash
cat .env | grep DATABASE_URL
```

Sollte zeigen: `DATABASE_URL="postgresql://postgres...5432/postgres"`

---

## Schritt 4: Alte Migrations löschen (2 Min)

```bash
# In backend/
rm -rf prisma/migrations/*
```

**Warum?** Wir erstellen eine komplett neue, saubere Initial Migration.

---

## Schritt 5: Database Setup (One-Click!) (5 Min)

### 5.1 Dependencies installieren (falls noch nicht geschehen)

```bash
npm install
```

### 5.2 Setup-Script ausführen

```bash
npm run setup:db
```

**Das Script macht:**
1. ✅ Prisma Client neu generieren
2. ✅ Initial Migration erstellen (alle Tabellen)
3. ✅ Migration ausführen
4. ✅ Schema verifizieren
5. ✅ Test-Verbindung

**Erwartete Ausgabe:**
```
🚀 Starting Database Setup...
✅ Prisma Client generated
✅ Initial migration created
✅ Migration deployed successfully
✅ Schema verified
✨ Database setup complete!

📊 Database Summary:
- Tables: 9
- Products table: ✅
- CrawlJobs table: ✅
- Screenshots table: ✅
- OcrResults table: ✅
- Matches table: ✅
- Templates table: ✅
- Labels table: ✅
- AutomationJobs table: ✅
- ExcelData table: ✅

🎉 Ready to use!
```

---

## Schritt 6: Backend starten & testen (10 Min)

### 6.1 Backend starten

```bash
npm run dev
```

**Erwartete Ausgabe:**
```
Initializing storage...
Initializing OCR service...
✅ OCR Service initialized with 4 workers
Initializing WebSocket server...
[WebSocket] Server initialized and ready
🚀 Label Printer Backend running on http://localhost:3001
🔌 WebSocket server ready for real-time updates
📋 API Endpoints:
   - Labels:     http://localhost:3001/api/labels
   - Excel:      http://localhost:3001/api/excel
   - Print:      http://localhost:3001/api/print
   - Crawler:    http://localhost:3001/api/crawler
   - OCR:        http://localhost:3001/api/ocr
   - Templates:  http://localhost:3001/api/templates
   - Automation: http://localhost:3001/api/automation
   - Articles:   http://localhost:3001/api/articles ← NEU!
   - Health:     http://localhost:3001/api/health
```

### 6.2 Health Check

In neuem Terminal:

```bash
curl http://localhost:3001/api/health
```

**Erwartete Antwort:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-17T..."
}
```

### 6.3 Articles API testen

```bash
curl http://localhost:3001/api/articles
```

**Erwartete Antwort:**
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

✅ **Perfekt!** Leere Liste ist korrekt - keine Daten yet!

### 6.4 Articles Stats testen

```bash
curl http://localhost:3001/api/articles/stats
```

**Erwartete Antwort:**
```json
{
  "success": true,
  "data": {
    "total": 0,
    "withImages": 0,
    "verified": 0,
    "published": 0,
    "categories": []
  }
}
```

✅ **Alles null ist korrekt!**

---

## Schritt 7: Integration Test (5 Min)

```bash
npm run test:integration
```

**Was wird getestet:**
1. ✅ Database-Verbindung
2. ✅ Alle API Endpoints
3. ✅ WebSocket-Verbindung
4. ✅ OCR Service
5. ✅ Crawler Service
6. ✅ Product Service

**Erwartete Ausgabe:**
```
🧪 Running Integration Tests...

✅ Database Connection: OK
✅ Health API: OK
✅ Articles API: OK
✅ Labels API: OK
✅ WebSocket: OK
✅ OCR Service: OK
✅ Crawler Service: OK

🎉 All tests passed!
```

---

## Schritt 8: Test-Daten erstellen (Optional, 5 Min)

```bash
npm run seed:db
```

**Was wird erstellt:**
- 5 Test-Produkte
- 2 Sample Templates
- 1 Test Crawl Job

**Danach:**
```bash
curl http://localhost:3001/api/articles
```

Sollte 5 Test-Artikel zeigen!

---

## Schritt 9: Frontend testen (5 Min)

### 9.1 Frontend starten

In neuem Terminal:
```bash
cd ../frontend
npm run dev
```

### 9.2 Artikel-Seite öffnen

Browser: http://localhost:5173/articles

**Erwartete Ansicht:**
- Leere Tabelle (falls keine Test-Daten)
- ODER 5 Test-Artikel (falls Seed ausgeführt)
- Keine Fehler in der Console!

---

## Schritt 10: End-to-End Test (10 Min)

### 10.1 Shop Automation testen

1. Öffne: http://localhost:5173/automation
2. Gib ein: `https://example.com` (Für schnellen Test)
3. Max Products: `5`
4. Klicke "Automation Starten"

### 10.2 Workflow beobachten

```
1. Crawling ✅
   ↓
2. OCR Processing ✅
   ↓
3. Products Saved to DB ✅ ← NEU!
   ↓
4. Matching (optional)
   ↓
5. Label Rendering ✅
```

### 10.3 Artikel prüfen

Öffne: http://localhost:5173/articles

**Erwartung:** Alle gecrawlten Produkte erscheinen in der Tabelle!

---

## ✅ Checkliste - Alles erledigt?

- [ ] Neues Supabase Projekt erstellt
- [ ] Credentials in .env eingetragen
- [ ] Alte Migrations gelöscht
- [ ] `npm run setup:db` ausgeführt
- [ ] Backend startet ohne Fehler
- [ ] Health Check funktioniert
- [ ] Articles API antwortet
- [ ] Integration Tests grün
- [ ] Frontend lädt Artikel-Seite
- [ ] End-to-End Test erfolgreich

---

## 🎉 Fertig!

**Du hast jetzt:**
✅ Komplett sauberes Backend
✅ Neue Supabase-Datenbank mit allen Tabellen
✅ Automatische Product-Speicherung nach OCR
✅ Artikel-Verwaltung funktioniert
✅ Alle Tests grün

---

## 🔧 Nächste Schritte

### Optional: Production Setup

1. **Pooler Connection aktivieren**
   ```env
   DATABASE_URL="postgresql://postgres.[REF]:[PWD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```

2. **Connection Pooling**
   - Supabase Dashboard → Settings → Database → Connection pooling
   - Aktivieren für Production

3. **Backups aktivieren**
   - Supabase Dashboard → Database → Backups
   - Point-in-time Recovery aktivieren

4. **Monitoring**
   - Supabase Dashboard → Database → Reports
   - Query-Performance überwachen

---

## ❓ Troubleshooting

Siehe: `TROUBLESHOOTING.md`

---

**Bei Fragen oder Problemen:**
1. Prüfe `TROUBLESHOOTING.md`
2. Prüfe Backend-Logs: `backend/server.log`
3. Prüfe Supabase Logs: Dashboard → Logs

**Datenbank zurücksetzen:**
```bash
npm run reset:db  # Löscht alles und macht Fresh Setup
```

---

**🚀 Viel Erfolg mit dem sauberen Backend!**
