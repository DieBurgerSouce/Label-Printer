# 🧪 Template Workflow - Vollständiger Test

## ✅ **BUGS GEFIXT:**

### Bug 1: localStorage statt Backend
**Problem**: Templates wurden aus localStorage geladen statt vom Backend
**Fix**: React Query holt Templates jetzt vom Backend (`/api/label-templates`)

### Bug 2: Falsche Navigation nach Speichern
**Problem**: Nach dem Speichern ging es zu `/labels` statt zu `/templates`
**Fix**: Navigiert jetzt korrekt zu `/templates` wo die Template-Liste ist

---

## 🔄 **Kompletter Workflow (So sollte es funktionieren):**

### Schritt 1: Vorbereitung
```bash
# Backend neu starten mit neuem Frontend
docker-compose down
docker-compose up -d --build
```

### Schritt 2: Browser-Cache löschen
1. Öffnen Sie http://localhost:3001
2. Drücken Sie **F12** (Developer Tools)
3. Gehen Sie zu **Console**
4. Eingeben:
```javascript
localStorage.clear();
location.reload();
```

### Schritt 3: Template erstellen
1. **Sidebar** → Klicken Sie auf **"Label Templates"**
2. Klicken Sie **"Neues Template"** (rechts oben)
3. Der Editor öffnet sich
4. **Template benennen**: z.B. "Test Template 1"
5. **Elemente hinzufügen**:
   - Klicken Sie "Überschrift" → Wird im Label angezeigt
   - Klicken Sie "Artikelnummer" → Für Produktnummer
   - Klicken Sie "Preis" → Für Preisinformation
6. **Drucklayout wählen**: z.B. "A4 Grid - 3×7"
7. Klicken Sie **"Speichern"** (rechts oben)

### Schritt 4: Überprüfung ✅
Nach dem Speichern sollte:
- ✅ Eine Erfolgsmeldung erscheinen: "Template erfolgreich gespeichert!"
- ✅ Sie werden automatisch zu **"Label Templates"** weitergeleitet
- ✅ Ihr neues Template **erscheint sofort in der Liste**
- ✅ Sie sehen eine Karte mit:
  - Template-Name: "Test Template 1"
  - Drucklayout: "A4 Grid - 3×7"
  - Größe: z.B. "400 × 300 px"
  - Anzahl Elemente: z.B. "3"

### Schritt 5: Template bearbeiten
1. Bei Ihrem Template: Klicken Sie **"Bearbeiten"**
2. Der Editor öffnet sich mit dem **geladenen Template**
3. Ändern Sie den Namen: z.B. "Test Template 1 (bearbeitet)"
4. Klicken Sie **"Speichern"**
5. ✅ Sie werden zurück zur Liste geleitet
6. ✅ Der **geänderte Name** wird angezeigt

### Schritt 6: Template löschen
1. Bei Ihrem Template: Klicken Sie **🗑️ Löschen**
2. Bestätigen Sie die Warnung
3. ✅ Template verschwindet aus der Liste

---

## 🔍 **Backend-Test (für Entwickler):**

### Templates abrufen:
```bash
curl http://localhost:3001/api/label-templates
```
**Erwartetes Ergebnis:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "...",
      "name": "Test Template 1",
      "width": 400,
      "height": 300,
      "elements": [...],
      "printLayoutId": "a4-grid-3x7"
    }
  ]
}
```

### Template speichern (Test):
```bash
curl -X POST http://localhost:3001/api/label-templates \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "name": "API Test Template",
    "width": 400,
    "height": 300,
    "elements": []
  }'
```

### Template löschen:
```bash
curl -X DELETE http://localhost:3001/api/label-templates/test-123
```

---

## 🐛 **Wenn etwas nicht funktioniert:**

### Problem: Template wird gespeichert, aber nicht angezeigt
**Lösung 1**: Seite neu laden (F5)
**Lösung 2**: Browser-Cache löschen (Strg + Shift + Delete)
**Lösung 3**: localStorage löschen:
```javascript
localStorage.clear();
location.reload();
```

### Problem: "Template konnte nicht geladen werden"
**Prüfen**:
1. Backend läuft: http://localhost:3001/api/health
2. Backend-Logs prüfen:
```bash
docker logs screenshot-algo-backend
```

### Problem: Template verschwindet nach Neustart
**Prüfen**:
1. Sind die Templates im Backend gespeichert?
```bash
curl http://localhost:3001/api/label-templates
```
2. Existiert der Ordner `backend/data/label-templates/`?
```bash
ls -la backend/data/label-templates/
```

### Problem: Alter Code wird verwendet
**Lösung**: Frontend neu bauen
```bash
cd frontend
npm run build
cd ..
docker-compose down
docker-compose up -d --build
```

---

## ✅ **Checkliste: Alles funktioniert?**

Nach dem Test sollten Sie ALLE Punkte abhaken können:

- [ ] **Backend läuft**: http://localhost:3001/api/health gibt `{"status":"ok"}` zurück
- [ ] **API funktioniert**: `curl http://localhost:3001/api/label-templates` gibt `{"success":true,...}` zurück
- [ ] **localStorage gelöscht**: Keine alten Templates mehr sichtbar
- [ ] **Neues Template erstellen**: Editor öffnet sich
- [ ] **Template speichern**: Erfolgsmeldung erscheint
- [ ] **Navigation korrekt**: Wird zu `/templates` weitergeleitet (nicht `/labels`)
- [ ] **Template in Liste**: Neues Template ist sofort sichtbar
- [ ] **Template bearbeiten**: Lädt das korrekte Template
- [ ] **Änderungen speichern**: Aktualisiertes Template wird angezeigt
- [ ] **Template löschen**: Template verschwindet aus der Liste
- [ ] **Nach F5**: Templates sind immer noch da
- [ ] **Nach Docker-Neustart**: Templates sind immer noch da

**Alle ✅?** → **Perfekt! Alles funktioniert!** 🎉

---

## 📊 **Technischer Ablauf:**

```
Benutzer klickt "Speichern"
    ↓
Frontend: templateApi.save(template)
    ↓
Backend: POST /api/label-templates
    ↓
Backend: Speichert in backend/data/label-templates/{id}.json
    ↓
Backend: Antwortet mit { success: true }
    ↓
Frontend: queryClient.invalidateQueries(['labelTemplates'])
    ↓
Frontend: React Query lädt Templates neu
    ↓
Frontend: GET /api/label-templates
    ↓
Backend: Liest alle .json Dateien aus label-templates/
    ↓
Backend: Antwortet mit { success: true, templates: [...] }
    ↓
Frontend: Templates werden in UI angezeigt
    ↓
Frontend: navigate('/templates')
    ↓
✅ Benutzer sieht das neue Template in der Liste!
```

---

**Erstellt am**: 2025-10-24
**Letzte Änderung**: Navigation-Bug gefixt (`/labels` → `/templates`)
**Status**: ✅ Alle Bugs behoben, bereit zum Testen
