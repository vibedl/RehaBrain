// Kopf-Fit – Einstufung (ca. 15 Minuten): legt die Startstufen je Bereich fest.
// Eigenständiger Baustein: rendert selbst in `app`, nutzt dieselbe run(ctx)-Schnittstelle wie app.js.
// Kein „Test bestehen“ – nur ein freundliches Ausprobieren, jederzeit pausierbar.
import { h } from "./ui.js";
import { icon } from "./icons.js";
import { speak as sprich, stopSpeaking } from "./speech.js";
import { load, save } from "./store.js";
import { updateProfile, MIN_LEVEL, MAX_LEVEL } from "./profile.js";

// ---------- Reine Logik (ohne DOM, in Node testbar) ----------

/** Welche Übung je Bereich zur Einstufung genutzt wird (erste vorhandene id gewinnt) */
export const TEST_VORLIEBEN = {
  "Aufmerksamkeit": ["reaktion", "suchbild", "geteilt"],
  "Gedächtnis": ["zahlen", "wege", "einkaufsliste"],
  "Planen & Denken": ["turm", "einkaufen", "ablauf"],
  "Sehen & Raum": ["durchstreichen", "blicksprung", "figuren"],
  // Kartenspiele werden nicht getestet, sondern aus den anderen Bereichen abgeleitet
};

export const START_STUFE = 4;
export const MAX_DURCHGAENGE = 2;
export const KARTEN_ABSTAND = 2; // Kartenspiele starten so viele Stufen unter dem Mittel

const klemme = (s) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(s)));
const gut = (score) => score >= 0.8;
const schwer = (score) => score < 0.5;

/** Liefert je Bereich das Testmodul: [{ bereich, modul }] (Bereiche ohne passendes Modul entfallen) */
export function waehleTestmodule(module, bereiche) {
  return bereiche
    .map((b) => (typeof b === "string" ? b : b.name))
    .filter((name) => TEST_VORLIEBEN[name])
    .map((name) => {
      const imBereich = module.filter((m) => m.bereich === name);
      const modul = TEST_VORLIEBEN[name].map((id) => imBereich.find((m) => m.id === id)).find(Boolean) ?? imBereich[0];
      return modul ? { bereich: name, modul } : null;
    })
    .filter(Boolean);
}

/**
 * Treppen-Ansatz: nächste Probestufe oder null (= fertig).
 * durchgaenge: [{ stufe, score }]
 */
export function naechsteProbe(durchgaenge) {
  if (durchgaenge.length === 0) return START_STUFE;
  if (durchgaenge.length >= MAX_DURCHGAENGE) return null;
  const { stufe, score } = durchgaenge[0];
  if (gut(score)) return klemme(stufe + 4);   // lief gut → deutlich höher probieren
  if (schwer(score)) return klemme(stufe - 2); // zu schwer → leichter probieren
  return null;                                 // passt → fertig
}

/** Startstufe aus den Durchgängen */
export function ermittleStufe(durchgaenge) {
  if (!durchgaenge.length) return START_STUFE;
  const [a, b] = durchgaenge;
  if (!b || b.stufe === a.stufe) {
    if (gut(a.score)) return klemme(a.stufe + 1);
    if (schwer(a.score)) return klemme(a.stufe - 1);
    return klemme(a.stufe);
  }
  if (b.stufe > a.stufe) {                      // nach oben probiert
    if (schwer(b.score)) return klemme(Math.floor((a.stufe + b.stufe) / 2));
    return klemme(b.stufe);                     // gut oder passend → höhere Stufe halten
  }
  // nach unten probiert
  if (gut(b.score)) return klemme(Math.ceil((a.stufe + b.stufe) / 2));
  if (schwer(b.score)) return klemme(b.stufe - 1);
  return klemme(b.stufe);
}

/**
 * Bereichsstufen auf alle Module übertragen.
 * bereichStufen: { "Aufmerksamkeit": 6, ... } → { modulId: stufe }
 * Kartenspiele (falls nicht selbst eingestuft): Mittel der übrigen Bereiche minus KARTEN_ABSTAND.
 */
export function verteileStufen(module, bereichStufen) {
  const werte = Object.entries(bereichStufen).filter(([n]) => n !== "Kartenspiele").map(([, s]) => s);
  const mittel = werte.length ? werte.reduce((x, y) => x + y, 0) / werte.length : START_STUFE;
  const karten = bereichStufen["Kartenspiele"] ?? klemme(mittel - KARTEN_ABSTAND);
  const levels = {};
  for (const m of module) {
    if (m.bereich === "Kartenspiele") levels[m.id] = karten;
    else if (bereichStufen[m.bereich] != null) levels[m.id] = klemme(bereichStufen[m.bereich]);
  }
  return { levels, kartenStufe: karten };
}

/** Wertschätzende Beschreibung einer Startstufe (keine Diagnose-Sprache) */
export function stufenSatz(stufe) {
  if (stufe <= 3) return "Sie beginnen ganz in Ruhe – so kann das Training gut mit Ihnen wachsen.";
  if (stufe <= 7) return "Ein guter, angenehmer Einstieg. Die Übungen passen sich weiter an Sie an.";
  if (stufe <= 12) return "Das lief schon richtig gut. Sie starten mit etwas mehr Herausforderung.";
  return "Beeindruckend! Hier starten Sie mit anspruchsvollen Aufgaben.";
}

// ---------- Oberfläche ----------

const zwischenKey = (profil) => `einstufung-zwischenstand:${profil.id}`;
export const hatZwischenstand = (profil) => !!load(zwischenKey(profil), null);

/**
 * Startet die Einstufung.
 * @param {object} o
 * @param {HTMLElement} o.app        Wurzelelement (#app)
 * @param {object} o.profil          aktuelles Profil (wird verändert und gespeichert)
 * @param {Array} o.module           MODULE-Liste aus app.js
 * @param {Array} o.bereiche         BEREICHE-Liste aus app.js ({name, akzent})
 * @param {Function} [o.onFertig]    (ergebnis) => void, nach Tipp auf „Zur Übersicht“ im Ergebnis
 * @param {Function} [o.onAbbruch]   () => void, wenn die Person „Später weitermachen“ wählt
 * @param {Function} [o.speak]       Vorlesefunktion (Standard: speech.js)
 * @returns {Promise<object|null>}   Ergebnis { datum, bereiche } oder null bei Abbruch
 */
export function starteEinstufung({ app, profil, module, bereiche, onFertig, onAbbruch, speak = sprich }) {
  const tests = waehleTestmodule(module, bereiche);
  const akzent = (name) => bereiche.find((b) => (b.name ?? b) === name)?.akzent ?? "a-copper";
  let sitzung = null; // { alive }
  let aufgeloest = false;

  return new Promise((resolve) => {
    const ende = (wert) => { if (!aufgeloest) { aufgeloest = true; resolve(wert); } };
    const neuerStand = () => ({ index: 0, durchgaenge: {}, stufen: {} });
    let stand = load(zwischenKey(profil), null);

    const zeige = (...kinder) => {
      if (sitzung) sitzung.alive = false;
      sitzung = null;
      stopSpeaking();
      app.replaceChildren(...kinder);
      window.scrollTo?.(0, 0);
      app.querySelector("h1")?.focus?.();
    };
    const kopf = (titel, eyebrow, aktionen = []) => h("header.kopf.schmal", {},
      h("div.kopf-links", {}, h("div.kopf-titel", {},
        eyebrow ? h("span.eyebrow", { text: eyebrow }) : null,
        h("h1", { text: titel, tabindex: "-1" }))),
      h("div.kopf-aktionen", {}, aktionen));
    const merken = () => save(zwischenKey(profil), stand);
    const vergessen = () => save(zwischenKey(profil), null);
    const fortschritt = () => h("ol.aw-schritte", { "aria-label": "Fortschritt" },
      tests.map((t, i) => h("li" + (i < stand.index ? ".aw-fertig" : i === stand.index ? ".aw-jetzt" : ""), {},
        h("span.aw-punkt"), h("span", { text: t.bereich }))));

    // 1) Einleitung
    function einleitung() {
      const weiter = stand && stand.index > 0 && stand.index < tests.length;
      const text = "Wir probieren gemeinsam ein paar kurze Übungen aus – eine aus jedem Bereich. "
        + "So findet Kopf-Fit heraus, mit welcher Stufe das Training für Sie angenehm beginnt. "
        + "Es gibt nichts zu bestehen. Das dauert etwa 15 Minuten, und Sie können jederzeit eine Pause machen.";
      zeige(
        kopf("Einstufung", "Kopf-Fit kennenlernen"),
        h("main.inhalt.schmal.aw-einstufung", {},
          h("p.anleitung.aw-links", { text }),
          h("ul.aw-bereiche", {}, tests.map((t) =>
            h(`li.${akzent(t.bereich)}`, {}, h("span.aw-icon", {}, icon(t.modul.id)),
              h("span", {}, h("strong", { text: t.bereich }), h("small", { text: t.modul.titel }))))),
          h("p.leise-text", { text: "Die Kartenspiele werden nicht eigens ausprobiert – sie starten etwas leichter als die übrigen Übungen." }),
          h("div.knopfreihe", {},
            h("button.knopf", { onTap: () => speak(text, { force: true }) }, icon("vorlesen"), h("span", { text: "Vorlesen" })),
            weiter
              ? [h("button.knopf", { text: "Neu beginnen", onTap: () => { stand = neuerStand(); merken(); anleitung(); } }),
                 h("button.knopf.gross.primaer", { text: `Fortsetzen (${stand.index} von ${tests.length} geschafft)`, onTap: anleitung })]
              : h("button.knopf.gross.primaer", { text: "Los geht's", onTap: () => { stand = neuerStand(); merken(); anleitung(); } })),
          h("button.knopf.aw-spaeter", { text: "Lieber später", onTap: abbrechen }),
        ),
      );
      speak(text);
    }

    function abbrechen() {
      if (sitzung) sitzung.alive = false;
      stopSpeaking();
      ende(null);
      onAbbruch?.();
    }

    // 2) Anleitung vor jedem Durchgang
    function anleitung() {
      if (!stand) stand = neuerStand();
      if (stand.index >= tests.length) return abschluss();
      const { bereich, modul } = tests[stand.index];
      const bisher = stand.durchgaenge[bereich] ?? [];
      const stufe = naechsteProbe(bisher);
      if (stufe == null) { stand.stufen[bereich] = ermittleStufe(bisher); stand.index++; merken(); return anleitung(); }
      const zweiter = bisher.length > 0;
      const text = modul.anleitung(stufe);
      const vorsatz = zweiter
        ? (gut(bisher[0].score) ? "Das lief gut! Wir probieren dieselbe Übung jetzt etwas schwieriger." : "Danke! Wir probieren dieselbe Übung jetzt etwas leichter.")
        : null;
      zeige(
        kopf(modul.titel, `Bereich ${stand.index + 1} von ${tests.length} · ${bereich}`,
          [h("button.knopf", { onTap: pause }, h("span", { text: "Pause" }))]),
        h("main.inhalt.schmal.mittig.aw-einstufung", {},
          fortschritt(),
          h(`div.symbol-gross.${akzent(bereich)}`, {}, icon(modul.id)),
          vorsatz ? h("p.aw-vorsatz", { text: vorsatz }) : null,
          h("p.anleitung", { text }),
          h("div.knopfreihe", {},
            h("button.knopf", { onTap: () => speak(text, { force: true }) }, icon("vorlesen"), h("span", { text: "Vorlesen" })),
            h("button.knopf.gross.primaer", { text: "Los geht's", onTap: () => durchgang(stufe) })),
        ),
      );
      speak((vorsatz ? vorsatz + " " : "") + text);
    }

    // 3) Ein Durchgang über die normale run(ctx)-Schnittstelle
    async function durchgang(stufe) {
      const { bereich, modul } = tests[stand.index];
      const stage = h("div.stage");
      zeige(
        h("header.kopf.uebung-kopf", {},
          h("div.kopf-links", {},
            h("button.knopf", { onTap: pause }, icon("schliessen"), h("span", { text: "Pause" })),
            h("h1", { text: modul.titel, tabindex: "-1" })),
          h("span.stufe-klein", { text: `Einstufung · ${bereich}` })),
        h("main.inhalt.uebung" + (bereich === "Kartenspiele" ? ".tisch" : ""), {}, stage),
      );
      const meine = { alive: true };
      sitzung = meine;
      const ctx = {
        stage, stufe, settings: profil.settings, bests: profil.bests,
        einstufung: true, kurz: true, // Hinweis für Module, die eine verkürzte Runde anbieten möchten
        alive: () => meine.alive && stage.isConnected,
        speak: (t) => speak(t),
      };
      let ergebnis = null;
      try {
        ergebnis = await modul.run(ctx);
      } catch (err) {
        console.error(err);
        ergebnis = { score: 0.6, text: "" }; // technischer Fehler zählt nicht gegen die Person
      }
      if (!ergebnis || !ctx.alive()) return; // pausiert oder weggeklickt
      const score = Math.max(0, Math.min(1, Number(ergebnis.score) || 0));
      (stand.durchgaenge[bereich] ??= []).push({ stufe, score: Math.round(score * 100) / 100 });
      updateProfile(profil); // Bestwerte (z. B. Seitenbilanz) mitsichern
      merken();
      anleitung();
    }

    // Pause: aktueller Durchgang wird verworfen, Geschafftes bleibt
    function pause() {
      if (sitzung) sitzung.alive = false;
      merken();
      const text = "Gut, wir machen eine Pause. Alles, was Sie schon geschafft haben, bleibt gespeichert.";
      zeige(
        kopf("Pause", "Einstufung"),
        h("main.inhalt.schmal.mittig.aw-einstufung", {},
          fortschritt(),
          h("p.anleitung", { text }),
          h("div.knopfreihe", {},
            h("button.knopf", { text: "Später weitermachen", onTap: abbrechen }),
            h("button.knopf.gross.primaer", { text: "Weitermachen", onTap: anleitung })),
        ),
      );
      speak(text);
    }

    // 4) Ergebnis speichern und zeigen
    function abschluss() {
      const bereichStufen = { ...stand.stufen };
      const { levels, kartenStufe } = verteileStufen(module, bereichStufen);
      if (module.some((m) => m.bereich === "Kartenspiele")) bereichStufen["Kartenspiele"] = kartenStufe;
      Object.assign(profil.levels, levels);
      const ergebnis = { datum: new Date().toISOString().slice(0, 10), bereiche: bereichStufen, durchgaenge: stand.durchgaenge };
      profil.einstufung = ergebnis;
      updateProfile(profil);
      vergessen();
      ende(ergebnis);

      const text = "Vielen Dank! Sie haben die Einstufung geschafft. Ab jetzt beginnt jede Übung auf einer Stufe, die zu Ihnen passt – und sie passt sich beim Üben weiter an.";
      zeige(
        kopf("Geschafft", "Einstufung"),
        h("main.inhalt.schmal.aw-einstufung", {},
          h("p.anleitung.aw-links", { text }),
          h("ul.aw-ergebnis", {}, Object.entries(bereichStufen).map(([name, s]) =>
            h(`li.${akzent(name)}`, {},
              h("span.aw-stufe", {}, h("small", { text: "Stufe" }), String(s)),
              h("span", {}, h("strong", { text: name }), h("small", { text: name === "Kartenspiele" ? "Zum Entspannen etwas leichter angesetzt." : stufenSatz(s) }))))),
          h("p.leise-text", { text: "Die Stufen sind nur ein Startpunkt, keine Bewertung. An schweren Tagen wird nie herabgestuft." }),
          h("div.knopfreihe", {},
            h("button.knopf.gross.primaer", { text: "Zur Übersicht", onTap: () => { stopSpeaking(); onFertig?.(ergebnis); } })),
        ),
      );
      speak(text);
    }

    if (!tests.length) { ende(null); onAbbruch?.(); return; }
    einleitung();
  });
}
