// Karten Stufe 6: Patience – Klondike (vereinfacht und normal) und Freecell. Trainiert Planen und Vorausdenken.
// Bedienung ohne Ziehen: Karte antippen (markiert), Ziel antippen (legt ab). Rückgängig unbegrenzt, Tipp-Knopf.
// Es werden nur Spiele ausgeteilt, die ein eingebauter Löser (Tiefensuche mit Zustands-Speicher, Zeitlimit) lösen kann.
//
// Warum immer das französische Blatt? Patience braucht 13 Werte je Farbe (Ass bis König). Das deutsche Skatblatt
// hat nur 8 (7 bis Ass). Eine 32-Karten-Patience wäre ein anderes Spiel mit ungewohnten Regeln – daher wird auch bei
// gewähltem deutschem Blatt mit französischen Karten gespielt, und die Übung sagt das kurz dazu.
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { warteAufEingabe } from "./tisch.js";
import { neuesBlatt52, rangVon, farbeVon, istRot, karte52Element, kartenName52, WERTE52 } from "./blatt52.js";

/* ====================================================================================================
   Stufen
   ==================================================================================================== */

/** Regeln je Stufe. tipps = Anzahl Tipps (Infinity = unbegrenzt), hilfe = mögliche Ziele markieren. */
export function stufenRegeln(stufe) {
  const s = Math.max(1, Math.min(20, Math.round(stufe)));
  if (s <= 7) {
    const tabelle = {
      1: { farben: [0, 2], maxRang: 5, spalten: 3, verdeckt: false },
      2: { farben: [0, 2], maxRang: 7, spalten: 4, verdeckt: false },
      3: { farben: [0, 2], maxRang: 9, spalten: 4, verdeckt: true },
      4: { farben: [0, 1, 2, 3], maxRang: 6, spalten: 5, verdeckt: true },
      5: { farben: [0, 1, 2, 3], maxRang: 8, spalten: 5, verdeckt: true },
      6: { farben: [0, 1, 2, 3], maxRang: 10, spalten: 6, verdeckt: true },
      7: { farben: [0, 1, 2, 3], maxRang: 13, spalten: 7, verdeckt: true },
    }[s];
    return { art: "klondike", ziehen: 1, ...tabelle, tipps: Infinity, hilfe: true, nurLoesbar: true };
  }
  if (s <= 14) {
    const tipps = { 8: 8, 9: 6, 10: 5, 11: 4, 12: 4, 13: 3, 14: 2 }[s];
    return { art: "klondike", ziehen: s <= 11 ? 1 : 3, farben: [0, 1, 2, 3], maxRang: 13, spalten: 7, verdeckt: true,
      tipps, hilfe: s <= 10, nurLoesbar: true };
  }
  const zellen = s <= 17 ? 4 : s <= 19 ? 3 : 2;
  const tipps = { 15: 4, 16: 3, 17: 2, 18: 2, 19: 1, 20: 1 }[s];
  return { art: "freecell", zellen, farben: [0, 1, 2, 3], maxRang: 13, spalten: 8, tipps, hilfe: false, nurLoesbar: true };
}

/* ====================================================================================================
   Zustand
   Klondike: { art, ziehen, farben, maxRang, spalten: [{d: verdeckt[], u: offen[]}], talon[], gezogen, ablage[4] }
     talon[0 .. gezogen-1] = aufgedeckter Abwurf (oberste = talon[gezogen-1]), talon[gezogen ..] = Nachziehstapel
   Freecell: { art, farben, maxRang, spalten: [{d: [], u[]}], zellen: [Karte | -1], ablage[4] }
   ablage[f] = höchster abgelegter Rang der Farbe f (nicht gespielte Farben zählen als voll)
   ==================================================================================================== */

export function austeilenRoh(regeln) {
  const { art, farben, maxRang } = regeln;
  const karten = neuesBlatt52(farben, maxRang);
  const ablage = [0, 1, 2, 3].map((f) => (farben.includes(f) ? 0 : maxRang));
  if (art === "freecell") {
    const spalten = Array.from({ length: 8 }, () => ({ d: [], u: [] }));
    karten.forEach((c, i) => spalten[i % 8].u.push(c));
    return { art, farben, maxRang, spalten, zellen: Array(regeln.zellen).fill(-1), ablage };
  }
  const spalten = [];
  let p = 0;
  for (let i = 0; i < regeln.spalten; i++) {
    const stapel = karten.slice(p, p + i + 1);
    p += i + 1;
    spalten.push(regeln.verdeckt ? { d: stapel.slice(0, -1), u: stapel.slice(-1) } : { d: [], u: stapel });
  }
  return { art, ziehen: regeln.ziehen, farben, maxRang, spalten, talon: karten.slice(p), gezogen: 0, ablage };
}

/** Passt c auf t (eins niedriger, andere Farbe)? */
const passtAuf = (c, t) => rangVon(t) === rangVon(c) + 1 && istRot(t) !== istRot(c);

/** Ab welchem Index liegt das untere Ende der Spalte in gültiger Reihe? */
export function reihenStart(u) {
  if (!u.length) return 0;
  let j = u.length - 1;
  while (j > 0 && passtAuf(u[j], u[j - 1])) j--;
  return j;
}

export const istGeloest = (s) => s.ablage.every((r) => r === s.maxRang);
export const abgelegtAnzahl = (s) => s.farben.reduce((n, f) => n + s.ablage[f], 0);
export const kartenGesamt = (s) => s.farben.length * s.maxRang;
const freieZellen = (s) => (s.zellen ? s.zellen.filter((z) => z < 0).length : 0);
const leereSpalten = (s) => s.spalten.filter((sp) => !sp.u.length && !sp.d.length).length;

/** Freecell: wie viele Karten dürfen auf einmal bewegt werden? */
export function kapazitaet(s, zielLeer) {
  const leer = leereSpalten(s) - (zielLeer ? 1 : 0);
  return (freieZellen(s) + 1) * 2 ** Math.max(0, leer);
}

/** Welche Talon-Karten sind erreichbar (ggf. nach mehrmaligem Ziehen)? */
export function talonErreichbar(s) {
  const n = s.talon.length;
  if (!n) return [];
  if (s.ziehen === 1) return Array.from({ length: n }, (_, i) => i);
  const set = new Set();
  if (s.gezogen > 0) set.add(s.gezogen - 1);
  let d = s.gezogen;
  let neu = false;
  for (let k = 0; k < 2 * n + 4; k++) {
    if (d >= n) { if (neu) break; d = 0; neu = true; }
    d = Math.min(d + s.ziehen, n);
    set.add(d - 1);
    if (neu && d >= s.gezogen) break;
  }
  return [...set];
}

/** Karte der Quelle (bei Spalte: erste Karte der Reihe) */
export function quellKarten(s, von) {
  if (von.s != null) return s.spalten[von.s].u.slice(von.j);
  if (von.talon != null) return [s.talon[von.talon]];
  if (von.z != null) return [s.zellen[von.z]];
  if (von.ab != null) return [von.ab * 13 + s.ablage[von.ab] - 1];
  return [];
}

/**
 * Zug prüfen. Züge: { t: "ab" | "sp" | "ze", von: {s, j} | {talon} | {z} | {ab}, nach } und { t: "ziehen" }.
 * @returns null, wenn erlaubt – sonst ein freundlicher Grund
 * talonFrei: jede erreichbare Talon-Karte zählt (für den Löser); sonst nur die oberste aufgedeckte.
 */
export function pruefeZug(s, m, { talonFrei = false } = {}) {
  if (m.t === "ziehen") return s.art === "klondike" && s.talon.length ? null : "Der Stapel ist leer.";
  const v = m.von;
  if (v.s != null) {
    const sp = s.spalten[v.s];
    if (!sp || v.j == null || v.j >= sp.u.length || v.j < 0) return "Diese Karte lässt sich nicht bewegen.";
    if (v.j < reihenStart(sp.u)) return "Diese Karte ist noch blockiert. Bewegen Sie zuerst die Karten, die darauf liegen.";
  } else if (v.talon != null) {
    if (s.art !== "klondike" || v.talon < 0 || v.talon >= s.talon.length) return "Diese Karte lässt sich nicht bewegen.";
    if (talonFrei ? !talonErreichbar(s).includes(v.talon) : v.talon !== s.gezogen - 1) return "Nur die oberste aufgedeckte Karte darf bewegt werden.";
  } else if (v.z != null) {
    if (!s.zellen || s.zellen[v.z] == null || s.zellen[v.z] < 0) return "Das Feld ist leer.";
  } else if (v.ab != null) {
    if (s.art !== "klondike") return "Von der Ablage wird nichts zurückgenommen.";
    if (!s.farben.includes(v.ab) || s.ablage[v.ab] <= 0) return "Die Ablage ist leer.";
  } else return "Diese Karte lässt sich nicht bewegen.";

  const karten = quellKarten(s, v);
  const c = karten[0];
  if (m.t === "ab") {
    if (v.ab != null) return "Die Karte liegt schon auf der Ablage.";
    if (karten.length !== 1) return "Auf die Ablage kommt immer nur eine einzelne Karte.";
    if (s.ablage[farbeVon(c)] !== rangVon(c) - 1) return "Auf die Ablage kommt zuerst das Ass, dann die 2, die 3 und so weiter – jeweils in derselben Farbe.";
    return null;
  }
  if (m.t === "ze") {
    if (s.art !== "freecell") return "Hier gibt es keine freien Felder.";
    if (karten.length !== 1) return "In ein freies Feld passt nur eine Karte.";
    if (v.z != null) return "Die Karte liegt schon in einem freien Feld.";
    if (s.zellen[m.nach] !== -1) return "Dieses Feld ist schon belegt.";
    return null;
  }
  if (m.t === "sp") {
    if (v.s === m.nach) return "Die Karte liegt schon in dieser Reihe.";
    const ziel = s.spalten[m.nach];
    if (!ziel) return "Dort kann nichts hingelegt werden.";
    const leer = !ziel.u.length && !ziel.d.length;
    if (leer) {
      if (s.art === "klondike" && rangVon(c) !== s.maxRang) {
        return s.maxRang === 13 ? "Auf einen leeren Platz darf nur ein König." : `Auf einen leeren Platz darf nur die höchste Karte, die ${WERTE52[s.maxRang - 1]}.`;
      }
    } else if (!passtAuf(c, ziel.u[ziel.u.length - 1])) {
      return "Die Karte muss genau eins niedriger sein und die andere Farbe haben: rot auf schwarz oder schwarz auf rot.";
    }
    if (s.art === "freecell" && karten.length > kapazitaet(s, leer)) {
      return "So viele Karten auf einmal gehen nicht – dafür fehlen freie Felder.";
    }
    return null;
  }
  return "Dieser Zug ist nicht möglich.";
}

/** Zug ausführen (ohne Prüfung). Liefert einen neuen Zustand, der alte bleibt unverändert. */
export function fuehreAus(s, m) {
  const n = { ...s, spalten: s.spalten.slice(), ablage: s.ablage.slice() };
  if (s.zellen) n.zellen = s.zellen.slice();
  if (m.t === "ziehen") {
    n.gezogen = s.gezogen >= s.talon.length ? 0 : Math.min(s.gezogen + s.ziehen, s.talon.length);
    return n;
  }
  const v = m.von;
  let karten;
  if (v.s != null) {
    const sp = s.spalten[v.s];
    karten = sp.u.slice(v.j);
    let neu = { d: sp.d, u: sp.u.slice(0, v.j) };
    if (!neu.u.length && neu.d.length) neu = { d: neu.d.slice(0, -1), u: neu.d.slice(-1) }; // aufdecken
    n.spalten[v.s] = neu;
  } else if (v.talon != null) {
    karten = [s.talon[v.talon]];
    n.talon = s.talon.slice(0, v.talon).concat(s.talon.slice(v.talon + 1));
    n.gezogen = v.talon;
  } else if (v.z != null) {
    karten = [s.zellen[v.z]];
    n.zellen[v.z] = -1;
  } else {
    karten = [v.ab * 13 + s.ablage[v.ab] - 1];
    n.ablage[v.ab]--;
  }
  if (m.t === "ab") n.ablage[farbeVon(karten[0])]++;
  else if (m.t === "ze") n.zellen[m.nach] = karten[0];
  else {
    const z = s.spalten[m.nach];
    n.spalten[m.nach] = { d: z.d, u: z.u.concat(karten) };
  }
  return n;
}

/** Verdeckte Karten im Spiel? */
export const verdeckteAnzahl = (s) => s.spalten.reduce((n, sp) => n + sp.d.length, 0);

/**
 * Ist der Rest nur noch „Karten ablegen“? Dann gibt es die Züge dafür zurück, sonst null.
 * Voraussetzung: keine verdeckten Karten. Talon-Karten zählen nur, wenn einzeln gezogen wird (sonst Talon leer).
 */
export function trivialeZuege(s) {
  if (s.art !== "klondike" && s.art !== "freecell") return null;
  if (verdeckteAnzahl(s) > 0) return null;
  if (s.art === "klondike" && s.ziehen !== 1 && s.talon.length) return null;
  let z = s;
  const zuege = [];
  for (let schutz = 0; schutz < 60 && !istGeloest(z); schutz++) {
    let m = null;
    for (let i = 0; i < z.spalten.length && !m; i++) {
      const u = z.spalten[i].u;
      if (u.length && z.ablage[farbeVon(u[u.length - 1])] === rangVon(u[u.length - 1]) - 1) m = { t: "ab", von: { s: i, j: u.length - 1 } };
    }
    if (!m && z.zellen) z.zellen.forEach((c, i) => { if (!m && c >= 0 && z.ablage[farbeVon(c)] === rangVon(c) - 1) m = { t: "ab", von: { z: i } }; });
    if (!m && z.talon) {
      const i = z.talon.findIndex((c) => z.ablage[farbeVon(c)] === rangVon(c) - 1);
      if (i >= 0) m = { t: "ab", von: { talon: i } };
    }
    if (!m) return null;
    zuege.push(m);
    z = fuehreAus(z, m);
  }
  return istGeloest(z) ? zuege : null;
}

/* ====================================================================================================
   Löser: Tiefensuche mit Zustands-Speicher (bereits gesehene Stellungen werden übersprungen) und Zeitlimit.
   Er kennt die verdeckten Karten (nur für die Prüfung „lösbar?“ und für Tipps). Züge werden nach Nutzen sortiert,
   sichere Ablage-Züge werden sofort gemacht. Nicht jeder denkbare Zug wird probiert (z. B. keine Karte von der
   Ablage zurück) – findet er eine Lösung, ist das Spiel sicher lösbar.
   ==================================================================================================== */

function schluessel(s) {
  const sp = s.spalten.map((x) => String.fromCharCode(...x.d.map((c) => c + 60)) + "/" + String.fromCharCode(...x.u.map((c) => c + 60)));
  sp.sort();
  let k = sp.join("|") + "#" + s.ablage.join(",");
  if (s.talon) k += "#" + String.fromCharCode(...s.talon.map((c) => c + 60)) + (s.ziehen === 1 ? "" : ":" + s.gezogen);
  if (s.zellen) k += "#" + s.zellen.filter((c) => c >= 0).sort((a, b) => a - b).join(",");
  return k;
}

/** Kann c gefahrlos abgelegt werden (keine kleinere Karte der Gegenfarbe braucht sie noch)? */
function sicherAblegbar(s, c) {
  const r = rangVon(c);
  if (s.ablage[farbeVon(c)] !== r - 1) return false;
  if (r <= 2) return true;
  const gegen = istRot(c) ? [0, 1] : [2, 3];
  return gegen.every((f) => s.ablage[f] >= r - 1);
}

export function zugKandidaten(s) {
  const kand = [];
  const add = (p, m) => kand.push([p, m]);
  const ab = (c) => s.ablage[farbeVon(c)] === rangVon(c) - 1;
  const sp = s.spalten;

  // 1. sichere Ablage-Züge: erzwungen
  for (let i = 0; i < sp.length; i++) {
    const u = sp[i].u;
    if (u.length && sicherAblegbar(s, u[u.length - 1])) return [{ t: "ab", von: { s: i, j: u.length - 1 } }];
  }
  if (s.zellen) {
    for (let z = 0; z < s.zellen.length; z++) if (s.zellen[z] >= 0 && sicherAblegbar(s, s.zellen[z])) return [{ t: "ab", von: { z } }];
  }
  const talonIdx = s.talon ? talonErreichbar(s) : [];
  if (s.ziehen === 1) for (const i of talonIdx) if (sicherAblegbar(s, s.talon[i])) return [{ t: "ab", von: { talon: i } }];

  const leerZiel = sp.findIndex((x) => !x.u.length && !x.d.length);

  if (s.art === "klondike") {
    for (let i = 0; i < sp.length; i++) {
      const { d, u } = sp[i];
      if (!u.length) continue;
      const rs = reihenStart(u);
      const verdecktDarunter = d.length + rs; // was freigelegt wird
      if (ab(u[u.length - 1])) add(60 + (u.length === 1 ? d.length * 2 : 0), { t: "ab", von: { s: i, j: u.length - 1 } });
      for (let k = 0; k < sp.length; k++) {
        if (k === i) continue;
        const ziel = sp[k];
        if (!ziel.u.length) {
          if (k !== leerZiel || ziel.d.length) continue;
          if (rangVon(u[rs]) === s.maxRang && verdecktDarunter > 0) add(45 + d.length, { t: "sp", von: { s: i, j: rs }, nach: k });
          continue;
        }
        const top = ziel.u[ziel.u.length - 1];
        for (let j = rs; j < u.length; j++) {
          if (!passtAuf(u[j], top)) continue;
          if (j === rs) {
            if (verdecktDarunter > 0) add(50 + d.length, { t: "sp", von: { s: i, j }, nach: k });
            else add(5, { t: "sp", von: { s: i, j }, nach: k }); // Spalte leeren
          } else if (ab(u[j - 1])) add(40, { t: "sp", von: { s: i, j }, nach: k });
          break;
        }
      }
    }
    for (const i of talonIdx) {
      const c = s.talon[i];
      const oben = i === s.gezogen - 1 ? 1 : 0;
      if (ab(c)) add(55 + oben, { t: "ab", von: { talon: i } });
      for (let k = 0; k < sp.length; k++) {
        const ziel = sp[k];
        if (!ziel.u.length) {
          if (k === leerZiel && rangVon(c) === s.maxRang) add(25 + oben, { t: "sp", von: { talon: i }, nach: k });
        } else if (passtAuf(c, ziel.u[ziel.u.length - 1])) add(30 + oben, { t: "sp", von: { talon: i }, nach: k });
      }
    }
  } else {
    const frei = s.zellen.indexOf(-1);
    const nFrei = freieZellen(s);
    const nLeer = leereSpalten(s);
    const kapVoll = (nFrei + 1) * 2 ** nLeer;
    const kapLeer = (nFrei + 1) * 2 ** Math.max(0, nLeer - 1);
    for (let z = 0; z < s.zellen.length; z++) {
      const c = s.zellen[z];
      if (c < 0) continue;
      if (ab(c)) add(70, { t: "ab", von: { z } });
      for (let k = 0; k < sp.length; k++) {
        if (!sp[k].u.length) { if (k === leerZiel) add(15, { t: "sp", von: { z }, nach: k }); }
        else if (passtAuf(c, sp[k].u[sp[k].u.length - 1])) add(62, { t: "sp", von: { z }, nach: k });
      }
    }
    for (let i = 0; i < sp.length; i++) {
      const u = sp[i].u;
      if (!u.length) continue;
      const rs = reihenStart(u);
      if (ab(u[u.length - 1])) add(68, { t: "ab", von: { s: i, j: u.length - 1 } });
      for (let k = 0; k < sp.length; k++) {
        if (k === i) continue;
        if (!sp[k].u.length) {
          if (k !== leerZiel || rs === 0) continue;
          const j = Math.max(rs, u.length - kapLeer);
          add(20 - Math.min(10, j), { t: "sp", von: { s: i, j }, nach: k });
          continue;
        }
        const top = sp[k].u[sp[k].u.length - 1];
        for (let j = rs; j < u.length; j++) {
          if (!passtAuf(u[j], top)) continue;
          if (u.length - j > kapVoll) break;
          if (j === rs) add(rs === 0 ? 48 : 52 + (rs < 3 ? 3 - rs : 0), { t: "sp", von: { s: i, j }, nach: k });
          else add(ab(u[j - 1]) ? 58 : 30, { t: "sp", von: { s: i, j }, nach: k });
          break;
        }
      }
      if (frei >= 0) {
        // Karte in ein freies Feld: lohnt eher bei kurzen Spalten oder wenn darunter etwas ablegbar wird
        let p = 10 - Math.min(8, u.length);
        if (u.length >= 2 && ab(u[u.length - 2])) p += 30;
        add(p, { t: "ze", von: { s: i, j: u.length - 1 }, nach: frei });
      }
    }
  }
  kand.sort((a, b) => b[0] - a[0]);
  return kand.map((x) => x[1]);
}

/**
 * Löst die Stellung. @returns { geloest, zuege (bei Erfolg), ausgeschoepft (alles probiert, keine Lösung), knoten }
 */
export function loese(start, { zeitMs = 400, maxKnoten = 400000 } = {}) {
  const t0 = Date.now();
  const gesehen = new Set();
  const pfad = [];
  let knoten = 0;
  let abbruch = false;
  const suche = (s, tiefe) => {
    if (istGeloest(s)) return true;
    if (tiefe > 400) return false;
    const k = schluessel(s);
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    if (++knoten % 512 === 0 && (Date.now() - t0 > zeitMs || knoten > maxKnoten)) { abbruch = true; }
    if (abbruch) return false;
    for (const m of zugKandidaten(s)) {
      pfad.push(m);
      if (suche(fuehreAus(s, m), tiefe + 1)) return true;
      pfad.pop();
      if (abbruch) return false;
    }
    return false;
  };
  const geloest = suche(start, 0);
  return { geloest, zuege: geloest ? pfad.slice() : null, ausgeschoepft: !geloest && !abbruch, knoten, ms: Date.now() - t0 };
}

/**
 * Teilt ein Spiel für die Stufe aus. Bei nurLoesbar werden Austeilungen verworfen, die der Löser nicht schafft.
 * Gesamtzeit ca. ≤ budgetMs. @returns { zustand, loesung (Züge oder null), versuche, ms }
 */
export function austeilen(stufe, { budgetMs = 1400 } = {}) {
  const regeln = stufenRegeln(stufe);
  const t0 = Date.now();
  let versuche = 0;
  let letzter = null;
  while (true) {
    versuche++;
    const zustand = austeilenRoh(regeln);
    letzter = zustand;
    if (!regeln.nurLoesbar) return { zustand, loesung: null, versuche, ms: Date.now() - t0 };
    const rest = budgetMs - (Date.now() - t0);
    const r = loese(zustand, { zeitMs: Math.max(60, Math.min(regeln.art === "freecell" ? 450 : 300, rest)) });
    if (r.geloest) return { zustand, loesung: r.zuege, versuche, ms: Date.now() - t0 };
    if (Date.now() - t0 > budgetMs) break;
  }
  return { zustand: letzter, loesung: null, versuche, ms: Date.now() - t0 };
}

/** Score: gelöst ja/nein, Anteil abgelegter Karten, Tipp-Nutzung, Züge im Vergleich zum Löser (grob) */
export function bewerte({ geloest, abgelegt, gesamt, tipps, zuege, loeserZuege }) {
  if (!geloest) return Math.round(Math.min(0.45, 0.45 * (abgelegt / Math.max(1, gesamt))) * 100) / 100;
  const eff = loeserZuege ? Math.max(0, Math.min(1, loeserZuege / Math.max(1, zuege))) : 0.8;
  const score = 0.72 + 0.28 * eff - Math.min(0.3, tipps * 0.05);
  return Math.round(Math.max(0.5, Math.min(1, score)) * 100) / 100;
}

/* ====================================================================================================
   Oberfläche
   ==================================================================================================== */

/** css/patience.css einmalig nachladen (ist nicht in index.html eingebunden) */
function paStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-pa-styles], link[href$="css/patience.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/patience.css", import.meta.url).href;
  link.setAttribute("data-pa-styles", "");
  document.head.append(link);
}

const FARBNAMEN = ["Kreuz", "Pik", "Herz", "Karo"];
const FARBZEICHEN = ["♣", "♠", "♥", "♦"];

/** Zug in Worten, z. B. „Legen Sie Herz 5 auf Pik 6.“ */
export function zugText(s, m) {
  if (m.t === "ziehen") return "Ziehen Sie eine Karte vom Stapel.";
  const karten = quellKarten(s, m.von);
  const name = kartenName52(karten[0]);
  const was = karten.length > 1 ? `${name} mit den Karten darauf` : name;
  if (m.t === "ab") return `Legen Sie ${name} auf die Ablage.`;
  if (m.t === "ze") return `Legen Sie ${name} in ein freies Feld.`;
  const ziel = s.spalten[m.nach];
  if (!ziel.u.length) return `Legen Sie ${was} auf den leeren Platz.`;
  return `Legen Sie ${was} auf ${kartenName52(ziel.u[ziel.u.length - 1])}.`;
}

export default {
  id: "patience",
  bereich: "Kartenspiele",
  titel: "Patience",
  icon: "",
  anleitung: (stufe) => {
    const r = stufenRegeln(stufe);
    const bedienung = " Tippen Sie eine Karte an und dann das Ziel. Es gibt keinen Zeitdruck, und jeder Zug lässt sich zurücknehmen.";
    if (r.art === "freecell") {
      return `Freecell: Legen Sie alle Karten nach Farben geordnet auf die Ablage, vom Ass bis zum König. In den Reihen legen Sie abwechselnd rot auf schwarz, immer eins niedriger. ${r.zellen} freie Felder nehmen je eine Karte auf.` + bedienung;
    }
    const hoch = r.maxRang === 13 ? "König" : WERTE52[r.maxRang - 1];
    return `Legen Sie alle Karten nach Farben geordnet auf die Ablage, vom Ass bis ${r.maxRang === 13 ? "zum König" : "zur " + hoch}. In den Reihen legen Sie abwechselnd rot auf schwarz, immer eins niedriger.`
      + (r.ziehen === 3 ? " Vom Stapel werden immer drei Karten gezogen, nur die oberste ist frei." : " Tippen Sie auf den Stapel, um eine Karte zu ziehen.")
      + bedienung + " Gespielt wird mit dem französischen Blatt, weil Patience 13 Werte je Farbe braucht.";
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    paStyles();
    const regeln = stufenRegeln(stufe);
    const klondike = regeln.art === "klondike";

    const status = h("p.hinweis.gross.pa-status", { "aria-live": "polite", text: "Die Karten werden gemischt …" });
    stage.append(status);
    await sleep(60);
    if (!ctx.alive()) return null;
    const { zustand: start, loesung } = austeilen(stufe);
    if (!ctx.alive()) return null;

    let s = start;
    const verlauf = []; // frühere Zustände für Rückgängig
    let zuege = 0; // Züge ohne Ziehen (Rückgängig nimmt sie wieder weg)
    let tippsGenutzt = 0;
    let auswahl = null; // { von }
    let tippMarke = null; // { von?, ziel? }
    let gesperrt = false;
    const gesamt = kartenGesamt(s);
    const loeserZuege = loesung ? (klondike ? loesung.length : Math.min(loesung.length, 95)) : null;

    const infoEl = h("p.hinweis.pa-info");
    const knopfAblage = h("button.knopf.gross.primaer.pa-knopf", { type: "button", text: "Auf Ablage", disabled: true });
    const knopfTipp = h("button.knopf.gross.pa-knopf", { type: "button" });
    const knopfZurueck = h("button.knopf.gross.pa-knopf", { type: "button", text: "Rückgängig" });
    const knopfAufgeben = h("button.knopf.gross.pa-knopf", { type: "button", text: "Aufgeben" });
    const aktionen = h("div.knopfreihe.pa-aktionen", {}, knopfAblage, knopfTipp, knopfZurueck, knopfAufgeben);
    const oben = h("div.pa-oben");
    const spaltenEl = h("div.pa-spalten");
    const brett = h("div.pa-brett" + (klondike ? ".pa-klondike" : ".pa-freecell"), {}, oben, spaltenEl);
    const tischEl = h("div.pa-tisch", {}, infoEl, aktionen, brett);
    stage.append(tischEl);
    status.textContent = klondike ? "Legen Sie alle Karten auf die Ablage." : "Freecell: alle Karten auf die Ablage.";
    if (ctx.settings?.blatt === "deutsch") {
      infoEl.dataset.blatt = "1";
    }

    // ---------- Größe: Karten so skalieren, dass es ohne Scrollen passt (Tablet quer) ----------
    let w = 100;
    const spaltenZahl = s.spalten.length;
    const obenPlaetze = klondike ? 2 + s.farben.length + 1 : regeln.zellen + 4 + 0.5;
    const erwarteteLaenge = klondike ? Math.max(8, s.spalten.length + 3) : 10;
    const groesse = () => {
      const breite = brett.clientWidth || stage.clientWidth || 800;
      const luecke = Math.max(6, Math.min(14, breite / 90));
      const wBreite = Math.min((breite - (spaltenZahl - 1) * luecke) / spaltenZahl, (breite - obenPlaetze * luecke) / Math.max(spaltenZahl, obenPlaetze));
      const topDoc = brett.getBoundingClientRect().top + window.scrollY;
      const hoehe = Math.max(320, window.innerHeight - topDoc - 24);
      const wHoehe = hoehe / (1.4 + 0.25 + 1.4 + (erwarteteLaenge - 1) * 0.3);
      w = Math.round(Math.max(54, Math.min(150, wBreite, wHoehe)));
      brett.style.setProperty("--pa-w", w + "px");
      brett.style.setProperty("--pa-luecke", luecke + "px");
      brett.style.setProperty("--pa-n", String(spaltenZahl));
      brett.dataset.hoehe = String(Math.max(hoehe - 1.65 * w, 3 * w));
    };

    // ---------- Darstellung ----------
    const gleicheQuelle = (a, b) => a && b && a.s === b.s && a.j === b.j && a.talon === b.talon && a.z === b.z && a.ab === b.ab;
    const inAuswahl = (von) => auswahl && von.s != null && auswahl.von.s === von.s && von.j >= auswahl.von.j;
    const zielMoeglich = (m) => regeln.hilfe && auswahl && !pruefeZug(s, m);

    function kartenKnopf(c, von, label) {
      const el = karte52Element(c, { tag: "button" });
      el.type = "button";
      el.classList.add("pa-karte");
      if (auswahl && (gleicheQuelle(auswahl.von, von) || inAuswahl(von))) el.classList.add("pa-gewaehlt");
      if (tippMarke?.von && (gleicheQuelle(tippMarke.von, von) || (von.s != null && tippMarke.von.s === von.s && von.j >= tippMarke.von.j))) el.classList.add("pa-tipp");
      el.setAttribute("aria-pressed", String(el.classList.contains("pa-gewaehlt")));
      if (label) el.setAttribute("aria-label", label);
      el.onclick = debounced((e) => { e.stopPropagation(); tippeKarte(von); });
      return el;
    }

    function platz(klasse, label, onTap, inhalt = []) {
      const el = h("button.pa-platz" + klasse, { type: "button", "aria-label": label }, inhalt);
      el.onclick = debounced((e) => { e.stopPropagation(); onTap(); });
      return el;
    }

    function zeichne() {
      groesse();
      // obere Reihe
      const teile = [];
      if (klondike) {
        const rest = s.talon.length - s.gezogen;
        const stapel = platz(".pa-stapel" + (rest ? "" : ".pa-leer") + (tippMarke?.ziehen ? ".pa-tipp" : ""),
          rest ? `Nachziehstapel, ${rest} Karten` : s.talon.length ? "Stapel neu auflegen" : "Stapel leer",
          () => ziehen(),
          rest ? [karte52Element(null, { verdeckt: true }), h("span.pa-zahl", { text: String(rest) })]
            : [h("span.pa-kreis", { "aria-hidden": "true" }), h("span.pa-platztext", { text: s.talon.length ? "neu" : "leer" })]);
        const abwurf = h("div.pa-abwurf");
        if (s.gezogen > 0) {
          const i = s.gezogen - 1;
          abwurf.append(kartenKnopf(s.talon[i], { talon: i }, kartenName52(s.talon[i]) + ", vom Stapel"));
        } else abwurf.append(h("div.pa-platz.pa-leer", { "aria-hidden": "true" }));
        teile.push(stapel, abwurf, h("div.pa-luecke"));
      } else {
        s.zellen.forEach((c, z) => {
          if (c >= 0) teile.push(h("div.pa-zelle", {}, kartenKnopf(c, { z }, kartenName52(c) + ", im freien Feld")));
          else {
            const ziel = auswahl && zielMoeglich({ t: "ze", von: auswahl.von, nach: z });
            teile.push(platz(".pa-zelle" + (ziel ? ".pa-ziel" : "") + (tippMarke?.zelle === z ? ".pa-tipp" : ""), "Freies Feld", () => tippeZelle(z)));
          }
        });
        teile.push(h("div.pa-luecke"));
      }
      for (const f of s.farben) {
        const r = s.ablage[f];
        const ziel = auswahl && zielMoeglich({ t: "ab", von: auswahl.von });
        const tipp = tippMarke?.ablage && tippMarke.farbe === f;
        if (r > 0) {
          const c = f * 13 + r - 1;
          const el = klondike ? kartenKnopf(c, { ab: f }, `${kartenName52(c)}, auf der Ablage`) : karte52Element(c);
          if (!klondike) { el.classList.add("pa-karte"); }
          const huelle = h("div.pa-ablage" + (ziel ? ".pa-ziel" : "") + (tipp ? ".pa-tipp" : ""), {}, el);
          huelle.onclick = debounced(() => tippeAblage());
          teile.push(huelle);
        } else {
          teile.push(platz(".pa-ablage" + (ziel ? ".pa-ziel" : "") + (tipp ? ".pa-tipp" : ""), `Ablage ${FARBNAMEN[f]}`, () => tippeAblage(),
            [h("span.pa-farbe.pa-f" + f, { text: FARBZEICHEN[f], "aria-hidden": "true" })]));
        }
      }
      oben.replaceChildren(...teile);

      // Reihen
      const maxHoehe = +brett.dataset.hoehe || 600;
      const hoechste = [];
      const spalten = s.spalten.map((sp, i) => {
        const n = sp.d.length + sp.u.length;
        let offU = 0.3 * w, offD = 0.14 * w;
        const noetig = 1.4 * w + sp.d.length * offD + Math.max(0, sp.u.length - 1) * offU;
        if (noetig > maxHoehe && n > 1) {
          const f = Math.max(0.72, (maxHoehe - 1.4 * w) / (noetig - 1.4 * w));
          offU *= f; offD = Math.max(0.07 * w, offD * f);
        }
        const kinder = [];
        let y = 0;
        sp.d.forEach(() => { const k = karte52Element(null, { verdeckt: true }); k.style.top = y + "px"; kinder.push(k); y += offD; });
        const rs = reihenStart(sp.u);
        sp.u.forEach((c, j) => {
          const k = kartenKnopf(c, { s: i, j }, kartenName52(c) + (j < rs ? ", blockiert" : ""));
          k.style.top = y + "px";
          if (j < rs && regeln.hilfe) k.classList.add("pa-blockiert");
          kinder.push(k);
          y += offU;
        });
        const hoehe = (n ? y - (sp.u.length ? offU : offD) : 0) + 1.4 * w;
        hoechste.push(hoehe);
        const ziel = auswahl && zielMoeglich({ t: "sp", von: auswahl.von, nach: i });
        if (!n) kinder.push(h("span.pa-leerplatz", { "aria-hidden": "true" }));
        const el = h("div.pa-spalte" + (ziel ? ".pa-ziel" : "") + (tippMarke?.nach === i ? ".pa-tipp" : ""),
          { role: "button", tabindex: n ? null : "0", "aria-label": n ? `Reihe ${i + 1}` : `Reihe ${i + 1}, leer` }, kinder);
        el.onclick = debounced(() => tippeSpalte(i));
        el.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); tippeSpalte(i); } };
        return el;
      });
      spaltenEl.replaceChildren(...spalten);
      spaltenEl.style.height = Math.max(...hoechste, 1.4 * w) + 8 + "px";

      // Knöpfe und Info
      const nAb = abgelegtAnzahl(s);
      const tippsRest = regeln.tipps === Infinity ? null : regeln.tipps - tippsGenutzt;
      infoEl.textContent = `Züge: ${zuege}  ·  Abgelegt: ${nAb} von ${gesamt}` + (tippsRest != null ? `  ·  Tipps übrig: ${tippsRest}` : "")
        + (infoEl.dataset.blatt ? "  ·  Patience braucht 13 Werte je Farbe, darum französisches Blatt" : "");
      knopfTipp.textContent = tippsRest != null ? `Tipp (${tippsRest})` : "Tipp";
      knopfTipp.disabled = gesperrt || tippsRest === 0;
      knopfZurueck.disabled = gesperrt || !verlauf.length;
      knopfAufgeben.disabled = gesperrt;
      const abOk = auswahl && !pruefeZug(s, { t: "ab", von: auswahl.von });
      knopfAblage.disabled = gesperrt || !abOk;
      tischEl.classList.toggle("pa-gesperrt", gesperrt);
    }

    // ---------- Aktionen ----------
    let ende = null;

    function zugMachen(m, { zaehlt = true } = {}) {
      verlauf.push({ s, zuege });
      s = fuehreAus(s, m);
      if (zaehlt) zuege++;
      auswahl = null;
      tippMarke = null;
      zeichne();
      pruefeEnde();
    }

    function versuche(m) {
      const grund = pruefeZug(s, m);
      if (grund) {
        feedback(stage, "Das passt dort leider nicht", "neutral");
        status.textContent = grund;
        auswahl = null;
        zeichne();
        return;
      }
      status.textContent = m.t === "ab" ? "Gut – abgelegt." : "Gut.";
      zugMachen(m);
    }

    function tippeKarte(von) {
      if (gesperrt) return;
      if (!(tippMarke?.von && gleicheQuelle(tippMarke.von, von))) tippMarke = null; // Ziel des Tipps bleibt markiert
      if (auswahl) {
        if (gleicheQuelle(auswahl.von, von)) { auswahl = null; status.textContent = "Auswahl aufgehoben."; zeichne(); return; }
        if (von.s != null && auswahl.von.s !== von.s) return versuche({ t: "sp", von: auswahl.von, nach: von.s });
        if (von.ab != null) return versuche({ t: "ab", von: auswahl.von });
        if (von.s != null && auswahl.von.s === von.s) { auswahl = null; } // andere Karte derselben Reihe: neu wählen
        else if (von.z != null || von.talon != null) { auswahl = null; }
      }
      if (von.s != null && von.j < reihenStart(s.spalten[von.s].u)) {
        const grund = "Diese Karte ist noch blockiert. Bewegen Sie zuerst die Karten, die darauf liegen.";
        feedback(stage, grund, "neutral");
        status.textContent = grund;
        zeichne();
        return;
      }
      auswahl = { von };
      const k = quellKarten(s, von);
      status.textContent = `${kartenName52(k[0])}${k.length > 1 ? ` und ${k.length - 1} weitere` : ""} gewählt. Tippen Sie jetzt auf das Ziel.`;
      zeichne();
    }

    function tippeSpalte(i) {
      if (gesperrt) return;
      if (!auswahl) {
        const sp = s.spalten[i];
        if (sp.u.length) return tippeKarte({ s: i, j: sp.u.length - 1 });
        status.textContent = "Wählen Sie zuerst eine Karte aus.";
        return;
      }
      if (auswahl.von.s === i) { auswahl = null; status.textContent = "Auswahl aufgehoben."; zeichne(); return; }
      versuche({ t: "sp", von: auswahl.von, nach: i });
    }

    function tippeAblage() {
      if (gesperrt) return;
      if (!auswahl) { status.textContent = "Wählen Sie zuerst eine Karte aus, dann die Ablage."; return; }
      versuche({ t: "ab", von: auswahl.von });
    }

    function tippeZelle(z) {
      if (gesperrt) return;
      if (!auswahl) { status.textContent = "Wählen Sie zuerst eine Karte aus."; return; }
      versuche({ t: "ze", von: auswahl.von, nach: z });
    }

    function ziehen() {
      if (gesperrt) return;
      if (!s.talon.length) { feedback(stage, "Der Stapel ist leer.", "neutral"); return; }
      const neu = s.gezogen >= s.talon.length;
      status.textContent = neu ? "Der Stapel wurde neu aufgelegt." : s.ziehen === 3 ? "Drei Karten gezogen – nur die oberste ist frei." : "Karte gezogen.";
      zugMachen({ t: "ziehen" }, { zaehlt: false });
    }

    async function pruefeEnde() {
      if (istGeloest(s)) return ende?.({ geloest: true });
      const rest = trivialeZuege(s);
      if (!rest) return;
      gesperrt = true;
      status.textContent = "Jetzt geht alles auf – die Karten werden abgelegt.";
      zeichne();
      for (const m of rest) {
        await sleep(220);
        if (!ctx.alive()) return;
        verlauf.push({ s, zuege });
        s = fuehreAus(s, m);
        zuege++;
        zeichne();
      }
      ende?.({ geloest: true });
    }

    knopfAblage.onclick = debounced(() => { if (!gesperrt && auswahl) versuche({ t: "ab", von: auswahl.von }); });
    knopfZurueck.onclick = debounced(() => {
      if (gesperrt || !verlauf.length) return;
      ({ s, zuege } = verlauf.pop());
      auswahl = null; tippMarke = null;
      status.textContent = "Zug zurückgenommen.";
      zeichne();
    });
    knopfTipp.onclick = debounced(async () => {
      if (gesperrt) return;
      if (regeln.tipps !== Infinity && tippsGenutzt >= regeln.tipps) return;
      auswahl = null;
      status.textContent = "Einen Moment, ich überlege …";
      gesperrt = true; zeichne();
      await sleep(40);
      if (!ctx.alive()) return;
      const r = loese(s, { zeitMs: klondike ? 700 : 900 });
      gesperrt = false;
      let m = r.geloest && r.zuege.length ? r.zuege[0] : null;
      let vorsicht = "";
      if (!m) {
        if (r.ausgeschoepft) {
          status.textContent = "Von hier aus sehe ich keinen Weg mehr. Nehmen Sie ein paar Züge zurück.";
          zeichne();
          return;
        }
        m = zugKandidaten(s)[0] ?? null;
        vorsicht = "Vielleicht hilft das: ";
        if (!m) { status.textContent = "Ich finde gerade keinen Zug. Nehmen Sie ein paar Züge zurück."; zeichne(); return; }
      }
      tippsGenutzt++;
      if (m.von?.talon != null && m.von.talon !== s.gezogen - 1) {
        tippMarke = { ziehen: true };
        status.textContent = vorsicht + "Ziehen Sie eine Karte vom Stapel.";
      } else {
        tippMarke = { von: m.von, nach: m.t === "sp" ? m.nach : null, ablage: m.t === "ab", farbe: farbeVon(quellKarten(s, m.von)[0]), zelle: m.t === "ze" ? m.nach : null };
        status.textContent = vorsicht + zugText(s, m);
      }
      ctx.speak?.(status.textContent);
      zeichne();
    });
    knopfAufgeben.onclick = debounced(() => {
      if (gesperrt) return;
      gesperrt = true;
      zeichne();
      const ja = h("button.knopf.gross", { type: "button", text: "Ja, aufgeben" });
      const nein = h("button.knopf.gross.primaer", { type: "button", text: "Weiterspielen" });
      const alt = status.textContent;
      status.textContent = "Möchten Sie dieses Spiel wirklich beenden?";
      const frage = h("div.knopfreihe.pa-frage", {}, nein, ja);
      aktionen.after(frage);
      nein.onclick = debounced(() => { frage.remove(); gesperrt = false; status.textContent = alt; zeichne(); });
      ja.onclick = debounced(() => { frage.remove(); ende?.({ geloest: false }); });
    });

    const beiGroesse = () => zeichne();
    window.addEventListener("resize", beiGroesse);
    zeichne();

    const ergebnis = await warteAufEingabe(ctx, (fertig) => { ende = fertig; },
      () => { window.removeEventListener("resize", beiGroesse); ende = null; });
    if (!ergebnis || !ctx.alive()) return null;

    gesperrt = true;
    auswahl = null; tippMarke = null;
    zeichne();
    const nAb = abgelegtAnzahl(s);
    const score = bewerte({ geloest: ergebnis.geloest, abgelegt: nAb, gesamt, tipps: tippsGenutzt, zuege, loeserZuege });
    if (ergebnis.geloest) {
      status.textContent = "Geschafft – alle Karten liegen auf der Ablage!";
      feedback(stage, "Geschafft!", "gut");
    } else {
      status.textContent = `${nAb} von ${gesamt} Karten abgelegt. Beim nächsten Mal klappt es sicher besser.`;
    }
    await sleep(1800);
    if (!ctx.alive()) return null;
    const tippText = tippsGenutzt ? `, ${tippsGenutzt} ${tippsGenutzt === 1 ? "Tipp" : "Tipps"}` : "";
    const text = ergebnis.geloest
      ? `Patience gelöst in ${zuege} Zügen${tippText}.`
      : `${nAb} von ${gesamt} Karten abgelegt – gut, dass Sie es versucht haben.`;
    return { score, text };
  },
};
