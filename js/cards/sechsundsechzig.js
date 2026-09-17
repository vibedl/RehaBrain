// Karten Stufe 9: Sechsundsechzig – Sie gegen den Computer
// 24 Karten (Neun bis Ass). Augen: Ass 11, Zehn 10, König 4, Dame/Ober 3, Bube/Unter 2, Neun 0 (zusammen 120).
// Solange der Talon offen ist: keine Bedienpflicht. Nach dem Zudrehen oder wenn der Talon leer ist:
// Farbe bedienen und den Stich möglichst übernehmen (Farbzwang + Stichzwang), sonst Trumpf, sonst beliebig.
// Melden: König + Dame gleicher Farbe = 20, in Trumpf 40 (zählt, sobald man einen Stich hat).
// Wer 66 Augen hat, sagt an. Spielpunkte: 1, 2 (Gegner unter 33 = Schneider), 3 (Gegner ohne Stich = Schwarz).
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { neuesDeck, kartenName, karteElement, BLAETTER } from "./deck.js";
import { RANG, mischen, nimmAusHand, waehleZug, Gedaechtnis, klemmeStaerke, denkpause } from "./engine.js";
import { Tisch, warteAufEingabe, farbName, farbCss } from "./tisch.js";

/* ================================================================ Stufen */

export function sechsundsechzigKonfig(stufe) {
  const s = Math.max(1, Math.min(20, stufe | 0 || 1));
  return {
    spiele: s <= 7 ? 2 : 3,
    augenSichtbar: s <= 8,          // Augenstand wird angezeigt
    auto66: s <= 5,                 // 66 wird automatisch angesagt
    hilfe: s <= 6,                  // gültige Karten hervorheben
    direkt: s <= 3,                 // Antippen spielt sofort
    zudrehen: s >= 9,               // Zudrehen erlaubt (und erklärt)
    mitzaehlen: s >= 9,             // Tastenfeld-Abfrage „Wie viele Augen haben Sie?“
    toleranz: s <= 14 ? 5 : 2,
    staerke: s <= 6 ? 1 : s <= 13 ? 2 : 3,
  };
}

/* ================================================================ Regeln (ohne DOM) */

const AUGEN = { 2: 0, 3: 10, 4: 2, 5: 3, 6: 4, 7: 11 }; // rang -> Augen
export const augen = (k) => AUGEN[k.rang] ?? 0;
export const summeAugen = (karten) => karten.reduce((s, k) => s + augen(k), 0);

/** 24er-Blatt: 7 und 8 entfernt. */
export function deck24(blatt = "franzoesisch") {
  return neuesDeck(blatt).filter((k) => k.rang >= RANG.NEUN).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Schlägt `antwort` die ausgespielte Karte? */
export function schlaegt(aus, antwort, trumpf) {
  if (antwort.farbe === aus.farbe) return augen(antwort) > augen(aus);
  return antwort.farbe === trumpf;
}

export function neuesSpiel({ blatt = "franzoesisch", rng = Math.random, ausspieler = 0, karten = null } = {}) {
  const deck = karten ?? mischen(deck24(blatt), rng);
  const haende = [deck.slice(0, 6), deck.slice(6, 12)];
  const talon = deck.slice(12); // talon[0] = aufgedeckter Trumpf (wird als letzte Karte gezogen), oben = Array-Ende
  return {
    blatt, rng,
    haende,
    talon,
    trumpf: talon[0].farbe,
    zugedreht: null,           // Index des Spielers, der zugedreht hat
    zudrehStand: null,         // { augenGegner, stichGegner } beim Zudrehen
    stiche: [[], []],          // gewonnene Karten
    stichAnzahl: [0, 0],
    augen: [0, 0],             // gezählte Augen inkl. wirksamer Meldungen
    offeneMeldung: [0, 0],     // Meldungen, die erst mit dem ersten Stich zählen
    meldungen: [[], []],       // [{farbe, wert}]
    meldPflicht: null,         // nach dem Melden: König oder Dame dieser Farbe ausspielen
    aktiv: ausspieler,
    ausspieler,
    tisch: null,               // { spieler, karte } – ausgespielte Karte
    letzterStich: null,
    ende: false,
    gewinner: null,
    punkte: 0,
    grund: "",
    gedaechtnis: [new Gedaechtnis(), new Gedaechtnis()],
  };
}

export const talonOffen = (sp) => sp.zugedreht == null && sp.talon.length > 0;
export const trumpfKarte = (sp) => (sp.talon.length ? sp.talon[0] : null);
const istAusspiel = (sp, i) => !sp.ende && sp.aktiv === i && !sp.tisch;

/** Gültige Karten für Spieler i. */
export function legaleKarten(sp, i) {
  const hand = sp.haende[i];
  if (sp.ende || sp.aktiv !== i) return [];
  if (!sp.tisch) {
    if (sp.meldPflicht) return hand.filter((k) => k.farbe === sp.meldPflicht && (k.rang === RANG.KOENIG || k.rang === RANG.DAME));
    return [...hand];
  }
  if (talonOffen(sp)) return [...hand];
  const aus = sp.tisch.karte;
  const farbe = hand.filter((k) => k.farbe === aus.farbe);
  if (farbe.length) {
    const hoeher = farbe.filter((k) => augen(k) > augen(aus));
    return hoeher.length ? hoeher : farbe;
  }
  const truempfe = hand.filter((k) => k.farbe === sp.trumpf);
  return truempfe.length ? truempfe : [...hand];
}
export const istLegal = (sp, i, karte) => legaleKarten(sp, i).some((k) => k.id === karte.id);

/** Farben, in denen Spieler i jetzt melden kann. */
export function meldbareFarben(sp, i) {
  if (!istAusspiel(sp, i) || sp.meldPflicht) return [];
  const hand = sp.haende[i];
  const gemeldet = new Set(sp.meldungen[i].map((m) => m.farbe));
  return [...new Set(hand.filter((k) => k.rang === RANG.KOENIG).map((k) => k.farbe))]
    .filter((f) => !gemeldet.has(f) && hand.some((k) => k.farbe === f && k.rang === RANG.DAME));
}

export function melde(sp, i, farbe) {
  if (!meldbareFarben(sp, i).includes(farbe)) return { ok: false, grund: "nicht möglich" };
  const wert = farbe === sp.trumpf ? 40 : 20;
  sp.meldungen[i].push({ farbe, wert });
  if (sp.stichAnzahl[i] > 0) sp.augen[i] += wert; else sp.offeneMeldung[i] += wert;
  sp.meldPflicht = farbe;
  return { ok: true, wert, zaehlt: sp.stichAnzahl[i] > 0 };
}

/** Trumpf-Neun gegen den aufgedeckten Trumpf tauschen. */
export function kannTauschen(sp, i) {
  if (!istAusspiel(sp, i) || !talonOffen(sp) || sp.talon.length <= 2) return false;
  if (sp.talon[0].rang === RANG.NEUN) return false;
  return sp.haende[i].some((k) => k.farbe === sp.trumpf && k.rang === RANG.NEUN);
}
export function tausche(sp, i) {
  if (!kannTauschen(sp, i)) return { ok: false };
  const hand = sp.haende[i];
  const neun = hand.find((k) => k.farbe === sp.trumpf && k.rang === RANG.NEUN);
  const alt = sp.talon[0];
  nimmAusHand(hand, neun);
  hand.push(alt);
  sp.talon[0] = neun;
  sp.gedaechtnis.forEach((g) => g.merke(neun));
  return { ok: true, genommen: alt, neun };
}

export const kannZudrehen = (sp, i) => istAusspiel(sp, i) && talonOffen(sp) && sp.talon.length > 2 && !sp.meldPflicht;
export function zudrehe(sp, i) {
  if (!kannZudrehen(sp, i)) return { ok: false };
  sp.zugedreht = i;
  sp.zudrehStand = { augenGegner: sp.augen[1 - i], stichGegner: sp.stichAnzahl[1 - i] > 0 };
  return { ok: true };
}

/** Spielpunkte für den Gewinner nach dem Stand des Verlierers. */
export function spielpunkteFuer(sp, gewinner) {
  const verlierer = 1 - gewinner;
  let augenV = sp.augen[verlierer], stichV = sp.stichAnzahl[verlierer] > 0;
  if (sp.zugedreht === gewinner && sp.zudrehStand) { augenV = sp.zudrehStand.augenGegner; stichV = sp.zudrehStand.stichGegner; }
  if (!stichV) return 3;
  if (augenV < 33) return 2;
  return 1;
}

function beende(sp, gewinner, punkte, grund) {
  sp.ende = true;
  sp.gewinner = gewinner;
  sp.punkte = punkte;
  sp.grund = grund;
  sp.tisch = null;
}

/** „66 erreicht“ ansagen. Stimmt es nicht, gewinnt der Gegner 2 Punkte. */
export function sage66(sp, i) {
  if (sp.ende) return { ok: false };
  if (sp.augen[i] >= 66) {
    beende(sp, i, spielpunkteFuer(sp, i), "ansage");
    return { ok: true, richtig: true, punkte: sp.punkte };
  }
  beende(sp, 1 - i, 2, "falsche ansage");
  return { ok: true, richtig: false, punkte: 2 };
}

/**
 * Karte spielen (ausspielen oder zugeben).
 * @returns {ok, grund?, stich?: {gewinner, karten, augen}, ende}
 */
export function spieleKarte(sp, i, karte) {
  if (sp.ende || sp.aktiv !== i) return { ok: false, grund: "nicht dran" };
  if (!sp.haende[i].some((k) => k.id === karte.id)) return { ok: false, grund: "nicht in der Hand" };
  if (!istLegal(sp, i, karte)) return { ok: false, grund: sp.meldPflicht && !sp.tisch ? "meldpflicht" : "bedienen" };
  nimmAusHand(sp.haende[i], karte);
  sp.gedaechtnis.forEach((g) => g.merke(karte));
  if (!sp.tisch) {
    sp.tisch = { spieler: i, karte };
    sp.meldPflicht = null;
    sp.aktiv = 1 - i;
    return { ok: true, ende: false };
  }
  const aus = sp.tisch.karte;
  const ausSpieler = sp.tisch.spieler;
  const gewinner = schlaegt(aus, karte, sp.trumpf) ? i : ausSpieler;
  const karten = [aus, karte];
  const wert = summeAugen(karten);
  sp.stiche[gewinner].push(...karten);
  sp.stichAnzahl[gewinner]++;
  sp.augen[gewinner] += wert + sp.offeneMeldung[gewinner];
  sp.offeneMeldung[gewinner] = 0;
  sp.letzterStich = { gewinner, karten, augen: wert, ausSpieler };
  sp.tisch = null;
  sp.aktiv = gewinner;
  const gezogen = [null, null];
  if (talonOffen(sp)) {
    gezogen[gewinner] = sp.talon.pop();
    sp.haende[gewinner].push(gezogen[gewinner]);
    gezogen[1 - gewinner] = sp.talon.pop();
    sp.haende[1 - gewinner].push(gezogen[1 - gewinner]);
  }
  sp.letzterStich.gezogen = gezogen;
  if (!sp.haende[0].length && !sp.haende[1].length) {
    if (sp.zugedreht != null) {
      // Wer zugedreht und nicht angesagt hat, verliert
      const g = 1 - sp.zugedreht;
      beende(sp, g, sp.zudrehStand?.stichGegner ? 2 : 3, "zudrehen verfehlt");
    } else {
      beende(sp, gewinner, spielpunkteFuer(sp, gewinner), "letzter stich");
    }
  }
  return { ok: true, stich: sp.letzterStich, ende: sp.ende };
}

/** Karten im Spiel (Test). */
export const kartenImSpiel = (sp) => [...sp.haende[0], ...sp.haende[1], ...sp.talon, ...sp.stiche[0], ...sp.stiche[1], ...(sp.tisch ? [sp.tisch.karte] : [])];

/* ---------------------------------------------------------------- Computer */

const paarTeil = (hand, k, meldungen) =>
  (k.rang === RANG.KOENIG || k.rang === RANG.DAME)
  && !meldungen.some((m) => m.farbe === k.farbe)
  && hand.some((x) => x.farbe === k.farbe && x.rang === (k.rang === RANG.KOENIG ? RANG.DAME : RANG.KOENIG));

/** Ist die Karte (nach Gedächtnis) die höchste noch mögliche ihrer Farbe? */
function sichererSieger(sp, i, k, gedaechtnis) {
  const hoehere = deck24(sp.blatt).filter((x) => x.farbe === k.farbe && augen(x) > augen(k));
  const eigen = new Set(sp.haende[i].map((x) => x.id));
  return hoehere.every((x) => eigen.has(x.id) || (gedaechtnis ? gedaechtnis.istRaus(x) : false));
}

export function bewerteAusspiel(sp, i, k, { gedaechtnis = null } = {}) {
  const hand = sp.haende[i];
  const trumpf = k.farbe === sp.trumpf;
  let w = 0;
  if (talonOffen(sp)) {
    w -= augen(k);
    if (trumpf) w -= 8;
    if (paarTeil(hand, k, sp.meldungen[i])) w -= 6;
  } else {
    const sieger = k.rang === RANG.ASS || sichererSieger(sp, i, k, gedaechtnis);
    const truempfe = hand.filter((x) => x.farbe === sp.trumpf).length;
    if (trumpf && truempfe >= 2) w += 4 + augen(k) / 4;
    if (sieger) w += 10 + augen(k); else w -= augen(k) + (trumpf ? 6 : 0);
  }
  return w;
}

export function bewerteZugabe(sp, i, k) {
  const aus = sp.tisch.karte;
  const hand = sp.haende[i];
  const trumpf = k.farbe === sp.trumpf;
  const wert = augen(aus) + augen(k);
  if (schlaegt(aus, k, sp.trumpf)) {
    let w = wert - (trumpf && aus.farbe !== sp.trumpf ? 7 + augen(k) * 0.4 : augen(k) * 0.2);
    if (sp.augen[i] + wert + sp.offeneMeldung[i] >= 66) w += 30;
    if (!talonOffen(sp)) w += 5;
    return w;
  }
  return -augen(k) - (trumpf ? 10 : 0) - (paarTeil(hand, k, sp.meldungen[i]) ? 6 : 0);
}

/** Entscheidungen vor dem Ausspielen (Tausch, Melden, Ansage, Zudrehen) und die Karte selbst. */
export function computerAusspielen(sp, i, staerke = 1, { zudrehenErlaubt = true } = {}) {
  const s = klemmeStaerke(staerke);
  const rng = sp.rng;
  const ev = [];
  if (sp.augen[i] >= 66) { const r = sage66(sp, i); ev.push({ typ: "ansage", ...r }); return ev; }
  if (kannTauschen(sp, i) && (s >= 2 || rng() < 0.7)) { const r = tausche(sp, i); ev.push({ typ: "tausch", ...r }); }
  const meldbar = meldbareFarben(sp, i);
  if (meldbar.length && (s >= 2 || rng() < 0.8)) {
    const farbe = meldbar.includes(sp.trumpf) ? sp.trumpf : meldbar[0];
    const r = melde(sp, i, farbe);
    ev.push({ typ: "melden", farbe, ...r });
    if (sp.augen[i] >= 66) { const a = sage66(sp, i); ev.push({ typ: "ansage", ...a }); return ev; }
  }
  if (zudrehenErlaubt && s >= 2 && kannZudrehen(sp, i)) {
    const hand = sp.haende[i];
    const truempfe = hand.filter((k) => k.farbe === sp.trumpf);
    const hoch = truempfe.filter((k) => k.rang === RANG.ASS || k.rang === RANG.ZEHN).length;
    const asse = hand.filter((k) => k.rang === RANG.ASS).length;
    const schwelle = s >= 3 ? 36 : 44;
    if (sp.augen[i] >= schwelle && truempfe.length >= 2 && hoch + asse >= 2) {
      zudrehe(sp, i);
      ev.push({ typ: "zudrehen" });
    }
  }
  const karte = waehleZug(legaleKarten(sp, i), {
    staerke: s, rng, gedaechtnis: sp.gedaechtnis[i],
    bewerte: (k, info) => bewerteAusspiel(sp, i, k, info),
  });
  const r = spieleKarte(sp, i, karte);
  ev.push({ typ: "karte", karte, ...r });
  return ev;
}

export function computerZugeben(sp, i, staerke = 1) {
  const s = klemmeStaerke(staerke);
  const karte = waehleZug(legaleKarten(sp, i), { staerke: s, rng: sp.rng, bewerte: (k) => bewerteZugabe(sp, i, k) });
  return { karte, ...spieleKarte(sp, i, karte) };
}

/** Ein Spiel Computer gegen Computer (Test). */
export function simuliereSpiel({ rng = Math.random, staerken = [1, 1], ausspieler = 0, zudrehen = true } = {}) {
  const sp = neuesSpiel({ rng, ausspieler });
  let sicherung = 0;
  while (!sp.ende && sicherung++ < 200) {
    const i = sp.aktiv;
    if (!sp.tisch) computerAusspielen(sp, i, staerken[i], { zudrehenErlaubt: zudrehen });
    else computerZugeben(sp, i, staerken[i]);
  }
  return { sp, sicherung };
}

/** Score: gewonnene Spiele, Regelfehler, Mitzähl-Genauigkeit (null = nicht abgefragt). */
export function sechsundsechzigScore({ gewonnen, spiele, fehler, genauigkeit = null }) {
  let basis = 0.3 + 0.7 * (gewonnen / Math.max(1, spiele));
  basis -= Math.min(0.25, fehler * 0.05);
  if (genauigkeit != null) basis = basis * 0.75 + genauigkeit * 0.25;
  return Math.round(Math.max(0, Math.min(1, basis)) * 100) / 100;
}

/* ================================================================ Oberfläche */

function romme66Styles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-ro-styles], link[href$="css/romme66.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/romme66.css", import.meta.url).href;
  link.setAttribute("data-ro-styles", "");
  document.head.append(link);
}

export default {
  id: "sechsundsechzig",
  bereich: "Kartenspiele",
  titel: "Sechsundsechzig",
  icon: "",
  anleitung: (stufe) => {
    const k = sechsundsechzigKonfig(stufe);
    return "Spielen Sie Stiche gegen den Computer. Wer zuerst 66 Augen hat, gewinnt das Spiel (Ass 11, Zehn 10, König 4, Dame 3, Bube 2, Neun 0). "
      + "König und Dame gleicher Farbe dürfen Sie melden: 20 Augen, in Trumpf 40. Ist der Stapel leer, müssen Sie Farbe bedienen und den Stich möglichst übernehmen."
      + (k.zudrehen ? " Mit „Zudrehen“ schließen Sie den Stapel – dann gelten die strengen Regeln sofort, und Sie müssen 66 erreichen." : "")
      + (k.auto66 ? "" : " Haben Sie 66 Augen, tippen Sie auf „66 ansagen“.")
      + (k.augenSichtbar ? "" : " Zählen Sie Ihre Augen selbst mit.");
  },

  async run(ctx) {
    const { stufe, settings, stage } = ctx;
    const blatt = settings?.blatt ?? "franzoesisch";
    const k = sechsundsechzigKonfig(stufe);
    romme66Styles();
    const wn = BLAETTER[blatt].wertNamen;
    const dameName = wn.D ?? wn.O;

    const tisch = new Tisch(ctx, { gegner: ["Computer"] });
    tisch.el.classList.add("ss-tisch");
    const standEl = h("p.spielstand.ss-stand");
    const augenEl = h("p.hinweis.ss-augen", { "aria-live": "polite" });
    const stichEl = h("div.ss-stich", { "aria-label": "Aktueller Stich" });
    tisch.gegnerReihe.before(standEl);
    tisch.mitte.after(stichEl);
    tisch.handEl.before(augenEl);

    let spielpunkte = [0, 0];
    let gewonnen = 0;
    let fehler = 0;
    const genau = [];

    const kartenPlatz = (karte, text, klasse = "") => h("div.ss-platz" + klasse, {}, karte ? karteElement(karte) : h("div.ss-leer"), h("span.ss-platztext", { text }));

    const zeichne = (sp, nr) => {
      standEl.textContent = `Spiel ${nr} von ${k.spiele} · Punkte: Sie ${spielpunkte[0]}, Computer ${spielpunkte[1]}`;
      tisch.setzeGegner(0, sp.haende[1].length, { aktiv: sp.aktiv === 1 && !sp.ende, info: `${sp.stichAnzahl[1]} ${sp.stichAnzahl[1] === 1 ? "Stich" : "Stiche"}${k.augenSichtbar ? ` · ${sp.augen[1]} Augen` : ""}` });
      tisch.setzeNachzieh(sp.talon.length);
      tisch.nachziehEl.classList.toggle("ss-zu", sp.zugedreht != null);
      const tk = trumpfKarte(sp);
      tisch.ablageEl.replaceChildren(tk && sp.zugedreht == null ? karteElement(tk) : h("div.ss-leer"));
      tisch.zusatzEl.replaceChildren(h("span.kt-chip.stapel." + farbCss(sp.trumpf, blatt), { text: `Trumpf: ${farbName(sp.trumpf, blatt)}` }));
      if (sp.zugedreht != null) tisch.zusatzEl.append(h("span.kt-chip.ss-zuchip", { text: sp.zugedreht === 0 ? "Sie haben zugedreht" : "Computer hat zugedreht" }));
      let t = `Ihre Stiche: ${sp.stichAnzahl[0]}`;
      if (k.augenSichtbar) {
        t += ` · Ihre Augen: ${sp.augen[0]}`;
        if (sp.offeneMeldung[0]) t += ` (+${sp.offeneMeldung[0]} nach dem ersten Stich)`;
      }
      if (sp.meldungen[0].length) t += ` · gemeldet: ${sp.meldungen[0].map((m) => `${farbName(m.farbe, blatt)} ${m.wert}`).join(", ")}`;
      augenEl.textContent = t;
      stichEl.replaceChildren(
        kartenPlatz(sp.tisch?.spieler === 1 ? sp.tisch.karte : null, "Computer"),
        kartenPlatz(sp.tisch?.spieler === 0 ? sp.tisch.karte : null, "Sie"),
      );
    };
    const zeigeStich = (stich) => {
      const [a, b] = stich.karten;
      const vonComputer = stich.ausSpieler === 1 ? a : b;
      const vonIhnen = stich.ausSpieler === 0 ? a : b;
      stichEl.replaceChildren(
        kartenPlatz(vonComputer, "Computer", stich.gewinner === 1 ? ".ss-sieger" : ""),
        kartenPlatz(vonIhnen, "Sie", stich.gewinner === 0 ? ".ss-sieger" : ""),
      );
    };
    const sortiert = (sp) => {
      const reihenfolge = [sp.trumpf, ...["kreuz", "pik", "herz", "karo"].filter((f) => f !== sp.trumpf)];
      return [...sp.haende[0]].sort((a, b) => reihenfolge.indexOf(a.farbe) - reihenfolge.indexOf(b.farbe) || augen(b) - augen(a));
    };

    // Tastenfeld: „Wie viele Augen haben Sie?“
    const tastenEingabe = (frage) => {
      let wert = "";
      const zeile = h("div.eingabezeile.ss-eingabe", { text: "_ _ _" });
      tisch.status(frage);
      return warteAufEingabe(ctx, (ende) => {
        const render = () => { zeile.textContent = wert ? wert.split("").join(" ") : "_ _ _"; };
        const tasten = [1, 2, 3, 4, 5, 6, 7, 8, 9, "Löschen", 0, "Fertig"].map((t) => h("button.taste" + (typeof t === "string" ? ".ss-wort" : ""), {
          type: "button", text: t,
          onTap: () => {
            if (t === "Löschen") wert = wert.slice(0, -1);
            else if (t === "Fertig") { if (wert) return ende(Number(wert)); }
            else if (wert.length < 3) wert += t;
            render();
          },
        }));
        tisch.aktionenEl.replaceChildren(h("div.ss-rechnen", {}, zeile, h("div.tastenfeld", {}, tasten)));
      }, () => tisch.aktionenEl.replaceChildren());
    };
    const augenAbfrage = async (sp, nr) => {
      const echt = sp.augen[0];
      const eingabe = await tastenEingabe("Wie viele Augen haben Sie gerade? (Meldungen mitzählen, sobald Sie einen Stich haben)");
      if (eingabe == null || !ctx.alive()) return false;
      const diff = Math.abs(eingabe - echt);
      genau.push(diff <= k.toleranz ? 1 : diff <= k.toleranz * 2 ? 0.5 : 0);
      if (diff === 0) feedback(stage, `Genau richtig: ${echt} Augen`, "gut");
      else if (diff <= k.toleranz) feedback(stage, `Fast: Es sind ${echt} Augen`, "gut");
      else feedback(stage, `Es sind ${echt} Augen`, "neutral");
      tisch.status(`Sie haben ${echt} Augen.`);
      zeichne(sp, nr);
      await sleep(1800);
      return ctx.alive();
    };

    // Menschliches Ausspielen (mit Tausch, Melden, Zudrehen, Ansage)
    const menschAusspielen = async (sp, nr) => {
      while (!sp.ende && sp.aktiv === 0 && !sp.tisch) {
        zeichne(sp, nr);
        if (k.auto66 && sp.augen[0] >= 66) {
          sage66(sp, 0);
          tisch.status("Sie haben 66 Augen erreicht!");
          return true;
        }
        const knoepfe = [];
        if (kannTauschen(sp, 0)) knoepfe.push({ id: "tausch", text: `${farbName(sp.trumpf, blatt)} Neun tauschen` });
        for (const f of meldbareFarben(sp, 0)) knoepfe.push({ id: "melden:" + f, text: `${farbName(f, blatt)} melden (${f === sp.trumpf ? 40 : 20})` });
        if (k.zudrehen && kannZudrehen(sp, 0)) knoepfe.push({ id: "zudrehen", text: "Zudrehen" });
        if (!k.auto66) knoepfe.push({ id: "66", text: "66 ansagen" });
        if (k.mitzaehlen) knoepfe.push({ id: "pruefen", text: "Augen prüfen" });
        tisch.status(sp.meldPflicht
          ? `Spielen Sie jetzt ${wn.K} oder ${dameName} in ${farbName(sp.meldPflicht, blatt)} aus.`
          : "Sie spielen aus. Jede Karte ist erlaubt.");
        const legal = legaleKarten(sp, 0);
        const wahl = await tisch.waehle({
          hand: sortiert(sp), spielbar: (x) => legal.some((l) => l.id === x.id), hilfe: k.hilfe || !!sp.meldPflicht, direkt: k.direkt, knoepfe,
        });
        if (!wahl || !ctx.alive()) return false;
        if (wahl.typ === "knopf") {
          if (wahl.id === "tausch") {
            const r = tausche(sp, 0);
            tisch.status(`Sie tauschen die Neun gegen ${kartenName(r.genommen)}.`);
            await sleep(1100);
          } else if (wahl.id.startsWith("melden:")) {
            const f = wahl.id.slice(7);
            const r = melde(sp, 0, f);
            feedback(stage, `${r.wert} gemeldet`, "gut");
            tisch.status(r.zaehlt ? `Sie melden ${r.wert} Augen.` : `Sie melden ${r.wert} Augen – sie zählen, sobald Sie einen Stich haben.`);
            await sleep(1300);
          } else if (wahl.id === "zudrehen") {
            const ja = await tisch.frage("Zudrehen? Danach wird nicht mehr gezogen, und Sie müssen 66 Augen erreichen.", [{ id: "ja", text: "Ja, zudrehen" }, { id: "nein", text: "Nein" }]);
            if (!ja || !ctx.alive()) return false;
            if (ja === "ja") { zudrehe(sp, 0); tisch.status("Sie haben zugedreht."); await sleep(1100); }
          } else if (wahl.id === "66") {
            const r = sage66(sp, 0);
            if (!r.richtig) fehler++;
            return true;
          } else if (wahl.id === "pruefen") {
            if (!(await augenAbfrage(sp, nr))) return false;
          }
          if (!ctx.alive()) return false;
          continue;
        }
        const r = spieleKarte(sp, 0, wahl.karte);
        if (!r.ok) {
          feedback(stage, `Nach dem Melden spielen Sie ${wn.K} oder ${dameName} dieser Farbe aus`, "neutral");
          await sleep(1300);
          if (!ctx.alive()) return false;
          continue;
        }
        return true;
      }
      return ctx.alive();
    };

    const menschZugeben = async (sp, nr) => {
      while (!sp.ende && sp.aktiv === 0 && sp.tisch) {
        zeichne(sp, nr);
        const legal = legaleKarten(sp, 0);
        tisch.status(talonOffen(sp)
          ? `Der Computer spielt ${kartenName(sp.tisch.karte)}. Legen Sie eine beliebige Karte dazu.`
          : `Der Computer spielt ${kartenName(sp.tisch.karte)}. Bedienen Sie die Farbe und stechen Sie, wenn möglich.`);
        const wahl = await tisch.waehle({ hand: sortiert(sp), spielbar: (x) => legal.some((l) => l.id === x.id), hilfe: k.hilfe, direkt: k.direkt });
        if (!wahl || !ctx.alive()) return false;
        if (wahl.typ !== "karte") continue;
        const r = spieleKarte(sp, 0, wahl.karte);
        if (!r.ok) {
          fehler++;
          const aus = sp.tisch.karte;
          const hatFarbe = sp.haende[0].some((x) => x.farbe === aus.farbe);
          feedback(stage, hatFarbe ? "Bitte die Farbe bedienen – und möglichst höher" : "Bitte mit Trumpf stechen", "neutral");
          await sleep(1400);
          if (!ctx.alive()) return false;
          continue;
        }
        return true;
      }
      return ctx.alive();
    };

    const stichAnzeigen = async (sp, nr, stich) => {
      zeichne(sp, nr);
      zeigeStich(stich);
      tisch.zeigeHand(sortiert(sp));
      const wer = stich.gewinner === 0 ? "Sie bekommen" : "Der Computer bekommt";
      tisch.status(`${wer} den Stich (${stich.augen} Augen).`);
      await sleep(1600);
      return ctx.alive();
    };

    for (let nr = 1; nr <= k.spiele; nr++) {
      if (!ctx.alive()) return null;
      const sp = neuesSpiel({ blatt, ausspieler: nr % 2 === 1 ? 0 : 1 });
      let stichNr = 0;
      zeichne(sp, nr);
      tisch.zeigeHand(sortiert(sp));
      tisch.status(`Spiel ${nr}: Trumpf ist ${farbName(sp.trumpf, blatt)}.`);
      await sleep(1600);
      if (!ctx.alive()) return null;

      while (!sp.ende) {
        if (!ctx.alive()) return null;
        const i = sp.aktiv;
        let stich = null;
        if (i === 0) {
          const vorher = sp.stichAnzahl[0] + sp.stichAnzahl[1];
          if (!sp.tisch) { if (!(await menschAusspielen(sp, nr))) return null; }
          else if (!(await menschZugeben(sp, nr))) return null;
          if (sp.stichAnzahl[0] + sp.stichAnzahl[1] > vorher) stich = sp.letzterStich;
          else { zeichne(sp, nr); tisch.zeigeHand(sortiert(sp)); }
        } else {
          tisch.zeigeHand(sortiert(sp));
          zeichne(sp, nr);
          if (!(await tisch.computerUeberlegt("Computer", denkpause()))) return null;
          const vorher = sp.stichAnzahl[0] + sp.stichAnzahl[1];
          if (!sp.tisch) {
            const ev = computerAusspielen(sp, 1, k.staerke, { zudrehenErlaubt: k.zudrehen });
            for (const e of ev) {
              if (e.typ === "karte") continue;
              const text = e.typ === "tausch" ? `Der Computer tauscht die Trumpf-Neun gegen ${kartenName(e.genommen)}.`
                : e.typ === "melden" ? `Der Computer meldet ${e.wert} in ${farbName(e.farbe, blatt)}.`
                  : e.typ === "zudrehen" ? "Der Computer dreht zu – ab jetzt gilt: Farbe bedienen und stechen."
                    : e.typ === "ansage" ? "Der Computer sagt 66 an." : "";
              zeichne(sp, nr);
              tisch.status(text);
              await sleep(1400);
              if (!ctx.alive()) return null;
            }
          } else {
            computerZugeben(sp, 1, k.staerke);
          }
          if (sp.stichAnzahl[0] + sp.stichAnzahl[1] > vorher) stich = sp.letzterStich;
          else zeichne(sp, nr);
        }
        if (stich) {
          stichNr++;
          if (!(await stichAnzeigen(sp, nr, stich))) return null;
          if (!sp.ende && k.mitzaehlen && (stichNr === 4 || stichNr === 8)) {
            if (!(await augenAbfrage(sp, nr))) return null;
          }
          if (!sp.ende && k.auto66 && sp.augen[0] >= 66) sage66(sp, 0);
        }
      }

      // Spielende
      spielpunkte[sp.gewinner] += sp.punkte;
      if (sp.gewinner === 0) gewonnen++;
      zeichne(sp, nr);
      tisch.zeigeHand(sortiert(sp));
      const p = sp.punkte === 1 ? "1 Punkt" : `${sp.punkte} Punkte`;
      const texte = {
        ansage: sp.gewinner === 0 ? `66 erreicht – Sie gewinnen ${p}!` : `Der Computer hat 66 erreicht und bekommt ${p}.`,
        "falsche ansage": sp.gewinner === 0 ? `Der Computer hatte noch keine 66. Sie bekommen ${p}.` : `Noch keine 66 Augen (${sp.augen[0]}). Der Computer bekommt ${p}.`,
        "letzter stich": sp.gewinner === 0 ? `Sie machen den letzten Stich und gewinnen ${p}.` : `Der Computer macht den letzten Stich und bekommt ${p}.`,
        "zudrehen verfehlt": sp.gewinner === 0 ? `Der Computer hat zugedreht, aber keine 66 erreicht. Sie bekommen ${p}.` : `Nach dem Zudrehen fehlten die 66 Augen. Der Computer bekommt ${p}.`,
      };
      tisch.status(texte[sp.grund] ?? "Spiel beendet.");
      augenEl.textContent = `Augen am Ende: Sie ${sp.augen[0]}, Computer ${sp.augen[1]}`;
      if (sp.gewinner === 0) feedback(stage, "Spiel gewonnen!", "gut");
      await sleep(3000);
      if (!ctx.alive()) return null;
      stichEl.replaceChildren();
    }

    const genauigkeit = genau.length ? genau.reduce((a, b) => a + b, 0) / genau.length : null;
    const score = sechsundsechzigScore({ gewonnen, spiele: k.spiele, fehler, genauigkeit });
    let text = `${gewonnen} von ${k.spiele} Spielen gewonnen (Punkte ${spielpunkte[0]} zu ${spielpunkte[1]}).`;
    if (fehler) text += fehler === 1 ? " Einmal nicht richtig bedient." : ` ${fehler} Regelfehler.`;
    if (genauigkeit != null) text += ` Mitzählen: ${Math.round(genauigkeit * 100)} % genau.`;
    return { score, text };
  },
};
