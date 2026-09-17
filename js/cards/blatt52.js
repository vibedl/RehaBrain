// 52er-Blatt (französisch) für Patience. deck.js hat nur 32 Karten (Skatblatt) – Patience braucht 13 Werte je Farbe.
// Karten sind hier kleine Zahlen (schnell für den Löser): c = farbe * 13 + (rang - 1), farbe 0..3 wie in BLAETTER
// (0 Kreuz, 1 Pik = schwarz; 2 Herz, 3 Karo = rot), rang 1 (Ass) … 13 (König).
// Für die Darstellung wird daraus ein Kartenobjekt gebaut, das karteElement() aus deck.js versteht.
import { shuffle } from "../core/ui.js";
import { BLAETTER, karteElement, kartenName } from "./deck.js";

export const WERTE52 = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"];

export const rangVon = (c) => (c % 13) + 1;
export const farbeVon = (c) => Math.floor(c / 13);
export const istRot = (c) => c >= 26;
export const karteCode = (farbe, rang) => farbe * 13 + rang - 1;

/** Gemischtes Blatt als Zahlen. farben z. B. [0, 2] (Kreuz, Herz), maxRang z. B. 6 (Ass bis 6). */
export function neuesBlatt52(farben = [0, 1, 2, 3], maxRang = 13) {
  const karten = [];
  for (const f of farben) for (let r = 1; r <= maxRang; r++) karten.push(karteCode(f, r));
  return shuffle(karten);
}

/** Kartenobjekt im Format von deck.js (immer französisches Blatt) */
export function karte52(c) {
  const fi = farbeVon(c);
  const r = rangVon(c);
  const farbe = BLAETTER.franzoesisch.farben[fi];
  return { id: `${farbe.id}-${r}`, farbe: farbe.id, farbIndex: fi, rang: r, wert: WERTE52[r - 1], blatt: "franzoesisch" };
}

export const kartenName52 = (c) => kartenName(karte52(c));

/** Karte als Element (nutzt karteElement aus deck.js, also dieselben .karte-Klassen) */
export const karte52Element = (c, opts = {}) => karteElement(c == null || c < 0 ? null : karte52(c), opts);
