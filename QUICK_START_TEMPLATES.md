# 🚀 Quick Start: Neue Template-Verwaltung

## ⚡ In 3 Schritten starten

### Schritt 1: Browser-Cache leeren
Öffnen Sie http://localhost:3001 und drücken Sie **F12**:
```javascript
localStorage.clear();
location.reload();
```
✅ **Fertig!** Die Seite lädt neu und alte Templates sind weg.

### Schritt 2: Docker neu starten (optional)
```bash
docker-compose down
docker-compose up -d --build
```

### Schritt 3: Erstes Template erstellen
1. Klicken Sie in der Sidebar auf **"Label Templates"**
2. Klicken Sie **"Neues Template"**
3. Erstellen Sie Ihr Label-Design
4. Wählen Sie ein Drucklayout (z.B. "A4 Grid - 3×7")
5. Klicken Sie **"Speichern"**

🎉 **Das Template erscheint jetzt in der Liste!**

---

## 📱 Neue Navigation

In der Sidebar finden Sie jetzt **zwei Template-Bereiche**:

### 📄 **Label Templates**
- Zum Erstellen von Label-Designs
- Elemente hinzufügen: Text, Bilder, Preise, QR-Codes
- Drucklayout auswählen
- Auto-Match Regeln definieren

### 🖨️ **Druck Templates**
- Zum Verwalten von Drucklayout-Vorlagen
- Standard-Layouts festlegen
- Templates exportieren/importieren

---

## ❓ Häufige Fragen

### **Wo sind meine alten Templates?**
Die alten Templates waren im Browser-Cache gespeichert. Nach dem localStorage-Löschen (Schritt 1) sind sie weg. Sie können neue Templates erstellen - diese werden dann korrekt im Backend gespeichert!

### **Template wird nicht gespeichert?**
Prüfen Sie:
1. Backend läuft: http://localhost:3001/api/health
2. Browser Console (F12) auf Fehler prüfen
3. localStorage gelöscht? (Schritt 1 wiederholen)

### **Template erscheint nicht in der Liste?**
1. Seite neu laden (F5)
2. Prüfen Sie ob Sie auf **"Label Templates"** sind (nicht "Druck Templates")
3. Browser-Cache leeren (Strg + Shift + Delete)

### **Wie bearbeite ich ein Template?**
1. Gehen Sie zu **"Label Templates"**
2. Klicken Sie auf **"Bearbeiten"** beim gewünschten Template
3. Der Editor öffnet sich mit dem geladenen Template
4. Änderungen vornehmen → **"Speichern"**

---

## 🆘 Probleme?

### Debug-Tool verwenden:
Öffnen Sie `migrate-localstorage-templates.html` im Browser und folgen Sie den Schritten.

### Oder: Templates manuell prüfen
```bash
node check-templates.js
```

### Komplett zurücksetzen:
```bash
# Doppelklick auf:
CLEAR_TEMPLATES.bat
```

---

## ✅ Checkliste: Alles funktioniert?

- [ ] localStorage gelöscht
- [ ] Docker neu gestartet
- [ ] Neues Label-Template erstellt
- [ ] Template in Liste sichtbar
- [ ] Template bearbeiten funktioniert
- [ ] Druckvorschau funktioniert
- [ ] Template löschen funktioniert

**Alle Häkchen gesetzt?** 🎉 **Perfekt, Sie können loslegen!**

---

**Support**: Bei weiteren Problemen Screenshots von Fehlermeldungen machen und senden!
