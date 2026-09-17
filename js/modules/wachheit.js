// Aufmerksamkeit: Schnell bereit (Alertness mit und ohne Warnhinweis)
// Teil „ohne Vorwarnung“ misst die eigene Grundwachheit, Teil „mit Vorwarnung“ die kurzfristige
// Aktivierung durch einen Hinweis. Reihenfolge ohne – mit – mit – ohne gleicht Übung und Ermüdung aus.
import { h, sleep, debounced, feedback } from "../core/ui.js";
import { wartenAuf } from "./einkaufsliste.js";

// ---------- Reine Logik (testbar) ----------

export const BLOECKE = ["ohne", "mit", "mit", "ohne"];

/** Schwierigkeit je Stufe 1–20 */
export function wachheitParameter(stufe) {
  const s = Math.max(1, Math.min(20, Math.round(stufe)));
  return {
    proBlock: s <= 5 ? 5 : s <= 12 ? 6 : 7,
    // Zeit vom Warnhinweis bis zum Kreis: erst fest, dann zunehmend unvorhersehbar
    vorwarnMin: s <= 4 ? 800 : s <= 10 ? 600 : 300,
    vorwarnMax: s <= 4 ? 800 : s <= 10 ? 1200 : 1800,
    wartenMin: 1500,
    wartenMax: s <= 4 ? 3000 : 4500,
    ablenkerAnteil: s >= 7 ? Math.min(0.25, 0.1 + (s - 7) * 0.012) : 0, // eckiges Zeichen: nicht tippen
    leerAnteil: s >= 14 ? 0.12 : 0,                                     // Hinweis ohne Kreis
    fenster: Math.max(1500, 3000 - s * 60),                            // so lange darf die Antwort dauern
  };
}

/** Durchgänge planen: [{ bedingung, art: "ziel"|"ablenker"|"leer", wartenMs, vorwarnMs }] */
export function planeWachheit(p, rng = Math.random) {
  const zwischen = (a, b) => Math.round(a + rng() * (b - a));
  const liste = [];
  BLOECKE.forEach((bedingung, block) => {
    const arten = [];
    const nStoer = Math.round(p.proBlock * p.ablenkerAnteil);
    const nLeer = bedingung === "mit" ? Math.round(p.proBlock * p.leerAnteil) : 0;
    for (let i = 0; i < nStoer; i++) arten.push("ablenker");
    for (let i = 0; i < nLeer; i++) arten.push("leer");
    while (arten.length < p.proBlock + nStoer + nLeer) arten.push("ziel"); // Zielanzahl bleibt je Block gleich
    // mischen, aber nie mit einem Nicht-Ziel beginnen
    for (let i = arten.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arten[i], arten[j]] = [arten[j], arten[i]];
    }
    const erstesZiel = arten.indexOf("ziel");
    [arten[0], arten[erstesZiel]] = [arten[erstesZiel], arten[0]];
    for (const art of arten) {
      liste.push({
        block, bedingung, art,
        wartenMs: zwischen(p.wartenMin, p.wartenMax),
        vorwarnMs: bedingung === "mit" ? zwischen(p.vorwarnMin, p.vorwarnMax) : 0,
      });
    }
  });
  return liste;
}

export const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Auswertung. ergebnisse: [{ bedingung, art, rt: ms|null, vorzeitig: bool }]
 * rt < 100 ms gilt als Vorwegnahme (nicht als echte Reaktion).
 */
export function auswertenWachheit(ergebnisse, fenster) {
  const bed = {};
  let fehlalarme = 0, vorzeitig = 0, ziele = 0, treffer = 0;
  for (const b of ["ohne", "mit"]) bed[b] = { rts: [], ziele: 0, treffer: 0 };
  for (const e of ergebnisse) {
    if (e.vorzeitig) vorzeitig++;
    if (e.art === "ziel") {
      ziele++; bed[e.bedingung].ziele++;
      if (e.rt != null && e.rt >= 100 && e.rt <= fenster) { treffer++; bed[e.bedingung].treffer++; bed[e.bedingung].rts.push(e.rt); }
      else if (e.rt != null && e.rt < 100) vorzeitig++;
    } else if (e.rt != null) fehlalarme++;
  }
  const zus = {};
  for (const b of ["ohne", "mit"]) zus[b] = { ziele: bed[b].ziele, treffer: bed[b].treffer, median: median(bed[b].rts) };
  const vorteil = zus.ohne.median != null && zus.mit.median != null ? zus.ohne.median - zus.mit.median : null;
  const score = ziele ? Math.max(0, Math.min(1, (treffer - 0.5 * fehlalarme - 0.25 * vorzeitig) / ziele)) : 0;
  return { ziele, treffer, auslasser: ziele - treffer, fehlalarme, vorzeitig, ohne: zus.ohne, mit: zus.mit, vorteil, score };
}

/** Persönliche Bestwerte fortschreiben; gibt { neu: ["ohne"|"mit"], langsamer: bool } zurück */
export function bestwerteWachheit(bests, e) {
  const neu = [];
  let langsamer = true, verglichen = false;
  for (const [b, key] of [["ohne", "wachheitOhne"], ["mit", "wachheitMit"]]) {
    const m = e[b].median;
    if (m == null) continue;
    const best = bests[key];
    if (best) { verglichen = true; if (m <= best * 1.3) langsamer = false; }
    if (!best || m < best) { bests[key] = Math.round(m); neu.push(b); }
  }
  return { neu, langsamer: verglichen && langsamer };
}

// ---------- Darstellung ----------

let audio = null;
function ton() {
  try {
    if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audio = new AC(); }
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.2);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.25);
  } catch { /* Ton ist nur Zusatz */ }
}

const blockText = (bedingung) => bedingung === "mit"
  ? "Mit Vorwarnung: Erst leuchtet der Ring auf (mit leisem Ton), kurz danach kommt der Kreis."
  : "Ohne Vorwarnung: Der Kreis kommt ganz ohne Ankündigung.";

export default {
  id: "wachheit",
  bereich: "Aufmerksamkeit",
  titel: "Schnell bereit",
  icon: "",
  anleitung: (stufe) => {
    const p = wachheitParameter(stufe);
    return "Tippen Sie so schnell wie möglich, sobald der volle grüne Kreis erscheint. Mal kommt vorher ein Warnhinweis, mal nicht."
      + (p.ablenkerAnteil ? " Bei einem eckigen Zeichen nicht tippen." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = wachheitParameter(stufe);
    const plan = planeWachheit(p);
    const ergebnisse = [];

    const info = h("p.hinweis", { text: "" });
    const ring = h("div.au-bereit-ring");
    const reiz = h("div.au-bereit-reiz");
    const flaeche = h("button.au-bereit-flaeche", { "aria-label": "Tippfläche" }, ring, reiz);
    const bedingungsSchild = h("p.au-bereit-schild");
    stage.append(info, bedingungsSchild, flaeche);

    let phase = "pause"; // pause | warten | reiz
    let aktuell = null;
    let reizStart = 0;
    flaeche.onclick = debounced(() => {
      if (!aktuell) return;
      if (phase === "reiz") {
        if (aktuell.rt == null) aktuell.rt = performance.now() - reizStart;
      } else if (phase === "warten") {
        if (!aktuell.vorzeitig) { aktuell.vorzeitig = true; feedback(stage, "Noch warten …", "neutral"); }
      }
    });

    // in kleinen Schritten warten, damit ein Abbruch schnell greift
    const warte = async (ms, abbruch = () => false) => {
      const ende = performance.now() + ms;
      while (performance.now() < ende) {
        if (!ctx.alive()) return false;
        if (abbruch()) return true;
        await sleep(Math.min(15, ende - performance.now()));
      }
      return ctx.alive();
    };

    try {
      let block = -1;
      for (let i = 0; i < plan.length; i++) {
        const d = plan[i];
        if (d.block !== block) {
          block = d.block;
          phase = "pause";
          bedingungsSchild.textContent = d.bedingung === "mit" ? "Mit Vorwarnung" : "Ohne Vorwarnung";
          bedingungsSchild.dataset.bedingung = d.bedingung;
          info.textContent = `Teil ${block + 1} von ${BLOECKE.length}`;
          flaeche.hidden = true;
          const box = h("div.au-bereit-intro", {}, h("p.hinweis.gross", { text: blockText(d.bedingung) }));
          stage.append(box);
          const ok = await wartenAuf(ctx, (fertig) => {
            box.append(h("div.knopfreihe", {}, h("button.knopf.gross.primaer", { text: block === 0 ? "Los geht's" : "Weiter", onclick: debounced(() => fertig(true)) })));
          });
          box.remove();
          if (ok == null) return null;
          flaeche.hidden = false;
          if (!(await warte(800))) return null;
        }

        aktuell = { bedingung: d.bedingung, art: d.art, rt: null, vorzeitig: false };
        phase = "warten";
        reiz.className = "au-bereit-reiz";
        ring.classList.remove("an");
        if (!(await warte(d.wartenMs))) return null;

        if (d.bedingung === "mit") {
          ring.classList.add("an");
          ton();
          if (!(await warte(d.vorwarnMs))) return null;
        }
        if (d.art !== "leer") {
          reiz.className = "au-bereit-reiz sichtbar " + (d.art === "ziel" ? "ziel" : "ablenker");
        }
        reizStart = performance.now();
        phase = "reiz";
        const fenster = d.art === "ziel" ? p.fenster : Math.min(p.fenster, 1500);
        if (!(await warte(fenster, () => aktuell.rt != null))) return null;
        phase = "pause";
        reiz.className = "au-bereit-reiz";
        ring.classList.remove("an");

        if (d.art === "ziel") {
          if (aktuell.rt != null && aktuell.rt >= 100) feedback(stage, `${Math.round(aktuell.rt)} ms`, "gut");
          else if (aktuell.rt != null) feedback(stage, "Etwas zu früh – erst den Kreis abwarten", "neutral");
          else feedback(stage, "Etwas zu spät – weiter geht's", "neutral");
        } else if (aktuell.rt == null) {
          feedback(stage, "Gut abgewartet!", "gut");
        } else {
          feedback(stage, d.art === "leer" ? "Diesmal kam kein Kreis" : "Das war eckig – beim nächsten Mal warten", "neutral");
        }
        ergebnisse.push(aktuell);
        aktuell = null;
        if (!(await warte(900))) return null;
      }
    } finally {
      flaeche.onclick = null;
      if (audio) { try { audio.close(); } catch { /* egal */ } audio = null; }
    }
    if (!ctx.alive()) return null;

    const e = auswertenWachheit(ergebnisse, p.fenster);
    const b = bestwerteWachheit(ctx.bests, e);
    let score = e.score;
    if (b.langsamer) score = Math.min(score, 0.79); // deutlich langsamer als sonst → nicht hochstufen

    const ms = (v) => (v == null ? "–" : `${Math.round(v)} ms`);
    let text = `${e.treffer} von ${e.ziele} Kreisen erwischt. Ohne Vorwarnung ${ms(e.ohne.median)}, mit Vorwarnung ${ms(e.mit.median)}.`;
    if (e.vorteil != null && e.vorteil >= 20) text += " Die Vorwarnung hat Sie spürbar schneller gemacht.";
    if (b.neu.length) text += " Neue persönliche Bestzeit!";
    return { score, text };
  },
};
