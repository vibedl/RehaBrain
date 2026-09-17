// Aufmerksamkeit: Wachsam bleiben (Daueraufmerksamkeit / Vigilanz)
// Ruhiges Förderband mit Paketen. Selten kommt ein Paket mit RUNDEM Aufkleber – dann antippen.
// Bewusst monoton: Es geht darum, über mehrere Minuten dranzubleiben, nicht um Tempo.
import { h, sleep, debounced, feedback } from "../core/ui.js";
import { wartenAuf } from "./einkaufsliste.js";

// ---------- Reine Logik (testbar) ----------

/** Schwierigkeit je Stufe 1–20 */
export function wachsamParameter(stufe) {
  const s = Math.max(1, Math.min(20, Math.round(stufe)));
  const dauerMin = s <= 5 ? 3 + (s - 1) * 0.75 : 7 + ((s - 6) * 13) / 14; // 3–6 min, dann 7–20 min
  return {
    dauerMs: Math.round(dauerMin * 60000),
    takt: Math.round(3200 - (s - 1) * 50),        // Abstand zwischen zwei Paketen: 3,2 s … 2,25 s
    reise: Math.round(9000 - (s - 1) * 170),       // so lange ist ein Paket sichtbar: 9 s … 5,8 s
    zielAnteil: s <= 5 ? 0.12 : s <= 12 ? 0.09 : 0.07,
    ablenkerAnteil: s >= 8 ? Math.min(0.28, 0.1 + (s - 8) * 0.015) : 0, // Pakete mit ECKIGEM Aufkleber
    kleinerAufkleber: s >= 14,
    pausen: 3,
  };
}

/**
 * Paketfolge planen. Jede Hälfte bekommt mindestens ein Zielpaket, damit sich
 * Anfang und Ende vergleichen lassen. Zwei Zielpakete sind nie gleichzeitig sichtbar.
 * Rückgabe: { pakete: [{ t, art: "ziel"|"ablenker"|"normal", haelfte: 0|1 }], halbZeit, gesamtMs }
 */
export function planeWachsam(p, dauerMs = p.dauerMs, rng = Math.random) {
  const n = Math.max(8, Math.floor(dauerMs / p.takt));
  const abstand = Math.ceil(p.reise / p.takt) + 1; // Mindestabstand zwischen Zielpaketen (in Paketen)
  const mitte = Math.floor(n / 2);
  const arten = new Array(n).fill("normal");
  const haelften = [[2, mitte], [mitte, n]]; // die ersten zwei Pakete sind nie Ziel (ankommen lassen)

  for (const [von, bis] of haelften) {
    const plaetze = bis - von;
    const wunsch = Math.max(1, Math.round(plaetze * p.zielAnteil));
    const moeglich = Math.max(1, Math.floor((plaetze - 1) / abstand) + 1);
    const anzahl = Math.min(wunsch, moeglich);
    let gesetzt = [];
    for (let versuch = 0; versuch < 200 && gesetzt.length < anzahl; versuch++) {
      gesetzt = [];
      const kandidaten = [];
      for (let i = von; i < bis; i++) kandidaten.push(i);
      // zufällige Reihenfolge, dann gierig mit Mindestabstand (auch zur anderen Hälfte)
      for (let i = kandidaten.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [kandidaten[i], kandidaten[j]] = [kandidaten[j], kandidaten[i]];
      }
      for (const k of kandidaten) {
        if (gesetzt.length >= anzahl) break;
        const frei = arten.every((a, idx) => a !== "ziel" || Math.abs(idx - k) >= abstand)
          && gesetzt.every((g) => Math.abs(g - k) >= abstand);
        if (frei) gesetzt.push(k);
      }
    }
    if (gesetzt.length === 0) gesetzt = [Math.floor((von + bis) / 2)];
    for (const k of gesetzt) arten[k] = "ziel";
  }
  for (let i = 0; i < n; i++) {
    if (arten[i] === "normal" && rng() < p.ablenkerAnteil) arten[i] = "ablenker";
  }
  // leichte Unregelmäßigkeit im Takt (± 15 %), die Reihenfolge bleibt erhalten
  const pakete = arten.map((art, i) => ({
    t: Math.max(0, Math.round(i * p.takt + (rng() - 0.5) * 0.3 * p.takt)),
    art,
    haelfte: i < mitte ? 0 : 1,
  }));
  return { pakete, halbZeit: pakete[mitte].t, gesamtMs: pakete[n - 1].t + p.reise };
}

/** Welchem Paket gilt ein Tipp zur (aktiven) Zeit `zeit`? Nur sichtbare, noch nicht gemeldete Zielpakete zählen. */
export function ordneTipp(pakete, zeit, reise, gemeldet) {
  for (let i = 0; i < pakete.length; i++) {
    const pk = pakete[i];
    if (pk.art !== "ziel" || gemeldet.has(i)) continue;
    if (zeit >= pk.t && zeit <= pk.t + reise) return { art: "treffer", index: i, rt: zeit - pk.t };
  }
  // Tipp kurz nach einem bereits gemeldeten Ziel (noch sichtbar) → nur ein Doppeltipp, kein Fehlalarm
  for (const i of gemeldet) {
    const pk = pakete[i];
    if (zeit >= pk.t && zeit <= pk.t + reise) return { art: "doppelt", index: i };
  }
  return { art: "fehlalarm" };
}

const mittelwert = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/**
 * Auswertung inkl. Verlauf. treffer: Map(index → Reaktionszeit ms), fehlalarme: [aktive Zeit ms]
 */
export function auswertenWachsam(plan, treffer, fehlalarme) {
  const haelfte = [0, 1].map((hIdx) => {
    const ziele = plan.pakete.map((pk, i) => ({ pk, i })).filter(({ pk }) => pk.art === "ziel" && pk.haelfte === hIdx);
    const rts = ziele.filter(({ i }) => treffer.has(i)).map(({ i }) => treffer.get(i));
    const fa = fehlalarme.filter((z) => (hIdx === 0 ? z < plan.halbZeit : z >= plan.halbZeit)).length;
    return {
      ziele: ziele.length, treffer: rts.length, auslasser: ziele.length - rts.length, fehlalarme: fa,
      quote: ziele.length ? rts.length / ziele.length : 0, rtMittel: mittelwert(rts),
    };
  });
  const ziele = haelfte[0].ziele + haelfte[1].ziele;
  const tr = haelfte[0].treffer + haelfte[1].treffer;
  const fa = fehlalarme.length;

  // Verlauf: Trefferquote und Reaktionszeit der zweiten Hälfte mit der ersten vergleichen
  const [a, b] = haelfte;
  const quoteDiff = b.quote - a.quote;
  const rtDiff = a.rtMittel && b.rtMittel ? (b.rtMittel - a.rtMittel) / a.rtMittel : 0;
  const faDiff = b.fehlalarme - a.fehlalarme;
  let verlauf = "gleich";
  if (quoteDiff <= -0.2 || (quoteDiff <= 0 && (rtDiff > 0.2 || faDiff >= 2))) verlauf = "nachgelassen";
  else if (quoteDiff >= 0.2 || (quoteDiff >= 0 && rtDiff < -0.2 && faDiff <= 0)) verlauf = "besser";

  return {
    ziele, treffer: tr, auslasser: ziele - tr, fehlalarme: fa, haelfte, verlauf,
    score: ziele ? Math.max(0, Math.min(1, (tr - 0.5 * fa) / ziele)) : 0,
  };
}

export function verlaufText(verlauf) {
  if (verlauf === "nachgelassen") return "Gegen Ende ist die Aufmerksamkeit etwas gesunken – bei langen, gleichförmigen Aufgaben ist das ganz normal.";
  if (verlauf === "besser") return "In der zweiten Hälfte waren Sie sogar noch aufmerksamer als am Anfang.";
  return "Sie sind bis zum Schluss gleichmäßig aufmerksam geblieben.";
}

// ---------- Darstellung ----------

function paketSvg(art, klein) {
  const r = klein ? 8 : 12;
  let aufkleber = `<rect x="60" y="44" width="22" height="14" rx="2" class="au-wach-etikett"/>`;
  if (art === "ziel") aufkleber = `<circle cx="70" cy="50" r="${r}" class="au-wach-aufkleber"/><circle cx="70" cy="50" r="${r * 0.4}" class="au-wach-aufkleber-kern"/>`;
  if (art === "ablenker") aufkleber = `<rect x="${70 - r}" y="${50 - r}" width="${2 * r}" height="${2 * r}" rx="1.5" class="au-wach-aufkleber"/><rect x="${70 - r * 0.4}" y="${50 - r * 0.4}" width="${r * 0.8}" height="${r * 0.8}" class="au-wach-aufkleber-kern"/>`;
  return `<svg viewBox="0 0 100 80" aria-hidden="true">
    <rect x="6" y="14" width="88" height="62" rx="4" class="au-wach-karton"/>
    <path d="M6 14 L20 4 H80 L94 14Z" class="au-wach-deckel"/>
    <rect x="36" y="14" width="14" height="62" class="au-wach-band-klebe"/>
    <path d="M42 4 V14" class="au-wach-kante"/>
    ${aufkleber}
  </svg>`;
}

const HAKEN = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" class="au-wach-ok-kreis"/><path d="M11 21 l6 6 l12 -14" class="au-wach-ok-haken"/></svg>`;

function nachFrame() {
  return new Promise((r) => {
    let fertig = false;
    const f = () => { if (!fertig) { fertig = true; r(); } };
    requestAnimationFrame(f);
    setTimeout(f, 120);
  });
}

export default {
  id: "wachsam",
  bereich: "Aufmerksamkeit",
  titel: "Wachsam bleiben",
  icon: "",
  anleitung: (stufe) => {
    const p = wachsamParameter(stufe);
    const min = Math.round(p.dauerMs / 60000);
    return `Pakete fahren ruhig auf einem Band vorbei. Tippen Sie nur, wenn ein Paket einen RUNDEN Aufkleber hat${p.ablenkerAnteil ? " – eckige Aufkleber nicht" : ""}. Die Übung dauert etwa ${min} Minuten, zwischendurch dürfen Sie eine kurze Pause machen.`;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = wachsamParameter(stufe);
    // ctx.testDauerMs: NUR für automatische Tests; ctx.kurz: verkürzte Runde in der Einstufung
    const dauer = ctx.testDauerMs ?? (ctx.kurz ? Math.min(p.dauerMs, 150000) : p.dauerMs);
    const plan = planeWachsam(p, dauer);

    const info = h("p.hinweis", { text: "Gleich kommen die ersten Pakete …" });
    const fortschritt = h("div.au-wach-fortschritt", { role: "progressbar", "aria-label": "Fortschritt" }, h("div.au-wach-fortschritt-balken"));
    const band = h("div.au-wach-band");
    const szene = h("button.au-wach-szene", { "aria-label": "Förderband – hier tippen bei rundem Aufkleber" },
      h("div.au-wach-wand", {}, h("div.au-wach-fenster"), h("div.au-wach-fenster")),
      band,
      h("div.au-wach-rollen", {}, Array.from({ length: 9 }, () => h("span.au-wach-rolle"))));
    const vorlage = h("div.au-wach-vorlage", {},
      h("span.au-wach-vorlage-bild", { html: paketSvg("ziel", false) }),
      h("span", { text: "Tippen bei rundem Aufkleber" }));
    const pauseKnopf = h("button.knopf.gross", { text: `Kurze Pause (${p.pausen})` });
    const overlay = h("div.au-wach-pause", { hidden: true },
      h("p.hinweis.gross", { text: "Pause – atmen Sie kurz durch." }),
      h("button.knopf.gross.primaer.au-wach-weiter", { text: "Weiter" }));
    stage.append(info, vorlage, h("div.au-wach-rahmen", {}, szene, overlay), fortschritt, h("div.knopfreihe", {}, pauseKnopf));

    const gemeldet = new Set();
    const treffer = new Map();
    const fehlalarme = [];
    const elemente = new Map(); // index → Element
    const erledigt = new Set(); // Pakete, die das Band verlassen haben
    let aktiv = 0;             // aktive (nicht pausierte) Zeit in ms
    let pausiert = false;
    let pausenUebrig = p.pausen;

    const tipp = () => {
      if (pausiert) return;
      const e = ordneTipp(plan.pakete, aktiv, p.reise, gemeldet);
      if (e.art === "treffer") {
        gemeldet.add(e.index); treffer.set(e.index, e.rt);
        const el = elemente.get(e.index);
        if (el) el.append(h("span.au-wach-ok", { html: HAKEN }));
      } else if (e.art === "fehlalarm") {
        fehlalarme.push(aktiv);
        feedback(stage, "Da war kein runder Aufkleber", "neutral");
      }
    };
    szene.onclick = debounced(tipp);
    const taste = (e) => { if (e.key === " " && e.target === document.body) { e.preventDefault(); szene.click(); } };
    document.addEventListener("keydown", taste);

    pauseKnopf.onclick = debounced(() => {
      if (pausiert || pausenUebrig <= 0) return;
      pausenUebrig--; pausiert = true;
      pauseKnopf.textContent = `Kurze Pause (${pausenUebrig})`;
      pauseKnopf.disabled = true;
      overlay.hidden = false;
    });
    overlay.querySelector("button").onclick = debounced(() => {
      overlay.hidden = true; pausiert = false;
      pauseKnopf.disabled = pausenUebrig <= 0;
    });

    try {
      // kurzer Vorlauf
      const vorlauf = performance.now() + 1500;
      while (performance.now() < vorlauf) { if (!ctx.alive()) return null; await sleep(60); }
      info.textContent = "Achten Sie auf runde Aufkleber.";

      let letzt = performance.now();
      let naechstes = 0;
      let breite = band.clientWidth || 600;
      let letzteMinute = -1;
      while (aktiv < plan.gesamtMs) {
        await nachFrame();
        if (!ctx.alive()) return null;
        const jetzt = performance.now();
        const delta = Math.min(150, jetzt - letzt);
        letzt = jetzt;
        if (pausiert || document.hidden) continue;
        aktiv += delta;
        breite = band.clientWidth || breite;

        // neue Pakete aufs Band legen
        while (naechstes < plan.pakete.length && plan.pakete[naechstes].t <= aktiv) {
          const pk = plan.pakete[naechstes];
          const el = h("div.au-wach-paket", { html: paketSvg(pk.art, p.kleinerAufkleber) });
          band.append(el);
          elemente.set(naechstes, el);
          naechstes++;
        }
        // Pakete bewegen, verlassene entfernen (Auslasser still vermerken)
        for (const [i, el] of elemente) {
          const pk = plan.pakete[i];
          const f = (aktiv - pk.t) / p.reise;
          if (f > 1) {
            el.remove(); elemente.delete(i); erledigt.add(i);
            if (pk.art === "ziel" && !gemeldet.has(i) && stufe <= 5) feedback(stage, "Ein rundes ist durchgerutscht – weiter geht's", "neutral");
            continue;
          }
          el.style.left = `${-18 + f * 118}%`;
        }
        // Bandoberfläche läuft mit der gleichen Geschwindigkeit mit
        band.style.backgroundPositionX = `${(aktiv / p.reise) * breite * 1.18}px`;
        fortschritt.firstChild.style.width = `${Math.min(100, (aktiv / plan.gesamtMs) * 100)}%`;
        const restMin = Math.ceil((plan.gesamtMs - aktiv) / 60000);
        if (restMin !== letzteMinute) {
          letzteMinute = restMin;
          info.textContent = restMin <= 1 ? "Noch etwa eine Minute – gleich geschafft." : `Achten Sie auf runde Aufkleber. Noch etwa ${restMin} Minuten.`;
        }
      }
    } finally {
      document.removeEventListener("keydown", taste);
      szene.onclick = null;
    }
    if (!ctx.alive()) return null;

    const e = auswertenWachsam(plan, treffer, fehlalarme);

    // Auswertung mit Verlauf (erste gegen zweite Hälfte)
    stage.replaceChildren();
    const balken = (titel, hf) => h("div.au-verlauf-zeile", {},
      h("span.au-verlauf-titel", { text: titel }),
      h("span.au-verlauf-spur", {}, h("span.au-verlauf-balken", { style: { width: `${Math.round(hf.quote * 100)}%` } })),
      h("span.au-verlauf-wert", { text: `${hf.treffer} von ${hf.ziele}` }));
    const zeilen = [
      `Entdeckt: ${e.treffer} von ${e.ziele} Paketen mit rundem Aufkleber`,
      e.auslasser ? `Durchgerutscht: ${e.auslasser}` : "Keines ist durchgerutscht",
      e.fehlalarme ? `Ohne runden Aufkleber getippt: ${e.fehlalarme}-mal` : "Kein einziges Mal unnötig getippt",
    ];
    stage.append(
      h("p.hinweis.gross", { text: "Geschafft – so ist es gelaufen" }),
      h("div.au-verlauf", {},
        h("ul.au-verlauf-liste", {}, zeilen.map((z) => h("li", { text: z }))),
        balken("Erste Hälfte", e.haelfte[0]),
        balken("Zweite Hälfte", e.haelfte[1]),
        h("p.au-verlauf-satz", { text: verlaufText(e.verlauf) })));
    const ok = await wartenAuf(ctx, (fertig) => {
      stage.append(h("div.knopfreihe", {}, h("button.knopf.gross.primaer", { text: "Weiter", onclick: debounced(() => fertig(true)) })));
    });
    if (ok == null || !ctx.alive()) return null;

    let text = `${e.treffer} von ${e.ziele} runden Aufklebern entdeckt`;
    text += e.fehlalarme ? `, ${e.fehlalarme}-mal ohne Grund getippt.` : ".";
    text += " " + verlaufText(e.verlauf);
    return { score: e.score, text };
  },
};
