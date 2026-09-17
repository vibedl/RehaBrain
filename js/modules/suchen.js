// Sehen & Raum: Szenen erkunden – alltagsnahe Bilder systematisch absuchen („Finden Sie alle Tassen“).
// Auswertung nach Bildschirmregionen (links/rechts/oben/unten) und Suchzeit.
import { h, sleep, feedback, onTap } from "../core/ui.js";

// ---------- Objekte (Strich-SVG, Ursprung = Mitte unten, etwa 70 × 70 Einheiten) ----------
export const OBJEKTE = {
  tasse: '<path d="M-24 -44h36v26q0 18-18 18t-18-18z"/><path d="M12 -38h5a9 9 0 0 1 0 18h-6" class="sv-o-offen"/>',
  becher: '<path d="M-16 -58h32l-3 58h-26z"/><path d="M-15 -48h30" class="sv-o-offen"/>',
  glas: '<path d="M-18 -52h36l-6 52h-24z" class="sv-o-glas"/><path d="M-15 -30h30" class="sv-o-offen"/>',
  teller: '<ellipse cx="0" cy="-8" rx="34" ry="8"/><ellipse cx="0" cy="-9" rx="18" ry="4" class="sv-o-offen"/>',
  topf: '<path d="M-26 -36h52v28q0 8-8 8h-36q-8 0-8-8z"/><path d="M-34 -30h8M26 -30h8M-28 -42h56" class="sv-o-offen"/>',
  apfel: '<path d="M0 -44c-10-8-30-6-30 14 0 18 14 30 22 30 4 0 6-2 8-2s4 2 8 2c8 0 22-12 22-30 0-20-20-22-30-14z"/><path d="M0 -44q2-10 8-14" class="sv-o-offen"/><path d="M5 -52q10-8 17 0q-8 6-17 0z"/>',
  orange: '<circle cx="0" cy="-27" r="26"/><circle cx="0" cy="-47" r="2.5" class="sv-o-voll"/><path d="M-12 -20h.01M8 -14h.01M10 -32h.01" class="sv-o-offen"/>',
  flasche: '<path d="M-6 -74h12v16l8 12v46h-28v-46l8-12z"/><path d="M-14 -30h28" class="sv-o-offen"/>',
  dose: '<rect x="-17" y="-48" width="34" height="48" rx="3"/><path d="M-17 -38h34M-17 -10h34" class="sv-o-offen"/>',
  brot: '<path d="M-32 0v-18q0-16 32-16t32 16v18z"/><path d="M-14 -30l-4 10M0 -32l-2 10M14 -30l0 10" class="sv-o-offen"/>',
  buch: '<rect x="-15" y="-62" width="30" height="62" rx="2"/><path d="M-9 -50h18M-9 -42h12" class="sv-o-offen"/>',
  stift: '<path d="M-34 -10h54l14 5-14 5h-54z"/><path d="M20 -10v10" class="sv-o-offen"/>',
  brille: '<circle cx="-17" cy="-16" r="13"/><circle cx="17" cy="-16" r="13"/><path d="M-4 -18q4-5 8 0M-30 -20l-5-7M30 -20l5-7" class="sv-o-offen"/>',
  schluessel: '<circle cx="-22" cy="-12" r="11"/><path d="M-11 -12h40M20 -12v9M29 -12v6" class="sv-o-offen"/><circle cx="-22" cy="-12" r="3.5" class="sv-o-offen"/>',
  katze: '<path d="M-22 0c-4-20 4-32 18-32s22 12 18 32z"/><circle cx="-2" cy="-42" r="13"/><path d="M-13 -49l1-14 8 7M9 -49l-1-14-8 7" class="sv-o-voll"/><path d="M14 -4q20 0 14-26" class="sv-o-offen"/>',
  hund: '<path d="M-22 0c-4-20 4-32 18-32s22 12 18 32z"/><circle cx="-2" cy="-42" r="13"/><path d="M-12 -50q-10 2-8 17M8 -50q10 2 8 17" class="sv-o-voll"/><path d="M14 -10q14-2 14-20" class="sv-o-offen"/><circle cx="-2" cy="-37" r="3" class="sv-o-voll"/>',
  ente: '<ellipse cx="-4" cy="-14" rx="28" ry="14"/><circle cx="12" cy="-38" r="11"/><path d="M22 -41l12 4-12 4z" class="sv-o-voll"/><path d="M-20 -18q10 8 22 0" class="sv-o-offen"/>',
  seife: '<rect x="-24" y="-20" width="48" height="20" rx="9"/><path d="M-12 -30h.01M0 -36h.01M10 -29h.01" class="sv-o-offen"/>',
  blumentopf: '<path d="M-16 -26h32l-5 26h-22z"/><path d="M0 -26v-24M0 -38q-10-2-12-10" class="sv-o-offen"/><circle cx="0" cy="-58" r="9"/>',
  ball: '<circle cx="0" cy="-25" r="25"/><path d="M-25 -25h50M0 -50q15 25 0 50" class="sv-o-offen"/>',
};

const NAMEN = {
  tasse: ["Tasse", "Tassen"], apfel: ["Apfel", "Äpfel"], brille: ["Brille", "Brillen"], katze: ["Katze", "Katzen"],
  schluessel: ["Schlüssel", "Schlüssel"], ente: ["Badeente", "Badeenten"],
};

// ---------- Szenen (viewBox 0 0 1000 600) ----------
const R = (x, y, b, hh, cls, extra = "") => `<rect x="${x}" y="${y}" width="${b}" height="${hh}" class="${cls}" ${extra}/>`;
const brett = (x1, x2, y) => R(x1, y, x2 - x1, 12, "sv-bg-holz", 'rx="3"');

export const SZENEN = [
  {
    id: "kueche", name: "Küche", ziel: "tasse", aehnlich: ["becher", "glas"], ablenker: ["teller", "topf", "flasche", "apfel", "dose"],
    flaechen: [[60, 440, 150], [560, 940, 150], [40, 960, 330], [150, 850, 540]],
    bg: R(0, 0, 1000, 600, "sv-bg-wand") + R(0, 500, 1000, 100, "sv-bg-boden")
      + R(455, 30, 90, 160, "sv-bg-himmel", 'rx="4"') + '<path d="M500 30v160M455 110h90" class="sv-bg-strich"/>'
      + brett(50, 450, 150) + brett(550, 950, 150)
      + R(30, 330, 940, 16, "sv-bg-holz", 'rx="3"') + R(40, 346, 920, 150, "sv-bg-moebel")
      + '<path d="M270 346v150M500 346v150M730 346v150M250 420h-20M290 420h20M480 420h-20M520 420h20M710 420h-20M750 420h20" class="sv-bg-strich"/>'
      + R(140, 540, 720, 14, "sv-bg-holz", 'rx="4"') + '<path d="M170 554v46M830 554v46" class="sv-bg-dick"/>',
  },
  {
    id: "schreibtisch", name: "Schreibtisch", ziel: "brille", aehnlich: ["schluessel"], ablenker: ["buch", "tasse", "stift", "blumentopf", "apfel"],
    flaechen: [[50, 410, 140], [50, 410, 270], [580, 960, 260], [40, 420, 420], [630, 960, 420], [60, 940, 585]],
    bg: R(0, 0, 1000, 600, "sv-bg-wand") + R(0, 520, 1000, 80, "sv-bg-boden")
      + R(30, 20, 400, 270, "sv-bg-moebel") + brett(40, 420, 140) + brett(40, 420, 270)
      + R(600, 40, 340, 210, "sv-bg-himmel", 'rx="4"') + '<path d="M770 40v210" class="sv-bg-strich"/>' + brett(580, 960, 260)
      + R(30, 420, 940, 16, "sv-bg-holz", 'rx="3"') + '<path d="M60 436v84M940 436v84" class="sv-bg-dick"/>'
      + R(440, 300, 170, 110, "sv-bg-moebel", 'rx="6"') + R(456, 314, 138, 82, "sv-bg-himmel") + '<path d="M525 410v10M490 420h70" class="sv-bg-dick"/>',
  },
  {
    id: "strasse", name: "Straße", ziel: "katze", aehnlich: ["hund"], ablenker: ["blumentopf", "ball", "flasche"],
    flaechen: [[70, 450, 170], [550, 930, 170], [70, 450, 290], [550, 930, 290], [20, 980, 470], [60, 940, 590]],
    bg: R(0, 0, 1000, 600, "sv-bg-himmel") + R(40, 40, 440, 430, "sv-bg-wand") + R(520, 70, 440, 400, "sv-bg-moebel")
      + '<path d="M30 40l230-30 230 30M510 70l230-40 230 40" class="sv-bg-dick"/>'
      + [100, 300].flatMap((x) => [R(x, 100, 110, 70, "sv-bg-himmel"), R(x, 220, 110, 70, "sv-bg-himmel")]).join("")
      + [580, 780].flatMap((x) => [R(x, 100, 110, 70, "sv-bg-himmel"), R(x, 220, 110, 70, "sv-bg-himmel")]).join("")
      + brett(60, 460, 170) + brett(540, 940, 170) + brett(60, 460, 290) + brett(540, 940, 290)
      + R(215, 360, 90, 110, "sv-bg-holz") + R(690, 360, 90, 110, "sv-bg-holz")
      + R(0, 470, 1000, 40, "sv-bg-boden") + R(0, 510, 1000, 90, "sv-bg-strasse")
      + '<path d="M40 555h90M220 555h90M400 555h90M580 555h90M760 555h90" class="sv-bg-markierung"/>',
  },
  {
    id: "wohnzimmer", name: "Wohnzimmer", ziel: "schluessel", aehnlich: ["stift", "brille"], ablenker: ["buch", "tasse", "blumentopf", "ball", "apfel"],
    flaechen: [[570, 950, 160], [50, 390, 290], [330, 670, 455], [60, 270, 520], [720, 960, 590], [40, 300, 590]],
    bg: R(0, 0, 1000, 600, "sv-bg-wand") + R(0, 520, 1000, 80, "sv-bg-boden")
      + R(90, 40, 220, 150, "sv-bg-moebel", 'rx="4"') + '<path d="M110 170l60-70 50 50 30-30 40 50" class="sv-bg-strich"/>'
      + brett(560, 960, 160) + R(40, 290, 360, 100, "sv-bg-holz", 'rx="4"') + '<path d="M220 300v80" class="sv-bg-strich"/>'
      + R(300, 400, 400, 55, "sv-bg-moebel", 'rx="20"') + R(320, 455, 360, 70, "sv-bg-moebel", 'rx="10"') + R(280, 430, 40, 110, "sv-bg-moebel", 'rx="14"') + R(680, 430, 40, 110, "sv-bg-moebel", 'rx="14"')
      + R(50, 520, 230, 12, "sv-bg-holz", 'rx="3"') + '<path d="M70 532v68M260 532v68" class="sv-bg-dick"/>',
  },
  {
    id: "bad", name: "Badezimmer", ziel: "ente", aehnlich: ["seife", "ball"], ablenker: ["flasche", "becher", "blumentopf"],
    flaechen: [[50, 350, 150], [650, 950, 150], [320, 680, 330], [640, 960, 430], [40, 300, 590], [330, 600, 590]],
    bg: R(0, 0, 1000, 600, "sv-bg-wand") + R(0, 530, 1000, 70, "sv-bg-boden")
      + '<path d="M0 100h1000M0 200h1000M0 300h1000M0 400h1000M0 500h1000M125 0v530M250 0v530M375 0v530M500 0v530M625 0v530M750 0v530M875 0v530" class="sv-bg-fliese"/>'
      + R(400, 40, 200, 200, "sv-bg-himmel", 'rx="100"') + brett(40, 360, 150) + brett(640, 960, 150)
      + R(300, 330, 400, 18, "sv-bg-moebel", 'rx="6"') + '<path d="M420 348q80 60 160 0" class="sv-bg-dick"/><path d="M500 395v135" class="sv-bg-dick"/>'
      + R(630, 430, 350, 100, "sv-bg-moebel", 'rx="30"'),
  },
  {
    id: "supermarkt", name: "Supermarkt-Regal", ziel: "apfel", aehnlich: ["orange"], ablenker: ["dose", "flasche", "brot", "becher"],
    flaechen: [[40, 960, 140], [40, 960, 280], [40, 960, 420], [40, 960, 560]],
    bg: R(0, 0, 1000, 600, "sv-bg-wand") + R(20, 10, 960, 590, "sv-bg-moebel")
      + brett(30, 970, 140) + brett(30, 970, 280) + brett(30, 970, 420) + brett(30, 970, 560)
      + '<path d="M500 10v590" class="sv-bg-strich"/>',
  },
];

// ---------- Reine Logik (testbar) ----------

const klemme = (x, a, b) => Math.max(a, Math.min(b, x));

export function sucheParameter(stufe) {
  const s = klemme(Math.round(stufe), 1, 20);
  return {
    szenen: 3,
    ziele: 3 + Math.floor((s - 1) / 4),                         // 3 … 7
    ablenker: Math.round(5 + s * 1.2),                          // 6 … 29 (begrenzt durch freie Plätze)
    aehnlich: s <= 5 ? 0 : s <= 12 ? 0.3 : 0.6,                 // Anteil ähnlicher Ablenker
    skala: Math.round((1 - (s - 1) * 0.015) * 100) / 100,       // Objektgröße 1 … 0,72
    strategie: s <= 6 ? "auto" : s <= 12 ? "knopf" : "aus",     // Suchlinien-Hilfe
  };
}

/** Region eines Punktes (Grundlinie) in der 1000 × 600-Szene */
export const regionVon = (x, y) => ({ lr: x < 500 ? "links" : "rechts", ou: y <= 300 ? "oben" : "unten" });

/** Alle Stellplätze einer Szene (Abstand 80 Einheiten) */
export function stellplaetze(szene, abstand = 80) {
  const p = [];
  for (const [x1, x2, y] of szene.flaechen) {
    const n = Math.max(1, Math.floor((x2 - x1) / abstand));
    const rand = (x2 - x1 - n * abstand) / 2;
    for (let i = 0; i < n; i++) {
      const x = x1 + rand + abstand / 2 + i * abstand;
      p.push({ x, y, ...regionVon(x, y) });
    }
  }
  return p;
}

/**
 * Objekte einer Szene erzeugen: Ziele gleichmäßig auf die vier Bildviertel verteilt, dann Ablenker.
 * Rückgabe [{ typ, ziel, x, y, lr, ou, farbe }]
 */
export function erzeugeSzene(szene, stufe, rng = Math.random) {
  const p = sucheParameter(stufe);
  const plaetze = stellplaetze(szene);
  const mische = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const viertel = mische(["links-oben", "rechts-oben", "links-unten", "rechts-unten"]);
  const frei = new Map(viertel.map((v) => [v, mische(plaetze.filter((pl) => `${pl.lr}-${pl.ou}` === v))]));
  const objekte = [];
  let k = 0, versuche = 0;
  while (objekte.length < p.ziele && versuche < 40) {
    const liste = frei.get(viertel[k++ % 4]);
    versuche++;
    if (liste.length) objekte.push({ ...liste.pop(), typ: szene.ziel, ziel: true });
  }
  const rest = mische([...frei.values()].flat());
  const anzahl = Math.min(p.ablenker, rest.length);
  for (let i = 0; i < anzahl; i++) {
    const pool = szene.aehnlich.length && rng() < p.aehnlich ? szene.aehnlich : szene.ablenker;
    objekte.push({ ...rest[i], typ: pool[Math.floor(rng() * pool.length)], ziel: false });
  }
  return objekte.map((o) => ({ ...o, x: o.x + Math.round((rng() * 2 - 1) * 8), farbe: Math.floor(rng() * 5) }));
}

const leereBilanz = () => ({ links: { g: 0, n: 0 }, rechts: { g: 0, n: 0 }, oben: { g: 0, n: 0 }, unten: { g: 0, n: 0 } });

/** Bilanz nach Regionen: gefunden = Set der Objekt-Indizes */
export function regionenBilanz(objekte, gefunden, bilanz = leereBilanz()) {
  objekte.forEach((o, i) => {
    if (!o.ziel) return;
    for (const r of [o.lr, o.ou]) { bilanz[r].n++; if (gefunden.has(i)) bilanz[r].g++; }
  });
  return bilanz;
}

const q = (x) => (x.n ? x.g / x.n : 1);

/** Freundlicher Hinweis bei einseitigen Auslassungen (sonst "") */
export function auslassungsHinweis(b) {
  const teile = [];
  const vergleiche = (a, c, wortA, wortC, grenze) => {
    const qa = q(b[a]), qc = q(b[c]);
    const schwach = qa < qc ? a : c;
    const fehlt = b[schwach].n - b[schwach].g;
    if (Math.abs(qa - qc) >= grenze && fehlt >= 2) teile.push(schwach === a ? wortA : wortC);
  };
  vergleiche("links", "rechts", "links", "rechts", 0.25);
  vergleiche("oben", "unten", "oben", "unten", 0.3);
  if (!teile.length) return "";
  return `${teile.map((t) => t[0].toUpperCase() + t.slice(1)).join(" und ")} wurde öfter etwas übersehen – schauen Sie dort beim nächsten Mal bewusst noch einmal hin.`;
}

/** Ergebnis im Profil ablegen (letzte 10) */
export function speichereSuche(bests, bilanz, sekunden, datum = new Date().toISOString().slice(0, 10)) {
  const liste = Array.isArray(bests.suchen) ? bests.suchen : [];
  const r = (x) => Math.round(q(x) * 100) / 100;
  liste.push({ datum, links: r(bilanz.links), rechts: r(bilanz.rechts), oben: r(bilanz.oben), unten: r(bilanz.unten), sekunden: Math.round(sekunden) });
  bests.suchen = liste.slice(-10);
  return bests.suchen;
}

/** Nächstes Objekt zum Tipp-Punkt innerhalb der Toleranz (Szenen-Einheiten); Mittelpunkt ≈ 30 Einheiten über Grundlinie */
export function trefferBei(objekte, x, y, toleranz, skala = 1) {
  let best = -1, bestD = Infinity;
  objekte.forEach((o, i) => {
    const d = Math.hypot(o.x - x, o.y - 30 * skala - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return bestD <= toleranz ? best : -1;
}

// ---------- Darstellung ----------

const objektSVG = (o, i, skala) =>
  `<g class="sv-such-obj sv-f${o.farbe}" data-i="${i}" tabindex="0" role="button" aria-label="Gegenstand" transform="translate(${o.x} ${o.y}) scale(${skala})">`
  + `<circle cx="0" cy="-30" r="40" class="sv-such-treffflaeche"/>${OBJEKTE[o.typ]}</g>`;

function szeneSVG(szene, objekte, skala) {
  return `<svg viewBox="0 0 1000 600" class="sv-such-bild" role="img" aria-label="Bild: ${szene.name}">`
    + `<g class="sv-such-hg" aria-hidden="true">${szene.bg}</g>`
    + objekte.map((o, i) => objektSVG(o, i, skala)).join("")
    + `<g class="sv-such-markierungen"></g><g class="sv-such-linien" aria-hidden="true"></g></svg>`;
}

/** Suchlinien (Zeilen von links nach rechts) kurz einblenden */
async function zeigeSuchlinien(svg, ctx) {
  const g = svg.querySelector(".sv-such-linien");
  const ys = [110, 300, 480];
  g.innerHTML = ys.map((y, i) => `<g class="sv-such-linie" style="animation-delay:${i * 1.1}s">`
    + `<path d="M40 ${y}H940" pathLength="100"/><path d="M915 ${y - 22}l28 22-28 22" pathLength="100"/></g>`).join("")
    + ys.slice(0, -1).map((y, i) => `<path d="M940 ${y + 28}Q500 ${(y + ys[i + 1]) / 2} 60 ${ys[i + 1] - 28}" class="sv-such-rueck" style="animation-delay:${i * 1.1 + 0.8}s" pathLength="100"/>`).join("");
  await sleep(4200);
  if (ctx.alive()) g.innerHTML = "";
}

export default {
  id: "suchen",
  bereich: "Sehen & Raum",
  titel: "Szenen erkunden",
  icon: "",
  anleitung: (stufe) => {
    const p = sucheParameter(stufe);
    let t = "Sie sehen ein Bild aus dem Alltag. Tippen Sie alle gesuchten Gegenstände an – ohne Zeitdruck. Wenn Sie keine mehr finden, tippen Sie auf „Fertig“.";
    t += p.strategie === "auto" ? " Zu Beginn zeigen Linien, wie man Zeile für Zeile von links nach rechts sucht." : " Tipp: Suchen Sie Zeile für Zeile, von links nach rechts.";
    return t;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = sucheParameter(stufe);
    const reihe = [...SZENEN].sort(() => Math.random() - 0.5).slice(0, p.szenen);
    let bilanz = leereBilanz();
    let gefundenGesamt = 0, zieleGesamt = 0, fehlTipps = 0, sekunden = 0;

    for (let n = 0; n < reihe.length && ctx.alive(); n++) {
      const szene = reihe[n];
      const [einzahl, mehrzahl] = NAMEN[szene.ziel];
      const objekte = erzeugeSzene(szene, stufe);
      const zahlZiele = objekte.filter((o) => o.ziel).length;

      // Aufgabe ansagen
      stage.replaceChildren();
      const los = h("button.knopf.gross.primaer", { text: "Los geht's" });
      stage.append(
        h("p.hinweis", { text: `Bild ${n + 1} von ${reihe.length}: ${szene.name}` }),
        h("div.sv-such-aufgabe", {},
          h("span.sv-such-vorlage", { html: `<svg viewBox="-45 -80 90 90" class="sv-f1" aria-hidden="true"><g class="sv-such-obj">${OBJEKTE[szene.ziel]}</g></svg>` }),
          h("p.hinweis.gross", { text: `Finden Sie alle ${mehrzahl}` })),
        h("div.knopfreihe", {}, los));
      ctx.speak?.(`Finden Sie alle ${mehrzahl}.`);
      const bereit = await new Promise((resolve) => {
        const warte = setInterval(() => { if (!ctx.alive()) { clearInterval(warte); resolve(null); } }, 300);
        onTap(los, () => { clearInterval(warte); resolve(true); });
      });
      if (!bereit || !ctx.alive()) return null;

      // Szene
      stage.replaceChildren();
      const gefunden = new Set();
      const zaehler = h("span.hinweis", { text: `Gesucht: ${mehrzahl} · gefunden 0` , "aria-live": "polite" });
      const bildRahmen = h("div.sv-such-rahmen", { html: szeneSVG(szene, objekte, p.skala) });
      const svg = bildRahmen.querySelector("svg");
      const marken = svg.querySelector(".sv-such-markierungen");
      const fertig = h("button.knopf.gross", { text: "Fertig" });
      const hilfe = p.strategie === "knopf" ? h("button.knopf", { text: "Suchweg zeigen" }) : null;
      stage.append(h("div.sv-such-kopf", {}, h("span.sv-such-vorlage.klein", { html: `<svg viewBox="-45 -80 90 90" class="sv-f1" aria-hidden="true"><g class="sv-such-obj">${OBJEKTE[szene.ziel]}</g></svg>` }), zaehler),
        bildRahmen, h("div.knopfreihe", {}, hilfe, fertig));

      const markiere = (i, cls) => {
        const o = objekte[i];
        marken.insertAdjacentHTML("beforeend",
          `<circle cx="${o.x}" cy="${o.y - 30 * p.skala}" r="${46 * p.skala + 4}" class="${cls}"/>`);
      };
      const start = performance.now();
      let letzterTipp = -Infinity;
      const tippe = (i) => {
        const jetzt = performance.now();
        if (jetzt - letzterTipp < 300) return; // Zittern
        letzterTipp = jetzt;
        if (i < 0 || gefunden.has(i)) return;
        const o = objekte[i];
        if (o.ziel) {
          gefunden.add(i);
          markiere(i, "sv-such-gefunden");
          zaehler.textContent = `Gesucht: ${mehrzahl} · gefunden ${gefunden.size}`;
        } else {
          fehlTipps++;
          const g = svg.querySelector(`[data-i="${i}"]`);
          g?.classList.add("sv-such-nein");
          setTimeout(() => g?.classList.remove("sv-such-nein"), 500);
          feedback(stage, `Das ist keine ${einzahl}`.replace("keine Schlüssel", "kein Schlüssel"), "neutral");
        }
      };
      svg.addEventListener("click", (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const m = svg.getScreenCTM();
        if (!m) return;
        const sp = pt.matrixTransform(m.inverse());
        const einheitenProPx = 1000 / (svg.clientWidth || 1000);
        const tol = Math.max(48 * p.skala, 36 * einheitenProPx);
        tippe(trefferBei(objekte, sp.x, sp.y, tol, p.skala));
      });
      svg.addEventListener("keydown", (e) => {
        const g = e.target.closest?.("[data-i]");
        if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tippe(Number(g.dataset.i)); }
      });
      if (hilfe) onTap(hilfe, () => zeigeSuchlinien(svg, ctx));
      if (p.strategie === "auto") zeigeSuchlinien(svg, ctx);

      const ok = await new Promise((resolve) => {
        onTap(fertig, () => { clearInterval(warte); resolve(true); });
        const warte = setInterval(() => {
          if (!ctx.alive()) { clearInterval(warte); resolve(null); }
          else if (gefunden.size === zahlZiele) { clearInterval(warte); resolve(true); }
        }, 200);
      });
      if (!ok || !ctx.alive()) return null;
      const dauer = (performance.now() - start) / 1000;
      sekunden += dauer;
      svg.classList.add("sv-such-gesperrt");
      bilanz = regionenBilanz(objekte, gefunden, bilanz);
      gefundenGesamt += gefunden.size;
      zieleGesamt += zahlZiele;
      objekte.forEach((o, i) => { if (o.ziel && !gefunden.has(i)) markiere(i, "sv-such-uebersehen"); });
      const alle = gefunden.size === zahlZiele;
      feedback(stage, alle ? "Alle gefunden!" : `${gefunden.size} von ${zahlZiele} gefunden – die übrigen sind markiert`, alle ? "gut" : "neutral");
      await sleep(alle ? 1300 : 3000);
      if (!ctx.alive()) return null;
    }
    if (!ctx.alive()) return null;

    speichereSuche(ctx.bests, bilanz, sekunden);
    const score = Math.max(0, Math.min(1, gefundenGesamt / (zieleGesamt + fehlTipps * 0.5)));
    const min = Math.floor(sekunden / 60), sek = Math.round(sekunden % 60);
    const zeit = min ? `${min} Min. ${sek} Sek.` : `${sek} Sek.`;
    const hinweis = auslassungsHinweis(bilanz);
    const text = `${gefundenGesamt} von ${zieleGesamt} gefunden in ${zeit} (links ${bilanz.links.g} von ${bilanz.links.n}, rechts ${bilanz.rechts.g} von ${bilanz.rechts.n}, oben ${bilanz.oben.g} von ${bilanz.oben.n}, unten ${bilanz.unten.g} von ${bilanz.unten.n}).`
      + (hinweis ? " " + hinweis : "");
    return { score, text };
  },
};
