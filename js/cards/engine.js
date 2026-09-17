// Karten-Engine: wiederverwendbare Bausteine für alle Kartenspiele (Mau-Mau, 17 und 4,
// später Rommé, Sechsundsechzig, Skat mit Ramsch & Bock). Enthält KEIN DOM – alles hier
// läuft auch in Node und lässt sich mit simulierten Partien testen.
//
// Kartenformat (aus deck.js): { id: "herz-7", farbe: "herz", farbIndex: 2, rang: 0..7, wert: "A", blatt }
//   rang 0 = Sieben, 1 = Acht, 2 = Neun, 3 = Zehn, 4 = Bube/Unter, 5 = Dame/Ober, 6 = König, 7 = Ass/Daus
//   farbIndex 0 = Kreuz/Eichel, 1 = Pik/Grün, 2 = Herz/Rot, 3 = Karo/Schellen (= Skat-Reihenfolge)
//
// Zufall: Jede Funktion, die Zufall braucht, nimmt optional `rng` (() => Zahl in [0,1)).
// Standard ist Math.random; für reproduzierbare Tests gibt es `zufallMitSaat(saat)`.

export const RANG = { SIEBEN: 0, ACHT: 1, NEUN: 2, ZEHN: 3, BUBE: 4, DAME: 5, KOENIG: 6, ASS: 7 };
export const FARBEN = ["kreuz", "pik", "herz", "karo"];

/* ---------------------------------------------------------------- Zufall */

/** Reproduzierbarer Zufallsgenerator (mulberry32) – für Tests und „gleiche Partie nochmal“. */
export function zufallMitSaat(saat = 1) {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, gibt ein neues Array zurück. */
export function mischen(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------- Hand */

/**
 * Hand sortieren (gibt neues Array zurück).
 * nach: "farbe" (erst Farbe, dann Rang) | "wert" (erst Rang, dann Farbe)
 * farbReihenfolge: Array von Farb-ids, z. B. Trumpf zuerst (Skat): ["herz","kreuz","pik","karo"]
 * rangSchluessel: optional (karte) => Zahl, falls ein Spiel eine eigene Rangfolge hat
 *   (Skat: Zehn hinter Ass; Null-Spiel: klassische Reihenfolge; Buben als eigene „Farbe“).
 * absteigend: höchste Karte zuerst (Standard: aufsteigend).
 */
export function sortiereHand(hand, { nach = "farbe", farbReihenfolge = FARBEN, rangSchluessel = (k) => k.rang, absteigend = false } = {}) {
  const fi = (k) => { const i = farbReihenfolge.indexOf(k.farbe); return i < 0 ? 99 : i; };
  const r = (k) => (absteigend ? -rangSchluessel(k) : rangSchluessel(k));
  return [...hand].sort((a, b) => (nach === "wert" ? r(a) - r(b) || fi(a) - fi(b) : fi(a) - fi(b) || r(a) - r(b)));
}

/** Karte (per id) aus einer Hand entfernen. Gibt die Karte zurück oder null. Verändert die Hand. */
export function nimmAusHand(hand, karteOderId) {
  const id = typeof karteOderId === "string" ? karteOderId : karteOderId.id;
  const i = hand.findIndex((k) => k.id === id);
  return i < 0 ? null : hand.splice(i, 1)[0];
}

/** Anzahl Karten je Farbe: { kreuz: 2, pik: 0, … } */
export function zaehleFarben(hand) {
  const z = Object.fromEntries(FARBEN.map((f) => [f, 0]));
  for (const k of hand) z[k.farbe] = (z[k.farbe] ?? 0) + 1;
  return z;
}

/** Farbe, von der am meisten Karten in der Hand sind (Gleichstand: frühere in FARBEN). ausser: Filter-Funktion. */
export function haeufigsteFarbe(hand, filter = () => true) {
  const z = zaehleFarben(hand.filter(filter));
  return FARBEN.reduce((best, f) => (z[f] > z[best] ? f : best), FARBEN[0]);
}

/** Karten austeilen: gibt Array von Händen zurück und entfernt die Karten vom Stapel (von oben = Array-Ende). */
export function austeilen(stapel, spielerAnzahl, kartenJeSpieler) {
  const haende = Array.from({ length: spielerAnzahl }, () => []);
  for (let r = 0; r < kartenJeSpieler; r++) for (const hd of haende) if (stapel.length) hd.push(stapel.pop());
  return haende;
}

/* ---------------------------------------------------------------- Stapel */

/**
 * Zieh- und Ablagestapel. Oberste Karte ist jeweils das letzte Array-Element.
 * Ist der Ziehstapel leer, wird die Ablage (ohne ihre oberste Karte) neu gemischt.
 */
export class Kartenstapel {
  constructor(karten = [], rng = Math.random) {
    this.zieh = [...karten];
    this.ablage = [];
    this.rng = rng;
    this.neugemischt = 0; // Zähler, nützlich für Anzeige/Tests
  }
  get oben() { return this.ablage[this.ablage.length - 1] ?? null; }
  get anzahlZieh() { return this.zieh.length; }
  /** Karte auf die Ablage legen. */
  ablegen(karte) { this.ablage.push(karte); }
  /** Oberste Karte vom Ziehstapel direkt auf die Ablage (z. B. Startkarte). */
  aufdecken() { const k = this.ziehe1(); if (k) this.ablegen(k); return k; }
  /** Kann (nach evtl. Neumischen) noch gezogen werden? */
  kannZiehen() { return this.zieh.length > 0 || this.ablage.length > 1; }
  /** Eine Karte ziehen, bei Bedarf neu mischen. null, wenn gar keine Karte mehr verfügbar ist. */
  ziehe1() {
    if (!this.zieh.length) this.neuMischen();
    return this.zieh.pop() ?? null;
  }
  /** n Karten ziehen (so viele wie möglich). */
  ziehe(n) {
    const out = [];
    for (let i = 0; i < n; i++) { const k = this.ziehe1(); if (!k) break; out.push(k); }
    return out;
  }
  neuMischen() {
    if (this.ablage.length <= 1) return false;
    const obenKarte = this.ablage.pop();
    this.zieh = mischen(this.ablage, this.rng).concat(this.zieh);
    this.ablage = [obenKarte];
    this.neugemischt++;
    return true;
  }
}

/* ---------------------------------------------------------------- Reihum */

/**
 * Nächster Spieler reihum.
 * aktiv: aktueller Index, anzahl: Spieler gesamt, richtung: +1 / -1,
 * schritte: 1 = normal, 2 = einer wird übersprungen (Aussetzen),
 * ausgeschieden: optional (index) => true, wenn der Spieler nicht mehr mitspielt.
 */
export function naechsterSpieler(aktiv, anzahl, { richtung = 1, schritte = 1, ausgeschieden = () => false } = {}) {
  let i = aktiv;
  let rest = schritte;
  let sicherung = anzahl * (schritte + 1) + 1;
  while (rest > 0 && sicherung-- > 0) {
    i = (((i + richtung) % anzahl) + anzahl) % anzahl;
    if (!ausgeschieden(i)) rest--;
  }
  return i;
}

/* ---------------------------------------------------------------- Computer-Gegner */

/**
 * Gedächtnis eines Computer-Gegners (für Stärke 3). Merkt sich öffentlich gesehene Karten.
 * Skat-Beispiel: g.merke(stichKarten); g.istRaus("herz-7"); g.unbekannt(alleKarten, eigeneHand)
 */
export class Gedaechtnis {
  constructor() { this.gesehen = new Set(); }
  merke(karten) { for (const k of [].concat(karten)) if (k) this.gesehen.add(k.id); }
  istRaus(karteOderId) { return this.gesehen.has(typeof karteOderId === "string" ? karteOderId : karteOderId.id); }
  /** Wie viele Karten einer Farbe schon gesehen wurden. */
  gesehenInFarbe(farbe) { let n = 0; for (const id of this.gesehen) if (id.startsWith(farbe + "-")) n++; return n; }
  /** Karten, die weder gesehen wurden noch in der eigenen Hand sind (mögliche Karten der Gegner). */
  unbekannt(alleKarten, eigeneHand = []) {
    const eigen = new Set(eigeneHand.map((k) => k.id));
    return alleKarten.filter((k) => !this.gesehen.has(k.id) && !eigen.has(k.id));
  }
  vergiss() { this.gesehen.clear(); }
}

/**
 * Stärke-Stufen der Computer-Gegner:
 *  1 = Anfänger: spielt legal, meist zufällig (mit 25 % Wahrscheinlichkeit doch die Heuristik)
 *  2 = Vereinsspieler: nimmt immer die Karte mit der besten Heuristik-Bewertung
 *  3 = Profi: wie 2, die Bewertungsfunktion bekommt zusätzlich das Gedächtnis
 * Rundet ab/auf auf 1..3.
 */
export const staerkeName = (s) => ["", "Anfänger", "Vereinsspieler", "Profi"][klemmeStaerke(s)];
export const klemmeStaerke = (s) => Math.max(1, Math.min(3, Math.round(s || 1)));

/**
 * Allgemeine Zugwahl für Computer-Gegner.
 * optionen: Array legaler Züge (Karten oder beliebige Objekte). Leeres Array => null.
 * bewerte(option, { gedaechtnis, staerke }) => Zahl (höher = besser). Wird nur ab Stärke 2 wirklich genutzt.
 * Bei Gleichstand wird zufällig zwischen den besten gewählt, damit der Computer nicht vorhersagbar ist.
 */
export function waehleZug(optionen, { staerke = 1, bewerte = () => 0, gedaechtnis = null, rng = Math.random } = {}) {
  if (!optionen || !optionen.length) return null;
  const s = klemmeStaerke(staerke);
  if (s === 1 && rng() >= 0.25) return optionen[Math.floor(rng() * optionen.length)];
  const info = { gedaechtnis: s >= 3 ? gedaechtnis : null, staerke: s };
  let best = -Infinity, kandidaten = [];
  for (const o of optionen) {
    const w = bewerte(o, info);
    if (w > best + 1e-9) { best = w; kandidaten = [o]; }
    else if (Math.abs(w - best) <= 1e-9) kandidaten.push(o);
  }
  return kandidaten[Math.floor(rng() * kandidaten.length)];
}

/** Denkpause für die Anzeige (Computer „überlegt“), leicht variiert – damit man folgen kann. */
export const denkpause = (rng = Math.random, basis = 1000) => Math.round(basis * (0.85 + rng() * 0.4));
