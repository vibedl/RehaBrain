// Sehen & Raum: Durchstreichen – alle Zielsymbole über die ganze Breite finden, Auswertung nach linker/rechter Hälfte
import { h, sleep, feedback, debounced } from "../core/ui.js";

// ---------- Symbole (Strich-SVG, viewBox 0 0 48 48) ----------
export const SYMBOLE = {
  kreis: '<circle cx="24" cy="24" r="15"/>',
  "kreis-punkt": '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="3.5" fill="currentColor"/>',
  "kreis-strich": '<circle cx="24" cy="24" r="15"/><path d="M24 13v22"/>',
  quadrat: '<rect x="10" y="10" width="28" height="28" rx="2"/>',
  "quadrat-kreuz": '<rect x="10" y="10" width="28" height="28" rx="2"/><path d="M17 17l14 14M31 17L17 31"/>',
  raute: '<path d="M24 7l17 17-17 17L7 24z"/>',
  "dreieck-oben": '<path d="M24 8l17 30H7z"/>',
  "dreieck-unten": '<path d="M24 40L7 10h34z"/>',
  stern: '<path d="M24 6l5.3 11.3 12.2 1.4-9 8.4 2.4 12.1L24 33.2l-10.9 6 2.4-12.1-9-8.4 12.2-1.4z"/>',
  plus: '<path d="M24 8v32M8 24h32"/>',
  kreuz: '<path d="M11 11l26 26M37 11L11 37"/>',
};
const GRUPPEN = [
  ["kreis", "kreis-punkt", "kreis-strich"],
  ["quadrat", "quadrat-kreuz", "raute"],
  ["dreieck-oben", "dreieck-unten", "raute"],
  ["stern", "plus", "kreuz"],
];

// ---------- Reine Logik (testbar) ----------

export function durchParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  const spalten = Math.min(10, 6 + 2 * Math.floor((s - 1) / 7)); // 6, 8, 10 – immer gerade
  const zeilen = Math.min(7, 4 + Math.floor((s - 1) / 6));         // 4 … 7
  const aehnlich = s >= 15 ? 1 : s >= 8 ? 0.5 : 0;                   // Anteil ähnlicher Ablenker
  return { spalten, zeilen, aehnlich, zielAnteil: 0.25 };
}

/** Ein Blatt erzeugen: gleich viele Ziele links und rechts */
export function erzeugeBlatt(stufe, rng = Math.random) {
  const p = durchParameter(stufe);
  const gi = Math.floor(rng() * GRUPPEN.length);
  const gruppe = GRUPPEN[gi];
  const ziel = gruppe[Math.floor(rng() * gruppe.length)];
  const aehnliche = gruppe.filter((x) => x !== ziel);
  const fremde = GRUPPEN.filter((_, i) => i !== gi).flat().filter((x) => x !== ziel && !aehnliche.includes(x));

  const halb = p.spalten / 2;
  const zieleProSeite = Math.max(2, Math.round((halb * p.zeilen) * p.zielAnteil));
  const items = [];
  for (const seite of ["links", "rechts"]) {
    const zellen = [];
    for (let z = 0; z < p.zeilen; z++) for (let c = 0; c < halb; c++) zellen.push([c + (seite === "rechts" ? halb : 0), z]);
    // Ziele zufällig auf die Zellen dieser Seite verteilen
    for (let i = zellen.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [zellen[i], zellen[j]] = [zellen[j], zellen[i]]; }
    zellen.forEach(([spalte, zeile], i) => {
      const istZiel = i < zieleProSeite;
      const pool = rng() < p.aehnlich ? aehnliche : fremde;
      const sym = istZiel ? ziel : pool[Math.floor(rng() * pool.length)];
      items.push({ sym, ziel: istZiel, spalte, zeile, seite, dx: rng() * 2 - 1, dy: rng() * 2 - 1 });
    });
  }
  items.sort((a, b) => a.zeile - b.zeile || a.spalte - b.spalte);
  return { ...p, ziel, items };
}

/** Seitenbilanz: gefundene Ziele je Hälfte. gefunden = Set von Indizes in items */
export function seitenBilanz(items, gefunden) {
  const b = { links: { gefunden: 0, gesamt: 0 }, rechts: { gefunden: 0, gesamt: 0 } };
  items.forEach((it, i) => {
    if (!it.ziel) return;
    b[it.seite].gesamt++;
    if (gefunden.has(i)) b[it.seite].gefunden++;
  });
  return b;
}

export const quote = (s) => (s.gesamt ? s.gefunden / s.gesamt : 1);

/** Freundlicher Hinweis, wenn eine Seite deutlich schwächer ist (sonst leerer Text) */
export function seitenHinweis(bilanz) {
  const l = quote(bilanz.links), r = quote(bilanz.rechts);
  if (Math.abs(l - r) < 0.2) return "";
  const schwach = l < r ? "linken" : "rechten";
  const kurz = l < r ? "links" : "rechts";
  return `Auf der ${schwach} Seite wurden weniger gefunden – achten Sie beim nächsten Mal besonders auf ${kurz}.`;
}

/** Bilanzen mehrerer Blätter addieren */
export function addiereBilanz(a, b) {
  return {
    links: { gefunden: a.links.gefunden + b.links.gefunden, gesamt: a.links.gesamt + b.links.gesamt },
    rechts: { gefunden: a.rechts.gefunden + b.rechts.gefunden, gesamt: a.rechts.gesamt + b.rechts.gesamt },
  };
}

/** Seitenbilanz im Profil ablegen (letzte 10 Werte) */
export function speichereSeiten(bests, bilanz, datum = new Date().toISOString().slice(0, 10)) {
  const liste = Array.isArray(bests.durchstreichenSeiten) ? bests.durchstreichenSeiten : [];
  liste.push({ datum, links: Math.round(quote(bilanz.links) * 100) / 100, rechts: Math.round(quote(bilanz.rechts) * 100) / 100 });
  bests.durchstreichenSeiten = liste.slice(-10);
  return bests.durchstreichenSeiten;
}

const svg = (sym) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYMBOLE[sym]}</svg>`;

export default {
  id: "durchstreichen",
  bereich: "Sehen & Raum",
  titel: "Durchstreichen",
  icon: "",
  anleitung: () => "Oben sehen Sie ein Zeichen. Tippen Sie auf dem ganzen Blatt alle gleichen Zeichen an, von ganz links bis ganz rechts. Dann tippen Sie auf „Fertig“.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const blaetter = 2;
    let bilanz = { links: { gefunden: 0, gesamt: 0 }, rechts: { gefunden: 0, gesamt: 0 } };
    let fehlTipps = 0;

    for (let b = 0; b < blaetter && ctx.alive(); b++) {
      stage.innerHTML = "";
      const blatt = erzeugeBlatt(stufe);
      const gefunden = new Set();
      const zielGesamt = blatt.items.filter((x) => x.ziel).length;

      const kopf = h("div.sr-durch-kopf", {},
        h("span.sr-durch-vorlage", { html: svg(blatt.ziel), "aria-label": "Gesuchtes Zeichen" }),
        h("span.hinweis", { text: `Blatt ${b + 1} von ${blaetter}` }));
      const raster = h("div.sr-durch-raster", { style: { gridTemplateColumns: `repeat(${blatt.spalten}, 1fr)` } },
        blatt.items.map((it, i) => {
          const btn = h("button.sr-durch-zeichen", {
            html: svg(it.sym), "aria-label": "Zeichen",
            style: { transform: `translate(${(it.dx * 12).toFixed(0)}%, ${(it.dy * 12).toFixed(0)}%)` },
          });
          btn.onclick = debounced(() => {
            if (gefunden.has(i)) return;
            if (it.ziel) { gefunden.add(i); btn.classList.add("sr-durch-markiert"); btn.setAttribute("aria-pressed", "true"); }
            else {
              fehlTipps++;
              btn.classList.add("sr-durch-nein");
              setTimeout(() => btn.classList.remove("sr-durch-nein"), 450);
            }
          });
          return btn;
        }));
      const fertig = h("button.knopf.gross", { text: "Fertig" });
      stage.append(kopf, raster, fertig);

      const ok = await new Promise((resolve) => {
        fertig.onclick = debounced(() => resolve(true));
        const warte = setInterval(() => {
          if (!ctx.alive()) { clearInterval(warte); resolve(null); }
          else if (gefunden.size === zielGesamt) { clearInterval(warte); resolve(true); }
        }, 200);
      });
      if (ok == null || !ctx.alive()) return null;
      raster.classList.add("sr-durch-gesperrt");
      bilanz = addiereBilanz(bilanz, seitenBilanz(blatt.items, gefunden));
      // Nicht gefundene Ziele sanft zeigen
      blatt.items.forEach((it, i) => { if (it.ziel && !gefunden.has(i)) raster.children[i].classList.add("sr-durch-uebersehen"); });
      feedback(stage, gefunden.size === zielGesamt ? "Alle gefunden!" : `${gefunden.size} von ${zielGesamt} gefunden`,
        gefunden.size === zielGesamt ? "gut" : "neutral");
      await sleep(gefunden.size === zielGesamt ? 1200 : 2600);
      if (!ctx.alive()) return null;
    }
    if (!ctx.alive()) return null;

    speichereSeiten(ctx.bests, bilanz);
    const gef = bilanz.links.gefunden + bilanz.rechts.gefunden;
    const ges = bilanz.links.gesamt + bilanz.rechts.gesamt;
    const score = Math.max(0, Math.min(1, gef / (ges + fehlTipps * 0.5)));
    const hinweis = seitenHinweis(bilanz);
    const text = `${gef} von ${ges} Zeichen gefunden (links ${bilanz.links.gefunden} von ${bilanz.links.gesamt}, rechts ${bilanz.rechts.gefunden} von ${bilanz.rechts.gesamt}).`
      + (hinweis ? " " + hinweis : "");
    return { score, text };
  },
};
