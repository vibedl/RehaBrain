// Karten Stufe 8: 17 und 4 gegen die Computer-Bank (32er-Blatt, Chips ohne echtes Geld)
// Werte: Ass 11, König 4, Dame/Ober 3, Bube/Unter 2, 7–10 Augenwert. Ziel 21, zwei Asse gewinnen sofort.
// Bewertet wird die Entscheidungsqualität (Karte/Genug im Vergleich zur besten Wahl), nicht das Kartenglück.
import { h, sleep, feedback } from "../core/ui.js";
import { neuesDeck, karteElement } from "./deck.js";
import { mischen, RANG } from "./engine.js";
import { kartenStyles, warteAufEingabe } from "./tisch.js";

/* ================================================================ Spiellogik (ohne DOM) */

export const RUNDEN = 6;
export const START_CHIPS = 20;
export const EINSATZ = 2;
export const BANK_STOPP = 17;

/** Kartenwert nach klassischer Zählung */
export function kartenWert(k) {
  switch (k.rang) {
    case RANG.SIEBEN: return 7;
    case RANG.ACHT: return 8;
    case RANG.NEUN: return 9;
    case RANG.ZEHN: return 10;
    case RANG.BUBE: return 2;
    case RANG.DAME: return 3;
    case RANG.KOENIG: return 4;
    case RANG.ASS: return 11;
    default: return 0;
  }
}

export const summe = (hand) => hand.reduce((a, k) => a + kartenWert(k), 0);
export const zweiAsse = (hand) => hand.length === 2 && hand.every((k) => k.rang === RANG.ASS);
export const ueberkauft = (hand) => !zweiAsse(hand) && summe(hand) > 21;

/** Bank zieht, bis sie mindestens 17 hat (zwei Asse = sofort fertig). Verändert bankHand und deck. */
export function bankSpielt(bankHand, deck) {
  while (!zweiAsse(bankHand) && summe(bankHand) < BANK_STOPP && deck.length) bankHand.push(deck.pop());
  return bankHand;
}

/**
 * Ergebnis einer Runde aus Sicht des Spielers: "sieg" | "niederlage" | "unentschieden"
 * Zwei Asse gewinnen immer (haben beide zwei Asse: unentschieden). Überkauft verliert – der Spieler zuerst.
 */
export function vergleiche(spieler, bank) {
  const sA = zweiAsse(spieler), bA = zweiAsse(bank);
  if (sA && bA) return "unentschieden";
  if (sA) return "sieg";
  if (ueberkauft(spieler)) return "niederlage";
  if (bA) return "niederlage";
  if (ueberkauft(bank)) return "sieg";
  const s = summe(spieler), b = summe(bank);
  return s > b ? "sieg" : s < b ? "niederlage" : "unentschieden";
}

/* ---------- Beste Entscheidung (exakt über die noch unbekannten Karten) */

const WERTE = [2, 3, 4, 7, 8, 9, 10, 11];
const ASS_IDX = 7;

/** Zählt unbekannte Karten je Wert (Index passend zu WERTE). */
export function restZaehlen(unbekannt) {
  const z = new Array(WERTE.length).fill(0);
  for (const k of unbekannt) z[WERTE.indexOf(kartenWert(k))]++;
  return z;
}

/**
 * Verteilung des Bank-Endstands, wenn die Bank mit `start` Karten (Werte) beginnt und aus `rest` zieht.
 * Rückgabe: Map Schlüssel -> Wahrscheinlichkeit; Schlüssel ist Summe oder "AA" (zwei Asse).
 */
function bankVerteilung(bankWerte, rest, memo) {
  const s = bankWerte.reduce((a, b) => a + b, 0);
  if (bankWerte.length === 2 && bankWerte[0] === 11 && bankWerte[1] === 11) return new Map([["AA", 1]]);
  const n = rest.reduce((a, b) => a + b, 0);
  if (s >= BANK_STOPP || n === 0) return new Map([[s, 1]]);
  // Zwei-Asse-Sonderfall nur bei genau einer Ass-Karte – dann Kartenanzahl im Schlüssel
  const key = (bankWerte.length === 1 && bankWerte[0] === 11 ? "A1|" : s + "|") + rest.join(",");
  if (memo.has(key)) return memo.get(key);
  const out = new Map();
  for (let i = 0; i < WERTE.length; i++) {
    if (!rest[i]) continue;
    const p = rest[i] / n;
    rest[i]--;
    const naechste = bankWerte.length === 1 && bankWerte[0] === 11 ? [11, WERTE[i]] : [s + WERTE[i]];
    const sub = bankVerteilung(naechste, rest, memo);
    rest[i]++;
    for (const [k, q] of sub) out.set(k, (out.get(k) ?? 0) + p * q);
  }
  memo.set(key, out);
  return out;
}

/** Erwartungswert (sieg +1, niederlage -1) beim Stehenbleiben mit Summe s. */
function evStehen(spielerSumme, spielerAA, bankOffen, rest, memo) {
  if (spielerAA) return 1;
  if (spielerSumme > 21) return -1;
  const vert = bankVerteilung([bankOffen], rest, memo);
  let ev = 0;
  for (const [k, p] of vert) {
    if (k === "AA") ev -= p;
    else if (k > 21) ev += p;
    else ev += p * Math.sign(spielerSumme - k);
  }
  return ev;
}

/**
 * Erwartungswerte beider Entscheidungen.
 * spielerHand, bankOffen (eine sichtbare Bankkarte), unbekannt = alle Karten, die der Spieler nicht sieht.
 * @returns { stehen, ziehen, beste: "genug"|"karte" }
 */
export function bewerteEntscheidung(spielerHand, bankOffen, unbekannt) {
  const rest = restZaehlen(unbekannt);
  const memoBank = new Map();
  const memoZ = new Map();
  const bank = kartenWert(bankOffen);
  const aa = zweiAsse(spielerHand);
  const s = summe(spielerHand);
  const stehen = evStehen(s, aa, bank, rest, memoBank);

  // Optimaler Wert nach dem Ziehen (danach wieder optimal entscheiden). Bank zieht aus dem dann verbleibenden Rest.
  const optimal = (summeJetzt, restJetzt) => {
    if (summeJetzt > 21) return -1;
    const key = summeJetzt + "|" + restJetzt.join(",");
    if (memoZ.has(key)) return memoZ.get(key);
    const st = evStehen(summeJetzt, false, bank, restJetzt, memoBank);
    const zi = ziehenEV(summeJetzt, restJetzt);
    const w = Math.max(st, zi);
    memoZ.set(key, w);
    return w;
  };
  const ziehenEV = (summeJetzt, restJetzt) => {
    const n = restJetzt.reduce((a, b) => a + b, 0);
    if (!n) return evStehen(summeJetzt, false, bank, restJetzt, memoBank);
    let ev = 0;
    for (let i = 0; i < WERTE.length; i++) {
      if (!restJetzt[i]) continue;
      const p = restJetzt[i] / n;
      restJetzt[i]--;
      ev += p * optimal(summeJetzt + WERTE[i], restJetzt);
      restJetzt[i]++;
    }
    return ev;
  };

  let ziehen;
  if (aa) ziehen = -1; // zwei Asse wegwerfen wäre unsinnig
  else if (s > 21) ziehen = -1;
  else if (spielerHand.length === 1 && spielerHand[0].rang === RANG.ASS) {
    // Ein Ass: die nächste Karte kann ein zweites Ass sein (sofortiger Sieg)
    const n = rest.reduce((a, b) => a + b, 0);
    ziehen = 0;
    for (let i = 0; i < WERTE.length; i++) {
      if (!rest[i]) continue;
      const p = rest[i] / n;
      rest[i]--;
      ziehen += p * (i === ASS_IDX ? 1 : optimal(11 + WERTE[i], rest));
      rest[i]++;
    }
  } else {
    ziehen = ziehenEV(s, rest);
  }
  return { stehen, ziehen, beste: ziehen > stehen ? "karte" : "genug" };
}

/** War die Entscheidung gut? Innerhalb der Toleranz zur besten Wahl zählt als gut (knappe Fälle). */
export function entscheidungGut(bewertung, wahl, toleranz = 0.1) {
  const best = Math.max(bewertung.stehen, bewertung.ziehen);
  const gewaehlt = wahl === "karte" ? bewertung.ziehen : bewertung.stehen;
  return gewaehlt >= best - toleranz;
}

/** Stufen-Einstellungen */
export function konfig17und4(stufe) {
  const s = Math.max(1, Math.min(20, stufe | 0 || 1));
  return {
    summeZeigen: s <= 5,              // Punktestand wird angezeigt
    pruefKnopf: s >= 6 && s <= 11,     // „Summe prüfen“-Knopf als Hilfe
    rechnen: s >= 12,                 // Summe selbst eintippen
    toleranz: s <= 5 ? 0.15 : s <= 11 ? 0.1 : 0.06,
    bankSummeZeigen: s <= 8,
  };
}

/** Score aus Entscheidungen (und ab Stufe 12 Kopfrechnen). */
export function score17und4({ gute, entscheidungen, rechnenRichtig = 0, rechnenGesamt = 0 }) {
  const e = entscheidungen ? gute / entscheidungen : 1;
  if (!rechnenGesamt) return e;
  return Math.round((0.7 * e + 0.3 * (rechnenRichtig / rechnenGesamt)) * 100) / 100;
}

/**
 * Simulation einer ganzen Runde mit einer Strategie (für Tests).
 * strategie(hand, bankOffen, unbekannt) => "karte" | "genug"
 */
export function simuliereRunde(deck, strategie) {
  deck = [...deck];
  const spieler = [deck.pop(), deck.pop()];
  const bank = [deck.pop()];
  let schritte = 0;
  while (!zweiAsse(spieler) && summe(spieler) <= 21 && deck.length && schritte++ < 20) {
    const unbekannt = [...deck, ...bank.slice(1)];
    if (strategie(spieler, bank[0], unbekannt) !== "karte") break;
    spieler.push(deck.pop());
  }
  if (!ueberkauft(spieler) && !zweiAsse(spieler)) bankSpielt(bank, deck);
  return { spieler, bank, ergebnis: vergleiche(spieler, bank) };
}

/* ================================================================ Oberfläche */

export default {
  id: "siebzehnundvier",
  bereich: "Kartenspiele",
  titel: "17 und 4",
  icon: "",
  anleitung: (stufe) => {
    const k = konfig17und4(stufe);
    return "Sammeln Sie Karten bis nahe an 21 Punkte, aber nicht darüber. Ass zählt 11, König 4, Dame 3, Bube 2, die anderen ihren Augenwert. Mit „Karte“ ziehen Sie, mit „Genug“ ist die Bank dran."
      + (k.rechnen ? " Tippen Sie nach jeder neuen Karte Ihre Summe ein." : k.summeZeigen ? "" : " Rechnen Sie Ihre Summe selbst im Kopf mit.");
  },

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    kartenStyles();
    const blatt = settings.blatt ?? "franzoesisch";
    const k = konfig17und4(stufe);
    let chips = START_CHIPS;
    let gute = 0, entscheidungen = 0, rechnenRichtig = 0, rechnenGesamt = 0, hilfen = 0;
    let siege = 0;

    const stand = h("div.spielstand.kt-chips");
    const hinweis = h("p.hinweis.gross.kt-status", { "aria-live": "polite" });
    const bankTitel = h("p.hinweis.kt-bereich");
    const bankPlatz = h("div.kt-reihe");
    const spielerTitel = h("p.hinweis.kt-bereich");
    const spielerPlatz = h("div.kt-reihe");
    const knoepfe = h("div.knopfreihe.kt-aktionen");
    const legende = h("p.reihenfolge.kt-legende", { text: blatt === "deutsch" ? "Daus 11 · König 4 · Ober 3 · Unter 2 · 7–10 Augenwert" : "Ass 11 · König 4 · Dame 3 · Bube 2 · 7–10 Augenwert" });
    stage.append(stand, legende, bankTitel, bankPlatz, hinweis, spielerTitel, spielerPlatz, knoepfe);
    const zeigeStand = (runde) => { stand.textContent = `Runde ${runde} von ${RUNDEN}   ·   Chips: ${chips}`; };

    const zeigeHand = (platz, hand, verdeckteDazu = 0) => {
      platz.replaceChildren(...hand.map((c) => karteElement(c)), ...Array.from({ length: verdeckteDazu }, () => karteElement(null, { verdeckt: true })));
      platz.lastChild?.classList.add("neu");
    };

    const tastenEingabe = () => {
      let wert = "";
      const zeile = h("div.eingabezeile", { text: "_ _" });
      return warteAufEingabe(ctx, (ende) => {
        const render = () => { zeile.textContent = wert ? wert.split("").join(" ") + (wert.length < 2 ? " _" : "") : "_ _"; };
        const tasten = [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((t) => h("button.taste", {
          type: "button", text: t, "aria-label": t === "⌫" ? "Löschen" : t === "✓" ? "Fertig" : String(t),
          onTap: () => {
            if (t === "⌫") wert = wert.slice(0, -1);
            else if (t === "✓") { if (wert) return ende(Number(wert)); }
            else if (wert.length < 2) wert += t;
            render();
          },
        }));
        knoepfe.replaceChildren(h("div.kt-rechnen", {}, zeile, h("div.tastenfeld", {}, tasten)));
      }, () => knoepfe.replaceChildren());
    };

    for (let runde = 1; runde <= RUNDEN; runde++) {
      if (!ctx.alive()) return null;
      zeigeStand(runde);
      const deck = mischen(neuesDeck(blatt));
      const spieler = [deck.pop(), deck.pop()];
      const bank = [deck.pop()];

      bankTitel.textContent = k.bankSummeZeigen ? `Bank: ${summe(bank)}` : "Bank";
      zeigeHand(bankPlatz, bank, 1);
      spielerTitel.textContent = "Ihre Karten";
      zeigeHand(spielerPlatz, spieler);
      hinweis.textContent = "Neue Runde";
      await sleep(900);
      if (!ctx.alive()) return null;

      let pruefeRechnen = k.rechnen;
      // Spieler-Entscheidungen
      while (!zweiAsse(spieler) && summe(spieler) <= 21) {
        spielerTitel.textContent = k.summeZeigen ? `Ihre Karten: ${summe(spieler)} Punkte` : "Ihre Karten";

        if (pruefeRechnen) {
          hinweis.textContent = "Wie viele Punkte haben Sie?";
          const eingabe = await tastenEingabe();
          if (eingabe == null) return null;
          rechnenGesamt++;
          if (eingabe === summe(spieler)) { rechnenRichtig++; feedback(stage, `Richtig, ${summe(spieler)} Punkte`, "gut"); }
          else feedback(stage, `Es sind ${summe(spieler)} Punkte`, "neutral");
          await sleep(1200);
          if (!ctx.alive()) return null;
          pruefeRechnen = false;
        }

        hinweis.textContent = "Karte oder genug?";
        const wahl = await warteAufEingabe(ctx, (ende) => {
          const reihe = [
            h("button.knopf.riesig", { type: "button", text: "Karte", onTap: () => ende("karte") }),
            h("button.knopf.riesig", { type: "button", text: "Genug", onTap: () => ende("genug") }),
          ];
          if (k.pruefKnopf) {
            reihe.push(h("button.knopf.gross", {
              type: "button", text: "Summe prüfen",
              onTap: () => { hilfen++; feedback(stage, `Sie haben ${summe(spieler)} Punkte`, "neutral"); },
            }));
          }
          knoepfe.replaceChildren(...reihe);
        }, () => knoepfe.replaceChildren());
        if (wahl == null) return null;

        // Unbekannt aus Sicht des Spielers: alles außer eigener Hand und offener Bankkarte
        const bewertung = bewerteEntscheidung(spieler, bank[0], deck);
        entscheidungen++;
        if (entscheidungGut(bewertung, wahl, k.toleranz)) gute++;

        if (wahl === "genug") break;
        spieler.push(deck.pop());
        zeigeHand(spielerPlatz, spieler);
        pruefeRechnen = k.rechnen && !ueberkauft(spieler) && !zweiAsse(spieler);
        await sleep(700);
        if (!ctx.alive()) return null;
      }
      spielerTitel.textContent = `Ihre Karten: ${summe(spieler)} Punkte`;

      if (zweiAsse(spieler)) {
        hinweis.textContent = "Zwei Asse – gewonnen!";
      } else if (ueberkauft(spieler)) {
        hinweis.textContent = `${summe(spieler)} Punkte – leider über 21.`;
      } else {
        // Bank zieht sichtbar Karte für Karte
        hinweis.textContent = "Die Bank ist dran …";
        await sleep(900);
        while (!zweiAsse(bank) && summe(bank) < BANK_STOPP && deck.length) {
          bank.push(deck.pop());
          zeigeHand(bankPlatz, bank);
          bankTitel.textContent = `Bank: ${summe(bank)}`;
          await sleep(1000);
          if (!ctx.alive()) return null;
        }
      }
      zeigeHand(bankPlatz, bank);
      bankTitel.textContent = zweiAsse(bank) ? "Bank: zwei Asse" : `Bank: ${summe(bank)}`;

      const erg = vergleiche(spieler, bank);
      if (erg === "sieg") { chips += EINSATZ; siege++; feedback(stage, "Runde gewonnen", "gut"); }
      else if (erg === "niederlage") { chips -= EINSATZ; feedback(stage, "Die Bank gewinnt diese Runde", "neutral"); }
      else feedback(stage, "Unentschieden", "neutral");
      if (!zweiAsse(spieler) && !ueberkauft(spieler)) {
        hinweis.textContent = erg === "sieg" ? "Gewonnen!" : erg === "niederlage" ? "Die Bank gewinnt." : "Unentschieden.";
      }
      zeigeStand(runde);

      await warteAufEingabe(ctx, (ende) => {
        knoepfe.replaceChildren(h("button.knopf.gross.primaer", { type: "button", text: runde < RUNDEN ? "Nächste Runde" : "Fertig", onTap: () => ende(true) }));
      }, () => knoepfe.replaceChildren());
      if (!ctx.alive()) return null;
    }

    const score = score17und4({ gute, entscheidungen, rechnenRichtig, rechnenGesamt });
    const teile = [`${siege} von ${RUNDEN} Runden gewonnen, ${chips} Chips.`, `${gute} von ${entscheidungen} Entscheidungen waren klug.`];
    if (rechnenGesamt) teile.push(`${rechnenRichtig} von ${rechnenGesamt} Summen richtig.`);
    return { score, text: teile.join(" ") };
  },
};
