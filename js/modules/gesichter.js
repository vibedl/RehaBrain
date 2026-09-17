// Gedächtnis: Gesichter & Namen – Personen kennenlernen, danach Namen, Gesichter und Zusatzinfos zuordnen
import { h, sleep, rand, pick, shuffle, feedback, debounced } from "../core/ui.js";
import { wartenAuf, weiterKnopf, frageAuswahl, zwischenaufgabe } from "./einkaufsliste.js";

// ---------- Merkmale ----------
export const MERKMALE = {
  geschlecht: ["w", "m"],
  kopf: ["rund", "oval", "schmal"],
  haut: [1, 2, 3, 4, 5],
  haarfarbe: ["schwarz", "braun", "blond", "rot", "grau", "weiss"],
  frisur: { w: ["lang", "dutt", "bob", "locken"], m: ["kurz", "scheitel", "halbglatze", "locken"] },
  brille: [false, true],
  bart: { w: ["keiner"], m: ["keiner", "voll", "schnurr"] },
  kleidung: ["copper", "sage", "blau", "muted"],
};
const SCHLUESSEL = ["geschlecht", "kopf", "haut", "haarfarbe", "frisur", "brille", "bart", "kleidung"];

export const NAMEN = {
  w: ["Anna", "Maria", "Helga", "Ursula", "Petra", "Sabine", "Monika", "Renate", "Gisela", "Elke", "Karin", "Inge", "Brigitte", "Erika"],
  m: ["Peter", "Klaus", "Hans", "Jürgen", "Wolfgang", "Dieter", "Uwe", "Bernd", "Horst", "Werner", "Günter", "Michael", "Frank", "Rolf"],
};
export const BERUFE = [
  { m: "Bäcker", w: "Bäckerin" }, { m: "Lehrer", w: "Lehrerin" }, { m: "Gärtner", w: "Gärtnerin" },
  { m: "Arzt", w: "Ärztin" }, { m: "Friseur", w: "Friseurin" }, { m: "Koch", w: "Köchin" },
  { m: "Postbote", w: "Postbotin" }, { m: "Schreiner", w: "Schreinerin" }, { m: "Apotheker", w: "Apothekerin" },
  { m: "Busfahrer", w: "Busfahrerin" },
];
export const ORTE = ["Hamburg", "München", "Köln", "Berlin", "Dresden", "Bremen", "Stuttgart", "Leipzig", "Kiel", "Nürnberg"];

/** Anzahl unterschiedlicher Merkmale zweier Gesichter */
export function abstand(a, b) {
  return SCHLUESSEL.reduce((n, k) => n + (a[k] !== b[k] ? 1 : 0), 0);
}

function zufallsGesicht(geschlecht = pick(MERKMALE.geschlecht)) {
  return {
    geschlecht,
    kopf: pick(MERKMALE.kopf),
    haut: pick(MERKMALE.haut),
    haarfarbe: pick(MERKMALE.haarfarbe),
    frisur: pick(MERKMALE.frisur[geschlecht]),
    brille: Math.random() < 0.35,
    bart: geschlecht === "m" && Math.random() < 0.45 ? pick(["voll", "schnurr"]) : "keiner",
    kleidung: pick(MERKMALE.kleidung),
  };
}

/** Variante eines Gesichts: `n` Merkmale verändert (Geschlecht bleibt) */
function variante(basis, n) {
  const g = { ...basis };
  const wahl = shuffle(["kopf", "haut", "haarfarbe", "frisur", "brille", "bart", "kleidung"]).slice(0, n);
  for (const k of wahl) {
    if (k === "brille") g.brille = !g.brille;
    else if (k === "bart") g.bart = g.geschlecht === "m" ? pick(MERKMALE.bart.m.filter((b) => b !== g.bart)) : "keiner";
    else if (k === "frisur") g.frisur = pick(MERKMALE.frisur[g.geschlecht].filter((f) => f !== g.frisur));
    else g[k] = pick(MERKMALE[k].filter((v) => v !== g[k]));
  }
  return g;
}

/** Schwierigkeit je Stufe 1–20 */
export function stufenParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    anzahl: Math.min(8, 2 + Math.floor((s - 1) / 3)),         // 2 … 8 Personen
    beruf: s >= 8,
    wohnort: s >= 15,
    mindestAbstand: s <= 6 ? 4 : s <= 13 ? 3 : 2,              // wie verschieden die Gesichter sind
    aehnlich: s >= 14,                                          // Gesichter aus einer gemeinsamen Grundform
    gleicheKleidung: s >= 17,
    beideRichtungen: s >= 5,                                    // auch „Welche Person heißt …?“
    pauseSek: s >= 12 ? 15 : 0,
  };
}

/** Personen für eine Runde: Gesichter, eindeutige Namen, ggf. Beruf und Wohnort */
export function erzeugePersonen(stufe) {
  const p = stufenParameter(stufe);
  const personen = [];
  const basis = zufallsGesicht();
  let versuche = 0;
  while (personen.length < p.anzahl) {
    versuche++;
    const locker = versuche > 400; // Notbremse: Abstand nur noch ≥ 1
    let g = p.aehnlich
      ? variante({ ...basis, geschlecht: pick(MERKMALE.geschlecht), frisur: null, bart: "keiner" }, 3 + rand(2))
      : zufallsGesicht();
    if (p.aehnlich) {
      if (!MERKMALE.frisur[g.geschlecht].includes(g.frisur)) g.frisur = pick(MERKMALE.frisur[g.geschlecht]);
      if (g.geschlecht === "w") g.bart = "keiner";
    }
    if (p.gleicheKleidung) g.kleidung = basis.kleidung;
    const min = locker ? 1 : p.mindestAbstand;
    const maxAehnlich = p.aehnlich && !locker ? 5 : 99;
    if (personen.some((q) => abstand(q, g) < min || abstand(q, g) > maxAehnlich)) continue;
    personen.push(g);
  }
  const namenW = shuffle(NAMEN.w), namenM = shuffle(NAMEN.m);
  const berufe = shuffle(BERUFE.map((_, i) => i)), orte = shuffle(ORTE);
  return personen.map((g, i) => ({
    gesicht: g,
    name: g.geschlecht === "w" ? namenW.pop() : namenM.pop(),
    beruf: p.beruf ? BERUFE[berufe[i]][g.geschlecht] : null,
    berufIndex: berufe[i],
    wohnort: p.wohnort ? orte[i] : null,
  }));
}

/** Satz zur Vorstellung, z. B. „Das ist Anna. Sie ist Bäckerin und wohnt in Kiel.“ */
export function vorstellung(person) {
  const er = person.gesicht.geschlecht === "w" ? "Sie" : "Er";
  let satz = `Das ist ${person.name}.`;
  if (person.beruf && person.wohnort) satz += ` ${er} ist ${person.beruf} und wohnt in ${person.wohnort}.`;
  else if (person.beruf) satz += ` ${er} ist ${person.beruf}.`;
  else if (person.wohnort) satz += ` ${er} wohnt in ${person.wohnort}.`;
  return satz;
}

/**
 * Fragen für eine Runde. Typen: "name" (Gesicht → Name), "gesicht" (Name → Gesicht), "beruf", "wohnort".
 * Jede Frage: { typ, person, optionen: [wert…], loesung }
 */
export function erzeugeFragen(personen, stufe) {
  const p = stufenParameter(stufe);
  const fragen = [];
  for (const person of personen) {
    const richtung = p.beideRichtungen && Math.random() < 0.5 ? "gesicht" : "name";
    if (richtung === "name") {
      // nur Namen desselben Geschlechts: erst gelernte, dann unbekannte
      const g = person.gesicht.geschlecht;
      const gelernt = personen.map((q) => q.name);
      const pool = shuffle(personen.filter((q) => q !== person && q.gesicht.geschlecht === g).map((q) => q.name));
      for (const n of shuffle(NAMEN[g])) if (pool.length < 3 && !gelernt.includes(n)) pool.push(n);
      fragen.push({ typ: "name", person, optionen: shuffle([person.name, ...pool.slice(0, 3)]), loesung: person.name });
    } else {
      // Gesichter desselben Geschlechts zuerst, damit das Geschlecht die Antwort nicht verrät
      const g = person.gesicht.geschlecht;
      const gleich = shuffle(personen.filter((q) => q !== person && q.gesicht.geschlecht === g));
      const anders = shuffle(personen.filter((q) => q !== person && q.gesicht.geschlecht !== g));
      const andere = [...gleich, ...anders].slice(0, 3);
      fragen.push({ typ: "gesicht", person, optionen: shuffle([person, ...andere]), loesung: person });
    }
  }
  const mitInfo = shuffle(personen).slice(0, Math.min(personen.length, 4));
  if (p.beruf) {
    for (const person of mitInfo) {
      const g = person.gesicht.geschlecht;
      const pool = shuffle(personen.map((q) => BERUFE[q.berufIndex][g]));
      const extra = BERUFE.map((b) => b[g]);
      const kandidaten = [...new Set([...pool.filter((b) => b !== person.beruf), ...shuffle(extra)])];
      fragen.push({ typ: "beruf", person, optionen: shuffle([person.beruf, ...kandidaten.filter((b) => b !== person.beruf).slice(0, 3)]), loesung: person.beruf });
    }
  }
  if (p.wohnort) {
    const pool = shuffle(personen.map((q) => q.wohnort));
    for (const person of shuffle(mitInfo).slice(0, 3)) {
      const kandidaten = [...new Set([...pool, ...shuffle(ORTE)])].filter((o) => o !== person.wohnort);
      fragen.push({ typ: "wohnort", person, optionen: shuffle([person.wohnort, ...kandidaten.slice(0, 3)]), loesung: person.wohnort });
    }
  }
  return shuffle(fragen);
}

// ---------- Porträt als SVG ----------
const HAAR = (farbe) => `var(--gd-haar-${farbe})`;

/** Porträt als SVG-Text (viewBox 0 0 120 140) */
export function portraitSvg(g) {
  const rx = { rund: 31, oval: 28, schmal: 25 }[g.kopf];
  const ry = { rund: 34, oval: 37, schmal: 38 }[g.kopf];
  const cx = 60, cy = 64;
  const L = cx - rx, R = cx + rx, top = cy - ry;
  const haut = `var(--gd-haut-${g.haut})`;
  const haar = HAAR(g.haarfarbe);
  const kleid = `var(--${g.kleidung === "muted" ? "muted" : g.kleidung})`;
  const hinten = [], vorne = [];

  switch (g.frisur) {
    case "lang":
      hinten.push(`<path d="M${L - 5} ${cy} Q${L - 6} ${top - 6} ${cx} ${top - 6} Q${R + 6} ${top - 6} ${R + 5} ${cy} L${R + 8} ${cy + 46} Q${cx} ${cy + 54} ${L - 8} ${cy + 46}Z" fill="${haar}"/>`);
      vorne.push(`<path d="M${L - 1} ${cy - 6} Q${L} ${top - 4} ${cx} ${top - 4} Q${R} ${top - 4} ${R + 1} ${cy - 6} Q${R - 6} ${top + 16} ${cx + 4} ${top + 14} Q${L + 8} ${top + 16} ${L - 1} ${cy - 6}Z" fill="${haar}"/>`);
      break;
    case "bob":
      vorne.push(`<path d="M${L - 5} ${cy + 16} Q${L - 8} ${top - 6} ${cx} ${top - 6} Q${R + 8} ${top - 6} ${R + 5} ${cy + 16} L${R - 3} ${cy + 16} Q${R - 2} ${top + 18} ${cx} ${top + 16} Q${L + 2} ${top + 18} ${L + 3} ${cy + 16}Z" fill="${haar}"/>`);
      break;
    case "dutt":
      hinten.push(`<circle cx="${cx}" cy="${top - 6}" r="13" fill="${haar}"/>`);
      vorne.push(`<path d="M${L} ${cy - 4} Q${L - 2} ${top - 3} ${cx} ${top - 3} Q${R + 2} ${top - 3} ${R} ${cy - 4} Q${R - 5} ${top + 12} ${cx} ${top + 11} Q${L + 5} ${top + 12} ${L} ${cy - 4}Z" fill="${haar}"/>`);
      break;
    case "locken": {
      const kreise = [];
      for (let i = 0; i <= 8; i++) {
        const w = Math.PI * (1.02 + (i / 8) * 0.96);
        kreise.push(`<circle cx="${(cx + Math.cos(w) * (rx + 2)).toFixed(1)}" cy="${(cy - 6 + Math.sin(w) * (ry + 2)).toFixed(1)}" r="9"/>`);
      }
      vorne.push(`<g fill="${haar}">${kreise.join("")}</g>`);
      break;
    }
    case "scheitel":
      vorne.push(`<path d="M${L - 1} ${cy - 2} Q${L - 4} ${top - 5} ${cx + 4} ${top - 5} Q${R + 4} ${top - 4} ${R + 1} ${cy - 4} Q${R - 4} ${top + 10} ${cx - 8} ${top + 14} Q${L + 4} ${top + 18} ${L - 1} ${cy - 2}Z" fill="${haar}"/>`);
      break;
    case "halbglatze":
      vorne.push(`<path d="M${L - 1} ${cy + 4} Q${L - 3} ${cy - 16} ${L + 6} ${top + 14} L${L + 7} ${cy - 2}Z" fill="${haar}"/>`);
      vorne.push(`<path d="M${R + 1} ${cy + 4} Q${R + 3} ${cy - 16} ${R - 6} ${top + 14} L${R - 7} ${cy - 2}Z" fill="${haar}"/>`);
      break;
    default: // kurz
      vorne.push(`<path d="M${L} ${cy - 2} Q${L - 3} ${top - 5} ${cx} ${top - 5} Q${R + 3} ${top - 5} ${R} ${cy - 2} Q${R - 3} ${top + 10} ${cx} ${top + 9} Q${L + 3} ${top + 10} ${L} ${cy - 2}Z" fill="${haar}"/>`);
  }

  const augenY = cy - 2;
  const teile = [
    `<rect width="120" height="140" fill="var(--canvas-alt)"/>`,
    ...hinten,
    // Schultern und Hals
    `<path d="M10 140 Q14 ${cy + 44} ${cx} ${cy + 40} Q106 ${cy + 44} 110 140Z" fill="${kleid}"/>`,
    `<path d="M${cx - 10} ${cy + 26} V${cy + 42} Q${cx} ${cy + 50} ${cx + 10} ${cy + 42} V${cy + 26}Z" fill="${haut}"/>`,
    // Ohren und Kopf
    `<ellipse cx="${L}" cy="${cy + 2}" rx="5" ry="8" fill="${haut}"/>`,
    `<ellipse cx="${R}" cy="${cy + 2}" rx="5" ry="8" fill="${haut}"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${haut}"/>`,
  ];
  if (g.bart === "voll") {
    teile.push(`<path d="M${L + 2} ${cy + 2} Q${L + 4} ${cy + ry + 8} ${cx} ${cy + ry + 8} Q${R - 4} ${cy + ry + 8} ${R - 2} ${cy + 2} Q${R - 6} ${cy + 20} ${cx} ${cy + 16} Q${L + 6} ${cy + 20} ${L + 2} ${cy + 2}Z" fill="${haar}"/>`);
  }
  teile.push(
    // Augenbrauen, Augen, Nase, Mund
    `<path d="M${cx - 17} ${augenY - 9} Q${cx - 11} ${augenY - 12} ${cx - 5} ${augenY - 9} M${cx + 5} ${augenY - 9} Q${cx + 11} ${augenY - 12} ${cx + 17} ${augenY - 9}" stroke="${haar}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    `<circle cx="${cx - 11}" cy="${augenY}" r="3" fill="var(--gd-augen)"/><circle cx="${cx + 11}" cy="${augenY}" r="3" fill="var(--gd-augen)"/>`,
    `<path d="M${cx} ${augenY + 5} Q${cx - 5} ${augenY + 14} ${cx + 1} ${augenY + 15}" stroke="var(--gd-kontur)" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  );
  if (g.bart === "schnurr" || g.bart === "voll") {
    teile.push(`<path d="M${cx - 12} ${cy + 22} Q${cx} ${cy + 14} ${cx + 12} ${cy + 22} Q${cx} ${cy + 19} ${cx - 12} ${cy + 22}Z" fill="${haar}" stroke="${haar}" stroke-width="3" stroke-linejoin="round"/>`);
  }
  teile.push(`<path d="M${cx - 9} ${cy + 24} Q${cx} ${cy + 31} ${cx + 9} ${cy + 24}" stroke="var(--gd-mund)" stroke-width="2.5" stroke-linecap="round" fill="none"/>`);
  teile.push(...vorne);
  if (g.brille) {
    teile.push(`<g stroke="var(--gd-kontur)" stroke-width="2.2" fill="none"><circle cx="${cx - 11}" cy="${augenY}" r="8"/><circle cx="${cx + 11}" cy="${augenY}" r="8"/><path d="M${cx - 3} ${augenY} H${cx + 3} M${cx - 19} ${augenY - 1} L${L + 1} ${augenY - 3} M${cx + 19} ${augenY - 1} L${R - 1} ${augenY - 3}"/></g>`);
  }
  return `<svg viewBox="0 0 120 140" aria-hidden="true">${teile.join("")}</svg>`;
}

const portrait = (person, klasse = "") =>
  h("span.gd-gesicht-bild" + (klasse ? "." + klasse : ""), { html: portraitSvg(person.gesicht) });

// ---------- Modul ----------
export default {
  id: "gesichter",
  bereich: "Gedächtnis",
  titel: "Gesichter & Namen",
  icon: "",
  anleitung: (stufe) => {
    const p = stufenParameter(stufe);
    const info = p.wohnort ? ", ihren Beruf und ihren Wohnort" : p.beruf ? " und ihren Beruf" : "";
    return `Sie lernen ${p.anzahl} Personen kennen. Merken Sie sich ihre Gesichter, ihre Namen${info}. Danach beantworten Sie Fragen zu den Personen.`;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = stufenParameter(stufe);
    const personen = erzeugePersonen(stufe);
    const hinweis = h("p.hinweis");
    const flaeche = h("div.gd-gesicht-flaeche");
    stage.append(hinweis, flaeche);

    // Phase 1: Personen einzeln kennenlernen
    for (let i = 0; i < personen.length; i++) {
      if (!ctx.alive()) return null;
      const person = personen[i];
      hinweis.textContent = `Person ${i + 1} von ${personen.length}`;
      const zusatz = [person.beruf, person.wohnort && `wohnt in ${person.wohnort}`].filter(Boolean).join(" · ");
      flaeche.replaceChildren(h("div.gd-gesicht-steckbrief", {},
        portrait(person, "gd-gesicht-gross"),
        h("p.gd-gesicht-name", { text: person.name }),
        zusatz ? h("p.gd-gesicht-info", { text: zusatz }) : null));
      ctx.speak(vorstellung(person));
      await sleep(600);
      if ((await weiterKnopf(ctx, flaeche, i < personen.length - 1 ? "Nächste Person" : "Weiter")) == null) return null;
    }

    // Überblick über alle
    hinweis.textContent = "Noch einmal alle zusammen";
    flaeche.replaceChildren(h("div.gd-gesicht-galerie", {}, personen.map((q) =>
      h("div.gd-gesicht-kachel", {}, portrait(q), h("span.gd-gesicht-name", { text: q.name }),
        q.beruf ? h("span.gd-gesicht-info", { text: q.beruf }) : null,
        q.wohnort ? h("span.gd-gesicht-info", { text: q.wohnort }) : null))));
    if ((await weiterKnopf(ctx, flaeche, "Ich bin bereit")) == null) return null;
    flaeche.replaceChildren();

    if (p.pauseSek) {
      hinweis.textContent = "Kurz etwas anderes";
      if ((await zwischenaufgabe(ctx, flaeche, p.pauseSek)) == null) return null;
    }

    // Phase 2: Fragen
    const fragen = erzeugeFragen(personen, stufe);
    let richtig = 0;
    const rueckmeldung = (ok, sonst) => (ok ? feedback(stage, "Richtig!", "gut") : feedback(stage, sonst, "neutral"));
    for (let i = 0; i < fragen.length; i++) {
      if (!ctx.alive()) return null;
      const f = fragen[i];
      hinweis.textContent = `Frage ${i + 1} von ${fragen.length}`;
      let antwort;
      if (f.typ === "gesicht") {
        antwort = await frageAuswahl(ctx, flaeche, {
          frage: `Welche Person heißt ${f.person.name}?`,
          klasse: "gd-gesicht-wahl",
          loesung: f.person.name,
          optionen: f.optionen.map((q, k) => ({ inhalt: portrait(q), wert: q.name, label: `Gesicht ${k + 1}` })),
          nachWahl: (w) => rueckmeldung(w === f.person.name, "Die richtige Person ist eingerahmt"),
        });
        if (antwort == null) return null;
        antwort = antwort === f.person.name;
      } else {
        const frage = f.typ === "name" ? "Wie heißt diese Person?"
          : f.typ === "beruf" ? `Was ist ${f.person.name} von Beruf?`
          : `Wo wohnt ${f.person.name}?`;
        const w = await frageAuswahl(ctx, flaeche, {
          frage,
          bild: portrait(f.person, "gd-gesicht-mittel"),
          loesung: f.loesung,
          optionen: f.optionen.map((o) => ({ inhalt: o, wert: o })),
          nachWahl: (w) => rueckmeldung(w === f.loesung, `Richtig wäre: ${f.loesung}`),
        });
        if (w == null) return null;
        antwort = w === f.loesung;
      }
      if (antwort) richtig++;
      await sleep(300);
    }
    if (!ctx.alive()) return null;
    return {
      score: richtig / fragen.length,
      text: `${richtig} von ${fragen.length} Fragen zu ${personen.length} Personen richtig beantwortet.`,
    };
  },
};
