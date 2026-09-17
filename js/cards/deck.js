// Kartendeck: 32 Karten (Skatblatt), französisch oder deutsch, extra groß dargestellt
import { h, shuffle } from "../core/ui.js";

// Vier-Farben-Darstellung: jede Farbe hat eine eigene Farbe – leichter zu unterscheiden
export const BLAETTER = {
  franzoesisch: {
    name: "Französisches Blatt",
    farben: [
      { id: "kreuz", name: "Kreuz", symbol: "♣", css: "kreuz" },
      { id: "pik", name: "Pik", symbol: "♠", css: "pik" },
      { id: "herz", name: "Herz", symbol: "♥", css: "herz" },
      { id: "karo", name: "Karo", symbol: "♦", css: "karo" },
    ],
    werte: ["7", "8", "9", "10", "B", "D", "K", "A"],
    wertNamen: { B: "Bube", D: "Dame", K: "König", A: "Ass" },
  },
  deutsch: {
    name: "Deutsches Blatt",
    farben: [
      { id: "kreuz", name: "Eichel", symbol: "", svg: '<path d="M4.5 10.5C4.5 6.4 7.8 3.5 12 3.5s7.5 2.9 7.5 7z"/><path d="M6.5 11.5h11c0 5.6-2.4 9.5-5.5 9.5s-5.5-3.9-5.5-9.5z"/><rect x="11" y="0.5" width="2" height="4" rx="1"/>', css: "eichel" },
      { id: "pik", name: "Grün", symbol: "", svg: '<path d="M12 1.5c5.5 4.3 7.5 8.4 7.5 12.3a7.5 7.5 0 0 1-15 0c0-3.9 2-8 7.5-12.3z"/><path d="M12 7.5v15" stroke="#FFFDF9" stroke-width="1.3" fill="none"/>', css: "gruen" },
      { id: "herz", name: "Rot", symbol: "", svg: '<path d="M12 21.5S3.5 16 3.5 9.8A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 16 12 21.5 12 21.5z"/>', css: "rot" },
      { id: "karo", name: "Schellen", symbol: "", svg: '<rect x="11" y="1" width="2" height="4" rx="1"/><circle cx="12" cy="13.5" r="8.5"/><path d="M3.8 12.5h16.4" stroke="#FFFDF9" stroke-width="1.6" fill="none"/><circle cx="12" cy="17.5" r="1.8" fill="#FFFDF9"/>', css: "schellen" },
    ],
    werte: ["7", "8", "9", "10", "U", "O", "K", "A"],
    wertNamen: { U: "Unter", O: "Ober", K: "König", A: "Daus" },
  },
};

/** Rang 0 (Sieben) … 7 (Ass) – gleich für beide Blätter, damit Spiele blattunabhängig sind */
export function neuesDeck(blatt = "franzoesisch") {
  const b = BLAETTER[blatt];
  const karten = [];
  b.farben.forEach((farbe, fi) => {
    b.werte.forEach((wert, rang) => {
      karten.push({ id: `${farbe.id}-${rang}`, farbe: farbe.id, farbIndex: fi, rang, wert, blatt });
    });
  });
  return shuffle(karten);
}

export function kartenName(k) {
  const b = BLAETTER[k.blatt];
  const farbe = b.farben[k.farbIndex].name;
  return `${farbe} ${b.wertNamen[k.wert] ?? k.wert}`;
}

export const istBild = (k) => k.rang >= 4 && k.rang <= 6; // Bube/Dame/König bzw. Unter/Ober/König

/** Karte als großes, gut lesbares Element. verdeckt=true zeigt die Rückseite. */
/** Farbzeichen als Element: Unicode (französisch) oder eigene Zeichnung (deutsch) */
export function farbSymbol(f) {
  const el = h("span.farbsymbol", { "aria-hidden": "true" });
  if (f.svg) el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">${f.svg}</svg>`;
  else el.textContent = f.symbol;
  return el;
}

export function karteElement(k, { verdeckt = false, tag = "div" } = {}) {
  if (verdeckt || !k) return h(`${tag}.karte.rueckseite`, { "aria-label": "Verdeckte Karte" });
  const f = BLAETTER[k.blatt].farben[k.farbIndex];
  return h(`${tag}.karte.${f.css}`, { "aria-label": kartenName(k) },
    h("span.ecke", {}, k.wert, farbSymbol(f)),
    h("span.mitte", {}, farbSymbol(f)),
    h("span.wert", { text: k.wert }),
  );
}
