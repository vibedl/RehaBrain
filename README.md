# Kopf-Fit

Gedächtnis- und Konzentrationstraining mit Kartenspielen für Menschen nach einem Schlaganfall oder mit Parkinson. Kostenlos, offline, ohne API-Keys. Die App läuft auf Tablet und Computer. Die Planung steht in [PLAN.md](PLAN.md).

> Kopf-Fit ist kein Medizinprodukt und ersetzt keine Therapie.

**Online:** https://vibedl.github.io/RehaBrain/ · **Code:** https://github.com/vibedl/RehaBrain

## Stand (17.09.2026): 26 Übungen in 5 Bereichen, alle Etappen des Plans umgesetzt
- **Grundgerüst:**
  - Profile, Einstellungen (Darstellung hell/dunkel/automatisch, Schriftgröße, Kartenblatt, Vorlesen, Kontrast, weniger Bewegung), Verlauf, Sicherung als Datei
  - Stufen 1–20 passen sich automatisch an; an einem „schlechten Tag“ wird nicht herabgestuft
  - Tagesvorschlag mit geführtem Training über 3 Übungen, Wochenleiste
  - Einstufungstest (ca. 15 Min.) setzt die Startstufen je Bereich
  - Therapie-Bericht zum Drucken oder als PDF (Verlauf → „Bericht drucken oder als PDF“)
  - Skat-Hausregeln in den Einstellungen: Ramsch, Schieberamsch, Bock, Kontra/Re
  - Doppeltipp-Schutz pro Knopf, offline nutzbar
- **Aufmerksamkeit:** Reaktion, Suchbild, Zwei Dinge zugleich
- **Gedächtnis:** Zahlen merken, Wege merken, Einkaufsliste, Gesichter & Namen, Alltag merken
- **Planen & Denken:** Einkaufen, Turm umschichten, Regeln wechseln, Abläufe ordnen
- **Sehen & Raum:** Durchstreichen (mit Auswertung links/rechts), Blicksprung, Figuren vergleichen
- **Kartenspiele (Leiter):** Karten sortieren, Paare finden, Höher oder tiefer, Schnipp-Schnapp, Mau-Mau, Patience (Klondike/Freecell, nur lösbare Spiele), Rommé, 17 und 4, Sechsundsechzig, Skat-Schule, Skat (gegen 2 Computer, mit Ramsch & Bock). Französisches oder deutsches Blatt (Patience immer französisch, 52 Karten).
- **Noch offen:** Test mit echten Nutzer:innen (Spieldauer, Score-Gewichtung, Computer-Stärke bei Rommé/Skat), Handy-Layout der Kartenspiele, Veröffentlichung (z. B. GitHub Pages)

## Lokal starten
Aus diesem Ordner heraus:
```bash
python3 -m http.server 8765
```
Dann `http://localhost:8765` im Browser öffnen. Ein Doppelklick auf die `index.html` reicht nicht, weil der Browser ES-Module und die Offline-Funktion nur über `http://` lädt.

## Veröffentlichen
Die App liegt öffentlich im Repo `vibedl/RehaBrain` und läuft über GitHub Pages. Entwickelt wird weiter im WikiNotebook. Ein neuer Stand geht mit einem Befehl online:
```bash
./projects/hirntraining/veroeffentlichen.sh "Kurze Beschreibung"
```
Der Ordner besteht nur aus statischen Dateien, ein Build-Schritt ist nicht nötig. Er lässt sich auf GitHub Pages, Netlify, Cloudflare Pages oder jeden Webspace hochladen. **Nach jeder Änderung** muss `VERSION` in `sw.js` erhöht werden, sonst behalten installierte Geräte die alte Fassung.

## Aufbau
```
js/core/     store (austauschbare Speicherschicht), profile (Stufen/Verlauf), ui (Tipp-Helfer), speech
js/modules/  Übungen – jede exportiert { id, bereich, titel, icon, anleitung(stufe), run(ctx) → {score 0..1, text} }
js/cards/    deck (32-Karten-Blatt), engine (Stapel, Reihum, Computer-Gegner ohne DOM), tisch (Spieltisch-Oberfläche) und die Kartenspiele
css/         Styles je Bereich (gedaechtnis, planen, sehen, karten)
```
Für eine neue Übung legst du eine Datei mit dieser Schnittstelle an (Details in `SCHWARM_BRIEFING.md`), trägst sie in `MODULE` in `js/app.js` ein, ergänzt ein Icon in `js/core/icons.js` und fügst sie zur Dateiliste in `sw.js` hinzu.
