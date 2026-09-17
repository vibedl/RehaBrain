// Kopf-Fit – druckfertiger Trainingsbericht (A4) für Ergotherapie oder Arztpraxis.
// Erzeugt ein eigenes Dokument (neues Fenster, sonst verstecktes iframe) und ruft window.print() auf.
// Keine Bibliotheken; Diagramme als Inline-SVG, schwarz-weiß-tauglich.
import { MAX_LEVEL } from "./profile.js";

// ---------- Reine Logik (ohne DOM, in Node testbar) ----------

/** Geschätzte Minuten je Übungsrunde (Schätzung, keine Messung) */
export const DAUER_MIN = { reaktion: 2, zahlen: 2, maumau: 5, siebzehnundvier: 4 };
export const DAUER_STANDARD = 3;

export const ZEITRAEUME = [
  { id: "4w", label: "4 Wochen" },
  { id: "1m", label: "1 Monat" },
  { id: "3m", label: "3 Monate" },
];

const TAG_MS = 86400000;
const pad = (n) => String(n).padStart(2, "0");
/** Lokales Datum als YYYY-MM-DD */
export const tagKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tagStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const datumDE = (t) => new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const keyZuZeit = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };

/** Zeitraum { von, bis } in ms; von = Tagesbeginn, bis = jetzt */
export function zeitraum(art = "4w", jetzt = Date.now()) {
  const d = new Date(jetzt);
  if (art === "1m") d.setMonth(d.getMonth() - 1);
  else if (art === "3m") d.setMonth(d.getMonth() - 3);
  else d.setDate(d.getDate() - 28);
  d.setDate(d.getDate() + 1); // heutiger Tag zählt mit
  return { von: tagStart(d), bis: jetzt };
}

export const imZeitraum = (history, { von, bis }) => history.filter((e) => e.t >= von && e.t <= bis);

export function trainingstage(eintraege) {
  return new Set(eintraege.map((e) => tagKey(e.t))).size;
}

export function schaetzeMinuten(eintraege) {
  return eintraege.reduce((s, e) => s + (DAUER_MIN[e.modul] ?? DAUER_STANDARD), 0);
}

/**
 * Stufenverlauf eines Bereichs: Mittelwert der zuletzt bekannten Stufen aller bisher geübten Module des Bereichs.
 * Liefert [{ t (Tagesbeginn), wert }] – ein Startpunkt bei `von` (falls vorher schon geübt) plus je Übungstag ein Punkt.
 */
export function bereichsVerlauf(history, modulIds, { von, bis }) {
  const ids = new Set(modulIds);
  const sortiert = history.filter((e) => ids.has(e.modul)).sort((a, b) => a.t - b.t);
  const stand = new Map();
  const mittel = () => [...stand.values()].reduce((x, y) => x + y, 0) / stand.size;
  const punkte = [];
  let i = 0;
  for (; i < sortiert.length && sortiert[i].t < von; i++) stand.set(sortiert[i].modul, sortiert[i].neueStufe);
  if (stand.size) punkte.push({ t: von, wert: runde(mittel()), start: true });
  for (; i < sortiert.length && sortiert[i].t <= bis; i++) {
    const e = sortiert[i];
    if (!stand.has(e.modul)) stand.set(e.modul, e.stufe); // Stand vor der ersten Übung
    if (!punkte.length) punkte.push({ t: tagStart(e.t), wert: runde(mittel()), start: true });
    stand.set(e.modul, e.neueStufe);
    const tag = tagStart(e.t);
    const letzter = punkte[punkte.length - 1];
    if (letzter.t === tag && !letzter.start) letzter.wert = runde(mittel());
    else punkte.push({ t: tag, wert: runde(mittel()) });
  }
  return punkte;
}
const runde = (x) => Math.round(x * 10) / 10;

/** Punkte → SVG-Koordinaten. Rückgabe [{ x, y, t, wert }] */
export function diagrammPunkte(punkte, { von, bis }, { breite = 560, hoehe = 170, rand = { l: 36, r: 12, o: 10, u: 26 } } = {}) {
  const spanne = Math.max(TAG_MS, bis - von);
  const iw = breite - rand.l - rand.r, ih = hoehe - rand.o - rand.u;
  return punkte.map((p) => ({
    ...p,
    x: runde(rand.l + Math.max(0, Math.min(1, (p.t - von) / spanne)) * iw),
    y: runde(rand.o + (1 - (Math.max(1, Math.min(MAX_LEVEL, p.wert)) - 1) / (MAX_LEVEL - 1)) * ih),
  }));
}

/** Schwere Tage im Zeitraum: profil.schwereTage (Liste YYYY-MM-DD) plus heutiges profil.schlechterTag */
export function schwereTageIm(profil, { von, bis }) {
  const alle = new Set([...(Array.isArray(profil.schwereTage) ? profil.schwereTage : []), profil.schlechterTag].filter(Boolean));
  return [...alle].filter((k) => { const t = keyZuZeit(k); return t >= tagStart(von) && t <= bis; }).sort();
}

/** Je Übung: Stufe zu Beginn, aktuell, Veränderung, Anzahl im Zeitraum */
export function uebungsTabelle(profil, module, { von, bis }) {
  const hist = [...profil.history].sort((a, b) => a.t - b.t);
  return module.map((m) => {
    const alle = hist.filter((e) => e.modul === m.id);
    const drin = alle.filter((e) => e.t >= von && e.t <= bis);
    if (!drin.length) return null;
    const vorher = alle.filter((e) => e.t < von).pop();
    const anfang = vorher ? vorher.neueStufe : drin[0].stufe;
    const aktuell = profil.levels?.[m.id] ?? drin[drin.length - 1].neueStufe;
    return { id: m.id, titel: m.titel, bereich: m.bereich, anfang, aktuell, veraenderung: aktuell - anfang, anzahl: drin.length };
  }).filter(Boolean);
}

/** Alle Daten des Berichts */
export function berichtDaten(profil, module, bereiche, art = "4w", jetzt = Date.now()) {
  const raum = zeitraum(art, jetzt);
  const eintraege = imZeitraum(profil.history ?? [], raum);
  const namen = bereiche.map((b) => b.name ?? b);
  return {
    name: profil.name, art, ...raum, erstellt: jetzt,
    tage: trainingstage(eintraege),
    anzahl: eintraege.length,
    minuten: schaetzeMinuten(eintraege),
    schwereTage: schwereTageIm(profil, raum),
    schwereTageGespeichert: Array.isArray(profil.schwereTage),
    bereiche: namen.map((name) => {
      const ids = module.filter((m) => m.bereich === name).map((m) => m.id);
      const punkte = bereichsVerlauf(profil.history ?? [], ids, raum);
      const veraenderung = punkte.length > 1 ? runde(punkte[punkte.length - 1].wert - punkte[0].wert) : null;
      return { name, punkte, veraenderung, anzahl: eintraege.filter((e) => ids.includes(e.modul)).length };
    }),
    uebungen: uebungsTabelle(profil, module, raum),
    seiten: Array.isArray(profil.bests?.durchstreichenSeiten) ? profil.bests.durchstreichenSeiten : [],
    einstufung: profil.einstufung ?? null,
  };
}

// ---------- HTML-Erzeugung (reine Strings) ----------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const zahlDE = (v) => String(v).replace(".", ",");
const vorzeichen = (v) => (v > 0 ? `+${zahlDE(v)}` : v < 0 ? `−${zahlDE(Math.abs(v))}` : "±0");
const stufenWort = (v) => (Math.abs(v) === 1 ? "Stufe" : "Stufen");

export function diagrammSVG(bereich, raum, schwereTage) {
  const breite = 560, hoehe = 170, rand = { l: 36, r: 12, o: 10, u: 26 };
  const iw = breite - rand.l - rand.r;
  const spanne = Math.max(TAG_MS, raum.bis - raum.von);
  const xVon = (t) => rand.l + Math.max(0, Math.min(1, (t - raum.von) / spanne)) * iw;
  const yVon = (w) => rand.o + (1 - (w - 1) / (MAX_LEVEL - 1)) * (hoehe - rand.o - rand.u);
  const pts = diagrammPunkte(bereich.punkte, raum, { breite, hoehe, rand });
  const tagBreite = Math.max(3, (TAG_MS / spanne) * iw);
  const pid = "schraffur-" + String(bereich.name).replace(/[^a-z]/gi, "");
  let s = `<svg class="dia" viewBox="0 0 ${breite} ${hoehe}" role="img" aria-label="Stufenverlauf ${esc(bereich.name)}">`;
  // schwere Tage als schraffierte Bänder
  s += `<defs><pattern id="${pid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#999" stroke-width="1.6"/></pattern></defs>`;
  for (const k of schwereTage) {
    const x = xVon(keyZuZeit(k));
    s += `<rect x="${runde(x)}" y="${rand.o}" width="${runde(Math.min(tagBreite, breite - rand.r - x))}" height="${hoehe - rand.o - rand.u}" fill="url(#${pid})"/>`;
  }
  for (const w of [1, 5, 10, 15, 20]) {
    const y = runde(yVon(w));
    s += `<line x1="${rand.l}" y1="${y}" x2="${breite - rand.r}" y2="${y}" stroke="${w === 1 ? "#555" : "#ccc"}" stroke-width="${w === 1 ? 1 : 0.6}"/>`;
    s += `<text x="${rand.l - 6}" y="${y + 3.5}" text-anchor="end" class="ach">${w}</text>`;
  }
  // Wochenmarken
  const d = new Date(raum.von);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7)); // nächster Montag
  for (let t = d.getTime(); t <= raum.bis; t += 7 * TAG_MS) {
    const x = runde(xVon(t));
    s += `<line x1="${x}" y1="${hoehe - rand.u}" x2="${x}" y2="${hoehe - rand.u + 4}" stroke="#555" stroke-width="0.8"/>`;
    s += `<text x="${x}" y="${hoehe - 6}" text-anchor="middle" class="ach">${new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" })}</text>`;
  }
  if (pts.length > 1) s += `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#1C1917" stroke-width="2" stroke-linejoin="round"/>`;
  for (const p of pts) s += `<circle cx="${p.x}" cy="${p.y}" r="${p.start ? 3.5 : 2.6}" fill="${p.start ? "#fff" : "#1C1917"}" stroke="#1C1917" stroke-width="1.4"/>`;
  if (!pts.length) s += `<text x="${breite / 2}" y="${hoehe / 2}" text-anchor="middle" class="leer">Im Zeitraum nicht geübt</text>`;
  return s + `</svg>`;
}

export function berichtHTML(daten) {
  const raum = { von: daten.von, bis: daten.bis };
  const tabelleZeilen = daten.uebungen.map((u) => `<tr><td>${esc(u.titel)}<small>${esc(u.bereich)}</small></td><td class="z">${u.anzahl}</td><td class="z">${u.anfang}</td><td class="z"><strong>${u.aktuell}</strong></td><td class="z">${vorzeichen(u.veraenderung)}</td></tr>`).join("");
  const bereichBloecke = daten.bereiche.map((b) => {
    const satz = b.veraenderung == null ? (b.anzahl ? "Zu wenige Übungstage für einen Verlauf." : "In diesem Zeitraum nicht geübt.")
      : `${vorzeichen(b.veraenderung)} ${stufenWort(b.veraenderung)} im Zeitraum (von ${zahlDE(b.punkte[0].wert)} auf ${zahlDE(b.punkte[b.punkte.length - 1].wert)})`;
    return `<section class="bereich"><div class="bkopf"><h3>${esc(b.name)}</h3><span>${esc(satz)} · ${b.anzahl} Übungen</span></div>${diagrammSVG(b, raum, daten.schwereTage)}</section>`;
  }).join("");
  const seiten = daten.seiten.length ? `<section class="block"><h2>Durchstreichen: gefundene Zeichen links und rechts</h2>
    <p class="klein">Anteil der gefundenen Zeichen auf der linken und rechten Blatthälfte (letzte ${daten.seiten.length} Runden). Deutliche, dauerhafte Unterschiede können ein Gesprächsanlass sein.</p>
    <table><thead><tr><th>Datum</th><th class="z">Links</th><th class="z">Rechts</th><th class="z">Unterschied</th></tr></thead><tbody>${daten.seiten.map((s) => `<tr><td>${esc(datumDE(keyZuZeit(s.datum)))}</td><td class="z">${Math.round(s.links * 100)} %</td><td class="z">${Math.round(s.rechts * 100)} %</td><td class="z">${Math.round(Math.abs(s.links - s.rechts) * 100)} Pkt.</td></tr>`).join("")}</tbody></table></section>` : "";
  const einst = daten.einstufung ? `<section class="block"><h2>Einstufung vom ${esc(datumDE(keyZuZeit(daten.einstufung.datum)))}</h2>
    <p class="klein">Startstufen, die beim Kennenlernen der Übungen festgelegt wurden (Stufen 1–${MAX_LEVEL}).</p>
    <div class="kacheln">${Object.entries(daten.einstufung.bereiche).map(([n, s]) => `<div class="kachel"><b>${s}</b><span>${esc(n)}</span></div>`).join("")}</div></section>` : "";
  const schwer = daten.schwereTage.length
    ? `${daten.schwereTage.length === 1 ? "Ein Tag" : daten.schwereTage.length + " Tage"} als „schwerer Tag“ markiert: ${daten.schwereTage.map((k) => esc(new Date(keyZuZeit(k)).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }))).join(", ")} – an diesen Tagen wurde nicht herabgestuft; im Diagramm schraffiert.`
    : daten.schwereTageGespeichert ? "Keine Tage als „schwerer Tag“ markiert." : "Schwere Tage werden erst ab jetzt dauerhaft gespeichert.";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Kopf-Fit – Trainingsbericht ${esc(daten.name)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..600&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap">
<style>
@page { size: A4; margin: 16mm 15mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #F1ECE6; color: #1C1917; font: 11pt/1.45 "Plus Jakarta Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
.blatt { max-width: 190mm; margin: 0 auto; padding: 14mm 12mm; background: #fff; }
h1, h2, h3 { font-family: "Newsreader", Georgia, "Times New Roman", serif; font-weight: 500; margin: 0; }
h1 { font-size: 24pt; line-height: 1.1; }
h2 { font-size: 14pt; margin: 0 0 6px; }
h3 { font-size: 12pt; }
.eyebrow { font-size: 8pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #A9532D; }
.kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2px solid #1C1917; padding-bottom: 8px; margin-bottom: 14px; }
.kopf .meta { text-align: right; font-size: 9.5pt; color: #44403C; }
.kacheln { display: grid; grid-template-columns: repeat(auto-fit, minmax(32mm, 1fr)); gap: 8px; margin: 8px 0; }
.kachel { border: 1px solid #bbb; border-radius: 8px; padding: 8px 10px; break-inside: avoid; }
.kachel b { display: block; font: 500 20pt/1.1 "Newsreader", Georgia, serif; }
.kachel span { font-size: 9pt; color: #44403C; }
.block { margin: 16px 0; break-inside: avoid; }
.klein, small { font-size: 9pt; color: #44403C; }
td small { display: block; }
.bereich { border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px; break-inside: avoid; }
.bkopf { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.bkopf span { font-size: 9.5pt; color: #44403C; }
.dia { width: 100%; height: auto; display: block; }
.dia .ach { font: 8px "Plus Jakarta Sans", Helvetica, Arial, sans-serif; fill: #555; }
.dia .leer { font: 11px "Plus Jakarta Sans", Helvetica, Arial, sans-serif; fill: #777; }
.legende { font-size: 8.5pt; color: #44403C; display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
.legende i { display: inline-block; width: 14px; height: 10px; vertical-align: -1px; margin-right: 4px; border: 1px solid #999; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #44403C; border-bottom: 1.5px solid #1C1917; }
.z { text-align: right; white-space: nowrap; }
tr { break-inside: avoid; }
.notizen { border: 1px solid #999; border-radius: 8px; min-height: 60mm; padding: 8px 10px;
  background-image: repeating-linear-gradient(#fff 0 9mm, #ccc 9mm calc(9mm + 1px)); background-position: 0 8mm; }
.hinweis { margin-top: 14px; padding: 8px 10px; border-left: 3px solid #1C1917; font-size: 9pt; color: #44403C; }
.leiste { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center;
  padding: 12px; background: #1C1917; color: #F3EFEA; font-size: 12pt; }
.leiste button { font: 600 12pt "Plus Jakarta Sans", sans-serif; min-height: 48px; padding: 8px 18px; border-radius: 10px; border: 1px solid #666; background: #2A2623; color: #F3EFEA; cursor: pointer; }
.leiste button[aria-pressed="true"] { background: #F3EFEA; color: #1C1917; }
.leiste button.druck { background: #C2673F; border-color: #C2673F; }
@media print { body { background: #fff; } .leiste { display: none; } .blatt { padding: 0; max-width: none; } }
</style></head><body>
<div class="leiste" role="toolbar" aria-label="Bericht">
  <span>Zeitraum:</span>
  ${ZEITRAEUME.map((z) => `<button type="button" data-zeitraum="${z.id}" aria-pressed="${z.id === daten.art}">${z.label}</button>`).join("")}
  <button type="button" class="druck" data-drucken>Drucken oder als PDF sichern</button>
</div>
<div class="blatt">
<header class="kopf"><div><div class="eyebrow">Kopf-Fit · Trainingsbericht</div><h1>${esc(daten.name)}</h1></div>
<div class="meta">Zeitraum: ${esc(datumDE(daten.von))} – ${esc(datumDE(daten.bis))}<br>Erstellt am ${esc(datumDE(daten.erstellt))}</div></header>

<section class="block"><h2>Überblick</h2>
<div class="kacheln">
<div class="kachel"><b>${daten.tage}</b><span>Trainingstage</span></div>
<div class="kachel"><b>${daten.anzahl}</b><span>Übungen</span></div>
<div class="kachel"><b>ca. ${daten.minuten}</b><span>Minuten (geschätzt*)</span></div>
<div class="kachel"><b>${daten.schwereTage.length}</b><span>schwere Tage</span></div>
</div>
<p class="klein">* Schätzung aus der Anzahl der Übungen (je nach Übung etwa 2–5 Minuten), keine gemessene Zeit. ${schwer}</p></section>

<section class="block" style="break-inside:auto"><h2>Stufenverlauf je Bereich</h2>
<p class="klein">Stufe 1 (leicht) bis ${MAX_LEVEL} (sehr anspruchsvoll): Mittelwert der Stufen aller geübten Übungen eines Bereichs. Die Stufe passt sich nach jeder Übung an.</p>
<div class="legende"><span><svg width="16" height="10"><circle cx="8" cy="5" r="3.5" fill="#fff" stroke="#1C1917" stroke-width="1.4"/></svg> Stand zu Beginn</span><span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="#1C1917" stroke-width="2"/><circle cx="13" cy="5" r="2.6" fill="#1C1917"/></svg> Übungstag</span><span><i style="background:repeating-linear-gradient(45deg,#fff 0 2px,#999 2px 3.5px)"></i>schwerer Tag</span></div>
${bereichBloecke}</section>

<section class="block" style="break-inside:auto"><h2>Übungen im Zeitraum</h2>
${daten.uebungen.length ? `<table><thead><tr><th>Übung</th><th class="z">Runden</th><th class="z">Stufe Beginn</th><th class="z">Stufe jetzt</th><th class="z">Veränderung</th></tr></thead><tbody>${tabelleZeilen}</tbody></table>` : `<p class="klein">In diesem Zeitraum wurden keine Übungen gemacht.</p>`}
</section>
${seiten}
${einst}
<section class="block"><h2>Notizen der Therapeutin / des Therapeuten</h2><div class="notizen"></div></section>
<p class="hinweis">Kopf-Fit ist ein Training für zu Hause und kein Medizinprodukt. Die Angaben ersetzen keine ärztliche oder therapeutische Diagnostik; sie zeigen nur, wie das Training verlaufen ist.</p>
</div></body></html>`;
}

// ---------- Öffnen & Drucken ----------

/**
 * Öffnet den Bericht in einem neuen Fenster (mit Zeitraum-Leiste) und startet den Druckdialog.
 * Werden Popups blockiert, wird ein verstecktes iframe gedruckt.
 * @param {object} profil
 * @param {Array} module     MODULE-Liste
 * @param {Array} bereiche   BEREICHE-Liste
 * @param {object} [opt]     { art: "4w"|"1m"|"3m", autoDruck: true, ziel: "fenster"|"iframe" }
 * @returns {{ art, dokument: Document, fenster: Window, iframe?: HTMLIFrameElement }}
 */
export function oeffneBericht(profil, module, bereiche, { art = "4w", autoDruck = true, ziel = "fenster" } = {}) {
  let fenster = ziel === "fenster" ? window.open("", "_blank") : null;
  let iframe = null;
  if (!fenster) {
    iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = "Bericht";
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "210mm", height: "297mm", border: "0", opacity: "0", pointerEvents: "none", zIndex: "-1" });
    document.body.append(iframe);
    fenster = iframe.contentWindow;
  }
  const ergebnis = { art, fenster, iframe, dokument: null };

  const zeichne = (a) => {
    ergebnis.art = a;
    const doc = fenster.document;
    doc.open();
    doc.write(berichtHTML(berichtDaten(profil, module, bereiche, a)));
    doc.close();
    ergebnis.dokument = doc;
    doc.querySelectorAll("[data-zeitraum]").forEach((b) => b.addEventListener("click", () => zeichne(b.dataset.zeitraum)));
    doc.querySelector("[data-drucken]")?.addEventListener("click", () => fenster.print());
  };
  zeichne(art);

  if (autoDruck) {
    const drucken = () => {
      try { fenster.focus(); fenster.print(); } catch (e) { console.error(e); }
      if (iframe) setTimeout(() => iframe.remove(), 60000);
    };
    // Schriften kurz abwarten (offline greifen die Ersatzschriften)
    const fonts = fenster.document.fonts;
    Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(() => setTimeout(drucken, 150));
  }
  return ergebnis;
}
