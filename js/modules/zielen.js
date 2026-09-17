// Visuomotorik: Ziele antippen – Kreise erscheinen nacheinander, möglichst genau in die Mitte tippen (Fitts-Prinzip)
import { h, feedback } from "../core/ui.js";
import {
  klemme, mittelwert, stufenwert, fittsIndex, tempoGegenBest, merkeBest, leseBest,
  farben, zeichenflaeche, tippErkennung, warte, warteAuf,
} from "./vm-kern.js";

// ---------- Reine Logik (testbar) ----------

/** Schwierigkeit: Zielgröße und Abstand relativ zur kürzeren Seite der Fläche */
export function zielenParameter(stufe) {
  const s = klemme(stufe, 1, 20);
  return {
    ziele: 20,
    radiusAnteil: stufenwert(s, 0.13, 0.045),   // Radius / kürzere Seite
    abstandAnteil: stufenwert(s, 0.35, 0.95),   // Sprungweite / kürzere Seite
    toleranz: stufenwert(s, 0.6, 0.1),          // zusätzlicher Trefferrand in Radien
    versuche: 3,
  };
}

/** Konkrete Pixelwerte für eine Fläche w×h; Radius nie kleiner als 22 px (halbe Tippfläche ≈ 44 px) */
export function zielenMasse(p, w, h) {
  const k = Math.min(w, h);
  const r = Math.max(22, p.radiusAnteil * k);
  return { r, abstand: Math.max(r * 2.5, p.abstandAnteil * k) };
}

/**
 * Nächstes Ziel in der geforderten Hälfte ("links"/"rechts") mit möglichst genau dem Sollabstand.
 * rng: () => [0,1)
 */
export function naechstesZiel(prev, abstand, r, w, h, seite, rng = Math.random) {
  const rand = r + 10;
  const xMin = seite === "rechts" ? Math.max(rand, w / 2 + r * 0.3) : rand;
  const xMax = seite === "links" ? Math.min(w - rand, w / 2 - r * 0.3) : w - rand;
  let best = null, fehler = Infinity;
  for (let i = 0; i < 80; i++) {
    let x, y;
    if (prev) {
      const a = rng() * Math.PI * 2;
      x = prev.x + Math.cos(a) * abstand; y = prev.y + Math.sin(a) * abstand;
    } else {
      x = xMin + rng() * Math.max(0, xMax - xMin); y = rand + rng() * Math.max(0, h - 2 * rand);
    }
    x = klemme(x, xMin, Math.max(xMin, xMax)); y = klemme(y, rand, Math.max(rand, h - rand));
    const d = prev ? Math.hypot(x - prev.x, y - prev.y) : abstand;
    const f = Math.abs(d - abstand);
    if (f < fehler) { fehler = f; best = { x, y, abstand: d }; }
    if (f < 2) break;
  }
  return best;
}

/** Auswertung der einzelnen Ziele {getroffen, ersterVersuch, abstandNorm, zeitMs, id, seite} */
export function zielenAuswertung(ergebnisse, bestDurchsatz = null) {
  const n = ergebnisse.length || 1;
  const erste = ergebnisse.filter((e) => e.ersterVersuch).length;
  const treffer = ergebnisse.filter((e) => e.getroffen);
  const normen = treffer.map((e) => Math.min(1.5, e.abstandNorm));
  const mittlererAbstand = normen.length ? mittelwert(normen) : 1.5;
  const praezision = klemme(1 - (mittlererAbstand - 0.25) / 0.9);
  const mitZeit = treffer.filter((e) => e.zeitMs > 80 && e.id > 0);
  const durchsatz = mitZeit.length ? mittelwert(mitZeit.map((e) => e.id / (e.zeitMs / 1000))) : null; // Bit/s
  const tempo = durchsatz ? tempoGegenBest(durchsatz, bestDurchsatz, { kleinerBesser: false }) : 0.5;
  const seite = (s) => {
    const l = treffer.filter((e) => e.seite === s);
    return { n: l.length, zeitMs: l.length ? mittelwert(l.map((e) => e.zeitMs)) : null, abstandNorm: l.length ? mittelwert(l.map((e) => e.abstandNorm)) : null };
  };
  const trefferQuote = erste / n;
  return {
    score: klemme(0.5 * trefferQuote + 0.3 * praezision + 0.2 * tempo),
    erste, gesamt: ergebnisse.length, trefferQuote, praezision, mittlererAbstand, durchsatz, tempo,
    zeitMs: treffer.length ? mittelwert(treffer.map((e) => e.zeitMs)) : null,
    links: seite("links"), rechts: seite("rechts"),
  };
}

const sek = (ms) => (ms / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ---------- Darstellung ----------

export default {
  id: "zielen",
  bereich: "Visuomotorik",
  titel: "Ziele antippen",
  icon: "",
  anleitung: () => "Kreise erscheinen nacheinander. Tippen Sie jeden Kreis möglichst genau in der Mitte an. Genauigkeit zählt mehr als Tempo.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = zielenParameter(stufe);
    const info = h("p.hinweis", { text: "Gleich erscheint der erste Kreis" });
    const rahmen = h("div.vm-rahmen");
    stage.append(info, rahmen);

    let ziel = null, marke = null, blitz = 0;
    const flaeche = zeichenflaeche(rahmen, (g, w, hh) => {
      const f = farben(rahmen);
      g.clearRect(0, 0, w, hh);
      g.strokeStyle = f.line; g.lineWidth = 2; g.setLineDash([6, 10]);
      g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, hh - 12); g.stroke(); g.setLineDash([]);
      if (marke) {
        g.strokeStyle = f.muted; g.lineWidth = 3;
        g.beginPath(); g.moveTo(marke.x - 9, marke.y - 9); g.lineTo(marke.x + 9, marke.y + 9);
        g.moveTo(marke.x + 9, marke.y - 9); g.lineTo(marke.x - 9, marke.y + 9); g.stroke();
      }
      if (!ziel) return;
      const { x, y, r } = ziel;
      g.fillStyle = performance.now() < blitz ? f.sageLight : f.copperSubtle;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = 4; g.strokeStyle = performance.now() < blitz ? f.sage : f.copper;
      g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.stroke();
      g.fillStyle = g.strokeStyle;
      g.beginPath(); g.arc(x, y, Math.max(4, r * 0.14), 0, Math.PI * 2); g.fill();
    });
    const zeichne = () => flaeche.neu();

    const ergebnisse = [];
    let prev = null;
    try {
      if (!(await warte(ctx, 900))) return null;
      for (let i = 0; i < p.ziele; i++) {
        const { r, abstand } = zielenMasse(p, flaeche.w, flaeche.h);
        const seite = i % 2 === 0 ? "links" : "rechts";
        const pos = naechstesZiel(prev, abstand, r, flaeche.w, flaeche.h, seite);
        ziel = { ...pos, r };
        marke = null;
        info.textContent = `Kreis ${i + 1} von ${p.ziele}`;
        zeichne();
        const erschienen = performance.now();

        const e = await warteAuf(ctx, (fertig) => {
          let versuch = 0;
          const trennen = tippErkennung(flaeche.canvas, {
            tipp: (pt) => {
              versuch++;
              const d = Math.hypot(pt.x - ziel.x, pt.y - ziel.y);
              if (d <= r * (1 + p.toleranz)) {
                fertig({ getroffen: true, ersterVersuch: versuch === 1, abstandNorm: d / r,
                  zeitMs: Math.max(0, pt.t - erschienen), id: prev ? fittsIndex(pos.abstand, 2 * r) : 0, seite });
              } else if (versuch >= p.versuche) {
                fertig({ getroffen: false, ersterVersuch: false, abstandNorm: d / r, zeitMs: 0, id: 0, seite });
              } else {
                marke = pt; zeichne();
                feedback(stage, "Knapp daneben – noch einmal", "neutral");
              }
            },
          });
          return trennen;
        });
        if (e == null || !ctx.alive()) return null;
        ergebnisse.push(e);
        prev = pos;
        if (e.getroffen) { blitz = performance.now() + 250; marke = null; zeichne(); }
        else { feedback(stage, "Weiter zum nächsten Kreis", "neutral"); }
        if (!(await warte(ctx, e.getroffen ? 260 : 700))) return null;
        ziel = null; zeichne();
        if (!(await warte(ctx, 180))) return null;
      }
    } finally {
      flaeche.weg();
    }
    if (!ctx.alive()) return null;

    const best = leseBest(ctx.bests, "zielen", "durchsatz");
    const a = zielenAuswertung(ergebnisse, best);
    const neu = a.durchsatz != null && merkeBest(ctx.bests, "zielen", "durchsatz", a.durchsatz, false);
    let text = `${a.erste} von ${a.gesamt} Kreisen beim ersten Versuch getroffen, im Mittel ${Math.round(a.mittlererAbstand * 100)} % des Radius von der Mitte entfernt.`;
    if (a.zeitMs) text += ` Bewegungszeit ${sek(a.zeitMs)} s`;
    if (a.links.zeitMs && a.rechts.zeitMs) text += ` (links ${sek(a.links.zeitMs)} s, rechts ${sek(a.rechts.zeitMs)} s)`;
    if (a.zeitMs) text += ".";
    if (neu) text += " Neue persönliche Bestleistung beim Tempo!";
    return { score: a.score, text };
  },
};
