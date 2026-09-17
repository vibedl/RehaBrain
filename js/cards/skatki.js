// Skat-Computerspieler – ohne DOM. Stärke 1 (Anfänger) … 3 (Profi).
//  1: reizt grob (mit Rauschen), spielt oft zufällig legal
//  2: feste Heuristiken (Trumpf ziehen, Asse abholen, schmieren, im Null drunterbleiben)
//  3: wie 2, merkt sich alle Karten und Fehlfarben und rechnet per Monte-Carlo-Simulation
//     über mögliche Kartenverteilungen (höchstens ~300 ms pro Zug).
import { RANG, FARBEN, mischen, klemmeStaerke } from "./engine.js";
import { neuesDeck } from "./deck.js";
import {
  augen, augenSumme, istTrumpf, istBube, bedienFarbe, kartenStaerke, schlaegt, stichSieger, legaleKarten,
  spitzen, spielwert, nullWert, neuesSpielObjekt, reizFrage, reizAntwort, nimmSkat, druecke, sageAn,
  gespielteKarten, spieleKarte, neuesSkatSpiel, reizErgebnis, starteRamsch, schiebeRamsch, spielErgebnis,
  augenGesamt,
} from "./skatregeln.js";

const ALLE_KARTEN = neuesDeck("franzoesisch").sort((a, b) => (a.id < b.id ? -1 : 1));
const jetzt = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/* ================================================================ Handbewertung */

const SCHWELLE = { farbe: 7, grand: 7.5 };

/** Stärke einer 10-Karten-Hand für ein Farbspiel mit Trumpf `trumpf`. */
export function farbStaerke(hand, trumpf) {
  const spiel = { art: "farbe", trumpf };
  let w = 0;
  for (const k of hand) {
    if (!istTrumpf(k, spiel)) continue;
    w += 1;
    if (istBube(k)) w += [1, 0.75, 0.5, 0.25][k.farbIndex];
    else if (k.rang === RANG.ASS) w += 0.5;
    else if (k.rang === RANG.ZEHN) w += 0.3;
  }
  for (const f of FARBEN) {
    if (f === trumpf) continue;
    const fk = hand.filter((k) => k.farbe === f && !istBube(k));
    const ass = fk.some((k) => k.rang === RANG.ASS), zehn = fk.some((k) => k.rang === RANG.ZEHN);
    if (ass) w += 1;
    if (ass && zehn) w += 0.8;
    else if (zehn && fk.length >= 2) w += 0.2;
    if (fk.length === 0) w += 0.5;
    else if (fk.length === 1 && !ass) w += 0.2;
  }
  return w;
}

/** Stärke für einen Grand. */
export function grandStaerke(hand) {
  let w = 0;
  const buben = hand.filter(istBube);
  for (const b of buben) w += [2, 1.6, 1.3, 1.1][b.farbIndex];
  for (const f of FARBEN) {
    const fk = hand.filter((k) => k.farbe === f && !istBube(k));
    const ass = fk.some((k) => k.rang === RANG.ASS), zehn = fk.some((k) => k.rang === RANG.ZEHN);
    const koenig = fk.some((k) => k.rang === RANG.KOENIG);
    if (ass) w += 1.2;
    if (ass && zehn) { w += 1; if (koenig) w += 0.3; w += Math.max(0, fk.length - 3) * 0.5; }
    else if (zehn && fk.length >= 3) w += 0.4;
  }
  if (buben.length < 2) w -= 2;
  return w;
}

/** Risiko im Nullspiel: Anzahl Karten, die vermutlich einen Stich bekommen. */
export function nullRisiko(hand) {
  let risiko = 0;
  for (const f of FARBEN) {
    const fk = hand.filter((k) => k.farbe === f).sort((a, b) => a.rang - b.rang);
    fk.forEach((k, i) => { if (k.rang > 2 * i) risiko++; });
  }
  return risiko;
}
const nullPerfekt = (hand) => FARBEN.every((f) => hand.filter((k) => k.farbe === f).sort((a, b) => a.rang - b.rang).every((k, i) => k.rang <= i));

/** Alle Spielarten mit Marge (≥ 0 = spielbar) und erreichbarem Grundwert (ohne Schneider). */
export function spielKandidaten(hand, kartenFuerSpitzen = hand) {
  const out = [];
  for (const f of FARBEN) {
    const spiel = neuesSpielObjekt("farbe", { trumpf: f });
    out.push({ spiel, marge: farbStaerke(hand, f) - SCHWELLE.farbe, wert: spielwert(spiel, { spitzenAnzahl: spitzen(kartenFuerSpitzen, spiel).anzahl }).wert });
  }
  const g = neuesSpielObjekt("grand");
  out.push({ spiel: g, marge: grandStaerke(hand) - SCHWELLE.grand, wert: spielwert(g, { spitzenAnzahl: spitzen(kartenFuerSpitzen, g).anzahl }).wert });
  const n = neuesSpielObjekt("null");
  out.push({ spiel: n, marge: (1 - nullRisiko(hand)) * 1.5, wert: nullWert(n) });
  return out;
}

/**
 * Bis zu welchem Wert der Computer reizt (0 = passt schon bei 18).
 * rauschen: Stärke 1 überschätzt sich gern, Stärke 3 ist genau.
 */
export function reizLimit(hand, staerke = 2, rng = Math.random) {
  const s = klemmeStaerke(staerke);
  const rauschen = s === 1 ? rng() * 2 - 0.6 : s === 2 ? rng() * 0.6 - 0.3 : 0;
  let limit = 0;
  for (const c of spielKandidaten(hand)) {
    if (c.spiel.art === "null") {
      const r = nullRisiko(hand);
      if (r === 0) limit = Math.max(limit, nullPerfekt(hand) && s >= 3 ? 59 : 35);
      else if (r === 1 && s >= 2) limit = Math.max(limit, 23);
      continue;
    }
    if (c.marge + rauschen >= 0) limit = Math.max(limit, c.wert);
  }
  return limit >= 18 ? limit : 0;
}

/** Antwort auf die aktuelle Reizfrage (true = sagen/ja). */
export function kiReizAntwort(sp, i, staerke = 2, rng = Math.random) {
  const f = reizFrage(sp.reizung);
  if (!f || f.spieler !== i) return false;
  sp._limits ??= {};
  if (sp._limits[i] == null) sp._limits[i] = reizLimit(sp.haende[i], staerke, rng);
  const limit = sp._limits[i];
  if (f.art === "vorhand") return limit >= 18;
  return f.wert != null && f.wert <= limit;
}

/** Soll der Alleinspieler Hand spielen? Gibt das Spiel zurück oder null (= Skat aufnehmen). */
export function kiHandSpiel(hand, reizwert, staerke = 2) {
  if (klemmeStaerke(staerke) < 2) return null;
  let best = null;
  for (const c of spielKandidaten(hand)) {
    const handSpiel = neuesSpielObjekt(c.spiel.art, { ...c.spiel, hand: true });
    const wert = c.spiel.art === "null" ? nullWert(handSpiel) : spielwert(handSpiel, { spitzenAnzahl: spitzen(hand, c.spiel).anzahl }).wert;
    const ok = c.spiel.art === "null" ? nullRisiko(hand) === 0 : c.marge >= 2.5;
    if (ok && wert >= reizwert && (!best || c.marge > best.marge)) best = { spiel: handSpiel, marge: c.marge };
  }
  return best?.spiel ?? null;
}

/**
 * Skat drücken und Spiel wählen. hand12 = Hand inkl. Skat.
 * @returns {druecken: [k,k], spiel}
 */
export function kiDrueckenUndAnsagen(hand12, reizwert, staerke = 2, rng = Math.random) {
  const s = klemmeStaerke(staerke);
  let best = null;
  const n = hand12.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const rest = hand12.filter((_, i) => i !== a && i !== b);
    const weg = [hand12[a], hand12[b]];
    for (const c of spielKandidaten(rest, hand12)) {
      if (c.spiel.art !== "null" && weg.some((k) => istTrumpf(k, c.spiel))) continue; // keine Trümpfe drücken
      let marge = c.marge + (c.spiel.art === "null" ? 0 : augenSumme(weg) / 25);
      if (c.spiel.art === "null") {
        const r = nullRisiko(rest);
        marge = (1 - r) * 1.5;
        if (r === 0 && nullPerfekt(rest)) c.ouvertMoeglich = true;
      }
      const reicht = c.wert >= reizwert;
      // Reicht der Wert nicht, zählt das Spiel nur als Notlösung
      const note = (reicht ? 100 : 0) + marge + (s === 1 ? rng() * 1.5 : 0);
      if (!best || note > best.note) best = { note, druecken: weg, spiel: c.spiel, ouvert: c.ouvertMoeglich };
    }
  }
  if (!best) { // nur Trümpfe? dann einfach die zwei niedrigsten drücken
    const sorted = [...hand12].sort((x, y) => augen(x) - augen(y));
    return { druecken: sorted.slice(0, 2), spiel: neuesSpielObjekt("grand") };
  }
  let spiel = best.spiel;
  if (spiel.art === "null" && best.ouvert && reizwert > 23 && s >= 3) spiel = neuesSpielObjekt("null", { ouvert: true });
  return { druecken: best.druecken, spiel };
}

/** Kontra geben? (Gegenspieler i) */
export function kiKontra(sp, i, staerke = 2) {
  if (klemmeStaerke(staerke) < 2 || sp.spiel.art === "ramsch" || sp.spiel.art === "null") return false;
  const hand = sp.haende[i];
  const tr = hand.filter((k) => istTrumpf(k, sp.spiel));
  const asse = hand.filter((k) => k.rang === RANG.ASS && !istTrumpf(k, sp.spiel)).length;
  if (sp.spiel.art === "grand") return tr.length >= 2 && tr.some((k) => k.farbIndex <= 1) && asse >= 3;
  return tr.length >= 5 && tr.some(istBube) && asse >= 1;
}
/** Re sagen? (Alleinspieler) */
export function kiRe(sp, i, staerke = 2) {
  if (klemmeStaerke(staerke) < 2) return false;
  const c = spielKandidaten(sp.haende[i]).find((x) => x.spiel.art === sp.spiel.art && x.spiel.trumpf === sp.spiel.trumpf);
  return !!c && c.marge >= 3;
}

/** Schieberamsch: Skat nehmen? Gibt null (schieben) oder die zwei Karten zum Weiterschieben zurück. */
export function kiSchieben(hand, skat, staerke = 2, rng = Math.random) {
  const s = klemmeStaerke(staerke);
  const hoch = hand.filter((k) => augen(k) >= 10 || istBube(k)).length;
  const nimmt = s === 1 ? rng() < 0.4 : hoch <= 2;
  if (!nimmt) return null;
  const hand12 = [...hand, ...skat].filter((k) => !istBube(k));
  hand12.sort((a, b) => augen(b) - augen(a) || kartenStaerke(b, { art: "ramsch" }) - kartenStaerke(a, { art: "ramsch" }));
  return hand12.slice(0, 2);
}

/* ================================================================ Kartenspiel: Heuristik */

const ramschSpiel = { art: "ramsch" };
const istFreund = (sp, i, j) => {
  if (sp.spiel.art === "ramsch") return i === j;
  if (i === j) return true;
  return i !== sp.alleinspieler && j !== sp.alleinspieler;
};

/** Ist `k` die höchste noch nicht gespielte Karte ihrer Bedienfarbe? bekannt = Set gespielter + eigener Karten-ids */
function istHoechsteVerbleibende(k, spiel, bekannt) {
  const f = bedienFarbe(k, spiel);
  const st = kartenStaerke(k, spiel);
  return !ALLE_KARTEN.some((x) => !bekannt.has(x.id) && x.id !== k.id && bedienFarbe(x, spiel) === f && kartenStaerke(x, spiel) > st
    && (f !== "trumpf" || istTrumpf(x, spiel)));
}
const niedrigste = (karten, spiel) => karten.reduce((m, k) => (augen(k) * 3 + kartenStaerke(k, spiel) + (istTrumpf(k, spiel) ? 40 : 0) < augen(m) * 3 + kartenStaerke(m, spiel) + (istTrumpf(m, spiel) ? 40 : 0) ? k : m));
const hoechsteStaerke = (karten, spiel) => karten.reduce((m, k) => ((istTrumpf(k, spiel) ? 100 : 0) + kartenStaerke(k, spiel) > (istTrumpf(m, spiel) ? 100 : 0) + kartenStaerke(m, spiel) ? k : m));

/**
 * Karte nach festen Regeln wählen (Stärke 1 und 2, auch Grundlage der Simulation bei Stärke 3).
 * gedaechtnis: true = kennt alle gespielten Karten.
 */
export function heuristikKarte(sp, i, { staerke = 2, rng = Math.random, gedaechtnis = true } = {}) {
  const hand = sp.haende[i];
  const legal = legaleKarten(hand, sp.stich.karten, sp.spiel);
  if (legal.length === 1) return legal[0];
  if (klemmeStaerke(staerke) === 1 && rng() < 0.5) return legal[Math.floor(rng() * legal.length)];
  const spiel = sp.spiel;
  const bekannt = new Set(hand.map((k) => k.id));
  if (gedaechtnis) for (const k of gespielteKarten(sp)) bekannt.add(k.id);
  else for (const k of sp.stich.karten) bekannt.add(k.id);
  if (gedaechtnis && i === sp.alleinspieler) for (const k of sp.skat) bekannt.add(k.id);

  if (spiel.art === "null") return nullKarte(sp, i, legal);
  if (spiel.art === "ramsch") return ramschKarte(sp, i, legal);

  const pos = sp.stich.karten.length;
  const allein = i === sp.alleinspieler;

  if (pos === 0) {
    const trumpfe = legal.filter((k) => istTrumpf(k, spiel));
    const fremdeTruempfe = ALLE_KARTEN.filter((x) => istTrumpf(x, spiel) && !bekannt.has(x.id)).length;
    if (allein) {
      if (trumpfe.length && fremdeTruempfe > 0) {
        const top = trumpfe.find((k) => istHoechsteVerbleibende(k, spiel, bekannt));
        if (top) return top;
        if (trumpfe.length >= 3) return niedrigste(trumpfe, spiel);
      }
      const sichere = legal.filter((k) => !istTrumpf(k, spiel) && istHoechsteVerbleibende(k, spiel, bekannt));
      if (sichere.length) return sichere.reduce((m, k) => (augen(k) > augen(m) ? k : m));
      const farben = legal.filter((k) => !istTrumpf(k, spiel));
      if (farben.length) return niedrigste(farben, spiel);
      return niedrigste(legal, spiel);
    }
    // Gegenspieler spielt aus: hohe Farbkarten abholen, sonst kurze Farbe klein
    const sichere = legal.filter((k) => !istTrumpf(k, spiel) && istHoechsteVerbleibende(k, spiel, bekannt));
    if (sichere.length) return sichere.reduce((m, k) => (augen(k) > augen(m) ? k : m));
    const farben = legal.filter((k) => !istTrumpf(k, spiel) && k.rang !== RANG.ZEHN);
    if (farben.length) return niedrigste(farben, spiel);
    return niedrigste(legal, spiel);
  }

  const si = stichSieger(sp.stich.karten, spiel);
  const bestKarte = sp.stich.karten[si];
  const bestSpieler = sp.stich.spieler[si];
  const freundVorn = istFreund(sp, i, bestSpieler);
  const gewinner = legal.filter((k) => schlaegt(k, bestKarte, spiel));
  const nichtTrumpfAugen = (k) => (istTrumpf(k, spiel) ? -1 : augen(k));

  if (pos === 2) {
    if (freundVorn) return legal.reduce((m, k) => (nichtTrumpfAugen(k) > nichtTrumpfAugen(m) ? k : m)); // schmieren
    if (gewinner.length) {
      const stichAugen = augenSumme(sp.stich.karten);
      // bevorzugt die billigste Karte, außer eine Farbkarte bringt selbst viele Augen
      const kosten = (k) => (istTrumpf(k, spiel) ? 8 + kartenStaerke(k, spiel) - (stichAugen >= 10 ? 6 : 0) : -augen(k));
      return gewinner.reduce((m, k) => (kosten(k) < kosten(m) ? k : m));
    }
    return niedrigste(legal, spiel);
  }
  // pos === 1: dahinter sitzt noch einer
  const naechster = (i + 1) % 3;
  if (freundVorn) {
    // Partner hat ausgespielt, Gegner (Alleinspieler) sitzt dahinter
    if (istHoechsteVerbleibende(bestKarte, spiel, bekannt) && !istTrumpf(bestKarte, spiel)) {
      const schmier = legal.filter((k) => !istTrumpf(k, spiel));
      if (schmier.length) return schmier.reduce((m, k) => (augen(k) > augen(m) ? k : m));
    }
    return niedrigste(legal, spiel);
  }
  const sicher = gewinner.filter((k) => istHoechsteVerbleibende(k, spiel, bekannt));
  if (sicher.length) return sicher.reduce((m, k) => (augen(k) > augen(m) ? k : m));
  if (!istFreund(sp, i, naechster) && gewinner.length) {
    // Alleinspieler in der Mitte: möglichst hoch drüber
    return hoechsteStaerke(gewinner, spiel);
  }
  return niedrigste(legal, spiel);
}

function nullKarte(sp, i, legal) {
  const spiel = sp.spiel;
  const allein = i === sp.alleinspieler;
  const pos = sp.stich.karten.length;
  const tief = (ks) => ks.reduce((m, k) => (k.rang < m.rang ? k : m));
  const hoch = (ks) => ks.reduce((m, k) => (k.rang > m.rang ? k : m));
  if (pos === 0) {
    if (allein) return tief(legal);
    // Gegenspieler: kurze Farbe klein anspielen
    return tief(legal);
  }
  const si = stichSieger(sp.stich.karten, spiel);
  const bestKarte = sp.stich.karten[si];
  const drunter = legal.filter((k) => !schlaegt(k, bestKarte, spiel));
  if (allein) {
    if (drunter.length) return hoch(drunter);
    return pos === 2 ? hoch(legal) : tief(legal);
  }
  const alleinSchonGespielt = sp.stich.spieler.includes(sp.alleinspieler);
  if (alleinSchonGespielt) {
    if (sp.stich.spieler[si] === sp.alleinspieler) return drunter.length ? hoch(drunter) : tief(legal);
    return hoch(legal);
  }
  return drunter.length ? tief(drunter) : tief(legal);
}

function ramschKarte(sp, i, legal) {
  const spiel = ramschSpiel;
  const wert = (k) => (istTrumpf(k, spiel) ? 100 : 0) + kartenStaerke(k, spiel);
  if (!sp.stich.karten.length) return legal.reduce((m, k) => (wert(k) + augen(k) * 0.1 < wert(m) + augen(m) * 0.1 ? k : m));
  const si = stichSieger(sp.stich.karten, spiel);
  const drunter = legal.filter((k) => !schlaegt(k, sp.stich.karten[si], spiel));
  if (drunter.length) return drunter.reduce((m, k) => (augen(k) * 2 + wert(k) > augen(m) * 2 + wert(m) ? k : m));
  return legal.reduce((m, k) => (wert(k) > wert(m) ? k : m));
}

/* ================================================================ Kartenspiel: Monte-Carlo (Stärke 3) */

/** Fehlfarben aus dem bisherigen Spielverlauf: { spieler: Set(bedienFarbe) } */
export function fehlfarben(sp) {
  const f = [new Set(), new Set(), new Set()];
  const pruefe = (karten, spieler) => {
    if (!karten.length) return;
    const gef = bedienFarbe(karten[0], sp.spiel);
    for (let j = 1; j < karten.length; j++) if (bedienFarbe(karten[j], sp.spiel) !== gef) f[spieler[j]].add(gef);
  };
  for (const s of sp.stiche) pruefe(s.karten, s.spieler);
  pruefe(sp.stich.karten, sp.stich.spieler);
  return f;
}

/** Zieht eine mögliche Verteilung der unbekannten Karten aus Sicht von Spieler i. */
function zieheVerteilung(sp, i, rng) {
  const allein = sp.alleinspieler;
  const skatBekannt = sp.spiel.art !== "ramsch" && i === allein;
  const offenAllein = sp.spiel.ouvert && allein != null && allein !== i;
  const bekannt = new Set(sp.haende[i].map((k) => k.id));
  for (const k of gespielteKarten(sp)) bekannt.add(k.id);
  if (skatBekannt) for (const k of sp.skat) bekannt.add(k.id);
  if (offenAllein) for (const k of sp.haende[allein]) bekannt.add(k.id);
  const pool = ALLE_KARTEN.filter((k) => !bekannt.has(k.id));
  const plaetze = [];
  for (let j = 0; j < 3; j++) if (j !== i && !(offenAllein && j === allein)) plaetze.push({ j, n: sp.haende[j].length, karten: [] });
  if (!skatBekannt) plaetze.push({ j: "skat", n: sp.skat.length, karten: [] });
  const fehl = fehlfarben(sp);
  for (let versuch = 0; versuch < 12; versuch++) {
    plaetze.forEach((p) => (p.karten = []));
    const karten = mischen(pool, rng);
    let ok = true;
    for (const k of karten) {
      const f = bedienFarbe(k, sp.spiel);
      const frei = plaetze.filter((p) => p.karten.length < p.n && (p.j === "skat" || versuch >= 10 || !fehl[p.j].has(f)));
      if (!frei.length) { ok = false; break; }
      // Gewichtet nach freien Plätzen
      let r = rng() * frei.reduce((s, p) => s + p.n - p.karten.length, 0);
      let ziel = frei[0];
      for (const p of frei) { r -= p.n - p.karten.length; if (r < 0) { ziel = p; break; } }
      ziel.karten.push(k);
    }
    if (ok) {
      const haende = sp.haende.map((h) => [...h]);
      let skat = [...sp.skat];
      for (const p of plaetze) { if (p.j === "skat") skat = p.karten; else haende[p.j] = p.karten; }
      return { haende, skat };
    }
  }
  return null;
}

function simKopie(sp, verteilung) {
  return {
    spiel: sp.spiel, alleinspieler: sp.alleinspieler, reizwert: sp.reizwert,
    haende: verteilung.haende.map((h) => [...h]), skat: [...verteilung.skat],
    stiche: sp.stiche.slice(),
    stich: { karten: [...sp.stich.karten], spieler: [...sp.stich.spieler] },
    augen: [...sp.augen], stichZahl: [...sp.stichZahl], amZug: sp.amZug, fertig: false, skatAn: sp.skatAn, schiebungen: 0,
  };
}

function bewerteEnde(sim, i) {
  const a = sim.alleinspieler;
  if (sim.spiel.art === "ramsch") return -sim.augen[i];
  if (sim.spiel.art === "null") {
    const gewonnen = sim.stichZahl[a] === 0;
    return (i === a) === gewonnen ? 100 : 0;
  }
  const augenAllein = sim.augen[a];
  if (i === a) return augenAllein + (augenAllein >= 61 ? 40 : 0) + (augenAllein >= 90 ? 10 : 0);
  const g = 120 - augenAllein;
  return g + (g >= 60 ? 40 : 0) + (g >= 31 ? 10 : 0);
}

/**
 * Karte per Monte-Carlo-Simulation wählen.
 * maxMs: Rechenzeit-Grenze, maxSamples: höchstens so viele Verteilungen.
 */
export function monteCarloKarte(sp, i, { rng = Math.random, maxMs = 280, maxSamples = 60 } = {}) {
  const legal = legaleKarten(sp.haende[i], sp.stich.karten, sp.spiel);
  if (legal.length <= 1) return legal[0] ?? null;
  const start = jetzt();
  const summe = new Map(legal.map((k) => [k.id, 0]));
  let samples = 0;
  while (samples < maxSamples && (samples < 2 || jetzt() - start < maxMs)) {
    const v = zieheVerteilung(sp, i, rng);
    if (!v) break;
    for (const k of legal) {
      const sim = simKopie(sp, v);
      spieleKarte(sim, i, k);
      let sicherung = 40;
      while (!sim.fertig && sicherung-- > 0) {
        const j = sim.amZug;
        spieleKarte(sim, j, heuristikKarte(sim, j, { staerke: 2, rng, gedaechtnis: true }));
      }
      summe.set(k.id, summe.get(k.id) + bewerteEnde(sim, i));
      if (jetzt() - start > maxMs * 1.05 && samples >= 2) break;
    }
    samples++;
  }
  let best = legal[0], bestW = -Infinity;
  for (const k of legal) { const w = summe.get(k.id); if (w > bestW) { bestW = w; best = k; } }
  return best;
}

/** Kartenwahl für alle Stärken. */
export function kiKarte(sp, i, staerke = 2, { rng = Math.random, maxMs = 280, maxSamples = 60 } = {}) {
  const s = klemmeStaerke(staerke);
  if (s >= 3) return monteCarloKarte(sp, i, { rng, maxMs, maxSamples });
  return heuristikKarte(sp, i, { staerke: s, rng, gedaechtnis: s >= 2 });
}

/* ================================================================ Simulation einer ganzen Partie (Tests) */

/**
 * Ein komplettes Spiel Computer gegen Computer.
 * @returns {sp, ergebnis, zuege} – ergebnis null, wenn eingepasst ohne Ramsch
 */
export function simuliereSkatSpiel({ rng = Math.random, geber = 0, staerken = [2, 2, 2], ramsch = true, schieberamsch = false, kontra = false, bock = false, mc = {}, pruefe = null } = {}) {
  const sp = neuesSkatSpiel({ geber, rng });
  let sicherung = 200;
  while (reizFrage(sp.reizung) && sicherung-- > 0) {
    const f = reizFrage(sp.reizung);
    reizAntwort(sp.reizung, kiReizAntwort(sp, f.spieler, staerken[f.spieler], rng));
  }
  const r = reizErgebnis(sp.reizung);
  if (r.alleGepasst) {
    if (!ramsch) return { sp, ergebnis: null };
    if (schieberamsch) {
      for (let n = 0; n < 3; n++) {
        const j = (sp.vorhand + n) % 3;
        const zurueck = kiSchieben(sp.haende[j], sp.skat, staerken[j], rng);
        const res = schiebeRamsch(sp, j, !!zurueck, zurueck);
        if (!res.ok) throw new Error("Schieben fehlgeschlagen: " + res.grund);
      }
    }
    starteRamsch(sp);
  } else {
    const a = r.alleinspieler;
    const hs = kiHandSpiel(sp.haende[a], r.wert, staerken[a]);
    if (hs) sageAn(sp, a, r.wert, hs);
    else {
      nimmSkat(sp, a);
      const d = kiDrueckenUndAnsagen(sp.haende[a], r.wert, staerken[a], rng);
      const res = druecke(sp, a, d.druecken);
      if (!res.ok) throw new Error("Drücken fehlgeschlagen: " + res.grund);
      sageAn(sp, a, r.wert, d.spiel);
    }
    if (kontra) {
      for (let j = 0; j < 3; j++) if (j !== a && !sp.kontra && kiKontra(sp, j, staerken[j])) sp.kontra = true;
      if (sp.kontra) sp.re = kiRe(sp, a, staerken[a]);
    }
  }
  let zuege = 0;
  while (!sp.fertig) {
    const j = sp.amZug;
    const k = kiKarte(sp, j, staerken[j], { rng, ...mc });
    if (pruefe) pruefe(sp, j, k);
    const res = spieleKarte(sp, j, k);
    if (!res.ok) throw new Error(`Illegaler Zug von ${j}: ${k?.id} (${res.grund})`);
    if (++zuege > 40) throw new Error("zu viele Züge");
  }
  return { sp, ergebnis: spielErgebnis(sp, { bock }), zuege, augenSumme: augenGesamt(sp) };
}
