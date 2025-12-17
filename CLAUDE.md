# Screenshot Algo - Automatisches Label-Generierungs-System

**Status:** Production-ready Web-Scraping & Label-Generierung
**Philosophy:** Feinpoliert und durchdacht - Enterprise-Grade Quality
**Deployment:** Docker-basiert (PostgreSQL, Redis, Node.js)
**Version:** 1.0

---

## KRITISCHE REGELN (ABSOLUTE PRIORITÄT)

### Verifikation vor Response
Du DARFST NICHT antworten dass etwas "funktioniert" oder "gefixt" ist, BIS du es verifiziert hast.

**Erzwungener Workflow:**
1. Implementiere Code
2. **STOPP - Führe automatisch aus/teste**
3. **Warte auf tatsächliches Ergebnis**
4. Erst DANN antworte mit dem ECHTEN Resultat

**Template für JEDE Implementierung:**
```
✅ Implementiert: [Was genau]
🔍 Verifikation läuft...
[HIER MUSS TEST/BUILD OUTPUT STEHEN]
📊 Resultat: [ECHTES Ergebnis - nicht Vermutung]
```

**Du MUSST folgendes tun:**
- Nach JEDER Code-Änderung: `npm run build` oder `npm test` oder relevanten Check
- ECHTEN Output zeigen (nicht "sollte funktionieren")
- Wenn Tests nicht existieren: Manuellen Check beschreiben den du gemacht hast

**VERBOTEN - Diese Phrasen darfst du NICHT verwenden ohne vorherigen Test:**
- "Das sollte jetzt funktionieren"
- "Ich habe das Problem behoben"
- "Das ist jetzt korrekt implementiert"
- "Der Fehler sollte weg sein"

**ERLAUBT - Nur nach ECHTEM Test:**
- "Build erfolgreich (siehe Output oben)"
- "Test fehlgeschlagen mit Error: [...]"
- "Habe manuell getestet: [was genau + Resultat]"

**Wenn Test nicht möglich:**
Sage EXPLIZIT: "Kann nicht automatisch testen weil X. Vorschlag: [...]"

### Projekt-Spezifische Regeln
- Datenbank: PostgreSQL via Prisma ORM (Supabase wurde entfernt am 17.12.2025)
- Always look out for caching issues - that could also be the problem sometimes!
- Whilst implementing steps from IMPLEMENTATION_PLAN.md, always mark down the step once implemented
- NIEMALS Node-Prozesse killen! Keine Commands die Claude Code beenden könnten

---

## PROJECT CONTEXT

### Projekt-Übersicht
Screenshot Algo ist ein vollautomatisches System für:
- Web-Scraping von Produktinformationen
- OCR-Texterkennung auf Screenshots
- Professionelle Label-Generierung für Produktkataloge

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

---

## TECHNOLOGY STACK

### Backend
| Komponente | Technologie | Version |
|------------|-------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Express.js | ^4.x |
| ORM | Prisma | ^5.x |
| Job Queue | BullMQ | ^5.x |
| Logger | Winston | ^3.x |
| Validation | Zod | ^3.x |

### Frontend
| Komponente | Technologie | Version |
|------------|-------------|---------|
| Framework | React | ^18.x |
| Build Tool | Vite | ^5.x |
| Language | TypeScript | ^5.x |
| Styling | Tailwind CSS | ^3.x |

### Infrastructure
| Service | Technologie | Port |
|---------|-------------|------|
| Database | PostgreSQL 16 | 5432 |
| Cache | Redis 7 | 6379 |
| Backend | Node.js | 3001 |

### Testing
| Tool | Verwendung |
|------|------------|
| Vitest | Unit & Integration Tests |
| Playwright | E2E Tests |
| ESLint | Linting |
| TypeScript | Type Checking |

---

## DEVELOPMENT COMMANDS

### Docker Development (Empfohlen)
```bash
# System starten
./START.bat              # Windows
docker compose up -d     # Alle Plattformen

# System stoppen
./STOP.bat               # Windows
docker compose down      # Alle Plattformen

# Logs ansehen
docker compose logs -f backend
docker compose logs -f postgres
```

### Lokale Entwicklung
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Makefile Commands
```bash
make dev          # Development Server starten
make test         # Tests ausführen
make lint         # Linting
make format       # Code formatieren
make docker-up    # Docker starten
make docker-down  # Docker stoppen
make db-migrate   # Datenbank migrieren
make clean        # Build-Artefakte löschen
```

### Testing
```bash
# Unit Tests
npm test

# E2E Tests
npx playwright test

# Mit Coverage
npm test -- --coverage

# Watch Mode
npm test -- --watch
```

---

## FILE ORGANIZATION

### Projekt-Struktur
```
Screenshot_Algo/
├── .claude/                    # Claude Code Konfiguration
│   ├── Docs/Guides/            # Entwickler-Dokumentation
│   ├── Static_Knowledge/       # Templates, SOP, ADR
│   ├── Dynamic_Knowledge/      # Logs, Learnings
│   ├── Meta-Layer/             # MOC, Indexes
│   └── quick-reference/        # Cheatsheets
├── .github/
│   ├── workflows/              # CI/CD Pipelines
│   └── ISSUE_TEMPLATE/         # Bug/Feature Templates
├── .vscode/                    # Editor Konfiguration
├── .husky/                     # Git Hooks
├── backend/
│   ├── src/
│   │   ├── routes/             # API Endpoints
│   │   ├── services/           # Business Logic
│   │   ├── utils/              # Utilities
│   │   └── types/              # TypeScript Types
│   ├── prisma/                 # Database Schema
│   └── tests/                  # Backend Tests
├── frontend/
│   ├── src/
│   │   ├── components/         # React Components
│   │   ├── pages/              # Page Components
│   │   ├── hooks/              # Custom Hooks
│   │   └── utils/              # Frontend Utilities
│   └── tests/                  # Frontend Tests
├── docker-compose.yml          # Docker Configuration
├── Makefile                    # Task Runner
└── package.json                # Root Dependencies
```

---

## CODING STANDARDS

### TypeScript (MANDATORY)
```typescript
// CORRECT: Volle Type Annotations
interface LabelRequest {
  productId: string;
  templateId: string;
  quantity: number;
  options?: LabelOptions;
}

async function generateLabel(
  request: LabelRequest
): Promise<GeneratedLabel> {
  // Implementation
}

// WRONG: Fehlende Types
async function generateLabel(request) {
  // NO!
}
```

### Error Handling
```typescript
// CORRECT: Strukturierte Fehlerbehandlung
try {
  const result = await labelService.generate(request);
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { request, error: error.message });
    throw new BadRequestError(error.message);
  }
  logger.error('Label generation failed', { error });
  throw new InternalError('Label generation failed');
}
```

### Logging
```typescript
// CORRECT: Strukturiertes Logging mit Winston
logger.info('Label generated', {
  productId: request.productId,
  templateId: request.templateId,
  duration: Date.now() - startTime
});

// WRONG: Console.log
console.log('Label generated'); // NO!
```

---

## GIT WORKFLOW

### Branch Naming
```
feature/TICKET-description
bugfix/TICKET-description
hotfix/TICKET-description
```

### Commit Convention
```bash
# Format: <type>(<scope>): <description>

feat(api): add label generation endpoint
fix(ocr): correct text extraction for German umlauts
docs(readme): update installation instructions
test(labels): add unit tests for template service
chore(deps): update dependencies
```

### Pre-commit Hooks
Die folgenden Checks laufen automatisch:
1. **ESLint** - Code Quality
2. **Prettier** - Formatting
3. **TypeScript** - Type Checking
4. **Tests** - Unit Tests (pre-push)

---

## SECURITY GUIDELINES

### Environment Variables
```bash
# NIEMALS committen!
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=your-secret-key
```

### Input Validation
```typescript
// CORRECT: Zod Schema Validation
const labelRequestSchema = z.object({
  productId: z.string().uuid(),
  templateId: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
});

// Validate
const validated = labelRequestSchema.parse(request);
```

---

## PERFORMANCE TARGETS

### Response Time Targets (95th percentile)
| Operation | Target |
|-----------|--------|
| Health Check | < 50ms |
| Label Generation | < 2s |
| OCR Processing | < 5s |
| Batch Processing | < 30s |

---

## DEBUGGING TIPS

### Docker Logs
```bash
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f
```

### Database Connection
```bash
docker compose exec postgres psql -U postgres -d screenshot_algo
```

### Redis CLI
```bash
docker compose exec redis redis-cli
```

### Common Issues

#### "Database connection failed"
```bash
docker compose ps
docker compose up -d postgres
```

#### "Redis connection refused"
```bash
docker compose restart redis
```

---

## DOCUMENTATION REFERENCES

### Interne Docs (in .claude/)
- `Docs/Guides/` - Entwickler-Guides
- `Static_Knowledge/SOP/` - Standard Operating Procedures
- `Static_Knowledge/Decision_Records/` - Architektur-Entscheidungen
- `quick-reference/` - Cheatsheets

---

## FINAL CHECKLIST

### Vor jedem Task
- [ ] Branch erstellt
- [ ] TypeScript Types korrekt
- [ ] Tests geschrieben/aktualisiert
- [ ] Linting clean

### Vor jedem Commit
- [ ] `npm test` erfolgreich
- [ ] `npm run lint` erfolgreich
- [ ] Keine Secrets im Code
- [ ] Commit Message folgt Convention

---

**Version:** 1.0
**Last Updated:** 2024-12-17
