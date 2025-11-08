# 🚀 Screenshot Algo - Deployment Package

**Version:** 1.1.0 - Memory Leak Fixes & Variant Detection
**Build Date:** 2025-11-03
**Status:** ✅ Production Ready

---

## 📦 Was ist in diesem Package?

Dieses Deployment-Package enthält:
- ✅ **Memory Leak Fixes** - Browser wird ordnungsgemäß geschlossen
- ✅ **Variant Detection** - Automatische Erkennung von Produktvarianten (Shopware 6)
- ✅ **Graceful Shutdown** - Sauberes Herunterfahren bei SIGTERM/SIGINT
- ✅ **Komplett getestet** - Alle Tests bestanden (siehe COMPREHENSIVE_TEST_REPORT.md)

---

## ⚡ Quick Start

### 1. System-Requirements

**Windows:**
- Docker Desktop installiert
- PowerShell 5.1 oder höher
- Mindestens 4 GB RAM
- 10 GB freier Festplattenspeicher

**Linux/Mac:**
- Docker & Docker Compose
- Bash Shell
- Mindestens 4 GB RAM
- 10 GB freier Festplattenspeicher

### 2. Installation (Windows)

```powershell
# 1. Entpacke die ZIP-Datei
# 2. Öffne PowerShell im entpackten Ordner
# 3. Starte das System:

.\START.bat
```

Das war's! Das System startet automatisch.

### 3. Installation (Linux/Mac)

```bash
# 1. Entpacke die ZIP-Datei
# 2. Öffne Terminal im entpackten Ordner
# 3. Mache Skripte ausführbar:
chmod +x *.sh

# 4. Starte das System:
./start.sh
```

### 4. System aufrufen

Öffne deinen Browser und gehe zu:
```
http://localhost:3000
```

Backend API:
```
http://localhost:3001
```

---

## 🗄️ Datenbank - Leer & Bereit

### Warum ist die Datenbank leer?

Dieses Package kommt mit einer **leeren Datenbank**, damit du:
- ✅ Nur die Daten crawlen kannst, die du brauchst
- ✅ Keine unnötigen Test-Daten hast
- ✅ Von Anfang an saubere Daten hast

### Daten selbst crawlen

#### Methode 1: Web-Interface (Empfohlen)
1. Öffne http://localhost:3000
2. Gehe zu "Crawler" im Menü
3. Gib deine Shop-URL ein (z.B. https://shop.example.com)
4. Klicke "Crawl starten"
5. Warte bis der Crawl abgeschlossen ist
6. Deine Produkte sind jetzt in der Datenbank!

#### Methode 2: API
```bash
# Single Product URL
curl -X POST http://localhost:3001/api/crawler/start \
  -H "Content-Type: application/json" \
  -d '{
    "shopUrl": "https://shop.example.com/product/123",
    "maxProducts": 1
  }'

# Gesamter Shop (bis zu 100 Produkte)
curl -X POST http://localhost:3001/api/crawler/start \
  -H "Content-Type: application/json" \
  -d '{
    "shopUrl": "https://shop.example.com",
    "maxProducts": 100
  }'
```

#### Methode 3: Beispiel-Skript
```javascript
// crawl-shop.js
const fetch = require('node-fetch');

async function crawlShop(shopUrl, maxProducts = 50) {
  const response = await fetch('http://localhost:3001/api/crawler/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shopUrl, maxProducts })
  });

  const result = await response.json();
  console.log('Crawl Job ID:', result.data.jobId);

  // Check status
  const jobId = result.data.jobId;
  const statusUrl = `http://localhost:3001/api/crawler/status/${jobId}`;

  // Poll until complete
  let status = 'crawling';
  while (status === 'crawling') {
    await new Promise(r => setTimeout(r, 5000)); // Wait 5s
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();
    status = statusData.data.status;
    console.log('Status:', status, '- Products:', statusData.data.productsFound);
  }

  console.log('Crawl completed!');
}

// Beispiel: Firmenich Shop crawlen
crawlShop('https://shop.firmenich.de', 50);
```

---

## 🔧 Konfiguration

### Environment Variables

Erstelle eine `.env` Datei im Root-Verzeichnis:

```env
# Backend Port (default: 3001)
PORT=3001

# Frontend Port (default: 3000)
VITE_PORT=3000

# Database (PostgreSQL)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=screenshot_algo

# Redis
REDIS_URL=redis://redis:6379

# Optional: Google Cloud Vision API (für besseres OCR)
GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here

# Optional: Supabase (für Cloud-Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Crawler Einstellungen

In der Web-UI unter "Crawler Settings":
- **Max Products:** Maximale Anzahl zu crawlender Produkte
- **Screenshot Quality:** Qualität der Screenshots (1-100)
- **Timeout:** Timeout für Seiten-Laden (ms)
- **Headless:** Browser im Hintergrund ausführen
- **Custom Selectors:** Eigene CSS-Selektoren für spezielle Shops

---

## 📊 Unterstützte Shop-Systeme

### Vollständig getestet ✅
- **Shopware 6** (z.B. Firmenich)
  - Automatische Varianten-Erkennung
  - Cookie Banner Handling
  - Tiered Pricing

### Experimentell ⚠️
- WooCommerce
- Shopify
- Magento
- Custom Shops

**Tipp:** Für unbekannte Shops können Custom Selectors konfiguriert werden.

---

## 🔍 Features

### 1. Automatischer Web Crawler
- Crawlt Produkte von beliebigen Online-Shops
- Erkennt automatisch Produkt-Selektoren
- Folgt Pagination automatisch
- Sammelt:
  - Produktbilder
  - Titel
  - Artikelnummern
  - Beschreibungen
  - Preise (inkl. Staffelpreise)

### 2. Varianten-Erkennung
- Erkennt Produktvarianten automatisch (z.B. Farben, Größen)
- Crawlt jede Variante separat
- Sammelt eindeutige Artikelnummern pro Variante
- Beispiel: Horizontalschäler mit 8 Farbvarianten → 8 separate Datensätze

### 3. OCR (Optical Character Recognition)
- Extrahiert Text aus Screenshots
- Nutzt Tesseract OCR (inkludiert)
- Optional: Google Cloud Vision API für bessere Ergebnisse
- Unterstützt Deutsch & Englisch

### 4. Label Generator
- Erstellt druckbare Etiketten aus Produktdaten
- Template-System für verschiedene Etikettenformate
- Export als PDF
- Bulk-Print Support

### 5. Automatisierung
- Auf-Anfrage-System für automatische Artikel-Erstellung
- Regel-basierte Template-Zuordnung
- Automatische Duplikat-Erkennung

---

## 🛠️ Befehle

### Windows (PowerShell/CMD)

```powershell
# System starten
.\START.bat

# System stoppen
.\STOP.bat

# System neu starten (rebuild)
.\UPDATE.bat

# Logs anzeigen
docker-compose logs -f backend

# Datenbank zurücksetzen (VORSICHT!)
docker-compose down -v
docker-compose up -d
```

### Linux/Mac (Bash)

```bash
# System starten
./start.sh

# System stoppen
./stop.sh

# System neu starten (rebuild)
./update.sh

# Logs anzeigen
docker-compose logs -f backend

# Datenbank zurücksetzen (VORSICHT!)
docker-compose down -v
docker-compose up -d
```

---

## 📈 Monitoring & Health Checks

### Health Check
```bash
curl http://localhost:3001/api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "memory": {
    "process": {
      "rss": 478,
      "heapUsed": 35
    },
    "system": {
      "total": 31962,
      "free": 29299,
      "used": 2663,
      "percentage": 8
    }
  },
  "uptime": 432
}
```

### Docker Stats
```bash
# Real-time Memory & CPU
docker stats screenshot-algo-backend

# Alle Container
docker stats
```

### Logs
```bash
# Backend Logs (live)
docker logs -f screenshot-algo-backend

# Nur Fehler
docker logs screenshot-algo-backend 2>&1 | grep -i error

# Crawler Logs
docker logs screenshot-algo-backend 2>&1 | grep "Crawling:"

# Browser Cleanup Logs
docker logs screenshot-algo-backend 2>&1 | grep "Browser closed"
```

---

## 🐛 Troubleshooting

### Problem: Docker startet nicht

**Lösung:**
```powershell
# Docker Desktop neu starten
# oder
docker system prune -a
docker-compose up -d
```

### Problem: Port 3000/3001 bereits belegt

**Lösung:**
Ändere die Ports in `docker-compose.yml`:
```yaml
services:
  backend:
    ports:
      - "3002:3001"  # Ändere 3001 → 3002
```

### Problem: Crawl schlägt fehl

**Mögliche Ursachen:**
1. **Ungültige URL** → Prüfe die URL
2. **Shop blockiert Crawler** → Verwende Custom User-Agent
3. **Cookie Banner** → Wird automatisch behandelt (Shopware 6)
4. **Timeout** → Erhöhe Timeout in den Settings

**Logs prüfen:**
```bash
docker logs screenshot-algo-backend 2>&1 | tail -50
```

### Problem: Varianten werden nicht erkannt

**Lösung:**
1. Prüfe ob Shop Shopware 6 verwendet
2. Für andere Systeme: Custom Selectors konfigurieren
3. Logs prüfen: `docker logs screenshot-algo-backend | grep variant`

### Problem: Hoher Memory-Verbrauch

**Normal:** ~500 MB RSS beim Crawlen
**Kritisch:** > 2 GB RSS

**Lösung:**
```bash
# Container neu starten
docker-compose restart backend

# Memory-Nutzung prüfen
docker stats screenshot-algo-backend
```

---

## 📚 Dokumentation

Weitere Dokumentation findest du in:
- `COMPREHENSIVE_TEST_REPORT.md` - Vollständiger Testbericht
- `MEMORY_LEAK_FIXES.md` - Memory Leak Fixes
- `VARIANT_DETECTION_FIXED.md` - Variant Detection
- `DEPLOYMENT_VERIFICATION.md` - Deployment-Verifizierung

---

## 🔐 Sicherheit

### Production Deployment

**WICHTIG:** Für Production-Einsatz:

1. **Ändere alle Passwörter** in `.env`:
   ```env
   POSTGRES_PASSWORD=dein-sicheres-passwort
   ```

2. **Aktiviere HTTPS** (z.B. mit nginx + Let's Encrypt)

3. **Firewall konfigurieren**:
   - Nur Port 443 (HTTPS) öffentlich
   - Ports 3000, 3001 nur intern

4. **Backups einrichten**:
   ```bash
   # PostgreSQL Backup
   docker exec screenshot-algo-postgres pg_dump -U postgres screenshot_algo > backup.sql
   ```

5. **Monitoring einrichten** (z.B. Prometheus, Grafana)

---

## 🆘 Support

Bei Problemen:
1. Prüfe die Logs: `docker logs screenshot-algo-backend`
2. Prüfe die Dokumentation
3. Erstelle ein GitHub Issue mit:
   - Fehlermeldung
   - Logs (letzte 50 Zeilen)
   - Shop-URL (falls möglich)
   - System-Info (Windows/Linux/Mac)

---

## 📝 Changelog

### Version 1.1.0 (2025-11-03)

#### ✅ New Features
- **Varianten-Erkennung** für Shopware 6
- **Automatische Cookie Banner Akzeptanz**
- **Memory Leak Fixes** - Browser-Cleanup
- **Graceful Shutdown** - Sauberes Herunterfahren

#### 🐛 Bug Fixes
- CSS Selector Bug für IDs mit Zahlen
- Browser wird jetzt immer geschlossen (auch bei Fehlern)
- Improved error handling in finally blocks
- Fixed return type for variant detection

#### 📊 Performance
- Memory-Nutzung reduziert (~6 MB nach mehreren Jobs)
- Variant Detection: ~7.7s pro Variante
- Graceful Shutdown: < 2 Sekunden

#### 📚 Documentation
- Comprehensive Test Report
- Memory Leak Fixes Dokumentation
- Deployment Verification Report

---

## 📄 Lizenz

Dieses Projekt ist proprietär. Alle Rechte vorbehalten.

---

**Viel Erfolg beim Crawlen! 🚀**
