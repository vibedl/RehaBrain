// Visuomotorik: Im Takt tippen – erst mit sichtbarem Takt mittippen, dann den Takt ohne Vorgabe halten
import { h, debounced } from "../core/ui.js";
import {
  klemme, mittelwert, median, stufenwert, variationskoeffizient, merkeBest, leseBest, warte, warteAuf, ton,
} from "./vm-kern.js";

// ---------- Reine Logik (testbar) ----------

const GRUNDTEMPO = [60, 66, 72, 80, 88, 96, 104, 112, 60, 72, 84, 96, 104, 112, 60, 72, 88, 100, 112, 120];

export function rhythmusParameter(stufe) {
  const s = klemme(Math.round(stufe), 1, 20);
  const bpm = GRUNDTEMPO[s - 1];
  // ab Stufe 15 wechseln die Blöcke zwischen langsam, mittel und schnell (40–120 Schläge pro Minute)
  const bloecke = s >= 15 ? [bpm, Math.round(stufenwert(s, 60, 40)), Math.min(120, bpm + 16)] : [bpm, bpm, bpm];
  return {
    bloecke,
    vorgabe: Math.round(stufenwert(s, 12, 8)),     // Schläge mit sichtbarem Takt
    frei: Math.round(stufenwert(s, 4, 20)),        // Schläge ohne Vorgabe
    wechselseitig: s >= 9,                         // links und rechts abwechselnd
    toleranz: stufenwert(s, 0.32, 0.15),           // Anteil des Schlagabstands, ab dem deutlich abgezogen wird
  };
}

/**
 * Mittippen mit Vorgabe: jedem Schlag den nächsten Tipp (±halber Abstand) zuordnen.
 * schlaege, tipps: Zeitpunkte in ms. Liefert Abweichungen (Tipp minus Schlag, negativ = zu früh).
 */
export function synchronAuswertung(schlaege, tipps, T) {
  const frei = [...tipps].sort((a, b) => a - b);
  const benutzt = new Set();
  const abw = [];
  for (const b of schlaege) {
    let best = -1, bd = Infinity;
    frei.forEach((t, i) => { if (!benutzt.has(i) && Math.abs(t - b) < bd) { bd = Math.abs(t - b); best = i; } });
    if (best >= 0 && bd <= T / 2) { benutzt.add(best); abw.push(frei[best] - b); }
  }
  return {
    abweichungen: abw,
    trefferquote: schlaege.length ? abw.length / schlaege.length : 0,
    mittlereAbwMs: abw.length ? mittelwert(abw.map(Math.abs)) : T / 2,
    tendenzMs: abw.length ? median(abw) : 0,
  };
}

/**
 * Takt halten ohne Vorgabe: Tipp-Abstände (ITI). Zu kurze Abstände (< 0,45 T, Doppeltipp) werden verworfen,
 * ausgelassene Schläge (ITI ≈ 2T oder 3T) aufgeteilt und gezählt.
 */
export function fortsetzungAuswertung(tipps, T, erwartet) {
  const t = [...tipps].sort((a, b) => a - b);
  const sauber = [];
  for (const x of t) if (!sauber.length || x - sauber[sauber.length - 1] >= 0.45 * T) sauber.push(x);
  const iti = [];
  let ausgelassen = 0;
  for (let i = 1; i < sauber.length; i++) {
    const d = sauber[i] - sauber[i - 1];
    const k = Math.max(1, Math.round(d / T));
    if (k > 3) continue; // lange Pause: nicht als Rhythmus werten
    ausgelassen += k - 1;
    for (let j = 0; j < k; j++) iti.push(d / k);
  }
  const mittel = iti.length ? mittelwert(iti) : 0;
  return {
    iti, mittelMs: mittel, ausgelassen,
    tempoAbw: mittel ? (mittel - T) / T : 1,     // + = langsamer geworden, − = schneller geworden
    cv: iti.length >= 2 ? variationskoeffizient(iti) : 1,
    abdeckung: erwartet ? klemme((iti.length - ausgelassen) / erwartet) : 0,
  };
}

export function blockScore(sync, frei, T, toleranz) {
  const a = sync.mittlereAbwMs / T;
  const syncWert = sync.trefferquote * klemme(1 - Math.max(0, a - 0.06) / toleranz);
  const tempoWert = klemme(1 - Math.abs(frei.tempoAbw) / toleranz);
  const gleichWert = klemme(1 - Math.max(0, frei.cv - 0.05) / toleranz);
  const freiWert = frei.abdeckung * (0.5 * tempoWert + 0.5 * gleichWert);
  return { syncWert, tempoWert, gleichWert, freiWert, score: klemme(0.5 * syncWert + 0.5 * freiWert) };
}

// ---------- Darstellung ----------

export default {
  id: "rhythmus",
  bereich: "Visuomotorik",
  titel: "Im Takt tippen",
  icon: "",
  anleitung: (stufe) => rhythmusParameter(stufe).wechselseitig
    ? "Der Kreis pulsiert im Takt. Tippen Sie im Takt mit, abwechselnd links und rechts – die leuchtende Fläche ist dran. Wenn der Kreis stillsteht, halten Sie den Takt allein weiter."
    : "Der Kreis pulsiert im Takt. Tippen Sie im Takt mit auf die große Fläche. Wenn der Kreis stillsteht, halten Sie den Takt allein weiter.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = rhythmusParameter(stufe);
    const info = h("p.hinweis.gross", { text: "Gleich geht es los" });
    const unter = h("p.hinweis", { text: "" });
    const puls = h("div.vm-rhy-puls", { "aria-hidden": "true" }, h("div.vm-rhy-kern"));
    const flaechen = p.wechselseitig
      ? [h("button.vm-rhy-flaeche", { "aria-label": "Linke Tippfläche" }, h("span", { text: "Links" })),
         h("button.vm-rhy-flaeche", { "aria-label": "Rechte Tippfläche" }, h("span", { text: "Rechts" }))]
      : [h("button.vm-rhy-flaeche", { "aria-label": "Tippfläche" }, h("span", { text: "Hier tippen" }))];
    const feld = h("div.vm-rhy-feld" + (p.wechselseitig ? ".vm-rhy-zwei" : ""), {}, flaechen);
    let tonAn = !!ctx.settings?.vmTon;
    const tonKnopf = h("button.knopf", { text: tonAn ? "Leiser Ton: an" : "Leiser Ton: aus", "aria-pressed": String(tonAn) });
    let audio = null;
    tonKnopf.onclick = debounced(() => {
      tonAn = !tonAn;
      if (ctx.settings) ctx.settings.vmTon = tonAn;
      tonKnopf.textContent = tonAn ? "Leiser Ton: an" : "Leiser Ton: aus";
      tonKnopf.setAttribute("aria-pressed", String(tonAn));
      if (tonAn && !audio) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch { audio = null; } }
    });
    if (tonAn) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch { audio = null; } }
    stage.append(info, puls, unter, feld, h("div.knopfreihe", {}, tonKnopf));

    // Tipps sammeln (pointerdown = Moment des Aufsetzens, das ist für Rhythmus entscheidend)
    let tipps = [];      // { t, seite }
    let sperre = 250;
    const letzte = [-Infinity, -Infinity];
    const tippe = (seite, t) => {
      if (t - letzte[seite] < sperre) return; // Zittern auf derselben Fläche
      letzte[seite] = t;
      tipps.push({ t, seite });
      const f = flaechen[seite];
      f.classList.remove("vm-rhy-getippt"); void f.offsetWidth; f.classList.add("vm-rhy-getippt");
    };
    const handler = flaechen.map((f, i) => (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      tippe(i, e.timeStamp || performance.now());
    });
    flaechen.forEach((f, i) => f.addEventListener("pointerdown", handler[i]));
    const taste = (e) => {
      if (e.repeat) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); tippe(0, performance.now()); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); tippe(0, performance.now()); }
      else if (e.key === "ArrowRight") { e.preventDefault(); tippe(p.wechselseitig ? 1 : 0, performance.now()); }
    };
    document.addEventListener("keydown", taste);

    const ergebnisse = [];
    try {
      if (!(await warte(ctx, 1200))) return null;
      for (let b = 0; b < p.bloecke.length; b++) {
        const bpm = p.bloecke[b], T = 60000 / bpm;
        sperre = Math.min(300, T * 0.4);
        const einzaehlen = 2;
        const gesamt = einzaehlen + p.vorgabe + p.frei;
        info.textContent = `Takt ${b + 1} von ${p.bloecke.length}: erst zuschauen`;
        unter.textContent = `${bpm} Schläge pro Minute`;
        tipps = [];
        puls.classList.remove("vm-rhy-still");

        const t0 = performance.now() + 600;
        const schlagZeit = (k) => t0 + k * T;
        const lauf = await warteAuf(ctx, (fertig) => {
          let k = 0, raf = 0;
          const schritt = () => {
            const jetzt = performance.now();
            while (k < gesamt && jetzt >= schlagZeit(k)) {
              const seite = p.wechselseitig ? (k % 2) : 0;
              if (k < einzaehlen + p.vorgabe) {
                puls.classList.remove("vm-rhy-schlag"); void puls.offsetWidth; puls.classList.add("vm-rhy-schlag");
                if (tonAn) ton(audio, k % 4 === 0 ? 740 : 620);
              }
              flaechen.forEach((f, i) => f.classList.toggle("vm-rhy-dran", p.wechselseitig && i === (seite + 1) % 2 && k + 1 < gesamt));
              if (k === einzaehlen) info.textContent = `Takt ${b + 1} von ${p.bloecke.length}: jetzt mittippen`;
              if (k === einzaehlen + p.vorgabe) {
                puls.classList.add("vm-rhy-still");
                info.textContent = "Jetzt ohne Vorgabe weiter";
              }
              k++;
            }
            if (k >= gesamt && jetzt >= schlagZeit(gesamt) - T * 0.4) { fertig(true); return; }
            raf = requestAnimationFrame(schritt);
          };
          raf = requestAnimationFrame(schritt);
          return () => cancelAnimationFrame(raf);
        });
        if (lauf == null || !ctx.alive()) return null;
        flaechen.forEach((f) => f.classList.remove("vm-rhy-dran"));

        // Auswertung des Blocks
        const synchronSchlaege = Array.from({ length: p.vorgabe }, (_, i) => schlagZeit(einzaehlen + i));
        const grenze = schlagZeit(einzaehlen + p.vorgabe) - T / 2;
        const sync = synchronAuswertung(synchronSchlaege, tipps.filter((x) => x.t < grenze).map((x) => x.t), T);
        // Ohne Vorgabe: letzter Tipp der Vorgabephase dient als Anker
        const vorher = tipps.filter((x) => x.t < grenze);
        const nachher = tipps.filter((x) => x.t >= grenze).map((x) => x.t);
        const anker = vorher.length ? [vorher[vorher.length - 1].t] : [];
        const frei = fortsetzungAuswertung([...anker, ...nachher], T, p.frei);
        let seitenfehler = 0;
        if (p.wechselseitig) {
          const zuordnung = tipps.slice().sort((x, y) => x.t - y.t);
          for (let i = 1; i < zuordnung.length; i++) if (zuordnung[i].seite === zuordnung[i - 1].seite) seitenfehler++;
        }
        const bs = blockScore(sync, frei, T, p.toleranz);
        const seitenAbzug = p.wechselseitig && tipps.length > 1 ? klemme(1 - seitenfehler / (tipps.length - 1)) : 1;
        ergebnisse.push({ T, bpm, sync, frei, ...bs, score: bs.score * (0.8 + 0.2 * seitenAbzug), seitenfehler });

        puls.classList.add("vm-rhy-still");
        info.textContent = tipps.length < 3 ? "Kurze Pause" : (bs.score >= 0.75 ? "Schön im Takt – kurze Pause" : "Gut gemacht – kurze Pause");
        if (!(await warte(ctx, 2200))) return null;
      }
    } finally {
      flaechen.forEach((f, i) => f.removeEventListener("pointerdown", handler[i]));
      document.removeEventListener("keydown", taste);
      if (audio) { try { audio.close(); } catch { /* egal */ } }
    }
    if (!ctx.alive()) return null;

    const score = klemme(mittelwert(ergebnisse.map((e) => e.score)));
    const abwMs = mittelwert(ergebnisse.map((e) => e.sync.mittlereAbwMs));
    const tempoAbw = mittelwert(ergebnisse.map((e) => e.frei.tempoAbw));
    const cv = mittelwert(ergebnisse.map((e) => e.frei.cv));
    const neu = merkeBest(ctx.bests, "rhythmus", `abwMs${ergebnisse[0].bpm}`, abwMs, true);
    const best = leseBest(ctx.bests, "rhythmus", `abwMs${ergebnisse[0].bpm}`);
    let text = `Mit Vorgabe im Mittel ${Math.round(abwMs)} ms neben dem Takt.`;
    const prozent = Math.round(Math.abs(tempoAbw) * 100);
    text += prozent <= 5 ? " Ohne Vorgabe das Tempo gut gehalten" : ` Ohne Vorgabe ${prozent} % ${tempoAbw > 0 ? "langsamer" : "schneller"} geworden`;
    text += cv <= 0.1 ? ", sehr gleichmäßig." : cv <= 0.2 ? ", recht gleichmäßig." : ", noch etwas unregelmäßig.";
    if (neu) text += " Neue persönliche Bestleistung!";
    else if (best && abwMs > best * 1.6) text += " Heute etwas schwerer als sonst – das ist in Ordnung.";
    return { score, text };
  },
};
