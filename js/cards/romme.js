// Karten Stufe 7: Rommé (vereinfacht) gegen 1–2 Computer-Gegner
// Zwei 32er-Blätter (64 Karten), ab höheren Stufen mit Jokern.
// Ziel: alle Karten in Sätzen (3–4 gleiche Werte, verschiedene Farben) und Reihen
// (mind. 3 aufeinanderfolgende Werte gleicher Farbe, 7-8-9-10-B-D-K-A) ablegen.
// Zug: eine Karte ziehen (Stapel oder Ablage) → auslegen/anlegen (freiwillig) → eine Karte abwerfen.
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { neuesDeck, karteElement, kartenName, BLAETTER } from "./deck.js";
import { Kartenstapel, austeilen, nimmAusHand, naechsterSpieler, mischen, waehleZug, klemmeStaerke, denkpause } from "./engine.js";
import { Tisch, warteAufEingabe } from "./tisch.js";

/* ================================================================ Stufen */

export function rommeKonfig(stufe) {
  const s = Math.max(1, Math.min(20, stufe | 0 || 1));
  return {
    handKarten: s <= 4 ? 7 : s <= 9 ? 9 : s <= 14 ? 11 : 13,
    gegner: s <= 10 ? 1 : 2,
    mindestwert: s <= 5 ? 0 : s <= 10 ? 20 : 30,
    joker: s <= 8 ? 0 : s <= 15 ? 2 : 3,
    hilfe: s <= 6,            // Kombinationen als Vorschlag hervorheben, Punktsumme anzeigen
    staerke: s <= 8 ? 1 : s <= 17 ? 2 : 3,
    maxRunden: s <= 9 ? 18 : 22, // eigene Züge, danach entscheidet der Punktestand der Hand
  };
}

/* ================================================================ Kombinationen (ohne DOM) */

export const MAX_ZUEGE = 1500;
const RANG_WERT = [7, 8, 9, 10, 10, 10, 10, 11];
export const rangWert = (r) => RANG_WERT[r] ?? 0;
/** Strafpunkte einer Karte in der Hand (Joker 20). */
export const punktwert = (k) => (k.joker ? 20 : rangWert(k.rang));
export const handPunkte = (hand) => hand.reduce((s, k) => s + punktwert(k), 0);

/**
 * Prüft, ob Karten eine gültige Kombination bilden.
 * @returns null oder { typ: "satz"|"reihe", karten (geordnet), wert, rang?, farbe?, von?, bis? }
 */
export function pruefeKombi(karten) {
  if (!karten || karten.length < 3) return null;
  if (new Set(karten.map((k) => k.id)).size !== karten.length) return null;
  const echt = karten.filter((k) => !k.joker);
  const joker = karten.filter((k) => k.joker);
  if (echt.length < 2) return null;

  // Satz: gleicher Wert, lauter verschiedene Farben, höchstens 4 Karten
  if (echt.every((k) => k.rang === echt[0].rang)) {
    const farben = new Set(echt.map((k) => k.farbe));
    if (farben.size === echt.length && karten.length <= 4) {
      const rang = echt[0].rang;
      return { typ: "satz", rang, karten: [...echt].sort((a, b) => a.farbIndex - b.farbIndex).concat(joker), wert: rangWert(rang) * karten.length };
    }
    return null;
  }

  // Reihe: eine Farbe, verschiedene Werte, Lücken mit Jokern füllen
  const farbe = echt[0].farbe;
  if (!echt.every((k) => k.farbe === farbe)) return null;
  if (new Set(echt.map((k) => k.rang)).size !== echt.length) return null;
  if (karten.length > 8) return null;
  const raenge = echt.map((k) => k.rang);
  let von = Math.min(...raenge), bis = Math.max(...raenge);
  const luecken = bis - von + 1 - echt.length;
  let uebrig = joker.length - luecken;
  if (uebrig < 0) return null;
  while (uebrig > 0 && bis < 7) { bis++; uebrig--; }
  while (uebrig > 0 && von > 0) { von--; uebrig--; }
  if (uebrig > 0) return null;
  const geordnet = [];
  let ji = 0, wert = 0;
  for (let r = von; r <= bis; r++) {
    geordnet.push(echt.find((k) => k.rang === r) ?? joker[ji++]);
    wert += rangWert(r);
  }
  return { typ: "reihe", farbe, von, bis, karten: geordnet, wert };
}

/** Alle möglichen Kombinationen aus einer Hand (Joker nur als Anzahl, echte Karten je Kombination). */
export function kandidaten(hand) {
  const jokerAnzahl = hand.filter((k) => k.joker).length;
  const echt = hand.filter((k) => !k.joker);
  const platzhalter = (n) => Array.from({ length: n }, (_, i) => ({ id: `_j${i}`, joker: true }));
  const out = [];
  const nimm = (karten, j) => {
    const p = pruefeKombi([...karten, ...platzhalter(j)]);
    if (p) out.push({ echt: karten, joker: j, wert: p.wert });
  };
  // Sätze
  for (let r = 0; r < 8; r++) {
    const proFarbe = new Map();
    for (const k of echt) if (k.rang === r && !proFarbe.has(k.farbe)) proFarbe.set(k.farbe, k);
    const arr = [...proFarbe.values()];
    for (let maske = 1; maske < 1 << arr.length; maske++) {
      const teil = arr.filter((_, i) => maske & (1 << i));
      if (teil.length < 2) continue;
      for (let j = 0; j <= Math.min(jokerAnzahl, 4 - teil.length); j++) if (teil.length + j >= 3) nimm(teil, j);
    }
  }
  // Reihen
  const farben = [...new Set(echt.map((k) => k.farbe))];
  for (const f of farben) {
    const proRang = [];
    for (const k of echt) if (k.farbe === f && !proRang[k.rang]) proRang[k.rang] = k;
    for (let von = 0; von < 8; von++) {
      if (!proRang[von]) continue;
      for (let bis = von + 1; bis < 8; bis++) {
        if (!proRang[bis]) continue;
        const teil = [];
        for (let r = von; r <= bis; r++) if (proRang[r]) teil.push(proRang[r]);
        const luecken = bis - von + 1 - teil.length;
        if (luecken > jokerAnzahl) continue;
        if (teil.length < 2) continue;
        for (let j = luecken; j <= jokerAnzahl && teil.length + j <= 8; j++) if (teil.length + j >= 3) nimm(teil, j);
      }
    }
  }
  return out;
}

/**
 * Beste Aufteilung einer Kartenmenge in disjunkte Kombinationen: möglichst viele Karten, dann möglichst viel Wert.
 * @returns { anzahl, wert, kombis: [pruefeKombi-Ergebnis …] }
 */
export function bestePartition(hand, { budget = 25000 } = {}) {
  const kand = kandidaten(hand);
  const joker = hand.filter((k) => k.joker);
  let best = { anzahl: 0, wert: 0, wahl: [] };
  const benutzt = new Set();
  const wahl = [];
  let knoten = 0;
  const dfs = (start, jBenutzt, n, w) => {
    if (n > best.anzahl || (n === best.anzahl && w > best.wert)) best = { anzahl: n, wert: w, wahl: [...wahl] };
    if (best.anzahl === hand.length) return;
    for (let i = start; i < kand.length; i++) {
      if (++knoten > budget) return;
      const c = kand[i];
      if (jBenutzt + c.joker > joker.length) continue;
      if (c.echt.some((k) => benutzt.has(k.id))) continue;
      c.echt.forEach((k) => benutzt.add(k.id));
      wahl.push(c);
      dfs(i + 1, jBenutzt + c.joker, n + c.echt.length + c.joker, w + c.wert);
      wahl.pop();
      c.echt.forEach((k) => benutzt.delete(k.id));
      if (best.anzahl === hand.length) return;
    }
  };
  dfs(0, 0, 0, 0);
  let ji = 0;
  const kombis = best.wahl.map((c) => pruefeKombi([...c.echt, ...joker.slice(ji, (ji += c.joker))]));
  return { anzahl: best.anzahl, wert: best.wert, kombis };
}

/** Auswahl vollständig in Kombinationen zerlegen – oder null. */
export function zerlege(karten) {
  if (karten.length < 3) return null;
  const p = bestePartition(karten, { budget: 60000 });
  return p.anzahl === karten.length ? p : null;
}

/* ================================================================ Spielablauf (ohne DOM) */

export function neuesSpiel({ blatt = "franzoesisch", gegner = 1, handKarten = 7, joker = 0, mindestwert = 0, rng = Math.random } = {}) {
  const karten = [];
  for (const d of [0, 1]) for (const k of neuesDeck(blatt)) karten.push({ ...k, id: `${k.id}-${d}` });
  for (let j = 0; j < joker; j++) karten.push({ id: `joker-${j}`, joker: true, farbe: null, farbIndex: -1, rang: -1, wert: "J", blatt });
  karten.sort((a, b) => (a.id < b.id ? -1 : 1)); // sortiert, damit eine Saat reproduzierbar ist
  const stapel = new Kartenstapel(mischen(karten, rng), rng);
  const anzahl = gegner + 1;
  const haende = austeilen(stapel.zieh, anzahl, handKarten);
  stapel.aufdecken();
  return {
    blatt, mindestwert, stapel,
    spieler: haende.map((hand, i) => ({ hand, name: i === 0 ? "Sie" : gegner === 1 ? "Computer" : `Computer ${i}`, raus: false, ausgelegt: 0 })),
    auslage: [],       // [{ id, typ, karten, besitzer, … }]
    aktiv: 0,
    phase: "ziehen",   // "ziehen" | "spielen"
    vonAblage: null,   // id der gerade von der Ablage genommenen Karte
    gewinner: null,
    ende: false,
    zuege: 0,
    naechsteId: 1,
    gesamt: karten.length,
    rng,
  };
}

export const kannZiehen = (sp) => sp.stapel.kannZiehen() || !!sp.stapel.oben;

const pruefeDran = (sp, i, phase) => !sp.ende && i === sp.aktiv && sp.phase === phase;
const alleInHand = (hand, karten) => karten.every((k) => hand.some((x) => x.id === k.id)) && new Set(karten.map((k) => k.id)).size === karten.length;

export function beendeNachPunkten(sp) {
  sp.ende = true;
  sp.gewinner = null;
}

/** Karte ziehen: quelle "stapel" oder "ablage". */
export function ziehe(sp, i, quelle = "stapel") {
  if (!pruefeDran(sp, i, "ziehen")) return { ok: false, grund: "nicht dran" };
  let karte;
  if (quelle === "ablage") {
    if (!sp.stapel.oben) return { ok: false, grund: "ablage leer" };
    karte = sp.stapel.ablage.pop();
    sp.vonAblage = karte.id;
  } else {
    karte = sp.stapel.ziehe1();
    if (!karte) return { ok: false, grund: "stapel leer" };
    sp.vonAblage = null;
  }
  sp.spieler[i].hand.push(karte);
  sp.phase = "spielen";
  return { ok: true, karte };
}

function legeKombisAus(sp, i, kombis) {
  const s = sp.spieler[i];
  const neu = [];
  for (const kombi of kombis) {
    kombi.karten.forEach((k) => nimmAusHand(s.hand, k));
    const eintrag = { ...kombi, id: sp.naechsteId++, besitzer: i };
    sp.auslage.push(eintrag);
    neu.push(eintrag);
    s.ausgelegt += kombi.karten.length;
  }
  s.raus = true;
  return neu;
}

/** Markierte Karten auslegen (dürfen mehrere Kombinationen sein). */
export function auslegen(sp, i, karten) {
  if (!pruefeDran(sp, i, "spielen")) return { ok: false, grund: "nicht dran" };
  const s = sp.spieler[i];
  if (!alleInHand(s.hand, karten)) return { ok: false, grund: "nicht in der Hand" };
  const p = zerlege(karten);
  if (!p) return { ok: false, grund: "keine kombi" };
  if (!s.raus && p.wert < sp.mindestwert) return { ok: false, grund: "mindestwert", wert: p.wert };
  if (karten.length >= s.hand.length) return { ok: false, grund: "abwurf" };
  const kombis = legeKombisAus(sp, i, p.kombis);
  return { ok: true, kombis, wert: p.wert };
}

/** Karten an eine ausgelegte Kombination anlegen (nur wer schon ausgelegt hat). */
export function anlegen(sp, i, karten, kombiId) {
  if (!pruefeDran(sp, i, "spielen")) return { ok: false, grund: "nicht dran" };
  const s = sp.spieler[i];
  if (!s.raus) return { ok: false, grund: "nicht raus" };
  if (!karten.length || !alleInHand(s.hand, karten)) return { ok: false, grund: "nicht in der Hand" };
  const kombi = sp.auslage.find((x) => x.id === kombiId);
  if (!kombi) return { ok: false, grund: "keine kombi" };
  if (karten.length >= s.hand.length) return { ok: false, grund: "abwurf" };
  const neu = pruefeKombi([...kombi.karten, ...karten]);
  if (!neu) return { ok: false, grund: "passt nicht" };
  karten.forEach((k) => nimmAusHand(s.hand, k));
  Object.assign(kombi, neu, { id: kombi.id, besitzer: kombi.besitzer });
  s.ausgelegt += karten.length;
  return { ok: true, kombi };
}

/** Eine Karte abwerfen – beendet den Zug. */
export function abwerfen(sp, i, karte) {
  if (!pruefeDran(sp, i, "spielen")) return { ok: false, grund: "nicht dran" };
  const s = sp.spieler[i];
  if (!s.hand.some((k) => k.id === karte.id)) return { ok: false, grund: "nicht in der Hand" };
  if (karte.id === sp.vonAblage && s.hand.length > 1) return { ok: false, grund: "gerade genommen" };
  nimmAusHand(s.hand, karte);
  sp.stapel.ablegen(karte);
  sp.zuege++;
  sp.vonAblage = null;
  if (!s.hand.length) { sp.ende = true; sp.gewinner = i; return { ok: true, fertig: true }; }
  sp.aktiv = naechsterSpieler(i, sp.spieler.length);
  sp.phase = "ziehen";
  return { ok: true, fertig: false };
}

/** Passt eine Karte an irgendeine ausgelegte Kombination? */
export const anlegbarAn = (sp, karte) => sp.auslage.find((c) => pruefeKombi([...c.karten, karte])) ?? null;

/** Platz nach Spielende: Gewinner 1, sonst nach Strafpunkten der Hand (weniger ist besser). */
export function platzierung(sp, i) {
  if (sp.gewinner === i) return 1;
  const eigene = handPunkte(sp.spieler[i].hand);
  let platz = 1;
  sp.spieler.forEach((s, j) => {
    if (j !== i && (sp.gewinner === j || handPunkte(s.hand) < eigene)) platz++;
  });
  return platz;
}

/** Alle Karten zählen (Test): Hände + Auslage + Stapel. */
export function kartenImSpiel(sp) {
  return [
    ...sp.spieler.flatMap((s) => s.hand), ...sp.auslage.flatMap((c) => c.karten), ...sp.stapel.zieh, ...sp.stapel.ablage,
  ];
}

/* ---------------------------------------------------------------- Computer */

/** Bringt die Karte etwas? (mehr Karten in Kombinationen oder direkt anlegbar) */
export function nuetztKarte(sp, i, karte) {
  const hand = sp.spieler[i].hand;
  if (karte.joker) return true;
  const vorher = bestePartition(hand, { budget: 6000 }).anzahl;
  const nachher = bestePartition([...hand, karte], { budget: 6000 }).anzahl;
  if (nachher > vorher) return true;
  return sp.spieler[i].raus && !!anlegbarAn(sp, karte);
}

export function bewerteAbwurf(sp, i, karte, { staerke = 2, geschuetzt = new Set() } = {}) {
  const hand = sp.spieler[i].hand;
  if (karte.joker) return -100;
  let w = punktwert(karte) * 0.3;
  if (geschuetzt.has(karte.id)) w -= 20;
  for (const o of hand) {
    if (o.id === karte.id || o.joker) continue;
    if (o.rang === karte.rang && o.farbe !== karte.farbe) w -= 3;
    if (o.farbe === karte.farbe) {
      const d = Math.abs(o.rang - karte.rang);
      if (d === 1) w -= 3; else if (d === 2) w -= 1.5;
    }
  }
  if (staerke >= 3 && anlegbarAn(sp, karte)) w -= 2.5; // nichts abwerfen, das die anderen gebrauchen können
  return w;
}

/**
 * Kompletter Computer-Zug. Gibt Ereignisse zurück:
 * {typ:"ziehe", quelle, karte} | {typ:"auslegen", kombis} | {typ:"anlegen", karte, kombi} | {typ:"abwerfen", karte} | {typ:"ende"}
 */
export function computerZug(sp, i, staerke = 1) {
  const s = klemmeStaerke(staerke);
  const rng = sp.rng;
  const ich = sp.spieler[i];
  const ev = [];
  if (sp.ende) return ev;

  // 1. Ziehen
  const oben = sp.stapel.oben;
  let quelle = "stapel";
  if (oben && (s >= 2 || rng() < 0.6) && nuetztKarte(sp, i, oben)) quelle = "ablage";
  else if (s === 1 && oben && rng() < 0.1) quelle = "ablage";
  if (quelle === "stapel" && !sp.stapel.kannZiehen()) quelle = "ablage";
  let z = ziehe(sp, i, quelle);
  if (!z.ok) {
    quelle = quelle === "stapel" ? "ablage" : "stapel";
    z = ziehe(sp, i, quelle);
  }
  if (!z.ok) { beendeNachPunkten(sp); ev.push({ typ: "ende" }); return ev; }
  ev.push({ typ: "ziehe", quelle, karte: z.karte });

  // 2. Auslegen
  if (s >= 2 || rng() < 0.7) {
    const p = bestePartition(ich.hand, { budget: 15000 });
    // Schwächere Gegner sehen nicht alles auf einmal: Stärke 1–2 legt höchstens eine Kombination pro Zug
    const kombis = behalteEine(p.kombis, ich.hand.length).slice(0, s >= 3 ? 99 : 1);
    const wert = kombis.reduce((x, c) => x + c.wert, 0);
    if (kombis.length && (ich.raus || wert >= sp.mindestwert)) {
      ev.push({ typ: "auslegen", kombis: legeKombisAus(sp, i, kombis) });
    }
  }

  // 3. Anlegen
  if (ich.raus) {
    let weiter = true;
    let angelegt = 0;
    while (weiter && !sp.ende && angelegt < (s >= 3 ? 99 : s)) {
      weiter = false;
      for (const karte of [...ich.hand]) {
        if (ich.hand.length <= 1) break;
        if (karte.joker && s < 3 && ich.hand.length > 2) continue; // Joker lieber behalten
        if (s === 1 && rng() < 0.35) continue;
        const kombi = anlegbarAn(sp, karte);
        if (kombi && anlegen(sp, i, [karte], kombi.id).ok) {
          ev.push({ typ: "anlegen", karte, kombi });
          angelegt++;
          weiter = true;
          break;
        }
      }
    }
    if (sp.ende) return ev;
  }

  // 4. Abwerfen
  let optionen = ich.hand.filter((k) => k.id !== sp.vonAblage || ich.hand.length === 1);
  const ohneJoker = optionen.filter((k) => !k.joker);
  if (ohneJoker.length) optionen = ohneJoker;
  const geschuetzt = new Set(bestePartition(ich.hand, { budget: 6000 }).kombis.flatMap((c) => c.karten.map((k) => k.id)));
  const karte = waehleZug(optionen, { staerke: s, rng, bewerte: (k) => bewerteAbwurf(sp, i, k, { staerke: s, geschuetzt }) });
  abwerfen(sp, i, karte);
  ev.push({ typ: "abwerfen", karte });
  return ev;
}

/** Eine Karte muss zum Abwerfen übrig bleiben: notfalls eine Endkarte aus einer langen Kombination oder eine Kombination weglassen. */
export function behalteEine(kombis, handAnzahl) {
  const summe = kombis.reduce((x, c) => x + c.karten.length, 0);
  if (summe < handAnzahl || !kombis.length) return kombis;
  for (let j = 0; j < kombis.length; j++) {
    const c = kombis[j];
    if (c.karten.length < 4) continue;
    for (const kurz of [c.karten.slice(1), c.karten.slice(0, -1)]) {
      const neu = pruefeKombi(kurz);
      if (neu) return kombis.map((x, i) => (i === j ? neu : x));
    }
  }
  return kombis.slice(0, -1);
}

/** Computer-gegen-Computer (Test). */
export function simulierePartie({ rng = Math.random, gegner = 1, handKarten = 7, joker = 0, mindestwert = 0, staerken = [1, 1, 1] } = {}) {
  const sp = neuesSpiel({ gegner, handKarten, joker, mindestwert, rng });
  while (!sp.ende && sp.zuege < MAX_ZUEGE) computerZug(sp, sp.aktiv, staerken[sp.aktiv] ?? 1);
  if (!sp.ende) beendeNachPunkten(sp);
  return sp;
}

/** Score aus Ergebnis, Anteil ausgelegter Karten und Regelfehlern. */
export function rommeScore({ gewonnen, platz, spielerAnzahl, ausgelegt, handKarten, fehler }) {
  let basis;
  if (gewonnen) basis = 1;
  else {
    const anteil = Math.min(1, ausgelegt / Math.max(1, handKarten));
    basis = 0.2 + 0.45 * anteil + (platz === 1 ? 0.12 : spielerAnzahl > 2 && platz === 2 ? 0.05 : 0);
    basis = Math.min(0.79, basis);
  }
  return Math.round(Math.max(0, Math.min(1, basis - Math.min(0.3, fehler * 0.04))) * 100) / 100;
}

/* ================================================================ Oberfläche */

export function romme66Styles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-ro-styles], link[href$="css/romme66.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/romme66.css", import.meta.url).href;
  link.setAttribute("data-ro-styles", "");
  document.head.append(link);
}

const JOKER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/><circle cx="3" cy="7" r="1.3"/><circle cx="21" cy="7" r="1.3"/><circle cx="12" cy="3.5" r="1.3"/><path d="M4 21h16"/></svg>';

export const karteNameRo = (k) => (k.joker ? "Joker" : kartenName(k));

/** Karte oder Joker als Element. */
export function roKarte(k, { tag = "div" } = {}) {
  if (!k || !k.joker) return karteElement(k, { tag });
  const el = h(`${tag}.karte.ro-joker`, { "aria-label": "Joker" },
    h("span.ecke", { text: "J" }),
    h("span.mitte.ro-jokerbild", { html: JOKER_SVG, "aria-hidden": "true" }),
    h("span.wert", { text: "J" }));
  return el;
}

function kombiText(c, blatt) {
  const b = BLAETTER[blatt];
  const wn = (r) => { const w = b.werte[r]; return b.wertNamen[w] ?? w; };
  if (c.typ === "satz") return `Satz ${wn(c.rang)}`;
  return `Reihe ${b.farben.find((f) => f.id === c.farbe)?.name ?? ""} ${b.werte[c.von]} bis ${b.werte[c.bis]}`;
}

export default {
  id: "romme",
  bereich: "Kartenspiele",
  titel: "Rommé",
  icon: "",
  anleitung: (stufe) => {
    const k = rommeKonfig(stufe);
    return "Legen Sie Sätze (drei oder vier gleiche Werte in verschiedenen Farben) und Reihen (mindestens drei Karten einer Farbe in Folge) aus. "
      + "In jedem Zug ziehen Sie eine Karte, legen aus oder an und werfen zum Schluss eine Karte ab. Wer zuerst die letzte Karte abwirft, gewinnt."
      + (k.mindestwert ? ` Beim ersten Auslegen brauchen Sie mindestens ${k.mindestwert} Punkte (Ass 11, Bilder und Zehn 10, sonst Augenwert).` : "")
      + (k.joker ? " Ein Joker ersetzt jede Karte." : "");
  },

  async run(ctx) {
    const { stufe, settings, stage } = ctx;
    const blatt = settings?.blatt ?? "franzoesisch";
    const k = rommeKonfig(stufe);
    romme66Styles();
    const sp = neuesSpiel({ blatt, gegner: k.gegner, handKarten: k.handKarten, joker: k.joker, mindestwert: k.mindestwert });
    const tisch = new Tisch(ctx, { gegner: sp.spieler.slice(1).map((s) => s.name) });
    tisch.el.classList.add("ro-tisch");
    const auslageEl = h("div.ro-auslage", { role: "group", "aria-label": "Ausgelegte Kombinationen" });
    const infoEl = h("p.hinweis.ro-info", { "aria-live": "polite" });
    const sortEl = h("div.knopfreihe.ro-sortieren");
    tisch.mitte.after(auslageEl);
    tisch.handEl.before(infoEl);
    tisch.handEl.after(sortEl);
    tisch.ablageEl.classList.add("ro-ablage");

    let sortierung = "farbe";
    const auswahl = new Set();
    let fehler = 0;
    let menschRunden = 0;
    let neuId = null;

    const sortierteHand = () => {
      const hand = sp.spieler[0].hand;
      const echt = hand.filter((x) => !x.joker);
      echt.sort((a, b) => (sortierung === "wert" ? a.rang - b.rang || a.farbIndex - b.farbIndex : a.farbIndex - b.farbIndex || a.rang - b.rang));
      return [...echt, ...hand.filter((x) => x.joker)];
    };

    const zeigeAuslage = (onKombi = null) => {
      if (!sp.auslage.length) {
        auslageEl.replaceChildren(h("p.ro-leertext", { text: "Noch keine Kombinationen ausgelegt" }));
        return;
      }
      auslageEl.replaceChildren(...sp.auslage.map((c) => {
        const text = kombiText(c, blatt);
        const el = h((onKombi ? "button" : "div") + ".ro-kombi", {
          type: onKombi ? "button" : null,
          "aria-label": `${text}, von ${c.besitzer === 0 ? "Ihnen" : sp.spieler[c.besitzer].name}${onKombi ? ". Antippen zum Anlegen" : ""}`,
        },
        h("span.ro-kombikarten", {}, c.karten.map((x) => roKarte(x))),
        h("span.ro-kombiname", { text: `${c.besitzer === 0 ? "Sie" : sp.spieler[c.besitzer].name}` }));
        if (onKombi) el.onclick = debounced(() => onKombi(c));
        return el;
      }));
    };

    const zeichne = () => {
      sp.spieler.slice(1).forEach((s, j) => tisch.setzeGegner(j, s.hand.length, { aktiv: sp.aktiv === j + 1, info: s.raus ? "hat ausgelegt" : "" }));
      tisch.setzeNachzieh(sp.stapel.anzahlZieh);
      const oben = sp.stapel.oben;
      tisch.zusatzEl.replaceChildren();
      tisch.ablageEl.replaceChildren(oben ? roKarte(oben) : h("div.ro-leer", { text: "Ablage leer" }));
      zeigeAuslage();
    };

    const zeigeHand = () => {
      tisch.handEl.classList.remove("kt-waehlbar");
      tisch.handEl.replaceChildren(...sortierteHand().map((x) => roKarte(x)));
    };

    const sortKnoepfe = (ende) => {
      sortEl.replaceChildren(
        h("button.knopf" + (sortierung === "farbe" ? ".ro-aktiv" : ""), { type: "button", text: "Nach Farbe", "aria-pressed": String(sortierung === "farbe"), onclick: debounced(() => ende({ typ: "sort", nach: "farbe" })) }),
        h("button.knopf" + (sortierung === "wert" ? ".ro-aktiv" : ""), { type: "button", text: "Nach Wert", "aria-pressed": String(sortierung === "wert"), onclick: debounced(() => ende({ typ: "sort", nach: "wert" })) }),
      );
    };
    const aufraeumen = () => {
      tisch.aktionenEl.replaceChildren();
      sortEl.replaceChildren();
      tisch.nachziehEl.disabled = true;
      tisch.nachziehEl.onclick = null;
      tisch.ablageEl.onclick = null;
      tisch.ablageEl.removeAttribute("role");
      tisch.ablageEl.removeAttribute("tabindex");
      tisch.ablageEl.classList.remove("ro-tippbar");
      tisch.handEl.querySelectorAll("button").forEach((b) => { b.onclick = null; b.disabled = true; });
      auslageEl.querySelectorAll("button").forEach((b) => { b.onclick = null; b.disabled = true; });
    };

    // ---------------- Ziehen
    const menschZiehen = async () => {
      while (true) {
        zeichne();
        zeigeHand();
        const oben = sp.stapel.oben;
        const stapelGeht = sp.stapel.kannZiehen();
        if (!stapelGeht && !oben) { beendeNachPunkten(sp); return true; }
        tisch.status("Sie sind dran: Ziehen Sie eine Karte vom Stapel oder von der Ablage.");
        infoEl.textContent = "";
        const wahl = await warteAufEingabe(ctx, (ende) => {
          const reihe = [];
          if (stapelGeht) {
            reihe.push(h("button.knopf.gross.primaer", { type: "button", text: "Vom Stapel ziehen", onclick: debounced(() => ende({ typ: "stapel" })) }));
            tisch.nachziehEl.disabled = false;
            tisch.nachziehEl.onclick = debounced(() => ende({ typ: "stapel" }));
          }
          if (oben) {
            reihe.push(h("button.knopf.gross", { type: "button", text: `${karteNameRo(oben)} von der Ablage nehmen`, onclick: debounced(() => ende({ typ: "ablage" })) }));
            tisch.ablageEl.classList.add("ro-tippbar");
            tisch.ablageEl.setAttribute("role", "button");
            tisch.ablageEl.setAttribute("tabindex", "0");
            tisch.ablageEl.onclick = debounced(() => ende({ typ: "ablage" }));
          }
          tisch.aktionenEl.replaceChildren(...reihe);
          sortKnoepfe(ende);
        }, aufraeumen);
        if (!wahl || !ctx.alive()) return false;
        if (wahl.typ === "sort") { sortierung = wahl.nach; continue; }
        const r = ziehe(sp, 0, wahl.typ);
        if (!r.ok) { feedback(stage, "Von dort kann gerade nicht gezogen werden", "neutral"); await sleep(900); continue; }
        auswahl.clear();
        neuId = r.karte.id;
        tisch.status(wahl.typ === "ablage" ? `Sie nehmen ${karteNameRo(r.karte)}.` : `Sie ziehen ${karteNameRo(r.karte)}.`);
        return true;
      }
    };

    // ---------------- Auslegen, anlegen, abwerfen
    const menschSpielen = async () => {
      const ich = sp.spieler[0];
      let ersteRunde = true;
      while (!sp.ende && sp.aktiv === 0 && sp.phase === "spielen") {
        zeichne();
        const hand = sortierteHand();
        for (const id of [...auswahl]) if (!hand.some((x) => x.id === id)) auswahl.delete(id);
        const vorschlag = new Set();
        const anlegbar = new Set();
        if (k.hilfe) {
          const p = bestePartition(hand, { budget: 15000 });
          if (ich.raus || p.wert >= sp.mindestwert) p.kombis.forEach((c) => c.karten.forEach((x) => vorschlag.add(x.id)));
          if (ich.raus) hand.forEach((x) => { if (!x.joker && anlegbarAn(sp, x)) anlegbar.add(x.id); });
        }
        if (!ersteRunde || !tisch.statusEl.textContent) {
          tisch.status(ich.raus
            ? "Legen Sie aus oder an. Zum Schluss werfen Sie eine Karte ab."
            : sp.mindestwert
              ? `Erstes Auslegen: mindestens ${sp.mindestwert} Punkte. Zum Schluss eine Karte abwerfen.`
              : "Markieren Sie eine Kombination und legen Sie sie aus. Zum Schluss eine Karte abwerfen.");
        }
        ersteRunde = false;

        const wahl = await warteAufEingabe(ctx, (ende) => {
          const auslegenK = h("button.knopf.gross.primaer", { type: "button", text: "Auslegen", onclick: debounced(() => ende({ typ: "auslegen" })) });
          const abwerfenK = h("button.knopf.gross", { type: "button", text: "Abwerfen", onclick: debounced(() => ende({ typ: "abwerfen" })) });
          const aktualisiere = () => {
            const markiert = hand.filter((x) => auswahl.has(x.id));
            auslegenK.disabled = markiert.length < 3;
            abwerfenK.disabled = markiert.length !== 1;
            abwerfenK.textContent = markiert.length === 1 ? `${karteNameRo(markiert[0])} abwerfen` : "Abwerfen";
            let t = markiert.length === 0 ? "Karten antippen zum Markieren"
              : markiert.length === 1 ? "1 Karte markiert" : `${markiert.length} Karten markiert`;
            if (k.hilfe && markiert.length) t += ` · ${markiert.reduce((s, x) => s + (x.joker ? 0 : rangWert(x.rang)), 0)} Punkte`;
            if (markiert.length && sp.auslage.length && ich.raus) t += " · Zum Anlegen eine Kombination antippen";
            infoEl.textContent = t;
          };
          tisch.handEl.classList.add("kt-waehlbar");
          tisch.handEl.replaceChildren(...hand.map((x) => {
            const el = roKarte(x, { tag: "button" });
            el.type = "button";
            if (x.id === neuId) el.classList.add("neu", "ro-neu");
            if (vorschlag.has(x.id)) el.classList.add("kt-spielbar");
            else if (anlegbar.has(x.id)) el.classList.add("kt-spielbar", "ro-anlegbar");
            const setze = () => {
              const an = auswahl.has(x.id);
              el.classList.toggle("kt-gewaehlt", an);
              el.setAttribute("aria-pressed", String(an));
            };
            setze();
            el.onclick = debounced(() => {
              if (auswahl.has(x.id)) auswahl.delete(x.id); else auswahl.add(x.id);
              setze();
              aktualisiere();
            });
            return el;
          }));
          zeigeAuslage((c) => ende({ typ: "anlegen", kombi: c }));
          tisch.aktionenEl.replaceChildren(auslegenK, abwerfenK);
          sortKnoepfe(ende);
          aktualisiere();
        }, aufraeumen);
        if (!wahl || !ctx.alive()) return false;

        const markiert = hand.filter((x) => auswahl.has(x.id));
        if (wahl.typ === "sort") { sortierung = wahl.nach; continue; }
        if (wahl.typ === "auslegen") {
          const r = auslegen(sp, 0, markiert);
          if (!r.ok) {
            fehler++;
            feedback(stage, r.grund === "mindestwert"
              ? `Das sind ${r.wert} Punkte. Beim ersten Auslegen brauchen Sie ${sp.mindestwert}.`
              : r.grund === "abwurf" ? "Behalten Sie eine Karte zum Abwerfen zurück"
                : "Diese Karten ergeben noch keine gültige Kombination", "neutral");
            await sleep(1300);
            if (!ctx.alive()) return false;
            continue;
          }
          auswahl.clear();
          tisch.status(`Ausgelegt: ${r.kombis.map((c) => kombiText(c, blatt)).join(", ")}.`);
          feedback(stage, "Gut ausgelegt!", "gut");
          await sleep(900);
          continue;
        }
        if (wahl.typ === "anlegen") {
          if (!markiert.length) { feedback(stage, "Markieren Sie zuerst die Karten, die Sie anlegen möchten", "neutral"); await sleep(1100); continue; }
          if (!ich.raus) { feedback(stage, "Anlegen geht erst, wenn Sie selbst etwas ausgelegt haben", "neutral"); await sleep(1300); continue; }
          const r = anlegen(sp, 0, markiert, wahl.kombi.id);
          if (!r.ok) {
            fehler++;
            feedback(stage, r.grund === "abwurf" ? "Behalten Sie eine Karte zum Abwerfen zurück" : "Das passt nicht an diese Kombination", "neutral");
            await sleep(1200);
            if (!ctx.alive()) return false;
            continue;
          }
          auswahl.clear();
          tisch.status(`Angelegt an: ${kombiText(r.kombi, blatt)}.`);
          await sleep(800);
          continue;
        }
        if (wahl.typ === "abwerfen") {
          if (markiert.length !== 1) continue;
          const r = abwerfen(sp, 0, markiert[0]);
          if (!r.ok) {
            feedback(stage, "Die eben genommene Karte bitte nicht gleich wieder abwerfen", "neutral");
            await sleep(1300);
            continue;
          }
          auswahl.clear();
          tisch.status(`Sie werfen ${karteNameRo(markiert[0])} ab.`);
          zeichne();
          zeigeHand();
          await sleep(700);
        }
      }
      return ctx.alive();
    };

    const eventText = (name, e) => {
      switch (e.typ) {
        case "ziehe": return e.quelle === "ablage" ? `${name} nimmt ${karteNameRo(e.karte)} von der Ablage.` : `${name} zieht vom Stapel.`;
        case "auslegen": return `${name} legt aus: ${e.kombis.map((c) => kombiText(c, blatt)).join(", ")}.`;
        case "anlegen": return `${name} legt ${karteNameRo(e.karte)} an.`;
        case "abwerfen": return `${name} wirft ${karteNameRo(e.karte)} ab.`;
        default: return "";
      }
    };

    zeichne();
    zeigeHand();
    while (!sp.ende) {
      if (!ctx.alive()) return null;
      zeichne();
      if (sp.aktiv === 0) {
        if (!(await menschZiehen())) return null;
        if (sp.ende) break;
        if (!(await menschSpielen())) return null;
        menschRunden++;
        if (!sp.ende && menschRunden >= k.maxRunden) beendeNachPunkten(sp);
        continue;
      }
      const i = sp.aktiv;
      const name = sp.spieler[i].name;
      zeigeHand();
      infoEl.textContent = "";
      if (!(await tisch.computerUeberlegt(name, denkpause()))) return null;
      const ev = computerZug(sp, i, k.staerke);
      for (const e of ev) {
        if (e.typ === "ende") continue;
        zeichne();
        tisch.status(eventText(name, e));
        await sleep(e.typ === "auslegen" ? 1500 : 1000);
        if (!ctx.alive()) return null;
      }
      if (!sp.ende && sp.zuege > MAX_ZUEGE) beendeNachPunkten(sp);
    }
    if (!ctx.alive()) return null;

    zeichne();
    zeigeHand();
    const platz = platzierung(sp, 0);
    const gewonnen = sp.gewinner === 0;
    const rest = handPunkte(sp.spieler[0].hand);
    tisch.status(gewonnen ? "Gewonnen – alle Karten abgelegt!"
      : sp.gewinner != null ? `${sp.spieler[sp.gewinner].name} hat alle Karten abgelegt.`
        : `Die Runde ist zu Ende. Ihnen bleiben ${rest} Punkte auf der Hand.`);
    infoEl.textContent = "";
    await sleep(2000);
    if (!ctx.alive()) return null;

    const score = rommeScore({ gewonnen, platz, spielerAnzahl: sp.spieler.length, ausgelegt: sp.spieler[0].ausgelegt, handKarten: k.handKarten, fehler });
    const ergebnis = gewonnen ? "Gewonnen!" : sp.gewinner == null && platz === 1 ? "Knapp vorn: die wenigsten Punkte auf der Hand." : `Platz ${platz} von ${sp.spieler.length}.`;
    const abgelegt = `${sp.spieler[0].ausgelegt} Karten ausgelegt.`;
    const fehlerText = fehler === 0 ? "" : fehler === 1 ? " Ein Versuch passte nicht." : ` ${fehler} Versuche passten nicht.`;
    return { score, text: `${ergebnis} ${abgelegt}${fehlerText}` };
  },
};
