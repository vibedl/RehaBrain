// Sehen & Raum: Blicksprung – ein Ziel erscheint irgendwo, auch weit am Rand; antippen
import { h, sleep, feedback, debounced } from "../core/ui.js";

// ---------- Reine Logik (testbar) ----------

export function blickParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    versuche: 16,
    // Anzeigedauer: niedrige Stufen großzügig, dann kürzer
    anzeige: s <= 3 ? 9000 : Math.round(Math.max(1600, 7000 - (s - 4) * 330)),
    ablenker: s >= 7 ? Math.min(5, 1 + Math.floor((s - 7) / 3)) : 0,
    ankuendigung: s <= 10,                       // „Achtung, links“
    blitz: s >= 13 ? Math.round(Math.max(450, 1300 - (s - 13) * 120)) : 0, // Ziel verschwindet nach … ms, Stelle bleibt tippbar
    randAnteil: Math.min(0.75, 0.4 + s * 0.02),  // Anteil der Ziele im äußeren Randbereich
  };
}

/**
 * Zufällige Position in Prozent (Mittelpunkt). Ränder 5 %, damit die Tippfläche ganz sichtbar bleibt.
 * seiteVorgabe: "links" | "rechts" | null
 */
export function zielPosition(rng = Math.random, randAnteil = 0.5, seiteVorgabe = null) {
  const seite = seiteVorgabe ?? (rng() < 0.5 ? "links" : "rechts");
  const amRand = rng() < randAnteil;
  // Abstand von der Mitte in Prozentpunkten: Rand = 30–45, sonst 5–30
  const abstand = amRand ? 30 + rng() * 15 : 5 + rng() * 25;
  const x = seite === "links" ? 50 - abstand : 50 + abstand;
  const y = 8 + rng() * 84;
  return { x, y, seite, amRand };
}

/** Seitenfolge ausgewogen: gleich viele links und rechts, gemischt */
export function seitenFolge(anzahl, rng = Math.random) {
  const f = Array.from({ length: anzahl }, (_, i) => (i % 2 ? "links" : "rechts"));
  for (let i = f.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [f[i], f[j]] = [f[j], f[i]]; }
  return f;
}

/** Abstand zweier Prozentpositionen unter Berücksichtigung des Seitenverhältnisses (breite/hoehe) */
export function abstandProzent(a, b, verhaeltnis = 1.6) {
  return Math.hypot((a.x - b.x) * verhaeltnis, a.y - b.y);
}

const ZIEL_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" class="sr-blick-ring"/><circle cx="24" cy="24" r="7" class="sr-blick-punkt"/></svg>';
const ABLENK_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="7" width="34" height="34" rx="6" class="sr-blick-ablenk-form"/></svg>';

export default {
  id: "blicksprung",
  bereich: "Sehen & Raum",
  titel: "Blicksprung",
  icon: "",
  anleitung: (stufe) => {
    const p = blickParameter(stufe);
    let t = "Ein runder Punkt erscheint irgendwo auf der Fläche, auch ganz am Rand. Tippen Sie ihn an.";
    if (p.ablenker) t += " Die Vierecke gehören nicht dazu.";
    if (p.blitz) t += " Der Punkt blitzt nur kurz auf – tippen Sie dorthin, wo er war.";
    return t;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = blickParameter(stufe);
    const folge = seitenFolge(p.versuche);
    const stat = { links: [0, 0], rechts: [0, 0] }; // [getroffen, gesamt]
    const zeiten = [];
    let daneben = 0;

    const info = h("p.hinweis.gross", { text: "Schauen Sie in die Mitte" });
    const feld = h("div.sr-blick-feld", { role: "application", "aria-label": "Suchfläche" });
    stage.append(info, feld);

    for (let v = 0; v < p.versuche && ctx.alive(); v++) {
      feld.replaceChildren(h("div.sr-blick-mitte"));
      const seite = folge[v];
      info.textContent = p.ankuendigung ? `Achtung, ${seite}` : `Punkt ${v + 1} von ${p.versuche}`;
      await sleep(p.ankuendigung ? 1400 : 900 + Math.random() * 900);
      if (!ctx.alive()) return null;

      const pos = zielPosition(Math.random, p.randAnteil, seite);
      const belegt = [pos];
      for (let a = 0; a < p.ablenker; a++) {
        let ap;
        for (let t = 0; t < 30; t++) {
          ap = zielPosition(Math.random, 0.4);
          if (belegt.every((b) => abstandProzent(ap, b) > 22)) break;
        }
        belegt.push(ap);
        feld.append(h("div.sr-blick-ablenk", { html: ABLENK_SVG, style: { left: ap.x + "%", top: ap.y + "%" } }));
      }

      const ziel = h("button.sr-blick-ziel", { html: ZIEL_SVG, "aria-label": "Punkt", style: { left: pos.x + "%", top: pos.y + "%" } });
      feld.append(ziel);
      info.textContent = `Punkt ${v + 1} von ${p.versuche}`;
      const start = performance.now();
      let blitzTimer = null;
      if (p.blitz) blitzTimer = setTimeout(() => ziel.classList.add("sr-blick-weg"), p.blitz);

      const ergebnis = await new Promise((resolve) => {
        let warte = null;
        const fertig = (x) => { clearInterval(warte); resolve(x); };
        ziel.onclick = debounced((e) => { e.stopPropagation(); fertig("treffer"); });
        feld.onclick = debounced((e) => {
          if (e.target.closest(".sr-blick-ziel")) return;
          daneben++;
          feedback(stage, "Knapp daneben – der Punkt ist woanders", "neutral");
        });
        warte = setInterval(() => {
          if (!ctx.alive()) fertig(null);
          else if (performance.now() - start > p.anzeige) fertig("zeit");
        }, 50);
      });
      clearTimeout(blitzTimer);
      ziel.onclick = null; feld.onclick = null;
      if (ergebnis == null) return null;

      stat[seite][1]++;
      if (ergebnis === "treffer") {
        stat[seite][0]++;
        zeiten.push(performance.now() - start);
        ziel.classList.remove("sr-blick-weg");
        ziel.classList.add("sr-blick-getroffen");
        feedback(stage, "Gefunden!", "gut");
      } else {
        ziel.classList.remove("sr-blick-weg");
        ziel.classList.add("sr-blick-zeigen");
        feedback(stage, `Hier war er – ${seite === "links" ? "links" : "rechts"}`, "neutral");
      }
      await sleep(ergebnis === "treffer" ? 800 : 1600);
    }
    if (!ctx.alive()) return null;

    const treffer = stat.links[0] + stat.rechts[0];
    const score = Math.max(0, Math.min(1, treffer / (p.versuche + daneben * 0.25)));
    let text = `${treffer} von ${p.versuche} Punkten gefunden.`;
    const ql = stat.links[1] ? stat.links[0] / stat.links[1] : 1;
    const qr = stat.rechts[1] ? stat.rechts[0] / stat.rechts[1] : 1;
    if (Math.abs(ql - qr) >= 0.25) {
      const k = ql < qr ? "links" : "rechts";
      text += ` Auf der ${ql < qr ? "linken" : "rechten"} Seite wurden weniger gefunden – schauen Sie beim nächsten Mal besonders nach ${k}.`;
    }
    if (zeiten.length) {
      const mittel = zeiten.reduce((a, b) => a + b, 0) / zeiten.length;
      const best = ctx.bests.blicksprung;
      if (!best || mittel < best) ctx.bests.blicksprung = mittel;
    }
    return { score, text };
  },
};
