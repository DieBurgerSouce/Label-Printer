# Screenshot Algo - Automatisches Label-Generierungs-System

Vollautomatisches System für Web-Scraping, OCR-Texterkennung und professionelle Label-Generierung. Perfekt für Produktkataloge, Preisetiketten und Inventarverwaltung.

🇩🇪 **[Deutsche Installations-Anleitung](./ANLEITUNG_FÜR_WINDOWS.md)** ← Hier starten!

---

## 🚀 Quick Start (für Endnutzer)

**Sie brauchen nur Docker Desktop - sonst nichts!**

### Schritt 1: Docker Desktop installieren
- Download: https://www.docker.com/products/docker-desktop
- Installation dauert ~10 Minuten
- Nach Installation PC neu starten

### Schritt 2: Screenshot Algo installieren
1. ZIP-Datei entpacken
2. **Doppelklick** auf `INSTALL.bat`
3. Warten (5-10 Minuten beim ersten Mal)

### Schritt 3: System nutzen
1. **Doppelklick** auf `START.bat`
2. Browser öffnet sich automatisch
3. Fertig! 🎉

**Ausführliche Anleitung:** [ANLEITUNG_FÜR_WINDOWS.md](./ANLEITUNG_FÜR_WINDOWS.md)

---

## 📦 Für Entwickler: ZIP-Paket erstellen

Wenn Sie dieses System an andere weitergeben möchten:

1. **Doppelklick** auf `PACKAGE.bat`
2. Eine ZIP-Datei wird erstellt: `Screenshot_Algo_DATUM.zip`
3. Diese ZIP-Datei versenden (per E-Mail, WeTransfer, etc.)

Die ZIP-Datei enthält:
- ✅ Kompletten Source-Code
- ✅ Docker-Konfiguration
- ✅ Installations-Scripts
- ✅ Deutsche Dokumentation
- ❌ Keine `node_modules` (werden bei Installation automatisch gebaut)
- ❌ Keine persönlichen Daten oder `.env` Dateien

---

## 🛠️ Verfügbare Scripts

| Script | Beschreibung |
|--------|-------------|
| `INSTALL.bat` | Einmalige Installation (nur beim ersten Mal) |
| `START.bat` | System starten |
| `STOP.bat` | System beenden |
| `UPDATE.bat` | System aktualisieren (nach Git Pull) |
| `PACKAGE.bat` | ZIP-Paket für Weitergabe erstellen |

---

## 🏗️ Technische Details

### Architektur

```
┌─────────────────────────────────────────────────┐
│  Browser (Frontend - React + Vite)              │
│  http://localhost:3001                          │
└───────────────────┬─────────────────────────────┘
                    │ HTTP/WebSocket
┌───────────────────▼─────────────────────────────┐
│  Backend API Server (Node.js + Express)         │
│  Port 3001                                      │
│  - REST API                                     │
│  - WebSocket Server                             │
│  - Statische Frontend-Dateien                   │
└─────┬──────────────────────────┬────────────────┘
      │                          │
┌─────▼──────────┐    ┌──────────▼───────────────┐
│  PostgreSQL    │    │  Redis Cache             │
│  Port 5432     │    │  Port 6379               │
│  (Datenbank)   │    │  (Job Queue)             │
└────────────────┘    └──────────────────────────┘
```

### Docker Services

- **postgres** - PostgreSQL 16 Datenbank
- **redis** - Redis 7 Cache & Job Queue
- **frontend-builder** - Baut das Frontend (nur während Installation)
- **backend** - Node.js Backend + serviert Frontend

### Tech Stack

**Backend:**
- Node.js 20
- Express.js
- Prisma ORM
- BullMQ (Job Queue)
- Puppeteer (Web Scraping)
- Tesseract OCR (Text-Erkennung)
- WebSocket (Echtzeit-Updates)

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (State Management)

**Infrastruktur:**
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

---

## 📂 Projekt-Struktur

```
Screenshot_Algo/
├── backend/                    # Backend API Server
│   ├── src/                   # TypeScript Source
│   │   ├── api/              # REST API Routes
│   │   ├── services/         # Business Logic
│   │   ├── websocket/        # WebSocket Server
│   │   └── index.ts          # Entry Point
│   ├── prisma/               # Datenbank Schema
│   ├── data/                 # Persistente Daten
│   │   ├── screenshots/      # Screenshots
│   │   ├── labels/           # Generierte Labels
│   │   ├── cache/            # Cache
│   │   ├── exports/          # Excel Exports
│   │   └── templates/        # Label Templates
│   ├── Dockerfile            # Backend Docker Image
│   └── package.json
│
├── frontend/                   # Frontend React App
│   ├── src/                   # React Source
│   │   ├── components/       # UI Komponenten
│   │   ├── hooks/            # Custom Hooks
│   │   ├── services/         # API Services
│   │   ├── store/            # Zustand Store
│   │   └── App.tsx           # Main Component
│   ├── Dockerfile            # Frontend Docker Image
│   └── package.json
│
├── docker-compose.yml         # Docker Orchestration
├── .env.example              # Environment Template
│
├── INSTALL.bat               # Installation Script
├── START.bat                 # Start Script
├── STOP.bat                  # Stop Script
├── UPDATE.bat                # Update Script
├── PACKAGE.bat               # ZIP Creation Script
│
├── README.md                 # Diese Datei
└── ANLEITUNG_FÜR_WINDOWS.md # Deutsche Anleitung
```

---

## 🔧 Entwicklung

### Lokale Entwicklung (ohne Docker)

**Voraussetzungen:**
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Tesseract OCR

**Backend starten:**
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

**Frontend starten:**
```bash
cd frontend
npm install
npm run dev
```

### Entwicklung mit Docker

**Services starten:**
```bash
docker-compose up -d
```

**Logs ansehen:**
```bash
docker-compose logs -f backend
```

**Services stoppen:**
```bash
docker-compose down
```

### Datenbank-Migrations

**Neue Migration erstellen:**
```bash
cd backend
npx prisma migrate dev --name migration_name
```

**Migration in Production ausführen:**
```bash
docker-compose run --rm backend npx prisma migrate deploy
```

---

## 🌟 Features

### ✅ Implementiert

- **Web Scraping**: Automatisches Crawlen von Produktseiten
- **OCR**: Texterkennung aus Screenshots (Deutsch + Englisch)
- **Label-Generation**: Automatische Erstellung von Preisetiketten
- **Template System**: Intelligente Label-Vorlagen mit Regeln
- **Artikel-Verwaltung**: CRUD für Produkte
- **Excel Import/Export**: Massen-Import von Artikeln
- **Bulk-Operations**: Massen-Verarbeitung von Screenshots & Labels
- **Real-time Updates**: WebSocket für Live-Fortschritt
- **Job Queue**: Redis-basierte Background-Jobs
- **API**: RESTful API für alle Operationen

### 🚧 In Entwicklung

- Desktop-App (Electron Wrapper)
- Automatische Updates
- Mehrsprachige Labels
- Barcode-Scanner Integration
- Cloud-Backup

---

## 📊 System-Anforderungen

**Minimum:**
- Windows 10 (64-bit)
- 8 GB RAM
- 10 GB Speicherplatz
- Docker Desktop

**Empfohlen:**
- Windows 11
- 16 GB RAM
- 20 GB Speicherplatz
- SSD

---

## 🐛 Troubleshooting

Siehe [ANLEITUNG_FÜR_WINDOWS.md](./ANLEITUNG_FÜR_WINDOWS.md) Abschnitt "Häufige Probleme"

**Häufigste Probleme:**
- Docker Desktop läuft nicht → Docker Desktop starten
- Port 3001 belegt → `.env` anpassen: `PORT=3002`
- Frontend nicht gefunden → `INSTALL.bat` erneut ausführen

**Logs ansehen:**
```bash
docker-compose logs backend
docker-compose logs postgres
docker-compose logs redis
```

---

## 📝 Lizenz

Proprietär - Alle Rechte vorbehalten

---

## 👨‍💻 Entwickler

Erstellt mit ❤️ für effiziente Label-Generierung

**Support:** Siehe [ANLEITUNG_FÜR_WINDOWS.md](./ANLEITUNG_FÜR_WINDOWS.md)
