// Sehen & Raum: Randsicht – Blick bleibt in der Mitte, kurze Lichtreize am Rand des Sehfelds wahrnehmen.
// Adaptiv je Richtung (Treppenverfahren). Ausdrücklich KEINE Perimetrie und keine Diagnose.
import { h, sleep, feedback, onTap } from "../core/ui.js";
import { kalibrierungNoetig, zeigeKalibrierung, gradZuPx, pxZuGrad } from "../core/sehabstand.js";

// ---------- Reine Logik (testbar) ----------

export const SEKTOREN = [
  { id: "rechts", winkel: 0, name: "rechts" },
  { id: "rechts-oben", winkel: 45, name: "rechts oben" },
  { id: "oben", winkel: 90, name: "oben" },
  { id: "links-oben", winkel: 135, name: "links oben" },
  { id: "links", winkel: 180, name: "links" },
  { id: "links-unten", winkel: 225, name: "links unten" },
  { id: "unten", winkel: 270, name: "unten" },
  { id: "rechts-unten", winkel: 315, name: "rechts unten" },
];
export const SEITEN = [
  { id: "beide", text: "Rundum, alle Seiten gleich" },
  { id: "links", text: "Links mehr üben" },
  { id: "rechts", text: "Rechts mehr üben" },
];

const klemme = (x, a, b) => Math.max(a, Math.min(b, x));

export function randParameter(stufe) {
  const s = klemme(Math.round(stufe), 1, 20);
  const sektorAnzahl = s <= 6 ? 2 : s <= 12 ? 4 : 8;
  return {
    sektorAnzahl,
    reize: sektorAnzahl === 2 ? 26 : sektorAnzahl === 4 ? 32 : 40,
    dauer: Math.round(600 - (s - 1) * 25),                 // Anzeigedauer des Lichts in ms: 600 … 125
    groesseGrad: Math.round((1.8 - (s - 1) * 0.06) * 100) / 100, // Durchmesser in Grad: 1,8 … 0,66
    helligkeit: s <= 10 ? 1 : Math.round((1 - (s - 10) * 0.05) * 100) / 100, // 1 … 0,5
    antwortMs: Math.max(1500, 2600 - s * 50),              // großzügiges Antwortfenster (Verlangsamung)
    fixDauer: Math.max(280, 700 - s * 20),                 // so lange ist die Mitte verändert
    zeigeVerpasst: true,
  };
}

/** Welche Richtungen auf dieser Stufe geübt werden */
export function sektorenFuer(stufe) {
  const n = randParameter(stufe).sektorAnzahl;
  const ids = n === 2 ? ["links", "rechts"] : n === 4 ? ["rechts", "oben", "links", "unten"] : SEKTOREN.map((s) => s.id);
  return SEKTOREN.filter((s) => ids.includes(s.id));
}

/** Gewicht einer Richtung je nach gewählter Seite */
export function sektorGewicht(sektor, seite) {
  if (seite === "links") return sektor.id.startsWith("links") ? 2 : 1;
  if (seite === "rechts") return sektor.id.startsWith("rechts") ? 2 : 1;
  return 1;
}

/**
 * Ablaufplan: Liste von Ereignissen { art: "reiz", sektor } | { art: "leer" } | { art: "mitte" }
 * – Reize nach Gewicht verteilt, dazu etwa 12 % Leerdurchgänge und 12 % Mitte-Kontrollen, gemischt.
 */
export function planeDurchgang(stufe, seite = "beide", rng = Math.random) {
  const p = randParameter(stufe);
  const sek = sektorenFuer(stufe);
  const gesamtGewicht = sek.reduce((a, s) => a + sektorGewicht(s, seite), 0);
  const plan = [];
  // gewichtete, möglichst gleichmäßige Verteilung (größter Rest)
  const anteile = sek.map((s) => ({ s, roh: (p.reize * sektorGewicht(s, seite)) / gesamtGewicht }));
  anteile.forEach((a) => { a.n = Math.floor(a.roh); });
  let rest = p.reize - anteile.reduce((x, a) => x + a.n, 0);
  [...anteile].sort((a, b) => (b.roh - b.n) - (a.roh - a.n)).forEach((a) => { if (rest > 0) { a.n++; rest--; } });
  anteile.forEach((a) => { for (let i = 0; i < a.n; i++) plan.push({ art: "reiz", sektor: a.s.id }); });
  const extra = Math.max(2, Math.round(p.reize * 0.12));
  for (let i = 0; i < extra; i++) { plan.push({ art: "leer" }); plan.push({ art: "mitte" }); }
  for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }
  // nicht mit einer Kontrolle beginnen – erst ein Reiz zum Eingewöhnen
  const erster = plan.findIndex((e) => e.art === "reiz");
  if (erster > 0) [plan[0], plan[erster]] = [plan[erster], plan[0]];
  return plan;
}

/**
 * Treppenverfahren (1 hoch / 1 runter): gesehen → weiter nach außen, nicht gesehen → weiter nach innen.
 * Schrittweite halbiert sich bei jeder Richtungsumkehr. Pendelt sich um die Wahrnehmungsgrenze ein.
 */
export function neueTreppe(startGrad, maxGrad, { schritt = 4, minSchritt = 1, minGrad = 2 } = {}) {
  const min = Math.min(minGrad, maxGrad / 2);
  return { wert: klemme(startGrad, min, maxGrad), min, max: maxGrad, schritt, minSchritt, richtung: 0, umkehr: [], versuche: 0, gesehen: 0, amRandGesehen: 0 };
}

export function treppeSchritt(t, gesehen) {
  const richtung = gesehen ? 1 : -1;
  if (t.richtung && richtung !== t.richtung) {
    t.umkehr.push(t.wert);
    t.schritt = Math.max(t.minSchritt, t.schritt / 2);
  }
  t.richtung = richtung;
  t.versuche++;
  if (gesehen) { t.gesehen++; if (t.wert >= t.max - 1e-9) t.amRandGesehen++; }
  t.wert = klemme(t.wert + richtung * t.schritt, t.min, t.max);
  return t;
}

/** Geschätzte Grenze in Grad (Mittel der letzten bis zu 4 Umkehrpunkte), null ohne Versuche */
export function treppeSchaetzung(t) {
  if (!t.versuche) return null;
  if (t.amRandGesehen >= 2 && t.wert >= t.max - 1e-9) return t.max;
  const u = t.umkehr.slice(-4);
  const w = u.length >= 2 ? u.reduce((a, b) => a + b, 0) / u.length : t.wert;
  return Math.round(klemme(w, t.min, t.max) * 10) / 10;
}

/** Größter nutzbarer Sehwinkel in einer Richtung, damit der Reiz ganz im Feld bleibt */
export function maxGradRichtung(winkel, halbBreitePx, halbHoehePx, reizRadiusPx, kalib, randPx = 10) {
  const rad = (winkel * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const nutzB = halbBreitePx - reizRadiusPx - randPx, nutzH = halbHoehePx - reizRadiusPx - randPx;
  const px = Math.min(c > 1e-6 ? nutzB / c : Infinity, s > 1e-6 ? nutzH / s : Infinity);
  return Math.max(0.5, Math.round(pxZuGrad(Math.max(1, px), kalib) * 10) / 10);
}

/** Position des Reizes relativ zur Mitte (x nach rechts, y nach unten) */
export function reizVersatz(winkel, grad, kalib) {
  const r = gradZuPx(grad, kalib), rad = (winkel * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: -Math.sin(rad) * r };
}

/** „gesehen“, wenn die Grenze nahe am nutzbaren Rand liegt, sonst „unsicher“ ab der Grenze */
export const sektorStatus = (grenze, max) => (grenze == null ? "offen" : grenze >= max * 0.85 ? "gesehen" : "unsicher");

/** Grenzen im Profil ablegen: bests.randsicht.verlauf[sektor] = letzte 10 { datum, grad, max } */
export function speichereGrenzen(bests, ergebnisse, seite, datum = new Date().toISOString().slice(0, 10)) {
  const r = (bests.randsicht && typeof bests.randsicht === "object") ? bests.randsicht : {};
  r.seite = seite;
  r.verlauf = r.verlauf ?? {};
  for (const e of ergebnisse) {
    if (e.grenze == null) continue;
    const liste = Array.isArray(r.verlauf[e.sektor]) ? r.verlauf[e.sektor] : [];
    liste.push({ datum, grad: e.grenze, max: e.max });
    r.verlauf[e.sektor] = liste.slice(-10);
  }
  bests.randsicht = r;
  return r;
}

/** Letzte gespeicherte Grenze einer Richtung (oder null) */
export function letzteGrenze(bests, sektor) {
  const l = bests?.randsicht?.verlauf?.[sektor];
  return Array.isArray(l) && l.length ? l[l.length - 1].grad : null;
}

/** Score: 60 % Weite (Grenze relativ zum nutzbaren Rand), 40 % Blick-in-der-Mitte-Kontrolle */
export function randScore(ergebnisse, kontrolle) {
  const mit = ergebnisse.filter((e) => e.grenze != null);
  const weite = mit.length ? mit.reduce((a, e) => a + Math.min(1, e.grenze / e.max), 0) / mit.length : 0;
  const n = kontrolle.mitteGesamt + kontrolle.leerGesamt;
  const zuverl = n ? (kontrolle.mitteTreffer + (kontrolle.leerGesamt - kontrolle.leerFehl)) / n : 1;
  return Math.max(0, Math.min(1, 0.6 * weite + 0.4 * zuverl));
}

const zahlDE = (v) => String(Math.round(v)).replace(".", ",");

/** Einfache Sehfeld-Skizze als SVG-Text: Kreis mit Sektoren, innen „gesehen“, außen „unsicher“ */
export function skizzeSVG(ergebnisse, { groesse = 320 } = {}) {
  const c = groesse / 2, R = c - 34;
  const maxAll = Math.max(1, ...ergebnisse.map((e) => e.max));
  const breite = ergebnisse.length <= 2 ? 90 : ergebnisse.length <= 4 ? 70 : 42; // Keilbreite in Grad
  const pt = (winkel, r) => {
    const a = (winkel * Math.PI) / 180;
    return `${(c + Math.cos(a) * r).toFixed(1)},${(c - Math.sin(a) * r).toFixed(1)}`;
  };
  const keil = (winkel, r0, r1) => {
    const a0 = winkel - breite / 2, a1 = winkel + breite / 2;
    // SVG-Winkel laufen im Uhrzeigersinn, unsere gegen den Uhrzeigersinn → sweep-flag 0 für a0→a1
    return `M${pt(a0, r0)} L${pt(a0, r1)} A${r1.toFixed(1)},${r1.toFixed(1)} 0 0 0 ${pt(a1, r1)} L${pt(a1, r0)}`
      + (r0 > 0 ? ` A${r0.toFixed(1)},${r0.toFixed(1)} 0 0 1 ${pt(a0, r0)}` : "") + " Z";
  };
  let s = `<svg viewBox="0 0 ${groesse} ${groesse}" class="sv-rand-skizze" role="img" aria-label="Skizze: wo das Licht gesehen wurde">`;
  s += `<circle cx="${c}" cy="${c}" r="${R}" class="sv-rand-sk-kreis"/>`;
  s += `<circle cx="${c}" cy="${c}" r="${(R / 2).toFixed(1)}" class="sv-rand-sk-hilfs"/>`;
  s += `<path d="M${c - R} ${c}H${c + R}M${c} ${c - R}V${c + R}" class="sv-rand-sk-hilfs"/>`;
  for (const e of ergebnisse) {
    const sek = SEKTOREN.find((x) => x.id === e.sektor);
    const rMax = (e.max / maxAll) * R;
    const rG = e.grenze == null ? 0 : (Math.min(e.grenze, e.max) / maxAll) * R;
    s += `<path d="${keil(sek.winkel, 0, rMax)}" class="sv-rand-sk-unsicher"/>`;
    if (rG > 0) s += `<path d="${keil(sek.winkel, 0, rG)}" class="sv-rand-sk-gesehen"/>`;
    const [lx, ly] = pt(sek.winkel, R + 18).split(",");
    s += `<text x="${lx}" y="${(+ly + 5).toFixed(1)}" text-anchor="middle" class="sv-rand-sk-text">${e.grenze == null ? "–" : zahlDE(e.grenze) + "°"}</text>`;
  }
  s += `<circle cx="${c}" cy="${c}" r="5" class="sv-rand-sk-mitte"/>`;
  return s + "</svg>";
}

// ---------- Übung ----------

/** Wartet auf Tipp auf einen der Knöpfe; null bei Abbruch */
function warteAufWahl(ctx, knoepfe) {
  return new Promise((resolve) => {
    const warte = setInterval(() => { if (!ctx.alive()) { clearInterval(warte); resolve(null); } }, 300);
    knoepfe.forEach(([el, wert]) => onTap(el, () => { clearInterval(warte); resolve(wert); }));
  });
}

export default {
  id: "randsicht",
  bereich: "Sehen & Raum",
  titel: "Randsicht",
  icon: "",
  anleitung: (stufe) => {
    let t = "Schauen Sie die ganze Zeit auf den Punkt in der Mitte. Blitzt am Rand ein Licht auf, tippen Sie auf „Licht gesehen“ oder drücken die Leertaste.";
    t += " Wird der Punkt in der Mitte kurz eckig, tippen Sie auf „Mitte verändert“ oder drücken Enter.";
    if (stufe <= 6) t += " Geübt wird zuerst links und rechts.";
    return t + " Das ist ein Training, kein Sehtest.";
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = randParameter(stufe);

    // ---- Kalibrierung & Seitenwahl ----
    if (kalibrierungNoetig(ctx.bests)) {
      const k = await zeigeKalibrierung(stage, ctx.bests, { alive: ctx.alive });
      if (!k || !ctx.alive()) return null;
    }
    let seite = SEITEN.some((s) => s.id === ctx.bests.randsicht?.seite) ? ctx.bests.randsicht.seite : "beide";
    for (;;) {
      stage.replaceChildren();
      const kal = ctx.bests.sehkalibrierung;
      const seitenKnoepfe = SEITEN.map((s) => h("button.knopf.option" + (s.id === seite ? ".aktiv" : ""), {
        text: s.text, role: "radio", "aria-checked": String(s.id === seite),
      }));
      const neu = h("button.knopf", { text: "Bildschirm neu vermessen" });
      const los = h("button.knopf.gross.primaer", { text: "Start" });
      stage.append(
        h("p.hinweis.gross", { text: "Welche Seite möchten Sie üben?" }),
        h("div.knopfreihe", { role: "radiogroup", "aria-label": "Seite" }, seitenKnoepfe),
        h("p.leise-text.sv-rand-text", { text: `Sitzabstand: ${kal.abstandCm} cm${kal.geschaetzt ? " (Bildschirmgröße geschätzt)" : ""}. Bleiben Sie möglichst so sitzen, Kopf ruhig halten.` }),
        h("p.leise-text.sv-rand-text", { text: "Tipp: Mit der Leertaste antworten – dann verdeckt die Hand nichts auf dem Bildschirm." }),
        h("div.knopfreihe", {}, neu, los));
      const wahl = await warteAufWahl(ctx, [...seitenKnoepfe.map((b, i) => [b, SEITEN[i].id]), [neu, "neu"], [los, "los"]]);
      if (wahl == null || !ctx.alive()) return null;
      if (wahl === "los") break;
      if (wahl === "neu") {
        const k = await zeigeKalibrierung(stage, ctx.bests, { alive: ctx.alive });
        if (!k || !ctx.alive()) return null;
      } else seite = wahl;
    }
    const kalib = ctx.bests.sehkalibrierung;

    // ---- Spielfeld ----
    stage.replaceChildren();
    const fix = h("div.sv-rand-fix", { "aria-hidden": "true" });
    const reiz = h("div.sv-rand-reiz", { "aria-hidden": "true" });
    const ring = h("div.sv-rand-ring", { "aria-hidden": "true" });
    const feld = h("div.sv-rand-feld", { role: "application", "aria-label": "Sehfeld – auf die Mitte schauen" }, fix, reiz, ring);
    const info = h("p.hinweis", { text: "Blick auf die Mitte" });
    const knopfGesehen = h("button.knopf.riesig.sv-rand-gesehen", { text: "Licht gesehen" });
    const knopfMitte = h("button.knopf.gross.sv-rand-mitte", { text: "Mitte verändert" });
    stage.append(info, feld, h("div.sv-rand-antworten", {}, knopfGesehen, knopfMitte));
    await sleep(50);
    if (!ctx.alive()) return null;

    const rahmen = feld.getBoundingClientRect();
    const halbB = rahmen.width / 2, halbH = rahmen.height / 2;
    const reizDurchmesser = Math.max(8, Math.round(gradZuPx(p.groesseGrad, kalib)));
    reiz.style.width = reiz.style.height = reizDurchmesser + "px";
    reiz.style.opacity = "0";
    const reizHelligkeit = String(p.helligkeit);

    const sektoren = sektorenFuer(stufe);
    const treppen = new Map(sektoren.map((s) => {
      const max = maxGradRichtung(s.winkel, halbB, halbH, reizDurchmesser / 2, kalib);
      const vorher = letzteGrenze(ctx.bests, s.id);
      const start = vorher != null ? vorher - 2 : Math.min(10, max * 0.6);
      return [s.id, neueTreppe(start, max)];
    }));

    // ---- Antworten (Knöpfe, Tipp aufs Feld, Tasten) ----
    let antwort = null;      // { art: "gesehen"|"mitte", t }
    let letzteAntwort = -Infinity;
    const antworte = (art) => {
      const jetzt = performance.now();
      if (jetzt - letzteAntwort < 300) return; // Zittern: Mehrfach-Tipps zählen einmal
      letzteAntwort = jetzt;
      antwort = { art, t: jetzt };
      const knopf = art === "gesehen" ? knopfGesehen : knopfMitte;
      knopf.classList.add("sv-rand-gedrueckt");
      setTimeout(() => knopf.classList.remove("sv-rand-gedrueckt"), 180);
    };
    knopfGesehen.addEventListener("click", () => antworte("gesehen"));
    knopfMitte.addEventListener("click", () => antworte("mitte"));
    feld.addEventListener("click", () => antworte("gesehen"));
    const tasten = (e) => {
      if (!ctx.alive()) return;
      if (e.key === " " || e.code === "Space") { e.preventDefault(); antworte("gesehen"); }
      else if (e.key === "Enter" || e.key === "m" || e.key === "M") { e.preventDefault(); antworte("mitte"); }
    };
    document.addEventListener("keydown", tasten);
    const aufraeumen = () => document.removeEventListener("keydown", tasten);

    const kontrolle = { mitteGesamt: 0, mitteTreffer: 0, leerGesamt: 0, leerFehl: 0 };
    const plan = planeDurchgang(stufe, seite);

    try {
      info.textContent = "Blick auf die Mitte – gleich geht es los";
      await sleep(1800);
      for (let i = 0; i < plan.length; i++) {
        if (!ctx.alive()) return null;
        const ev = plan[i];
        info.textContent = `Blick auf die Mitte · ${i + 1} von ${plan.length}`;
        await sleep(1100 + Math.random() * 1300);
        if (!ctx.alive()) return null;

        antwort = null;
        const start = performance.now();
        let pos = null, treppe = null;
        if (ev.art === "reiz") {
          treppe = treppen.get(ev.sektor);
          const sek = SEKTOREN.find((s) => s.id === ev.sektor);
          pos = reizVersatz(sek.winkel, treppe.wert, kalib);
          reiz.style.left = `calc(50% + ${pos.x.toFixed(1)}px)`;
          reiz.style.top = `calc(50% + ${pos.y.toFixed(1)}px)`;
          reiz.style.opacity = reizHelligkeit;
          setTimeout(() => { reiz.style.opacity = "0"; }, p.dauer);
        } else if (ev.art === "mitte") {
          fix.classList.add("sv-rand-fix-anders");
          setTimeout(() => fix.classList.remove("sv-rand-fix-anders"), p.fixDauer);
        }
        // Antwortfenster abwarten (endet früher, sobald geantwortet wurde)
        while (performance.now() - start < p.antwortMs && !(antwort && antwort.t >= start)) {
          await sleep(40);
          if (!ctx.alive()) return null;
        }
        reiz.style.opacity = "0";
        const a = antwort && antwort.t >= start ? antwort.art : null;

        if (ev.art === "reiz") {
          if (a === "gesehen") treppeSchritt(treppe, true);
          else if (a === "mitte") feedback(stage, "Die Mitte war gleich – das war ein Licht am Rand", "neutral");
          else {
            treppeSchritt(treppe, false);
            if (p.zeigeVerpasst) {
              ring.style.left = reiz.style.left; ring.style.top = reiz.style.top;
              ring.classList.add("sv-rand-ring-an");
              await sleep(650);
              ring.classList.remove("sv-rand-ring-an");
            }
          }
        } else if (ev.art === "mitte") {
          kontrolle.mitteGesamt++;
          if (a === "mitte") { kontrolle.mitteTreffer++; feedback(stage, "Gut aufgepasst!", "gut"); }
          else feedback(stage, "Die Mitte hatte sich kurz verändert", "neutral");
        } else {
          kontrolle.leerGesamt++;
          if (a) kontrolle.leerFehl++;
        }
      }
    } finally {
      aufraeumen();
    }
    if (!ctx.alive()) return null;

    // ---- Auswertung ----
    const ergebnisse = sektoren.map((s) => {
      const t = treppen.get(s.id);
      return { sektor: s.id, name: s.name, grenze: treppeSchaetzung(t), max: t.max, status: sektorStatus(treppeSchaetzung(t), t.max) };
    });
    const vorher = Object.fromEntries(sektoren.map((s) => [s.id, letzteGrenze(ctx.bests, s.id)]));
    speichereGrenzen(ctx.bests, ergebnisse, seite);
    const score = randScore(ergebnisse, kontrolle);

    const unsicher = ergebnisse.filter((e) => e.status === "unsicher");
    let text = unsicher.length
      ? `Das Licht wurde nicht überall bis zum Rand gesehen – am wenigsten weit ${unsicher.sort((a, b) => a.grenze / a.max - b.grenze / b.max)[0].name} (etwa ${zahlDE(unsicher[0].grenze)} Grad).`
      : "Das Licht wurde in allen geübten Richtungen bis nahe an den Bildschirmrand gesehen.";
    if (kontrolle.mitteGesamt) text += ` Veränderung in der Mitte ${kontrolle.mitteTreffer} von ${kontrolle.mitteGesamt} Mal bemerkt.`;

    stage.replaceChildren(
      h("p.hinweis.gross", { text: "Ihre Skizze von heute" }),
      h("div.sv-rand-ergebnis", {},
        h("div.sv-rand-skizze-platz", { html: skizzeSVG(ergebnisse) }),
        h("div.sv-rand-legende", {},
          h("p", {}, h("i.sv-rand-lg-gesehen"), "Licht gesehen"),
          h("p", {}, h("i.sv-rand-lg-unsicher"), "unsicher / nicht gesehen, bis zum Bildschirmrand"),
          h("ul.sv-rand-liste", {}, ergebnisse.map((e) => h("li", {
            text: `${e.name[0].toUpperCase() + e.name.slice(1)}: etwa ${e.grenze == null ? "–" : zahlDE(e.grenze)}° von ${zahlDE(e.max)}° möglich`
              + (vorher[e.sektor] != null ? ` (letztes Mal ${zahlDE(vorher[e.sektor])}°)` : ""),
          }))))),
      h("p.leise-text.sv-rand-text", { text: "Wichtig: Diese Skizze ist keine Gesichtsfeld-Messung (Perimetrie) und keine Diagnose. Bildschirm, Sitzabstand und Tagesform beeinflussen das Ergebnis. Verlässliche Aussagen über das Sehfeld kann nur eine augenärztliche Untersuchung geben." }),
    );
    const weiter = h("button.knopf.gross.primaer", { text: "Weiter" });
    stage.append(h("div.knopfreihe", {}, weiter));
    const ok = await warteAufWahl(ctx, [[weiter, true]]);
    if (ok == null || !ctx.alive()) return null;
    return { score, text };
  },
};
