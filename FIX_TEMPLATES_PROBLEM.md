# ⚡ Schnelle Lösung: Templates zurücksetzen

## Das Problem
Templates werden im **Browser-Cache** (localStorage) gespeichert, deshalb sieht man die alten Templates noch!

## ✅ Lösung (NUR 2 Schritte!)

### Schritt 1: Browser-Console öffnen
1. Öffnen Sie http://localhost:3001 im Browser
2. Drücken Sie **F12** (oder Rechtsklick → "Untersuchen")
3. Klicken Sie auf den Tab **"Console"**

### Schritt 2: localStorage löschen
Kopieren Sie diese Zeile in die Console und drücken Sie **Enter**:

```javascript
localStorage.clear(); location.reload();
```

**Das war's!** Die Seite lädt neu und die alten Templates sind weg.

---

## Alternative: Private/Inkognito-Fenster
Öffnen Sie http://localhost:3001 in einem **Private/Inkognito-Fenster**:
- **Chrome/Edge**: Strg + Shift + N
- **Firefox**: Strg + Shift + P

Im Inkognito-Modus gibt es keinen localStorage-Cache.

---

## Neue Templates speichern
Nach dem localStorage-Löschen:
1. Gehen Sie zu "Templates" → "Neues Label-Template"
2. Erstellen Sie Ihr Template
3. Klicken Sie "Speichern"
4. **WICHTIG**: Das Template wird jetzt richtig im Backend gespeichert!

---

## Warum passiert das?
Es gibt einen Bug im Code:
- Templates werden zum **Backend** gespeichert ✅
- Templates werden aus **localStorage** geladen ❌

→ Ich werde das gleich fixen, sodass Templates richtig aus dem Backend geladen werden!
