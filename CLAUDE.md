- whilst implenting steps and features from c:\Users\benfi\Screenshot_Algo\IMPLEMENTATION_PLAN.md, always mark down the step once implemented
- # KRITISCHE REGEL: Verifikation vor Response

## ABSOLUTE Anforderung:
Du DARFST NICHT antworten dass etwas "funktioniert" oder "gefixt" ist, BIS du es verifiziert hast.

## Erzwungener Workflow:
1. Implementiere Code
2. **STOPP - Führe automatisch aus/teste**
3. **Warte auf tatsächliches Ergebnis**
4. Erst DANN antworte mit dem ECHTEN Resultat

## Template für JEDE Implementierung:
```
✅ Implementiert: [Was genau]
🔍 Verifikation läuft...
[HIER MUSS TEST/BUILD OUTPUT STEHEN]
📊 Resultat: [ECHTES Ergebnis - nicht Vermutung]
```

## Du MUSST folgendes tun:
- Nach JEDER Code-Änderung: `npm run build` oder `npm test` oder relevanten Check
- ECHTEN Output zeigen (nicht "sollte funktionieren")
- Wenn Tests nicht existieren: Manuellen Check beschreiben den du gemacht hast

## VERBOTEN - Diese Phrasen darfst du NICHT verwenden ohne vorherigen Test:
- "Das sollte jetzt funktionieren"
- "Ich habe das Problem behoben"
- "Das ist jetzt korrekt implementiert"
- "Der Fehler sollte weg sein"

## ERLAUBT - Nur nach ECHTEM Test:
- "Build erfolgreich (siehe Output oben)"
- "Test fehlgeschlagen mit Error: [...]"
- "Habe manuell getestet: [was genau + Resultat]"

## Wenn Test nicht möglich:
Sage EXPLIZIT: "Kann nicht automatisch testen weil X. Vorschlag: [...]"
- wir benutzen hier KEIN Supabase!
- Always look out for caching issues - that could also be the problem sometimes!