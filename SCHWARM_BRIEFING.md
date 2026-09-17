# Schwarm-Briefing Kopf-Fit (gilt für alle Agenten)

Projekt: `<Projektordner>/`. Das ist eine Offline-Web-App (PWA) für Gedächtnis- und Konzentrationstraining für Menschen nach einem Schlaganfall und mit Parkinson. Sie ist in reinem JavaScript mit ES-Modulen geschrieben, ohne Build und ohne npm-Pakete. Die gesamte Oberfläche ist auf Deutsch, Nutzer:innen werden gesiezt.

## Vor dem Start lesen
- `PLAN.md` (Abschnitte 2, 3, 4 und 8)
- `js/core/ui.js`: Helfer `h()`, `onTap`, `debounced`, `sleep`, `rand`, `pick`, `shuffle`, `feedback`
- **zwei Referenzmodule:** `js/modules/wege.js` und `js/cards/hoeher.js`. Deren Muster genau übernehmen.
- `js/cards/deck.js`: Kartendeck mit `neuesDeck(blatt)`, `karteElement(k, {verdeckt, tag})`, `kartenName`, `istBild`, `BLAETTER`
- `style.css`: nur lesen, um die Design-Tokens zu kennen

## Schnittstelle eines Moduls (Pflicht)
```js
export default {
  id: "eindeutige-id",            // klein, ohne Leerzeichen
  bereich: "Aufmerksamkeit" | "Gedächtnis" | "Planen & Denken" | "Sehen & Raum" | "Kartenspiele",
  titel: "Kurzer Titel",
  icon: "",                        // leer lassen, Icons baut der Koordinator
  anleitung: (stufe) => "1–3 kurze, klare Sätze, Sie-Form",
  async run(ctx) { ... return { score: 0..1, text: "Ergebnis in einem Satz" } }
}
```
`ctx` = `{ stage, stufe (1–20), settings: {blatt: "franzoesisch"|"deutsch", ...}, bests: {} (persönliche Bestwerte, beschreibbar), alive(): bool, speak(text) }`.
- Alles wird in `ctx.stage` gerendert. Nach jedem `await` gilt: `if (!ctx.alive()) return null;` (so wird ein Abbruch erkannt).
- Warte-Promises für Eingaben prüfen `ctx.alive()` per `setInterval` (siehe wege.js) und lösen bei Abbruch mit `null` auf.
- Klick-Handler **immer** über `onTap` / `debounced` (schützt vor Doppeltipps durch Zittern). Kein Ziehen und Ablegen als Pflicht. Tippe-und-Ziel-antippen reicht immer.
- Die Stufen 1–20 steuern die Schwierigkeit spürbar. Der Score ist ≥ 0.8, wenn es für diese Stufe gut lief, und < 0.5, wenn es zu schwer war. Eine Runde dauert 2–4 Minuten.
- Fehler werden freundlich per `feedback(stage, "…", "neutral")` gemeldet, nie mit rotem „Falsch!“.

## Gestaltung
- **Keine Emojis in der Bedienung.** Bildinhalte als eigenes Inline-SVG (einfache, klare Formen), Farben nur über CSS-Variablen: `--ink`, `--muted`, `--card`, `--canvas-alt`, `--line`, `--line-strong`, `--copper`, `--copper-dark`, `--copper-subtle`, `--sage`, `--sage-light`, `--blau`, `--kartenweiss`, `--radius-md`, `--radius-lg`, `--shadow-md`, `--tippmin` (Mindestgröße einer Tippfläche), `--serif`, `--sans`. Sie funktionieren im hellen und im dunklen Modus.
- Vorhandene Klassen dürfen genutzt werden: `.hinweis`, `.hinweis.gross`, `.knopf`, `.knopf.gross`, `.knopf.primaer`, `.knopf.riesig`, `.knopfreihe`, `.kartenplatz`, `.kartenplatz.zwei`, `.karte`, `.stapel`, `.spielstand`, `.tastenfeld`, `.taste`, `.brett`, `.feld`.
- Neue Styles kommen **nur** in die eigene CSS-Datei (siehe Auftrag), mit eindeutigem Präfix pro Modul. Tippflächen sind mindestens `var(--tippmin)` groß, Schrift mindestens `1em`.
- Die Kartenspiele laufen automatisch auf einem dunklen Tisch (`.uebung.tisch`). Text dort in hellen Farben (`#fff` bzw. `rgba(243,239,234,.72)`).

## Verboten
- `js/app.js`, `sw.js`, `style.css`, `index.html`, `js/core/*` und fremde Dateien ändern. Fehlt dir ein Helfer, baue ihn lokal in deiner Datei.
- git-Befehle ausführen (committen erledigt der Koordinator)
- Netzwerkzugriffe oder externe Bibliotheken

## Prüfen, bevor du fertig meldest
- `node --check <jede deiner Dateien>`
- Reine Spiellogik (Regeln, Punkte, Gegner) als exportierte Funktionen schreiben und mit einem kleinen Node-Skript im Scratchpad testen: `node --input-type=module -e "import ... from '<absoluter Pfad>'"`. Die Module importieren `../core/ui.js`, das DOM nur beim Aufruf braucht. Import und Logik lassen sich also testen.

## Abschlussbericht (kurz)
1. Liste der Dateien, jeweils mit `id` und `bereich`
2. **Icon-Vorschlag je Modul:** der Inhalt eines SVG für `viewBox="0 0 48 48"`, nur Strich-Pfade (Stroke), ohne `<svg>`-Tag (Stil wie in `js/core/icons.js`)
3. was getestet wurde und was offen oder unsicher ist
