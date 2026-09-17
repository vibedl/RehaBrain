// Aufmerksamkeit: Geteilte Aufmerksamkeit (Doppelaufgabe) – links eine Lampe, rechts Zahlen, beides gleichzeitig beobachten
import { h, sleep, debounced, feedback } from "../core/ui.js";

// ---------- Reine Logik (testbar) ----------

/** Schwierigkeit aus der Stufe ableiten */
export function geteiltParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  const takt = Math.round(3000 - (s - 1) * 95);           // 3000 ms … 1195 ms pro Reiz je Seite
  return {
    takt,
    reize: Math.max(24, Math.min(60, Math.round(100000 / takt))), // je Seite, Runde ≈ 2 Minuten
    zielAnteil: s <= 10 ? 0.35 : 0.28,
    lampenAblenker: s >= 6,                                   // andere Farben statt nur „aus“
    zweistellig: s >= 8,
    bedingung: s >= 13 ? "gerade-gross" : "gerade",           // zweite Bedingung
    ton: true,                                                // leiser Piep beim Lampensignal, nur Zusatzhilfe
  };
}

export function istZielZahl(n, bedingung) {
  if (bedingung === "gerade-gross") return n % 2 === 0 && n > 50;
  return n % 2 === 0;
}

export function bedingungText(bedingung) {
  return bedingung === "gerade-gross" ? "gerade Zahl über 50" : "gerade Zahl";
}

/** Reizfolgen für beide Seiten erzeugen. rng: () => [0,1) */
export function planeReize(p, rng = Math.random) {
  const links = [], rechts = [];
  const ablenkFarben = ["blau", "kupfer"];
  for (let i = 0; i < p.reize; i++) {
    const zielL = rng() < p.zielAnteil && !(links[i - 1]?.ziel);
    links.push({ ziel: zielL, zustand: zielL ? "gruen" : (p.lampenAblenker && rng() < 0.6 ? ablenkFarben[Math.floor(rng() * 2)] : "aus") });

    const zielR = rng() < p.zielAnteil;
    let n;
    for (let v = 0; v < 200; v++) {
      n = p.zweistellig ? 10 + Math.floor(rng() * 90) : 1 + Math.floor(rng() * 9);
      if (istZielZahl(n, p.bedingung) === zielR && n !== rechts[i - 1]?.zahl) break;
    }
    // Stufe 1–7 kennt keine Zahl > 50; falls kein Treffer erzeugbar, bleibt es ein Nicht-Ziel
    rechts.push({ zahl: n, ziel: istZielZahl(n, p.bedingung) });
  }
  return { links, rechts };
}

/** Auswertung: Treffer zählen voll, Fehlalarme halb negativ */
export function geteiltScore({ treffer, fehlalarm, ziele }) {
  if (!ziele) return 0;
  return Math.max(0, Math.min(1, (treffer - 0.5 * fehlalarm) / ziele));
}

// ---------- Darstellung ----------

const LAMPE = `<svg viewBox="0 0 100 140" aria-hidden="true">
  <rect x="14" y="6" width="72" height="128" rx="18" class="sr-geteilt-gehaeuse"/>
  <circle cx="50" cy="70" r="28" class="sr-geteilt-licht"/>
  <circle cx="50" cy="70" r="12" class="sr-geteilt-kern"/>
</svg>`;

function piep(audio) {
  try {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.3);
  } catch { /* Ton ist nur Zusatz */ }
}

export default {
  id: "geteilt",
  bereich: "Aufmerksamkeit",
  titel: "Zwei Dinge zugleich",
  icon: "",
  anleitung: (stufe) => {
    const p = geteiltParameter(stufe);
    return `Achten Sie auf beide Seiten. Tippen Sie links, wenn die Lampe grün leuchtet. Tippen Sie rechts bei einer ${bedingungText(p.bedingung)}.`;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = geteiltParameter(stufe);
    const plan = planeReize(p);
    const stat = { treffer: 0, verpasst: 0, fehlalarm: 0, ziele: 0 };

    let audio = null;
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch { audio = null; }

    const info = h("p.hinweis", { text: "Gleich geht es los …" });
    const lampe = h("div.sr-geteilt-lampe", { html: LAMPE, "data-zustand": "aus" });
    const zahl = h("div.sr-geteilt-zahl", { text: "" });
    const btnL = h("button.sr-geteilt-flaeche", { "aria-label": "Linke Fläche: Lampe" },
      h("span.sr-geteilt-titel", { text: "Grüne Lampe" }), lampe);
    const btnR = h("button.sr-geteilt-flaeche", { "aria-label": "Rechte Fläche: Zahlen" },
      h("span.sr-geteilt-titel", { text: bedingungText(p.bedingung) }), zahl);
    stage.append(info, h("div.sr-geteilt-feld", {}, btnL, btnR));

    // Fenster je Seite: aktueller Reiz, ob schon getippt
    const fenster = { L: null, R: null };
    const tippe = (seite, btn) => {
      const f = fenster[seite];
      btn.classList.remove("sr-geteilt-ok");
      if (!f) return;
      if (f.getippt) return;
      f.getippt = true;
      if (f.ziel) {
        stat.treffer++;
        void btn.offsetWidth; btn.classList.add("sr-geteilt-ok");
      } else {
        stat.fehlalarm++;
        feedback(stage, seite === "L" ? "Die Lampe war nicht grün" : "Diese Zahl passt nicht", "neutral");
      }
    };
    btnL.onclick = debounced(() => tippe("L", btnL));
    btnR.onclick = debounced(() => tippe("R", btnR));
    const taste = (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); btnL.click(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); btnR.click(); }
    };
    document.addEventListener("keydown", taste);

    const schliesse = (seite) => {
      const f = fenster[seite];
      if (f && f.ziel && !f.getippt) stat.verpasst++;
      fenster[seite] = null;
    };

    // Wartet in kleinen Schritten, damit ein Abbruch schnell erkannt wird
    const warte = async (ms) => {
      const ende = performance.now() + ms;
      while (performance.now() < ende) {
        if (!ctx.alive()) return false;
        await sleep(Math.min(60, ende - performance.now()));
      }
      return ctx.alive();
    };

    try {
      if (!(await warte(1500))) return null;
      const halb = p.takt / 2;
      // Schritt 2i: linke Seite wechselt, Schritt 2i+1: rechte Seite – versetzt, damit beides beachtet werden muss
      for (let s = 0; s < p.reize * 2; s++) {
        const i = Math.floor(s / 2);
        const seite = s % 2 === 0 ? "L" : "R";
        schliesse(seite);
        info.textContent = `Signal ${i + 1} von ${p.reize}`;
        if (seite === "L") {
          const r = plan.links[i];
          lampe.dataset.zustand = "aus";
          await sleep(120);
          if (!ctx.alive()) return null;
          lampe.dataset.zustand = r.zustand;
          if (r.ziel) { stat.ziele++; if (audio && p.ton) piep(audio); }
          fenster.L = { ziel: r.ziel, getippt: false };
        } else {
          const r = plan.rechts[i];
          zahl.classList.add("sr-geteilt-weg");
          await sleep(120);
          if (!ctx.alive()) return null;
          zahl.textContent = String(r.zahl);
          zahl.classList.remove("sr-geteilt-weg");
          if (r.ziel) stat.ziele++;
          fenster.R = { ziel: r.ziel, getippt: false };
        }
        if (!(await warte(halb - 120))) return null;
      }
      if (!(await warte(p.takt / 2))) return null;
      schliesse("L"); schliesse("R");
    } finally {
      document.removeEventListener("keydown", taste);
      btnL.onclick = null; btnR.onclick = null;
      if (audio) { try { audio.close(); } catch { /* egal */ } }
    }

    const score = geteiltScore(stat);
    let text = `${stat.treffer} von ${stat.ziele} Signalen erkannt.`;
    if (stat.fehlalarm) text += ` ${stat.fehlalarm}-mal ohne Signal getippt.`;
    return { score, text };
  },
};
