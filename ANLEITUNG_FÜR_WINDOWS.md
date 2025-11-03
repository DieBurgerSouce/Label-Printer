# 🇩🇪 Screenshot Algo - Installations-Anleitung für Windows

Diese Anleitung erklärt Schritt-für-Schritt, wie Sie Screenshot Algo auf Ihrem Windows-PC installieren und nutzen können.

**Wichtig:** Sie brauchen **keine** Programmierkenntnisse! Alles funktioniert per Doppelklick.

---

## 📋 Inhalt

1. [System-Anforderungen](#system-anforderungen)
2. [Docker Desktop installieren](#docker-desktop-installieren)
3. [Screenshot Algo installieren](#screenshot-algo-installieren)
4. [System starten](#system-starten)
5. [System beenden](#system-beenden)
6. [Häufige Probleme](#häufige-probleme)

---

## 🖥️ System-Anforderungen

Ihr PC benötigt:

- ✅ **Windows 10** (64-bit) oder neuer
- ✅ **8 GB RAM** (besser: 16 GB)
- ✅ **10 GB freier Speicherplatz**
- ✅ **Internetverbindung** (nur für Installation)

**Sie brauchen NICHT:**
- ❌ Node.js
- ❌ Python
- ❌ Visual Studio
- ❌ PostgreSQL
- ❌ Irgendwelche Entwickler-Tools

Alles läuft in **Docker** - das ist wie eine isolierte "Mini-PC" auf Ihrem Computer.

---

## 🐳 Docker Desktop installieren

**Was ist Docker?**
Docker ist ein Programm, das alle benötigten Komponenten (Datenbank, Server, etc.) in isolierten "Containern" ausführt. So müssen Sie nichts manuell installieren!

### Schritt 1: Docker Desktop herunterladen

1. Öffnen Sie Ihren Browser
2. Gehen Sie zu: **https://www.docker.com/products/docker-desktop**
3. Klicken Sie auf **"Download for Windows"**
4. Warten Sie, bis der Download abgeschlossen ist (~500 MB)

### Schritt 2: Docker Desktop installieren

1. Öffnen Sie die heruntergeladene Datei: `Docker Desktop Installer.exe`
2. Folgen Sie dem Installations-Assistenten:
   - ✅ "Use WSL 2 instead of Hyper-V" **aktivieren**
   - ✅ Alle anderen Standard-Einstellungen beibehalten
3. Klicken Sie auf **"Install"**
4. Warten Sie 5-10 Minuten
5. Klicken Sie auf **"Close and restart"**
6. **Ihr PC wird neu gestartet**

### Schritt 3: Docker Desktop starten

1. Nach dem Neustart öffnet sich Docker Desktop automatisch
2. Falls nicht: Suchen Sie "Docker Desktop" im Windows-Startmenü
3. Beim ersten Start:
   - ✅ Akzeptieren Sie die Nutzungsbedingungen
   - ✅ Sie können sich anmelden (optional) oder "Continue without signing in"
4. Warten Sie, bis unten links "**Engine running**" steht (grünes Symbol)

**✅ Docker ist jetzt bereit!**

---

## 📦 Screenshot Algo installieren

### Schritt 1: ZIP-Datei entpacken

Sie haben eine ZIP-Datei erhalten (z.B. `Screenshot_Algo_20250122.zip`).

1. **Rechtsklick** auf die ZIP-Datei
2. Wählen Sie **"Alle extrahieren..."**
3. Wählen Sie einen Ordner, z.B.:
   ```
   C:\Users\IhrName\Screenshot_Algo
   ```
4. Klicken Sie auf **"Extrahieren"**

### Schritt 2: Installation starten

1. Öffnen Sie den entpackten Ordner
2. Sie sehen jetzt folgende Dateien:
   ```
   📁 backend/
   📁 frontend/
   📄 INSTALL.bat          ← Diese Datei!
   📄 START.bat
   📄 STOP.bat
   📄 docker-compose.yml
   📄 README.md
   ```

3. **Doppelklicken** Sie auf **`INSTALL.bat`**

### Schritt 3: Installation durchführen

Ein schwarzes Fenster (Kommandozeile) öffnet sich. Sie sehen:

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     SCREENSHOT ALGO - INSTALLATIONS-ASSISTENT                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

[1/5] Prüfe Docker Installation...
✅ Docker ist installiert

[2/5] Prüfe ob Docker läuft...
✅ Docker läuft

[3/5] Erstelle Konfigurationsdatei...
✅ .env Datei erstellt

[4/5] Baue alle Services... (kann 5-10 Minuten dauern)
```

**Bitte warten Sie!** Die Installation dauert beim ersten Mal **5-10 Minuten**.

Docker lädt jetzt:
- PostgreSQL Datenbank
- Redis Cache
- Node.js Server
- Und baut Ihre Anwendung

### Schritt 4: Installation abgeschlossen

Wenn Sie folgende Meldung sehen, ist alles fertig:

```
╔══════════════════════════════════════════════════════════════╗
║                  ✅ INSTALLATION ABGESCHLOSSEN                ║
╚══════════════════════════════════════════════════════════════╝

📋 Nächste Schritte:
   1. Doppelklicken Sie auf START.bat
   2. Ihr Browser öffnet sich automatisch
   3. Viel Spaß mit Screenshot Algo!

💡 Sie brauchen NICHTS außer Docker Desktop!
   Kein Node.js, kein npm, kein Python - alles läuft in Docker.

Drücken Sie eine beliebige Taste . . .
```

Drücken Sie eine beliebige Taste, um das Fenster zu schließen.

**✅ Installation abgeschlossen!**

---

## 🚀 System starten

Jedes Mal, wenn Sie das System nutzen möchten:

1. **Doppelklicken** Sie auf **`START.bat`**
2. Ein Fenster öffnet sich und zeigt:
   ```
   [1/2] Starte Docker Desktop...
   ✅ Docker Desktop läuft

   [2/2] Starte alle Services...
   ✅ PostgreSQL Datenbank gestartet
   ✅ Redis Cache gestartet
   ✅ Backend API Server gestartet

   🚀 System läuft!
   📍 Öffne http://localhost:3001 im Browser...
   ```

3. Ihr Browser öffnet sich **automatisch**
4. Sie sehen die Screenshot Algo Oberfläche

**✅ Das System ist jetzt betriebsbereit!**

### Was läuft jetzt?

Im Hintergrund laufen drei "Container":
- 🗄️ **PostgreSQL** - Ihre Datenbank (Port 5432)
- 🔴 **Redis** - Cache für schnellere Verarbeitung (Port 6379)
- 🖥️ **Backend** - Der Haupt-Server (Port 3001)

Das Browser-Fenster (Frontend) kommuniziert mit dem Backend.

---

## 🛑 System beenden

Wenn Sie fertig sind:

1. **Doppelklicken** Sie auf **`STOP.bat`**
2. Alle Container werden sauber beendet
3. Sie sehen:
   ```
   ✅ Alle Services wurden beendet

   💡 Ihre Daten bleiben erhalten!

   Zum erneuten Start: Doppelklick auf START.bat
   ```

**Wichtig:** Ihre Daten (Artikel, Labels, Screenshots) bleiben gespeichert und sind beim nächsten Start wieder da!

---

## 🔧 Häufige Probleme

### Problem: "Docker ist nicht installiert"

**Lösung:**
1. Installieren Sie Docker Desktop (siehe oben)
2. Starten Sie Ihren PC neu
3. Starten Sie Docker Desktop
4. Führen Sie `INSTALL.bat` erneut aus

---

### Problem: "Docker läuft nicht"

Sie sehen:
```
❌ FEHLER: Docker Desktop läuft nicht!
```

**Lösung:**
1. Öffnen Sie Docker Desktop über das Startmenü
2. Warten Sie, bis unten links "Engine running" steht
3. Führen Sie `START.bat` erneut aus

---

### Problem: "Port 3001 ist bereits belegt"

**Lösung:**
Ein anderes Programm nutzt bereits Port 3001.

1. Führen Sie `STOP.bat` aus
2. Starten Sie Ihren PC neu
3. Führen Sie `START.bat` aus

Wenn das Problem weiterhin besteht:
- Öffnen Sie die Datei `.env` im Screenshot_Algo Ordner
- Ändern Sie die Zeile `PORT=3001` zu `PORT=3002`
- Speichern Sie die Datei
- Führen Sie `START.bat` erneut aus
- Öffnen Sie dann http://localhost:3002

---

### Problem: Browser öffnet sich nicht automatisch

**Lösung:**
Öffnen Sie manuell Ihren Browser und gehen Sie zu:
```
http://localhost:3001
```

---

### Problem: "Seite kann nicht geladen werden"

**Ursache:** Der Server ist noch nicht vollständig gestartet.

**Lösung:**
1. Warten Sie 30-60 Sekunden
2. Drücken Sie F5 im Browser (Seite neu laden)
3. Wenn es immer noch nicht funktioniert:
   - Führen Sie `STOP.bat` aus
   - Führen Sie `START.bat` erneut aus

---

### Problem: Docker läuft sehr langsam

**Ursache:** Docker benötigt ausreichend Ressourcen.

**Lösung:**
1. Öffnen Sie Docker Desktop
2. Klicken Sie auf das ⚙️ (Einstellungen)
3. Gehen Sie zu "Resources"
4. Stellen Sie ein:
   - **CPUs:** mindestens 2
   - **Memory:** mindestens 4 GB (besser: 6-8 GB)
5. Klicken Sie auf "Apply & Restart"

---

### Problem: "Installation schlägt fehl beim Frontend-Build"

**Lösung:**
1. Prüfen Sie Ihre Internetverbindung
2. Führen Sie `STOP.bat` aus
3. Löschen Sie den Ordner (falls vorhanden):
   ```
   C:\Users\IhrName\Screenshot_Algo\frontend\node_modules
   ```
4. Führen Sie `INSTALL.bat` erneut aus

---

## 🔄 System aktualisieren

Wenn Sie eine neue Version erhalten:

1. **Doppelklicken** Sie auf **`STOP.bat`** (System beenden)
2. Entpacken Sie die neue ZIP-Datei **über den alten Ordner**
3. **Doppelklicken** Sie auf **`UPDATE.bat`**
4. Warten Sie, bis die Aktualisierung abgeschlossen ist
5. **Doppelklicken** Sie auf **`START.bat`**

**Ihre Daten bleiben erhalten!** (Artikel, Labels, Einstellungen)

---

## 💾 Wo sind meine Daten?

Alle Ihre Daten sind gespeichert in:

```
C:\Users\IhrName\Screenshot_Algo\backend\data\
```

Ordner-Struktur:
```
📁 data/
  ├── 📁 screenshots/     ← Gespeicherte Screenshots
  ├── 📁 labels/          ← Generierte Label-Dateien
  ├── 📁 cache/           ← Temporärer Cache
  ├── 📁 exports/         ← Excel-Exporte
  └── 📁 templates/       ← Label-Vorlagen
```

**Backup erstellen:**
Kopieren Sie einfach den ganzen `data/` Ordner!

---

## 📞 Hilfe benötigt?

### Logs anschauen

Wenn etwas nicht funktioniert, können Sie die Logs ansehen:

1. Öffnen Sie eine **Eingabeaufforderung** (CMD):
   - Drücken Sie `Windows-Taste + R`
   - Tippen Sie `cmd` und drücken Sie Enter

2. Navigieren Sie zu Ihrem Screenshot_Algo Ordner:
   ```cmd
   cd C:\Users\IhrName\Screenshot_Algo
   ```

3. Zeigen Sie die Logs an:
   ```cmd
   docker-compose logs backend
   ```

### System zurücksetzen

**ACHTUNG: Löscht ALLE Daten!**

1. Führen Sie `STOP.bat` aus
2. Löschen Sie den Ordner `backend\data\`
3. Öffnen Sie eine Eingabeaufforderung im Screenshot_Algo Ordner
4. Führen Sie aus:
   ```cmd
   docker-compose down -v
   ```
5. Führen Sie `INSTALL.bat` erneut aus

---

## ✅ Checkliste für erfolgreiche Installation

- [ ] Windows 10/11 (64-bit)
- [ ] Mindestens 8 GB RAM
- [ ] Mindestens 10 GB freier Speicherplatz
- [ ] Docker Desktop installiert
- [ ] Docker Desktop läuft ("Engine running")
- [ ] ZIP-Datei entpackt
- [ ] `INSTALL.bat` ausgeführt (dauert 5-10 Min)
- [ ] Installation erfolgreich abgeschlossen
- [ ] `START.bat` ausgeführt
- [ ] Browser öffnet http://localhost:3001
- [ ] Screenshot Algo Oberfläche wird angezeigt

**Wenn alle Punkte ✅ sind: Herzlichen Glückwunsch! Sie können jetzt loslegen!** 🎉

---

## 🎯 Nächste Schritte

1. **Artikel importieren:**
   - Gehen Sie zu "Artikel verwalten"
   - Importieren Sie Ihre Produktliste

2. **Screenshots erstellen:**
   - Wählen Sie Artikel aus
   - Klicken Sie auf "Screenshots erstellen"
   - Das System lädt automatisch die Produktseiten

3. **Labels generieren:**
   - Nachdem Screenshots erstellt wurden
   - Klicken Sie auf "Labels generieren"
   - Laden Sie die fertigen Labels herunter

**Viel Erfolg! 🚀**
