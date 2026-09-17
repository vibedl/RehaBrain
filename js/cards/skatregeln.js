// Skat-Regeln nach Deutscher Skatordnung / ISkO – reine Logik OHNE DOM (läuft auch in Node).
// Enthält: Augen, Trumpf und Rangfolgen (Farb-, Grand-, Null-, Ramschspiel), Bedienpflicht,
// Stichgewinner, Reizwerte, Spitzen, Spielwert, Überreizt, Ramsch-Wertung, Bock-Liste
// und den kompletten Spielablauf (Reizen, Skat, Stiche) als klonbare, reine Datenobjekte.
//
// Kartenformat aus deck.js: { id, farbe, farbIndex, rang (0 = Sieben … 3 = Zehn, 4 = Bube, 5 = Dame, 6 = König, 7 = Ass), wert, blatt }
import { RANG, FARBEN, mischen } from "./engine.js";
import { neuesDeck, BLAETTER } from "./deck.js";

/* ================================================================ Grundwerte */

/** Augen je Rang: Sieben, Acht, Neun = 0 · Zehn 10 · Bube/Unter 2 · Dame/Ober 3 · König 4 · Ass/Daus 11 */
export const AUGEN_JE_RANG = [0, 0, 0, 10, 2, 3, 4, 11];
export const augen = (k) => AUGEN_JE_RANG[k.rang];
export const augenSumme = (karten) => karten.reduce((s, k) => s + augen(k), 0);

export const GRUNDWERT = { karo: 9, herz: 10, pik: 11, kreuz: 12, grand: 24 };
export const NULLWERT = { einfach: 23, hand: 35, ouvert: 46, ouvertHand: 59 };
const NULL_STAFFEL = [23, 35, 46, 59];

/** Reihenfolge innerhalb einer Farbe (ohne Buben) im Farb-/Grand-/Ramschspiel: 7 8 9 D K 10 A */
const FARB_ORDNUNG = [0, 1, 2, 5, -1, 3, 4, 6]; // Index = rang

/**
 * Spiel-Objekt:
 * { art: "farbe"|"grand"|"null"|"ramsch", trumpf: "kreuz"|… (nur art "farbe"),
 *   hand, schneiderAngesagt, schwarzAngesagt, ouvert }
 */
export function neuesSpielObjekt(art, { trumpf = null, hand = false, schneiderAngesagt = false, schwarzAngesagt = false, ouvert = false } = {}) {
  const s = { art, trumpf: art === "farbe" ? trumpf : null, hand: !!hand, schneiderAngesagt: !!schneiderAngesagt, schwarzAngesagt: !!schwarzAngesagt, ouvert: !!ouvert };
  if (art === "farbe" || art === "grand") {
    if (s.ouvert) { s.hand = true; s.schwarzAngesagt = true; } // Ouvert im Farb-/Grandspiel = Hand und Schwarz angesagt
    if (s.schwarzAngesagt) s.schneiderAngesagt = true;
    if (s.schneiderAngesagt) s.hand = true; // Ansagen nur beim Handspiel
  } else {
    s.schneiderAngesagt = false; s.schwarzAngesagt = false;
    if (art === "ramsch") { s.hand = false; s.ouvert = false; }
  }
  return s;
}

/* ================================================================ Trumpf, Bedienen, Stich */

export const istBube = (k) => k.rang === RANG.BUBE;

export function istTrumpf(k, spiel) {
  if (!spiel || spiel.art === "null") return false;
  if (istBube(k)) return true;
  return spiel.art === "farbe" && k.farbe === spiel.trumpf;
}

/** Welche „Farbe“ eine Karte beim Bedienen hat: "trumpf" oder die Kartenfarbe. */
export const bedienFarbe = (k, spiel) => (istTrumpf(k, spiel) ? "trumpf" : k.farbe);

/** Stärke innerhalb der eigenen Bedienfarbe (höher schlägt niedriger). */
export function kartenStaerke(k, spiel) {
  if (spiel.art === "null") return k.rang; // 7 8 9 10 B D K A
  if (istBube(k)) return 20 + (3 - k.farbIndex); // Kreuz > Pik > Herz > Karo
  return FARB_ORDNUNG[k.rang];
}

/** Schlägt `k` die Karte `best`, wenn `best` gerade den Stich hält? */
export function schlaegt(k, best, spiel) {
  const tk = istTrumpf(k, spiel), tb = istTrumpf(best, spiel);
  if (tk && !tb) return true;
  if (bedienFarbe(k, spiel) !== bedienFarbe(best, spiel)) return false;
  return kartenStaerke(k, spiel) > kartenStaerke(best, spiel);
}

/** Index der Karte, die den (Teil-)Stich gerade hält bzw. gewinnt. */
export function stichSieger(karten, spiel) {
  let best = 0;
  for (let i = 1; i < karten.length; i++) if (schlaegt(karten[i], karten[best], spiel)) best = i;
  return best;
}

/** Gültige Karten: Bedienpflicht (Trumpf mit Trumpf, Farbe mit Farbe), sonst beliebig. */
export function legaleKarten(hand, stichKarten, spiel) {
  if (!stichKarten || !stichKarten.length) return [...hand];
  const gefordert = bedienFarbe(stichKarten[0], spiel);
  const passend = hand.filter((k) => bedienFarbe(k, spiel) === gefordert);
  return passend.length ? passend : [...hand];
}
export const istLegal = (karte, hand, stichKarten, spiel) => legaleKarten(hand, stichKarten, spiel).some((k) => k.id === karte.id);

/** Sortierschlüssel für die Anzeige (kleiner = weiter links): Trumpf zuerst, dann Farben, jeweils hoch → niedrig. */
export function anzeigeSchluessel(k, spiel) {
  const sp = spiel ?? { art: "grand" };
  if (istTrumpf(k, sp)) return 0 + (40 - kartenStaerke(k, sp));
  const fi = FARBEN.indexOf(k.farbe);
  return 100 + fi * 20 + (19 - kartenStaerke(k, sp));
}
export const sortiereSkatHand = (hand, spiel) => [...hand].sort((a, b) => anzeigeSchluessel(a, spiel) - anzeigeSchluessel(b, spiel));

/* ================================================================ Spitzen, Reizwerte, Spielwert */

/** Trumpfreihe (höchste zuerst), gegen die die Spitzen gezählt werden. */
export function trumpfReihe(spiel) {
  const buben = FARBEN.map((f) => `${f}-${RANG.BUBE}`);
  if (spiel.art === "grand") return buben;
  if (spiel.art !== "farbe") return [];
  const t = spiel.trumpf;
  return [...buben, ...[RANG.ASS, RANG.ZEHN, RANG.KOENIG, RANG.DAME, 2, 1, 0].map((r) => `${t}-${r}`)];
}

/** Spitzen („mit“/„ohne“) – gezählt über Hand + Skat des Alleinspielers. */
export function spitzen(karten, spiel) {
  const reihe = trumpfReihe(spiel);
  if (!reihe.length) return { mit: false, anzahl: 0 };
  const ids = new Set(karten.map((k) => k.id));
  const mit = ids.has(reihe[0]);
  let anzahl = 0;
  while (anzahl < reihe.length && ids.has(reihe[anzahl]) === mit) anzahl++;
  return { mit, anzahl };
}

export function grundwert(spiel) {
  if (spiel.art === "grand") return GRUNDWERT.grand;
  if (spiel.art === "farbe") return GRUNDWERT[spiel.trumpf];
  return 0;
}

export function nullWert(spiel) {
  if (spiel.ouvert) return spiel.hand ? NULLWERT.ouvertHand : NULLWERT.ouvert;
  return spiel.hand ? NULLWERT.hand : NULLWERT.einfach;
}

/**
 * Spielwert eines Farb-, Grand- oder Nullspiels.
 * spitzenAnzahl: Zahl der Spitzen; schneider/schwarz: tatsächlich erreicht (egal von welcher Partei).
 * Gibt {wert, grund, stufen} zurück. Stufen = Spitzen + Spiel + Hand + Schneider + angesagt + Schwarz + angesagt + Ouvert.
 */
export function spielwert(spiel, { spitzenAnzahl = 0, schneider = false, schwarz = false } = {}) {
  if (spiel.art === "null") return { wert: nullWert(spiel), grund: nullWert(spiel), stufen: 1 };
  if (spiel.art === "ramsch") return { wert: 0, grund: 0, stufen: 0 };
  const s = neuesSpielObjekt(spiel.art, spiel);
  const sw = schwarz || s.schwarzAngesagt;       // angesagtes Schwarz zählt auch die Stufe „Schwarz“
  const sn = schneider || sw || s.schneiderAngesagt;
  const stufen = spitzenAnzahl + 1 + (s.hand ? 1 : 0) + (sn ? 1 : 0) + (s.schneiderAngesagt ? 1 : 0)
    + (sw ? 1 : 0) + (s.schwarzAngesagt ? 1 : 0) + (s.ouvert ? 1 : 0);
  const grund = grundwert(s);
  return { wert: grund * stufen, grund, stufen };
}

let _reizwerte = null;
/** Alle möglichen Reizwerte aufsteigend: 18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, … 264 */
export function reizwerte() {
  if (_reizwerte) return _reizwerte;
  const set = new Set(NULL_STAFFEL);
  for (const g of [9, 10, 11, 12]) for (let m = 2; m <= 18; m++) set.add(g * m);
  for (let m = 2; m <= 11; m++) set.add(24 * m);
  _reizwerte = [...set].filter((w) => w >= 18).sort((a, b) => a - b);
  return _reizwerte;
}
/** Nächster Reizwert nach `wert` (0 → 18). null, wenn keiner mehr geht. */
export function naechsterReizwert(wert = 0) {
  return reizwerte().find((w) => w > wert) ?? null;
}

/** Höchster Wert, den dieses Spiel ohne Schneider/Schwarz sicher erreicht (für Reiz-Hilfen). */
export function mindestSpielwert(spiel, kartenMitSkat) {
  if (spiel.art === "null") return nullWert(spiel);
  return spielwert(spiel, { spitzenAnzahl: spitzen(kartenMitSkat, spiel).anzahl }).wert;
}
/** Höchster überhaupt erreichbarer Wert (mit Schneider und Schwarz, ohne Ansagen zu ändern). */
export function maximalerSpielwert(spiel, kartenMitSkat) {
  if (spiel.art === "null") return nullWert(spiel);
  return spielwert(spiel, { spitzenAnzahl: spitzen(kartenMitSkat, spiel).anzahl, schneider: true, schwarz: true }).wert;
}

/**
 * Auswertung eines Farb-, Grand- oder Nullspiels (ohne Kontra/Bock – die kommen in `listenPunkte`).
 * augenAllein: Augen des Alleinspielers inkl. Skat; sticheAllein: Anzahl seiner Stiche.
 * Verlorene Spiele zählen doppelt negativ (ISkO).
 */
export function werteSpielAus({ spiel, reizwert = 18, kartenMitSkat = [], augenAllein = 0, sticheAllein = 0 }) {
  const s = neuesSpielObjekt(spiel.art, spiel);
  if (s.art === "null") {
    let wert = nullWert(s);
    let gewonnen = sticheAllein === 0;
    let ueberreizt = false;
    if (reizwert > wert) {
      ueberreizt = true; gewonnen = false;
      wert = NULL_STAFFEL.find((w) => w >= reizwert) ?? reizwert;
    }
    return { gewonnen, wert, punkte: gewonnen ? wert : -2 * wert, ueberreizt, schneider: false, schwarz: false, spitzen: { mit: false, anzahl: 0 }, grund: wert, stufen: 1 };
  }
  const sp = spitzen(kartenMitSkat, s);
  const schwarz = sticheAllein === 10 || sticheAllein === 0;
  const schneider = augenAllein >= 90 || augenAllein <= 30;
  let gewonnen = augenAllein >= 61;
  if (s.schneiderAngesagt && augenAllein < 90) gewonnen = false;
  if (s.schwarzAngesagt && sticheAllein < 10) gewonnen = false;
  const w = spielwert(s, { spitzenAnzahl: sp.anzahl, schneider, schwarz });
  let wert = w.wert;
  let ueberreizt = false;
  if (wert < reizwert) {
    ueberreizt = true; gewonnen = false;
    wert = w.grund * Math.ceil(reizwert / w.grund); // kleinstes Vielfaches des Grundwerts, das den Reizwert erreicht
  }
  return { gewonnen, wert, punkte: gewonnen ? wert : -2 * wert, ueberreizt, schneider, schwarz, spitzen: sp, grund: w.grund, stufen: w.stufen };
}

/** Kontra, Re und Bock verdoppeln jeweils. */
export function listenPunkte(punkte, { kontra = false, re = false, bock = false } = {}) {
  return punkte * (kontra ? 2 : 1) * (kontra && re ? 2 : 1) * (bock ? 2 : 1);
}

/**
 * Ramsch-Wertung. augen/stiche: je Spieler (Skat ist schon beim Gewinner des letzten Stichs eingerechnet).
 * Wer die meisten Augen hat, verliert und bekommt sie als Minuspunkte (Gleichstand: alle Betroffenen).
 * Jungfrau: jeder Spieler ohne Stich verdoppelt den Verlust. Durchmarsch: einer macht alle Stiche → +120.
 * schiebungen: beim Schieberamsch verdoppelt jedes Schieben. bock: verdoppelt.
 */
export function werteRamschAus({ augen: a, stiche, jungfrau = true, schiebungen = 0, bock = false }) {
  const n = a.length;
  const punkte = Array(n).fill(0);
  const durch = stiche.findIndex((s) => s === 10);
  const faktorBasis = 2 ** schiebungen * (bock ? 2 : 1);
  if (durch >= 0) {
    punkte[durch] = 120 * faktorBasis;
    return { durchmarsch: durch, verlierer: [], jungfrauen: [], punkte, faktor: faktorBasis };
  }
  const max = Math.max(...a);
  const verlierer = a.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0);
  const jungfrauen = jungfrau ? stiche.map((s, i) => (s === 0 ? i : -1)).filter((i) => i >= 0) : [];
  const faktor = faktorBasis * 2 ** jungfrauen.length;
  for (const v of verlierer) punkte[v] = -max * faktor;
  return { durchmarsch: null, verlierer, jungfrauen, punkte, faktor };
}

/* ================================================================ Bock */

/** Standard-Auslöser einer Bockrunde. */
export const BOCK_AUSLOESER = {
  kontra: true,          // ein Kontra wurde gegeben
  sechzigSechzig: true,  // Spiel endet 60:60
  verlorenAb: 100,       // verlorenes Spiel mit Spielwert ≥ 100 (0 = aus)
  durchmarsch: false,    // Durchmarsch im Ramsch
};

/** Prüft, ob ein beendetes Spiel eine Bockrunde auslöst. Gibt den Grund als Text zurück oder null. */
export function bockGrund(e, ausloeser = BOCK_AUSLOESER) {
  if (!ausloeser || !e) return null;
  if (ausloeser.kontra && e.kontra) return "Kontra";
  if (ausloeser.sechzigSechzig && !e.ramsch && e.augenAllein === 60) return "60 zu 60";
  if (ausloeser.verlorenAb && !e.ramsch && e.gewonnen === false && e.wert >= ausloeser.verlorenAb) return `verlorenes Spiel über ${ausloeser.verlorenAb}`;
  if (ausloeser.durchmarsch && e.ramsch && e.durchmarsch != null) return "Durchmarsch";
  return null;
}

/**
 * Bock-Liste: eine Bockrunde = so viele Spiele, wie Spieler am Tisch sind (jeder gibt einmal).
 * Mehrere Auslöser hängen weitere Runden hinten an (sie stapeln sich nicht).
 * Ablauf: vor dem Spiel `istBock()`, danach `spielBeendet(ergebnis)`.
 */
export function neueBockliste(spielerAnzahl = 3, ausloeser = BOCK_AUSLOESER) {
  return { spielerAnzahl, ausloeser, offen: 0 };
}
export const istBock = (b) => !!b && !!b.ausloeser && b.offen > 0;
export function bockSpielBeendet(b, ergebnis) {
  if (!b || !b.ausloeser) return { ausgeloest: false, grund: null, war: false };
  const war = b.offen > 0;
  if (war) b.offen--;
  const grund = bockGrund(ergebnis, b.ausloeser);
  if (grund) b.offen += b.spielerAnzahl;
  return { ausgeloest: !!grund, grund, war };
}

/* ================================================================ Reizen */

/**
 * Reiz-Zustand (reines Objekt, klonbar). Plätze relativ zum Geber:
 * Vorhand = links vom Geber (hört zuerst), Mittelhand sagt Vorhand, danach sagt Hinterhand dem Sieger.
 * Haben beide anderen gepasst, ohne dass gereizt wurde, darf Vorhand selbst 18 spielen.
 */
export function neueReizung(geber, anzahl = 3) {
  const vorhand = (geber + 1) % anzahl, mittelhand = (geber + 2) % anzahl, hinterhand = geber % anzahl;
  return { vorhand, mittelhand, hinterhand, phase: 1, sager: mittelhand, hoerer: vorhand, wert: 0, angebot: null, ende: false, alleinspieler: null, gepasst: [] };
}

/** Aktuelle Frage oder null, wenn das Reizen vorbei ist.
 *  {spieler, art: "sagen"|"hoeren"|"vorhand", wert} – "sagen": Wert bieten oder passen; "hoeren": Ja oder passen; "vorhand": 18 selbst spielen? */
export function reizFrage(r) {
  if (r.ende) return null;
  if (r.phase === 3) return { spieler: r.vorhand, art: "vorhand", wert: 18 };
  if (r.angebot != null) return { spieler: r.hoerer, art: "hoeren", wert: r.angebot };
  return { spieler: r.sager, art: "sagen", wert: naechsterReizwert(r.wert) };
}

/** Antwort auf die aktuelle Frage anwenden (ja = sagen/halten, false = passen). */
export function reizAntwort(r, ja) {
  const f = reizFrage(r);
  if (!f) return r;
  if (f.art === "vorhand") {
    r.ende = true;
    if (ja) { r.alleinspieler = r.vorhand; r.wert = 18; } else r.gepasst.push(r.vorhand);
    return r;
  }
  if (f.art === "sagen") {
    if (ja && f.wert != null) { r.angebot = f.wert; return r; }
    r.gepasst.push(r.sager);
    return phaseEnde(r, r.hoerer);
  }
  // hören
  if (ja) { r.wert = r.angebot; r.angebot = null; return r; }
  r.wert = r.angebot; r.angebot = null;
  r.gepasst.push(r.hoerer);
  return phaseEnde(r, r.sager);
}

function phaseEnde(r, sieger) {
  if (r.phase === 1) {
    r.phase = 2; r.sager = r.hinterhand; r.hoerer = sieger; r.angebot = null;
    return r;
  }
  // Phase 2 vorbei
  if (r.wert === 0) {
    if (sieger === r.vorhand && !r.gepasst.includes(r.vorhand)) { r.phase = 3; return r; }
    // Nicht möglich (ohne Gebot gewinnt immer der Hörer = Vorhand) – Sicherung
  }
  r.ende = true;
  r.alleinspieler = r.wert > 0 ? sieger : null;
  return r;
}

export const reizErgebnis = (r) => ({ fertig: r.ende, alleGepasst: r.ende && r.alleinspieler == null, alleinspieler: r.alleinspieler, wert: r.wert });

/* ================================================================ Spielablauf */

const nachId = (a, b) => (a.id < b.id ? -1 : 1);

/**
 * Neues Spiel (ein Geben). Reines Datenobjekt – mit structuredClone kopierbar (z. B. für „Zug zurücknehmen“).
 * karten: optional vorgegebene 32 Karten (Reihenfolge = Austeilung: 0–9, 10–19, 20–29, Skat 30–31).
 */
export function neuesSkatSpiel({ geber = 0, rng = Math.random, blatt = "franzoesisch", karten = null } = {}) {
  const deck = karten ?? mischen(neuesDeck(blatt).sort(nachId), rng);
  const haende = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)];
  const skat = deck.slice(30, 32);
  return {
    geber, blatt,
    vorhand: (geber + 1) % 3,
    haende,
    skat,
    urHaende: haende.map((h) => [...h]),
    urSkat: [...skat],
    reizung: neueReizung(geber),
    reizwert: 0,
    alleinspieler: null,
    spiel: null,
    skatAufgenommen: false,
    kontra: false, re: false,
    schiebungen: 0, schiebeSpieler: [],
    stiche: [],               // [{karten:[3], spieler:[3], sieger}]
    stich: { karten: [], spieler: [] },
    amZug: null,
    augen: [0, 0, 0],
    stichZahl: [0, 0, 0],
    skatAn: null,             // wer die Skat-Augen bekommt
    fertig: false,
  };
}

/** Alleinspieler nimmt den Skat auf (Hand hat dann 12 Karten). */
export function nimmSkat(sp, i = sp.alleinspieler) {
  sp.haende[i].push(...sp.skat);
  sp.skat = [];
  sp.skatAufgenommen = true;
}

/** Zwei Karten drücken. @returns {ok, grund} */
export function druecke(sp, i, karten) {
  const hand = sp.haende[i];
  if (!karten || karten.length !== 2 || karten[0].id === karten[1].id) return { ok: false, grund: "genau zwei Karten" };
  if (!karten.every((k) => hand.some((x) => x.id === k.id))) return { ok: false, grund: "nicht in der Hand" };
  const ids = new Set(karten.map((k) => k.id));
  sp.haende[i] = hand.filter((k) => !ids.has(k.id));
  sp.skat = hand.filter((k) => ids.has(k.id));
  return { ok: true };
}

/** Spiel ansagen und das Ausspielen beginnen (Vorhand kommt raus). */
export function sageAn(sp, alleinspieler, reizwert, spiel) {
  sp.alleinspieler = alleinspieler;
  sp.reizwert = reizwert;
  sp.spiel = neuesSpielObjekt(spiel.art, { ...spiel, hand: spiel.hand || !sp.skatAufgenommen });
  sp.skatAn = alleinspieler;
  sp.amZug = sp.vorhand;
}

/** Ramsch beginnen (alle haben gepasst). Der Skat geht an den Gewinner des letzten Stichs. */
export function starteRamsch(sp) {
  sp.alleinspieler = null;
  sp.reizwert = 0;
  sp.spiel = neuesSpielObjekt("ramsch");
  sp.amZug = sp.vorhand;
}

/**
 * Schieberamsch: Spieler i nimmt den Skat (true) und legt zwei Karten (ohne Buben) wieder hin – oder schiebt ungesehen weiter (false).
 * Jedes Schieben mit Aufnahme verdoppelt. @returns {ok, grund}
 */
export function schiebeRamsch(sp, i, nimmt, zurueck = null) {
  if (!nimmt) return { ok: true };
  const hand12 = [...sp.haende[i], ...sp.skat];
  if (!zurueck || zurueck.length !== 2 || zurueck[0].id === zurueck[1].id) return { ok: false, grund: "genau zwei Karten" };
  if (zurueck.some(istBube)) return { ok: false, grund: "Buben dürfen nicht geschoben werden" };
  if (!zurueck.every((k) => hand12.some((x) => x.id === k.id))) return { ok: false, grund: "nicht in der Hand" };
  const ids = new Set(zurueck.map((k) => k.id));
  sp.haende[i] = hand12.filter((k) => !ids.has(k.id));
  sp.skat = hand12.filter((k) => ids.has(k.id));
  sp.schiebungen++;
  sp.schiebeSpieler.push(i);
  return { ok: true };
}

export const partei = (sp, i) => (sp.spiel?.art === "ramsch" || sp.alleinspieler == null ? i : i === sp.alleinspieler ? "allein" : "gegner");

/** Gültige Karten für Spieler i im aktuellen Stich. */
export const gueltigeKarten = (sp, i) => legaleKarten(sp.haende[i], sp.stich.karten, sp.spiel);

/**
 * Karte spielen. @returns {ok, grund?, stichFertig, sieger, spielFertig}
 * grund: "nicht dran" | "nicht in der Hand" | "bedienen" | "vorbei"
 */
export function spieleKarte(sp, i, karte) {
  if (sp.fertig) return { ok: false, grund: "vorbei" };
  if (i !== sp.amZug) return { ok: false, grund: "nicht dran" };
  const hand = sp.haende[i];
  const idx = hand.findIndex((k) => k.id === karte.id);
  if (idx < 0) return { ok: false, grund: "nicht in der Hand" };
  if (!istLegal(hand[idx], hand, sp.stich.karten, sp.spiel)) return { ok: false, grund: "bedienen" };
  const k = hand.splice(idx, 1)[0];
  sp.stich.karten.push(k);
  sp.stich.spieler.push(i);
  if (sp.stich.karten.length < 3) {
    sp.amZug = (i + 1) % 3;
    return { ok: true, stichFertig: false, sieger: null, spielFertig: false };
  }
  const si = stichSieger(sp.stich.karten, sp.spiel);
  const sieger = sp.stich.spieler[si];
  sp.augen[sieger] += augenSumme(sp.stich.karten);
  sp.stichZahl[sieger]++;
  sp.stiche.push({ karten: sp.stich.karten, spieler: sp.stich.spieler, sieger });
  sp.stich = { karten: [], spieler: [] };
  sp.amZug = sieger;
  let spielFertig = sp.stiche.length === 10;
  if (sp.spiel.art === "null" && sieger === sp.alleinspieler) spielFertig = true;
  if (spielFertig) beendeSpiel(sp, sieger);
  return { ok: true, stichFertig: true, sieger, spielFertig };
}

function beendeSpiel(sp, letzterSieger) {
  sp.fertig = true;
  sp.amZug = null;
  if (sp.spiel.art === "ramsch") {
    sp.skatAn = letzterSieger;
    sp.augen[letzterSieger] += augenSumme(sp.skat);
  } else if (sp.spiel.art !== "null") {
    sp.augen[sp.alleinspieler] += augenSumme(sp.skat);
  }
}

/** Alle bisher offen gespielten Karten (fertige Stiche + aktueller Stich). */
export function gespielteKarten(sp) {
  const out = [];
  for (const s of sp.stiche) out.push(...s.karten);
  out.push(...sp.stich.karten);
  return out;
}

/** Summe aller Augen am Spielende inkl. Skat und Resthänden (muss immer 120 sein). */
export function augenGesamt(sp) {
  return sp.augen.reduce((a, b) => a + b, 0) + (sp.spiel?.art === "null" ? augenSumme(sp.skat) + sp.haende.reduce((s, h) => s + augenSumme(h), 0) : 0);
}

/**
 * Ergebnis eines fertigen Spiels inkl. Kontra/Re/Bock.
 * @returns {ramsch, gewonnen, wert, punkte: [3] (Listenpunkte je Spieler), augenAllein, ueberreizt, schneider, schwarz, spitzen, kontra, re, bock, …}
 */
export function spielErgebnis(sp, { bock = false, jungfrau = true } = {}) {
  if (sp.spiel.art === "ramsch") {
    const r = werteRamschAus({ augen: sp.augen, stiche: sp.stichZahl, jungfrau, schiebungen: sp.schiebungen, bock });
    return { ramsch: true, ...r, augen: [...sp.augen], stiche: [...sp.stichZahl], bock, kontra: false, re: false };
  }
  const a = sp.alleinspieler;
  const kartenMitSkat = [...sp.urHaende[a], ...sp.urSkat];
  const e = werteSpielAus({ spiel: sp.spiel, reizwert: sp.reizwert, kartenMitSkat, augenAllein: sp.augen[a], sticheAllein: sp.stichZahl[a] });
  const lp = listenPunkte(e.punkte, { kontra: sp.kontra, re: sp.re, bock });
  const punkte = [0, 0, 0];
  punkte[a] = lp;
  return { ramsch: false, ...e, listenwert: lp, punkte, alleinspieler: a, augenAllein: sp.augen[a], sticheAllein: sp.stichZahl[a], bock, kontra: sp.kontra, re: sp.re, spiel: sp.spiel, reizwert: sp.reizwert };
}

/* ================================================================ Texte */

export function farbNameSkat(farbe, blatt = "franzoesisch") {
  return BLAETTER[blatt]?.farben.find((f) => f.id === farbe)?.name ?? farbe;
}
/** z. B. „Herz-Spiel Hand, Schneider angesagt“, „Grand ouvert“, „Null Hand“, „Ramsch“ */
export function spielName(spiel, blatt = "franzoesisch") {
  if (!spiel) return "";
  if (spiel.art === "ramsch") return "Ramsch";
  const zus = [];
  let name;
  if (spiel.art === "null") {
    name = "Null";
    if (spiel.ouvert) zus.push("ouvert");
    if (spiel.hand) zus.push("Hand");
    return [name, ...zus].join(" ");
  }
  name = spiel.art === "grand" ? "Grand" : `${farbNameSkat(spiel.trumpf, blatt)}-Spiel`;
  if (spiel.ouvert) return `${name} ouvert`;
  if (spiel.hand) zus.push("Hand");
  if (spiel.schwarzAngesagt) zus.push("Schwarz angesagt");
  else if (spiel.schneiderAngesagt) zus.push("Schneider angesagt");
  return zus.length ? `${name} ${zus.join(", ")}` : name;
}
