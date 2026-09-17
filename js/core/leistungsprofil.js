// Kopf-Fit – Leistungsprofil: unser Gegenstück zu Screenings, aber ausdrücklich ohne Normwerte.
// Vergleich nur mit sich selbst: aktuelle Stufe, Trend (4 Wochen), Stabilität, Tagesform-Einfluss,
// Stärken/Übungsfelder in verständlicher Sprache. Dazu ein SVG-Netzdiagramm über alle Bereiche.
import { h } from "./ui.js";
import { MAX_LEVEL } from "./profile.js";

// ---------- Reine Logik (ohne DOM, in Node testbar) ----------

const TAG_MS = 86400000;
const runde1 = (x) => Math.round(x * 10) / 10;
const runde = (x) => Math.round(x);

/** Einträge eines Bereichs aus profil.history (über alle Module des Bereichs) */
function bereichsEintraege(history, modulIds) {
  const ids = new Set(modulIds);
  return history.filter((e) => ids.has(e.modul)).sort((a, b) => a.t - b.t);
}

/** Mittelwert einer Zahlen-Liste, oder null wenn leer */
const mittel = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Streuung (Standardabweichung) der Scores – Maß für Stabilität, 0 = immer gleich gut */
export function streuung(scores) {
  if (scores.length < 2) return 0;
  const m = mittel(scores);
  return runde1(Math.sqrt(mittel(scores.map((s) => (s - m) ** 2))));
}

/**
 * Linearer Trend (Steigung je Tag) einer Zeitreihe [{t, wert}], über die kleinste-Quadrate-Methode.
 * Bei weniger als 2 Punkten oder wenn alle am selben Tag liegen: 0.
 */
export function linearerTrend(punkte) {
  if (punkte.length < 2) return 0;
  const t0 = punkte[0].t;
  const xs = punkte.map((p) => (p.t - t0) / TAG_MS);
  const ys = punkte.map((p) => p.wert);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0), sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const nenner = n * sxx - sx * sx;
  if (Math.abs(nenner) < 1e-9) return 0;
  return (n * sxy - sx * sy) / nenner;
}

/** Wortlaut für einen Trend (Stufenänderung je Woche) */
export function trendWort(proWoche) {
  if (proWoche >= 0.35) return "steigend";
  if (proWoche <= -0.35) return "fallend";
  return "gleichbleibend";
}

/** Wortlaut für Stabilität (Streuung der Scores 0..1) */
export function stabilitaetsWort(s) {
  if (s <= 0.12) return "gleichmäßig";
  if (s <= 0.25) return "wechselhaft";
  return "sehr wechselhaft";
}

/**
 * Tagesform-Einfluss: Mittelwert der Scores an „schweren Tagen“ vs. normalen Tagen.
 * Rückgabe { schwerTage, normalTage, unterschied } oder null ohne Vergleichsdaten.
 */
export function tagesformEinfluss(eintraege, schwereTage) {
  if (!eintraege.length) return null;
  const schwer = new Set(schwereTage ?? []);
  const tagKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const schwerScores = eintraege.filter((e) => schwer.has(tagKey(e.t))).map((e) => e.score);
  const normalScores = eintraege.filter((e) => !schwer.has(tagKey(e.t))).map((e) => e.score);
  if (!schwerScores.length || !normalScores.length) return null;
  const schwerM = mittel(schwerScores), normalM = mittel(normalScores);
  return { schwerTage: runde1(schwerM), normalTage: runde1(normalM), unterschied: runde1(normalM - schwerM) };
}

/**
 * Profil je Bereich berechnen.
 * @param {object} profil        { levels, bests, history, schwereTage, schlechterTag }
 * @param {Array} module         MODULE-Liste aus app.js ({id, bereich, titel})
 * @param {Array} bereiche       BEREICHE-Liste aus app.js ({name, akzent})
 * @returns {Array<{name, akzent, stufe, geuebt, trend, trendWort, proWoche, stabilitaet, stabilitaetsWort,
 *                  tagesform, staerke, uebungsfeld, anzahl, text}>}
 */
export function berechneProfil(profil, module, bereiche) {
  const history = profil.history ?? [];
  const jetzt = Date.now();
  const von4w = jetzt - 28 * TAG_MS;
  const alleSchwer = [...new Set([...(profil.schwereTage ?? []), profil.schlechterTag].filter(Boolean))];

  const ergebnisse = bereiche.map((b) => {
    const name = b.name ?? b;
    const ids = module.filter((m) => m.bereich === name).map((m) => m.id);
    const alle = bereichsEintraege(history, ids);
    const letzte4w = alle.filter((e) => e.t >= von4w);
    const geuebt = alle.length > 0;

    // Stufenverlauf für den Trend: Tagespunkte (Mittel der neuesten Stufen aller Module dieses Bereichs)
    const stand = new Map();
    const punkte = [];
    for (const e of alle) {
      if (e.t < von4w) { stand.set(e.modul, e.neueStufe); continue; }
      if (!stand.has(e.modul)) stand.set(e.modul, e.stufe);
      stand.set(e.modul, e.neueStufe);
      const werte = [...stand.values()];
      punkte.push({ t: e.t, wert: werte.reduce((a, x) => a + x, 0) / werte.length });
    }
    const proTag = linearerTrend(punkte);
    const proWoche = runde1(proTag * 7);
    const scores4w = letzte4w.map((e) => e.score);
    const sStreuung = streuung(scores4w);
    const tagesform = tagesformEinfluss(letzte4w, alleSchwer);

    const aktuelleStufe = ids.reduce((sum, id, i, arr) => sum + (profil.levels?.[id] ?? 1), 0) / Math.max(1, ids.length);

    return {
      name, akzent: b.akzent,
      stufe: geuebt ? runde1(aktuelleStufe) : null,
      geuebt, anzahl: alle.length, anzahl4w: letzte4w.length,
      trend: proWoche, trendWort: geuebt ? trendWort(proWoche) : null,
      stabilitaet: sStreuung, stabilitaetsWort: scores4w.length >= 3 ? stabilitaetsWort(sStreuung) : null,
      tagesform,
    };
  });

  // Stärken / Übungsfelder relativ zueinander: höchste normierte Stufe = Stärke, niedrigste = Übungsfeld
  const geuebte = ergebnisse.filter((r) => r.geuebt);
  let staerkeName = null, uebungsfeldName = null;
  if (geuebte.length >= 2) {
    const sortiert = [...geuebte].sort((a, b) => b.stufe - a.stufe);
    if (sortiert[0].stufe > sortiert[sortiert.length - 1].stufe) {
      staerkeName = sortiert[0].name;
      uebungsfeldName = sortiert[sortiert.length - 1].name;
    }
  }

  return ergebnisse.map((r) => ({
    ...r,
    staerke: r.name === staerkeName,
    uebungsfeld: r.name === uebungsfeldName,
    text: beschreibung(r, r.name === staerkeName, r.name === uebungsfeldName),
  }));
}

function beschreibung(r, istStaerke, istUebungsfeld) {
  if (!r.geuebt) return "Noch nicht geübt.";
  const teile = [`Stufe ${zahlDE(r.stufe)} von ${MAX_LEVEL}.`];
  if (r.trendWort === "steigend") teile.push("In den letzten 4 Wochen ging es spürbar aufwärts.");
  else if (r.trendWort === "fallend") teile.push("In den letzten 4 Wochen war es eher schwerer als sonst.");
  else if (r.anzahl4w >= 2) teile.push("In den letzten 4 Wochen ungefähr gleich geblieben.");
  if (r.stabilitaetsWort === "gleichmäßig") teile.push("Die Ergebnisse sind gleichmäßig.");
  else if (r.stabilitaetsWort) teile.push("Die Ergebnisse schwanken von Übung zu Übung.");
  if (r.tagesform && r.tagesform.unterschied >= 0.15) teile.push("An schweren Tagen lief es spürbar schwerer als sonst – das ist normal und wurde nicht herabgestuft.");
  if (istStaerke) teile.push("Das ist im Vergleich zu Ihren anderen Bereichen im Moment Ihr stärkster.");
  if (istUebungsfeld) teile.push("Hier lohnt sich etwas mehr Übung im Vergleich zu Ihren anderen Bereichen.");
  return teile.join(" ");
}

const zahlDE = (v) => String(v).replace(".", ",");

/** Radar-Koordinaten für n Bereiche mit Werten 0..max, gleichmäßig im Kreis verteilt (erster Punkt oben) */
export function radarKoordinaten(werte, { mitte = 150, radius = 110, max = MAX_LEVEL } = {}) {
  const n = werte.length;
  return werte.map((w, i) => {
    const winkel = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (Math.max(0, Math.min(max, w ?? 0)) / max) * radius;
    return { x: runde1(mitte + Math.cos(winkel) * r), y: runde1(mitte + Math.sin(winkel) * r), winkel };
  });
}

/** Koordinaten für die Achsen-Beschriftungen (etwas außerhalb des Radius) */
export function radarBeschriftungen(namen, { mitte = 150, radius = 110, abstand = 26 } = {}) {
  const n = namen.length;
  return namen.map((name, i) => {
    const winkel = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { name, x: runde1(mitte + Math.cos(winkel) * (radius + abstand)), y: runde1(mitte + Math.sin(winkel) * (radius + abstand)), winkel };
  });
}

// ---------- SVG-Netzdiagramm ----------

export function radarSVG(ergebnisse, { groesse = 300 } = {}) {
  const mitte = groesse / 2, radius = groesse * 0.36;
  const namen = ergebnisse.map((r) => r.name);
  const werte = ergebnisse.map((r) => r.stufe ?? 0);
  const punkte = radarKoordinaten(werte, { mitte, radius });
  const labels = radarBeschriftungen(namen, { mitte, radius, abstand: groesse * 0.1 });
  const ringe = [0.25, 0.5, 0.75, 1];

  let s = `<svg viewBox="0 0 ${groesse} ${groesse}" class="lp-radar" role="img" aria-label="Netzdiagramm über alle Bereiche">`;
  // Hintergrund-Ringe
  for (const f of ringe) {
    const rp = radarKoordinaten(namen.map(() => MAX_LEVEL * f), { mitte, radius });
    s += `<polygon points="${rp.map((p) => `${p.x},${p.y}`).join(" ")}" class="lp-radar-ring"/>`;
  }
  // Achsen
  for (const l of labels) s += `<line x1="${mitte}" y1="${mitte}" x2="${runde1(mitte + Math.cos(l.winkel) * radius)}" y2="${runde1(mitte + Math.sin(l.winkel) * radius)}" class="lp-radar-achse"/>`;
  // Werte-Fläche
  if (punkte.length >= 3) s += `<polygon points="${punkte.map((p) => `${p.x},${p.y}`).join(" ")}" class="lp-radar-flaeche"/>`;
  for (const p of punkte) s += `<circle cx="${p.x}" cy="${p.y}" r="4.5" class="lp-radar-punkt"/>`;
  // Beschriftungen
  for (const l of labels) {
    const anker = Math.cos(l.winkel) > 0.3 ? "start" : Math.cos(l.winkel) < -0.3 ? "end" : "middle";
    s += `<text x="${l.x}" y="${l.y}" text-anchor="${anker}" class="lp-radar-text">${esc(l.name)}</text>`;
  }
  return s + "</svg>";
}

const esc = (str) => String(str ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Bildschirm ----------

/**
 * Bildschirm anzeigen. Rendert in app.replaceChildren(...).
 * @param {object} o
 * @param {HTMLElement} o.app
 * @param {object} o.profil
 * @param {Array} o.module
 * @param {Array} o.bereiche
 * @param {() => void} o.zurueck
 */
export function zeigeProfil({ app, profil, module, bereiche, zurueck }) {
  const ergebnisse = berechneProfil(profil, module, bereiche);
  const geuebt = ergebnisse.filter((r) => r.geuebt);

  const karte = (r) => h(`div.lp-karte${r.staerke ? ".lp-staerke" : ""}${r.uebungsfeld ? ".lp-uebungsfeld" : ""}`, {},
    h("div.lp-karte-kopf", {},
      h("span.lp-karte-name", { text: r.name }),
      r.geuebt ? h("span.lp-karte-stufe", { text: `Stufe ${String(r.stufe).replace(".", ",")}` }) : null),
    r.geuebt ? h("div.lp-karte-marken", {},
      r.trendWort ? h(`span.lp-marke.lp-trend-${r.trendWort}`, { text: r.trendWort === "steigend" ? "Aufwärtstrend" : r.trendWort === "fallend" ? "Zurzeit schwerer" : "Gleichbleibend" }) : null,
      r.staerke ? h("span.lp-marke.lp-marke-staerke", { text: "Stärke" }) : null,
      r.uebungsfeld ? h("span.lp-marke.lp-marke-feld", { text: "Übungsfeld" }) : null) : null,
    h("p.lp-karte-text", { text: r.text }));

  app.replaceChildren(
    h("header.kopf.schmal", {},
      h("div.kopf-links", {},
        zurueck ? h("button.knopf", { onTap: zurueck, text: "Zurück" }) : null,
        h("div.kopf-titel", {}, h("span.eyebrow", { text: "Kopf-Fit" }), h("h1", { text: "Mein Leistungsprofil", tabindex: "-1" })))),
    h("main.inhalt.schmal", {},
      h("p.anleitung", { text: `${profil.name}s Überblick über alle Bereiche.` }),
      h("p.leise-text.lp-hinweis", { text: "Das ist kein Test und keine Diagnose. Der Vergleich gilt nur zwischen Ihren eigenen Bereichen und im Verlauf der Zeit – nicht mit anderen Personen oder mit einem Normwert." }),
      geuebt.length
        ? h("div.lp-radar-platz", { html: radarSVG(ergebnisse) })
        : h("p.leise-text", { text: "Noch keine Übung gemacht – das Netzdiagramm erscheint, sobald mindestens ein Bereich geübt wurde." }),
      h("div.lp-karten", {}, ergebnisse.map(karte)),
    ),
  );
  app.querySelector("h1")?.focus?.();
}

// ---------- Druckbericht-Schnipsel (inline-Styles, schwarz-weiß-tauglich) ----------

/** HTML-Schnipsel für den Druckbericht (bericht.js kann dies in ein <section> einfügen) */
export function profilAbschnittHTML(profil, module, bereiche) {
  const ergebnisse = berechneProfil(profil, module, bereiche);
  const geuebt = ergebnisse.filter((r) => r.geuebt);
  if (!geuebt.length) return "";
  const zeile = (r) => `<tr><td>${esc(r.name)}</td><td style="text-align:right">${String(r.stufe).replace(".", ",")}</td>`
    + `<td style="text-align:right">${r.trendWort === "steigend" ? "↑ steigend" : r.trendWort === "fallend" ? "↓ zurzeit schwerer" : "→ gleichbleibend"}</td>`
    + `<td style="text-align:right">${r.stabilitaetsWort ?? "–"}</td>`
    + `<td>${r.staerke ? "Stärke" : r.uebungsfeld ? "Übungsfeld" : ""}</td></tr>`;
  return `<section class="block" style="break-inside:avoid"><h2>Leistungsprofil</h2>
<p class="klein">Vergleich nur mit den eigenen Bereichen und im eigenen Verlauf – kein Test, keine Diagnose, kein Normwert.</p>
<table style="width:100%;border-collapse:collapse;font-size:10pt">
<thead><tr style="border-bottom:1.5px solid #1C1917"><th style="text-align:left;padding:4px 6px">Bereich</th><th style="text-align:right;padding:4px 6px">Stufe</th><th style="text-align:right;padding:4px 6px">Trend (4 Wo.)</th><th style="text-align:right;padding:4px 6px">Ergebnisse</th><th style="padding:4px 6px"></th></tr></thead>
<tbody style="vertical-align:top">${geuebt.map(zeile).join("").replace(/<td/g, '<td style="padding:4px 6px;border-bottom:1px solid #ddd"')}</tbody>
</table></section>`;
}
