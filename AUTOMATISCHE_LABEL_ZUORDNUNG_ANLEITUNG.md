# 📋 Automatische Label-Zuordnung - Benutzeranleitung

## 🎯 Was macht das System?

Das System ordnet **automatisch** das richtige Label-Template jedem Artikel zu, basierend auf seinem Preis-Typ:

| Artikel-Typ | Wird automatisch zugeordnet zu |
|------------|-------------------------------|
| **Staffelpreis-Artikel** | Staffelpreis-Label-Template |
| **Einzelpreis-Artikel** | Einzelpreis-Label-Template |
| **"Auf Anfrage"-Artikel** | Einzelpreis-Label-Template ⚠️ |

⚠️ **Wichtig:** Artikel mit "Auf Anfrage" werden **automatisch** mit dem gleichen Template wie Einzelpreis-Artikel gedruckt!

---

## 📝 Schritt 1: Label-Templates erstellen

### Option A: Einzelpreis-Template erstellen

1. **Öffne:** http://localhost:3001
2. **Klicke in der Sidebar:** "Label Templates"
3. **Klicke:** "Neues Template" (blauer Button rechts oben)
4. **Fülle aus:**
   - **Name:** `Einzelpreis-Label` (oder wie du möchtest)
   - **Beschreibung:** `Für Artikel mit normalem Einzelpreis`
   - **Größe:** z.B. 400x250px (100x62.5mm)
   - **Design:** Gestalte dein Label mit Produktname, Preis, Bild, etc.

5. **Scrolle nach unten zu:** "Auto-Match Regeln"
6. **Aktiviere:** ✅ "Auto-Match aktivieren"
7. **Füge Regel hinzu:**
   - **Feld:** `Preis-Typ`
   - **Operator:** `ist`
   - **Wert:** `Normaler Preis`

8. **WICHTIG - Zweite Regel hinzufügen:**
   - **Klicke:** "+ Bedingung hinzufügen"
   - **Feld:** `Preis-Typ`
   - **Operator:** `ist`
   - **Wert:** `Auf Anfrage`

9. **Wähle Logik:** `ODER` (nicht UND!)
   - Das bedeutet: Artikel mit Einzelpreis **ODER** "Auf Anfrage" bekommen dieses Template

10. **Speichere das Template**

### Option B: Staffelpreis-Template erstellen

1. **Klicke:** "Neues Template"
2. **Fülle aus:**
   - **Name:** `Staffelpreis-Label`
   - **Beschreibung:** `Für Artikel mit Mengenrabatten`
   - **Größe:** z.B. 400x350px (100x87.5mm) - **GRÖSSER** für Preisstaffel!
   - **Design:** Extra Platz für Preisstaffel-Tabelle

3. **Auto-Match Regeln:**
   - ✅ Auto-Match aktivieren
   - **Regel:** `Preis-Typ` `ist` `Staffelpreis`

4. **Speichere das Template**

---

## 🚀 Schritt 2: Automatische Zuordnung nutzen

### Bulk-Generierung mit Auto-Match:

1. **Gehe zu:** Artikel-Seite (Sidebar → "Articles")

2. **Wähle Artikel aus:**
   - Aktiviere "Alle auswählen" (für alle Artikel)
   - Oder wähle einzelne Artikel mit Checkboxen

3. **Klicke:** "Labels generieren" Button (rechts oben)

4. **Auto-Match Preview erscheint:**
   ```
   Automatische Template-Zuweisung

   ✅ Gematched: 18 Artikel
      - 15x Einzelpreis-Label
        (davon 2x "Auf Anfrage"-Artikel)
      - 3x Staffelpreis-Label

   ⚠️ Übersprungen: 0 Artikel
   ```

5. **Prüfe die Zuordnung:**
   - Einzelpreis-Artikel → Einzelpreis-Template ✅
   - Staffelpreis-Artikel → Staffelpreis-Template ✅
   - "Auf Anfrage"-Artikel → Einzelpreis-Template ✅

6. **Klicke:** "Labels generieren" (wenn alles passt)

7. **Fertig!** 🎉
   - Alle Labels werden mit dem passenden Template erstellt
   - Toast-Nachricht zeigt Anzahl generierter Labels

---

## 🔍 Wie erkennt das System die Artikel-Typen?

Das System analysiert **automatisch** jeden Artikel:

```
┌─────────────────────────────────────┐
│ ARTIKEL-ANALYSE                     │
├─────────────────────────────────────┤
│                                     │
│ 1. Hat der Artikel Staffelpreise?  │
│    (z.B. "ab 10 Stück: 5.99 EUR")  │
│    → JA = STAFFELPREIS             │
│    → NEIN = weiter zu 2.           │
│                                     │
│ 2. Steht "Auf Anfrage" im Text?    │
│    → JA = AUF ANFRAGE              │
│    → NEIN = weiter zu 3.           │
│                                     │
│ 3. Hat der Artikel einen Preis?    │
│    (z.B. 19.99 EUR)                │
│    → JA = EINZELPREIS              │
│    → NEIN = KEIN PREIS             │
│                                     │
└─────────────────────────────────────┘
```

### Prioritäten (wichtig!):

1. **HÖCHSTE PRIORITÄT:** Staffelpreise
   - Wenn ein Artikel Staffelpreise hat, wird er IMMER als Staffelpreis klassifiziert
   - Auch wenn zusätzlich ein Einzelpreis angegeben ist!

2. **MITTLERE PRIORITÄT:** "Auf Anfrage"
   - Wenn kein Staffelpreis, aber "Auf Anfrage" im Text steht

3. **NIEDRIGSTE PRIORITÄT:** Einzelpreis
   - Wenn weder Staffelpreis noch "Auf Anfrage"

---

## 💡 Beispiele

### Beispiel 1: Normaler Artikel
```
Artikel: Kistenwaschmaschine Basic
Artikelnummer: 1234
Preis: 1.299,00 EUR
Staffelpreise: -

→ System erkennt: EINZELPREIS
→ Verwendet: Einzelpreis-Template
```

### Beispiel 2: Staffelpreis-Artikel
```
Artikel: Papiertragetasche 1,5 KG
Artikelnummer: 8358
Preis: -
Staffelpreise:
  - ab 35 Stück: 0,60 EUR
  - ab 50 Stück: 0,55 EUR

→ System erkennt: STAFFELPREIS
→ Verwendet: Staffelpreis-Template
```

### Beispiel 3: "Auf Anfrage"-Artikel
```
Artikel: Kistenwaschmaschine Teco
Artikelnummer: 1050
Preis: -
Text: "Auf Anfrage"

→ System erkennt: AUF ANFRAGE
→ Verwendet: Einzelpreis-Template ✅
```

### Beispiel 4: Artikel MIT Staffelpreis UND Einzelpreis
```
Artikel: Premium-Spargelschale
Artikelnummer: 9999
Preis: 10,00 EUR
Staffelpreise:
  - ab 50 Stück: 8,50 EUR
  - ab 100 Stück: 7,00 EUR

→ System erkennt: STAFFELPREIS (hat Vorrang!)
→ Verwendet: Staffelpreis-Template
```

---

## ⚙️ Erweiterte Regeln erstellen

Du kannst auch **komplexere Regeln** erstellen, z.B.:

### Regel 1: Teure Einzelpreis-Artikel (Premium-Label)
```
Template: "Premium-Label"
Regeln:
  - Preis-Typ ist "Normaler Preis"
  UND
  - Preisbereich größer als 100 EUR

Logik: UND
```
→ Nur Einzelpreis-Artikel ÜBER 100 EUR bekommen das Premium-Label

### Regel 2: Staffelpreis-Artikel einer bestimmten Kategorie
```
Template: "Staffelpreis-Spezial"
Regeln:
  - Preis-Typ ist "Staffelpreis"
  UND
  - Kategorie enthält "Verpackung"

Logik: UND
```
→ Nur Staffelpreis-Artikel aus der Kategorie "Verpackung"

### Regel 3: Hersteller-spezifische Labels
```
Template: "Firmenich-Label"
Regeln:
  - Hersteller ist "Firmenich"

Logik: (egal)
```
→ Alle Artikel von Firmenich bekommen ein spezielles Label

---

## 🛠️ Verfügbare Regel-Felder

| Feld | Operatoren | Werte | Beispiel |
|------|-----------|-------|----------|
| **Preis-Typ** | `ist`, `ist nicht` | `Normaler Preis`, `Staffelpreis`, `Auf Anfrage` | Artikel mit Einzelpreis |
| **Kategorie** | `ist`, `ist nicht`, `enthält` | Freitext | Kategorie enthält "Spargel" |
| **Preisbereich** | `größer als`, `kleiner als` | Zahl | Preis > 50 EUR |
| **Hersteller** | `ist`, `enthält` | Freitext | Hersteller ist "TECO" |

### Logik-Optionen:
- **UND:** Alle Bedingungen müssen zutreffen
- **ODER:** Mindestens eine Bedingung muss zutreffen

---

## 🔧 Troubleshooting

### Problem: Artikel werden nicht gematched
**Lösung:**
1. Prüfe ob Auto-Match im Template aktiviert ist ✅
2. Prüfe ob die Regeln korrekt sind
3. Prüfe die Logik (UND vs. ODER)
4. Teste mit einzelnem Artikel zuerst

### Problem: Falsches Template wird zugeordnet
**Lösung:**
- **Template-Reihenfolge wichtig!**
- Das **erste** passende Template wird verwendet
- Spezifischere Templates sollten OBEN stehen
- Generische Templates sollten UNTEN stehen

**Beispiel richtige Reihenfolge:**
```
1. Premium-Label (Einzelpreis UND > 100 EUR)     ← Spezifisch
2. Staffelpreis-Label (Staffelpreis)             ← Mittel
3. Einzelpreis-Label (Einzelpreis ODER Auf Anfrage) ← Generisch
```

### Problem: "Auf Anfrage" Artikel werden übersprungen
**Lösung:**
- Füge im Einzelpreis-Template eine zweite Regel hinzu:
  - `Preis-Typ` `ist` `Auf Anfrage`
- Setze Logik auf `ODER`

---

## 📊 Statistiken anzeigen

Nach der Generierung siehst du:
- **Anzahl gematched:** Wie viele Artikel ein Template bekommen haben
- **Anzahl übersprungen:** Artikel ohne passendes Template
- **Template-Verteilung:** Welches Template wie oft verwendet wurde

**Beispiel:**
```
✅ 18 Artikel gematched:
   - 15x Einzelpreis-Label (davon 2x "Auf Anfrage")
   - 3x Staffelpreis-Label

⚠️ 3 Artikel übersprungen:
   - Artikel ohne Preis können nicht automatisch zugeordnet werden
```

---

## 🎯 Best Practices

1. **Immer mit Vorschau testen** bevor du alle Artikel generierst
2. **Klare Template-Namen** verwenden (z.B. "Staffelpreis-Label", nicht "Template 1")
3. **Beschreibungen** helfen später bei der Verwaltung
4. **Template-Reihenfolge** beachten (spezifisch → generisch)
5. **Fallback-Template** ohne Auto-Match für manuelle Zuordnung

---

## 🚀 Quick-Start Zusammenfassung

**In 3 Schritten zu automatischen Labels:**

1️⃣ **Templates erstellen:**
   - Einzelpreis-Template (mit Regel: "Einzelpreis" ODER "Auf Anfrage")
   - Staffelpreis-Template (mit Regel: "Staffelpreis")

2️⃣ **Auto-Match aktivieren:**
   - ✅ In jedem Template Auto-Match anschalten
   - Regeln korrekt einstellen

3️⃣ **Artikel auswählen & generieren:**
   - Artikel markieren → "Labels generieren"
   - Vorschau prüfen → Bestätigen → Fertig! 🎉

---

## ✅ Checkliste für neue Templates

Bevor du ein neues Auto-Match-Template erstellst:

- [ ] Template-Name ist beschreibend
- [ ] Template-Beschreibung erklärt Verwendungszweck
- [ ] Design ist für den Artikel-Typ optimiert
  - [ ] Einzelpreis: Kompakte Höhe (250-300px)
  - [ ] Staffelpreis: Größere Höhe (350-400px) für Tabelle
- [ ] Auto-Match ist aktiviert ✅
- [ ] Regeln sind korrekt eingestellt
- [ ] Logik (UND/ODER) ist richtig gewählt
- [ ] Getestet mit echten Artikeln
- [ ] Template-Reihenfolge berücksichtigt

---

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfe diese Anleitung
2. Teste mit einzelnem Artikel
3. Prüfe Browser-Console (F12) auf Fehlermeldungen
4. Kontaktiere Support mit Screenshot der Fehlermeldung

---

**Viel Erfolg mit der automatischen Label-Generierung!** 🎉

*Erstellt am: 03.11.2025*
*Version: 1.0*
*Für: Screenshot_Algo Label Generation System*
