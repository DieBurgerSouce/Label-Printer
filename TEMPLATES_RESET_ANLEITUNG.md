# Templates zurücksetzen - Anleitung

## Problem
Nach Docker-Neuinstallation sind immer noch alte Templates sichtbar und neue Templates können nicht gespeichert werden.

## Ursache
Die Templates werden im Ordner `backend/data/label-templates/` gespeichert, der auch nach Docker-Neustart erhalten bleibt.

## Lösung

### Schritt 1: Docker stoppen
```bash
docker-compose down
```
Oder: Einfach `STOP.bat` doppelklicken

### Schritt 2: Templates löschen

**Option A: Automatisch (empfohlen)**
- Doppelklick auf `CLEAR_TEMPLATES.bat`
- Bestätigen Sie die Warnung mit Enter

**Option B: Manuell**
- Öffnen Sie den Ordner: `Screenshot_Algo\backend\data\label-templates\`
- Löschen Sie alle `.json` Dateien in diesem Ordner

### Schritt 3: Docker neu starten
```bash
docker-compose up -d
```
Oder: Doppelklick auf `START.bat`

### Schritt 4: Browser-Cache leeren

**Chrome/Edge:**
1. Drücken Sie: `Strg + Shift + Delete`
2. Wählen Sie "Cached images and files"
3. Klicken Sie "Clear data"

**Oder:**
- Öffnen Sie die App in einem Private/Inkognito-Fenster

### Schritt 5: Testen
1. Öffnen Sie http://localhost:3001
2. Gehen Sie zu "Labels" → "Neues Template"
3. Erstellen Sie ein neues Template
4. Klicken Sie "Speichern"
5. Prüfen Sie, ob das Template in der Liste erscheint

## Debugging: Wenn es immer noch nicht funktioniert

### 1. Prüfen Sie die Browser-Konsole
1. Drücken Sie `F12` im Browser
2. Klicken Sie auf den Tab "Console"
3. Speichern Sie ein Template
4. Schauen Sie nach Fehlermeldungen (rot)

### 2. Prüfen Sie die Backend-Logs
```bash
docker logs screenshot-algo-backend
```

### 3. Prüfen Sie Dateiberechtigungen
Der Ordner `backend/data/label-templates/` muss Schreibrechte haben.

## Kontakt
Bei weiteren Problemen: Screenshots von Fehlermeldungen machen und senden!
