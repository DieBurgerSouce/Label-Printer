# LocalTunnel Setup - Projekt mit anderen teilen

## Was ist das?
Mit dieser Anleitung kannst du **EINEN Link** mit anderen teilen, über den sie das komplette Projekt nutzen können - egal wo sie sind!

## Voraussetzungen
- Node.js installiert
- Backend und Frontend sind fertig gebaut

## Schnellstart (3 Schritte)

### 1. Backend starten

```bash
cd backend
npm run dev
```

Du solltest sehen:
```
✅ Serving frontend static files from: C:\Users\benfi\Screenshot_Algo\frontend\dist
🚀 Label Printer Backend running on http://localhost:3001
```

### 2. LocalTunnel öffnen (NEUES Terminal!)

```bash
npx localtunnel --port 3001
```

Du bekommst eine URL wie:
```
your url is: https://wild-tiger-42.loca.lt
```

**Das ist dein Link!** ✨

### 3. Link teilen

Teile die URL (z.B. `https://wild-tiger-42.loca.lt`) mit anderen:
- Frontend: `https://wild-tiger-42.loca.lt/`
- Alles funktioniert automatisch!

## Wichtig

### Beim ersten Aufruf
LocalTunnel zeigt eine Warnseite. Einfach auf **"Click to Continue"** klicken.

### URL ändert sich
Jedes Mal wenn du LocalTunnel neu startest, bekommst du eine **neue URL**.

### Backend läuft weiter
Lass das Backend-Terminal laufen, während andere die App nutzen.

## Troubleshooting

### "Frontend dist folder not found"
Führe aus:
```bash
cd frontend
npm run build
cd ..
```

### Backend stoppt
Einfach neu starten:
```bash
cd backend
npm run dev
```

### LocalTunnel funktioniert nicht
Alternativen:
```bash
# Cloudflare Tunnel (dauerhafter)
npx cloudflared tunnel --url localhost:3001

# Serveo (SSH-basiert)
ssh -R 80:localhost:3001 serveo.net
```

## Production-Modus vs Dev-Modus

### Production (wie jetzt konfiguriert)
- Frontend ist gebaut → schnell
- Backend serviert Frontend
- EIN Link für alles
- Perfekt zum Teilen

### Dev-Modus (lokale Entwicklung)
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend mit Hot-Reload
cd frontend
npm run dev
```

## Übersicht

```
┌─────────────────────────────────────┐
│  https://xxxxx.loca.lt              │
│  (Eine URL für ALLES)               │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  LocalTunnel                        │
│  (Tunnel ins Internet)              │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Backend (localhost:3001)           │
│  • Serviert Frontend (/)            │
│  • API Routes (/api/*)              │
│  • WebSocket (ws://)                │
└─────────────────────────────────────┘
```

## Next Steps

Wenn du das Projekt **dauerhaft** online haben willst:
1. **Cloudflare Tunnel** - Kostenlos, dauerhaft
2. **Railway.app** - Einfaches Hosting
3. **Vercel + Backend** - Professionell

Für heute reicht LocalTunnel perfekt!
