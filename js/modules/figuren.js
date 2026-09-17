// Sehen & Raum: Figuren vergleichen (mentale Rotation) – welche Figur ist dieselbe, nur gedreht?
import { h, sleep, feedback, debounced } from "../core/ui.js";

// ---------- Reine Logik (testbar) ----------
// Eine Figur ist eine Liste von Zellen [x, y] (zusammenhängende Quadrate).

const schluessel = (f) => f.map(([x, y]) => x + "," + y).join(";");

/** Verschieben auf Ursprung und sortieren → vergleichbare Form */
export function normalisiere(f) {
  const mx = Math.min(...f.map((c) => c[0])), my = Math.min(...f.map((c) => c[1]));
  return f.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Um 90° × k im Uhrzeigersinn drehen (Bildschirmkoordinaten, y nach unten) */
export function drehe(f, k = 1) {
  let r = f;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) r = r.map(([x, y]) => [-y, x]);
  return normalisiere(r);
}

export const spiegle = (f) => normalisiere(f.map(([x, y]) => [-x, y]));

/** Gleich, wenn eine der vier Drehungen übereinstimmt (Spiegelung zählt NICHT als gleich) */
export function gleichUnterRotation(a, b) {
  if (a.length !== b.length) return false;
  const kb = schluessel(normalisiere(b));
  return [0, 1, 2, 3].some((k) => schluessel(drehe(a, k)) === kb);
}

/** Gleich unter Drehung oder Spiegelung */
export const gleichUnterSymmetrie = (a, b) => gleichUnterRotation(a, b) || gleichUnterRotation(spiegle(a), b);

/** Chiral = Spiegelbild ist durch Drehen nicht erreichbar (nur dann ist eine Spiegelung ein echter Ablenker) */
export const istChiral = (f) => !gleichUnterRotation(f, spiegle(f));

export function istZusammenhaengend(f) {
  if (!f.length) return false;
  const set = new Set(f.map((c) => c + ""));
  const gesehen = new Set([f[0] + ""]);
  const stapel = [f[0]];
  while (stapel.length) {
    const [x, y] = stapel.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = [x + dx, y + dy] + "";
      if (set.has(k) && !gesehen.has(k)) { gesehen.add(k); stapel.push([x + dx, y + dy]); }
    }
  }
  return gesehen.size === f.length;
}

const nachbarn = (f) => {
  const set = new Set(f.map((c) => c + ""));
  const out = new Map();
  for (const [x, y] of f) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = [x + dx, y + dy];
    if (!set.has(c + "")) out.set(c + "", c);
  }
  return [...out.values()];
};

/** Zufällige zusammenhängende Figur aus n Quadraten, höchstens 4×4 groß */
export function zufallsFigur(n, rng = Math.random, chiral = true) {
  for (let versuch = 0; versuch < 500; versuch++) {
    let f = [[0, 0]];
    while (f.length < n) {
      const nb = nachbarn(f);
      f.push(nb[Math.floor(rng() * nb.length)]);
    }
    f = normalisiere(f);
    const breite = Math.max(...f.map((c) => c[0])) + 1, hoehe = Math.max(...f.map((c) => c[1])) + 1;
    if (breite > 4 || hoehe > 4 || (breite === 1 || hoehe === 1)) continue; // keine geraden Stäbe
    if (chiral && !istChiral(f)) continue;
    return f;
  }
  throw new Error("Keine Figur gefunden");
}

/** Figur verändern: ein Quadrat versetzen, Ergebnis muss eine wirklich andere Form sein */
export function veraendere(f, rng = Math.random) {
  for (let versuch = 0; versuch < 300; versuch++) {
    const weg = Math.floor(rng() * f.length);
    const rest = f.filter((_, i) => i !== weg);
    if (!istZusammenhaengend(rest)) continue;
    const nb = nachbarn(rest).filter((c) => c + "" !== f[weg] + "");
    const neu = normalisiere([...rest, nb[Math.floor(rng() * nb.length)]]);
    const breite = Math.max(...neu.map((c) => c[0])) + 1, hoehe = Math.max(...neu.map((c) => c[1])) + 1;
    if (breite > 4 || hoehe > 4) continue;
    if (gleichUnterSymmetrie(neu, f)) continue;
    return neu;
  }
  return null;
}

export function figurenParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    aufgaben: 10,
    zellen: s <= 6 ? 4 : s <= 13 ? 5 : 6,
    optionen: s <= 4 ? 2 : s <= 11 ? 3 : 4,
    drehungen: s <= 3 ? [0] : s <= 8 ? [1, 3] : s <= 13 ? [1, 2, 3] : [0, 1, 2, 3],
    beliebig: s >= 16,        // zusätzlich freier Winkel (Darstellung)
    spiegelung: s >= 8,       // gespiegelte Ablenker erst ab mittleren Stufen
  };
}

/**
 * Eine Aufgabe: { vorlage, optionen: [{ figur, art: "gleich"|"gespiegelt"|"veraendert", winkel }], richtig }
 */
export function erzeugeAufgabe(stufe, rng = Math.random) {
  const p = figurenParameter(stufe);
  for (let versuch = 0; versuch < 100; versuch++) {
    const vorlage = zufallsFigur(p.zellen, rng, true);
    const drehung = () => p.drehungen[Math.floor(rng() * p.drehungen.length)];
    const optionen = [{ figur: drehe(vorlage, drehung()), art: "gleich" }];
    if (p.spiegelung) optionen.push({ figur: drehe(spiegle(vorlage), drehung()), art: "gespiegelt" });
    let ok = true;
    while (optionen.length < p.optionen) {
      const basis = p.spiegelung && rng() < 0.3 ? spiegle(vorlage) : vorlage;
      const v = veraendere(basis, rng);
      if (!v) { ok = false; break; }
      if (optionen.some((o) => gleichUnterSymmetrie(o.figur, v))) { if (rng() < 0.02) { ok = false; break; } continue; }
      optionen.push({ figur: drehe(v, drehung()), art: "veraendert" });
    }
    if (!ok) continue;
    for (const o of optionen) o.winkel = p.beliebig ? Math.floor(rng() * 8) * 45 : 0;
    // mischen
    for (let i = optionen.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [optionen[i], optionen[j]] = [optionen[j], optionen[i]]; }
    return { vorlage, optionen, richtig: optionen.findIndex((o) => o.art === "gleich") };
  }
  throw new Error("Keine Aufgabe erzeugbar");
}

// ---------- Darstellung ----------

function figurSvg(f, winkel = 0) {
  const g = 10;
  const inhalt = f.map(([x, y]) => `<rect x="${x * g + 1}" y="${y * g + 1}" width="${g - 2}" height="${g - 2}" rx="1.5" class="sr-figuren-zelle"/>`).join("");
  const breite = Math.max(...f.map((c) => c[0])) + 1, hoehe = Math.max(...f.map((c) => c[1])) + 1;
  const cx = (breite * g) / 2, cy = (hoehe * g) / 2;
  // Feste Ansichtsgröße 64×64 um den Mittelpunkt, damit gedrehte Figuren nicht abgeschnitten werden
  return `<svg viewBox="${cx - 32} ${cy - 32} 64 64" aria-hidden="true"><g transform="rotate(${winkel} ${cx} ${cy})">${inhalt}</g></svg>`;
}

export default {
  id: "figuren",
  bereich: "Sehen & Raum",
  titel: "Figuren vergleichen",
  icon: "",
  anleitung: (stufe) => {
    const p = figurenParameter(stufe);
    return p.drehungen.length === 1 && p.drehungen[0] === 0
      ? "Oben sehen Sie eine Figur. Tippen Sie unten auf die Figur, die genau gleich aussieht."
      : "Oben sehen Sie eine Figur. Unten ist sie gedreht – nur eine ist dieselbe Figur. Tippen Sie sie an."
        + (p.spiegelung ? " Vorsicht: Spiegelbilder zählen nicht." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = figurenParameter(stufe);
    let richtig = 0;

    for (let a = 0; a < p.aufgaben && ctx.alive(); a++) {
      stage.innerHTML = "";
      const aufgabe = erzeugeAufgabe(stufe);
      const info = h("p.hinweis", { text: `Aufgabe ${a + 1} von ${p.aufgaben}` });
      const vorlage = h("div.sr-figuren-vorlage", { html: figurSvg(aufgabe.vorlage), "aria-label": "Vorlage" });
      const knoepfe = aufgabe.optionen.map((o, i) =>
        h("button.sr-figuren-option", { html: figurSvg(o.figur, o.winkel), "aria-label": `Figur ${i + 1}` }));
      const auswahl = h("div.sr-figuren-auswahl" + (knoepfe.length === 3 ? ".sr-figuren-drei" : ""), {}, knoepfe);
      stage.append(info, vorlage, h("p.hinweis", { text: "Welche ist dieselbe?" }), auswahl);

      const wahl = await new Promise((resolve) => {
        let warte = null;
        const fertig = (x) => { clearInterval(warte); resolve(x); };
        knoepfe.forEach((k, i) => { k.onclick = debounced(() => fertig(i)); });
        warte = setInterval(() => { if (!ctx.alive()) fertig(null); }, 300);
      });
      if (wahl == null || !ctx.alive()) return null;
      knoepfe.forEach((k) => { k.onclick = null; k.disabled = true; });
      knoepfe[aufgabe.richtig].classList.add("sr-figuren-richtig");
      if (wahl === aufgabe.richtig) { richtig++; feedback(stage, "Richtig!", "gut"); }
      else {
        knoepfe[wahl].classList.add("sr-figuren-gewaehlt");
        const art = aufgabe.optionen[wahl].art;
        feedback(stage, art === "gespiegelt" ? "Das war das Spiegelbild – die markierte ist es" : "Die markierte Figur ist dieselbe", "neutral");
      }
      await sleep(wahl === aufgabe.richtig ? 1100 : 2200);
    }
    if (!ctx.alive()) return null;
    return { score: richtig / p.aufgaben, text: `${richtig} von ${p.aufgaben} Figuren richtig erkannt.` };
  },
};
