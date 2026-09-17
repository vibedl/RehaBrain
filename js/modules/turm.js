// Planen & Denken: Turm umschichten (Türme von Hanoi, ab Stufe 11 Zielbilder nach Tower-of-London-Prinzip)
import { h, sleep, rand, feedback, onTap } from "../core/ui.js";

// Zustand: pos[d] = Stab (0–2) der Scheibe d; d = 0 ist die kleinste Scheibe

/** Oberste (kleinste) Scheibe auf einem Stab, oder -1 */
export function obersteScheibe(pos, stab) {
  for (let d = 0; d < pos.length; d++) if (pos[d] === stab) return d;
  return -1;
}

export function zugErlaubt(pos, von, nach) {
  if (von === nach) return false;
  const d = obersteScheibe(pos, von);
  if (d < 0) return false;
  const ziel = obersteScheibe(pos, nach);
  return ziel < 0 || ziel > d;
}

export function ziehe(pos, von, nach) {
  const neu = [...pos];
  neu[obersteScheibe(pos, von)] = nach;
  return neu;
}

const schluessel = (pos) => pos.join("");

/** Alle Abstände (kürzeste Zugzahlen) vom Start aus – Breitensuche über höchstens 3^5 Zustände */
export function abstaende(start) {
  const dist = new Map([[schluessel(start), 0]]);
  const zustand = new Map([[schluessel(start), start]]);
  const schlange = [start];
  while (schlange.length) {
    const p = schlange.shift();
    const dp = dist.get(schluessel(p));
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      if (!zugErlaubt(p, a, b)) continue;
      const q = ziehe(p, a, b), k = schluessel(q);
      if (!dist.has(k)) { dist.set(k, dp + 1); zustand.set(k, q); schlange.push(q); }
    }
  }
  return { dist, zustand };
}

export function optimaleZuege(start, ziel) {
  return abstaende(start).dist.get(schluessel(ziel));
}

export const istGleich = (a, b) => schluessel(a) === schluessel(b);

/** Zielbild-Aufgabe: zufälliger Start, Ziel genau k Züge entfernt (oder so weit wie möglich) */
export function zielAufgabe(n, k, zufall = rand) {
  const start = Array.from({ length: n }, () => zufall(3));
  const { dist, zustand } = abstaende(start);
  let beste = 0;
  for (const v of dist.values()) beste = Math.max(beste, Math.min(v, k));
  const kandidaten = [...dist.entries()].filter(([, v]) => v === beste).map(([s]) => zustand.get(s));
  const ziel = kandidaten[zufall(kandidaten.length)];
  return { start, ziel, optimal: beste };
}

/** Score: optimal = 1, jeder Umweg kostet anteilig */
export function turmScore(zuege, optimal) {
  if (zuege <= optimal) return 1;
  return Math.max(0, 1 - (zuege - optimal) / (optimal * 1.5 + 2));
}

/** Aufgaben-Rahmen pro Stufe */
export function turmStufe(stufe) {
  if (stufe <= 10) {
    const n = stufe <= 3 ? 2 : stufe <= 6 ? 3 : stufe <= 9 ? 4 : 5;
    return { modus: "hanoi", n, runden: n === 2 ? 3 : n === 5 ? 1 : 2 };
  }
  if (stufe <= 14) return { modus: "ziel", n: 3, k: 3 + (stufe - 11), runden: 3 };
  if (stufe <= 17) return { modus: "ziel", n: 4, k: 5 + (stufe - 15), runden: 3 };
  return { modus: "ziel", n: 5, k: 6 + (stufe - 18), runden: 3 };
}

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

const STAB_NAMEN = ["linken", "mittleren", "rechten"];

function zeichneTuerme(container, pos, { klein = false, gewaehlt = -1 } = {}) {
  const n = pos.length;
  const staebe = [0, 1, 2].map((s) => {
    const scheiben = [];
    for (let d = 0; d < n; d++) if (pos[d] === s) { // kleinste zuerst = oben im Stapel
      scheiben.push(h(`div.pl-turm-scheibe.pl-turm-farbe${d % 5}` + (s === gewaehlt && d === obersteScheibe(pos, s) ? ".angehoben" : ""), {
        style: { width: `${34 + (66 * (d + 1)) / n}%` },
      }));
    }
    return scheiben;
  });
  if (klein) {
    container.replaceChildren(...staebe.map((sch) => h("div.pl-turm-stab.klein", {}, h("div.pl-turm-stange"), h("div.pl-turm-stapel", {}, sch))));
  }
  return staebe;
}

export default {
  id: "turm",
  bereich: "Planen & Denken",
  titel: "Turm umschichten",
  icon: "",
  anleitung: (stufe) =>
    (stufe <= 10
      ? "Bringen Sie alle Scheiben auf den rechten Stab."
      : "Bauen Sie die Scheiben so um, dass sie aussehen wie im Zielbild.")
    + " Tippen Sie zuerst den Stab an, von dem Sie eine Scheibe nehmen, dann den Ziel-Stab. Eine große Scheibe darf nie auf einer kleineren liegen.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const rahmen = turmStufe(stufe);
    let punkte = 0, optimalGeloest = 0;

    for (let r = 0; r < rahmen.runden && ctx.alive(); r++) {
      stage.replaceChildren();
      const aufgabe = rahmen.modus === "hanoi"
        ? { start: Array(rahmen.n).fill(0), ziel: Array(rahmen.n).fill(2), optimal: 2 ** rahmen.n - 1 }
        : zielAufgabe(rahmen.n, rahmen.k);

      let pos = aufgabe.start;
      const verlauf = [];
      let zuege = 0, gewaehlt = -1;
      const grenze = aufgabe.optimal * 4 + 12;

      const hinweis = h("p.hinweis", { text: `Aufgabe ${r + 1} von ${rahmen.runden} – in ${aufgabe.optimal === 1 ? "1 Zug" : aufgabe.optimal + " Zügen"} lösbar` });
      const zaehler = h("p.pl-turm-zaehler");
      const zielbild = h("div.pl-turm-zielbild", { "aria-label": "Zielbild" });
      zeichneTuerme(zielbild, aufgabe.ziel, { klein: true });
      const stabKnoepfe = [0, 1, 2].map((s) => h("button.pl-turm-stab", { "aria-label": `${STAB_NAMEN[s]} Stab` }));
      const feldTuerme = h("div.pl-turm-feld", {}, stabKnoepfe);
      const rueck = h("button.knopf.gross", { text: "Rückgängig" });
      stage.append(hinweis, h("div.pl-turm-zielbox", {}, h("span", { text: "Ziel" }), zielbild), feldTuerme, zaehler, h("div.knopfreihe", {}, rueck));

      const zeichne = () => {
        const staebe = zeichneTuerme(null, pos, { gewaehlt });
        stabKnoepfe.forEach((k, s) => {
          k.replaceChildren(h("div.pl-turm-stange"), h("div.pl-turm-stapel", {}, staebe[s]));
          k.classList.toggle("gewaehlt", s === gewaehlt);
        });
        zaehler.textContent = `Züge: ${zuege}`;
        rueck.disabled = verlauf.length === 0;
      };
      zeichne();

      const ergebnis = await warte(ctx, (done) => {
        stabKnoepfe.forEach((k, s) => onTap(k, () => {
          if (gewaehlt < 0) {
            if (obersteScheibe(pos, s) < 0) { feedback(stage, "Auf diesem Stab liegt keine Scheibe", "neutral"); return; }
            gewaehlt = s; zeichne(); return;
          }
          if (s === gewaehlt) { gewaehlt = -1; zeichne(); return; }
          if (!zugErlaubt(pos, gewaehlt, s)) {
            feedback(stage, "Große Scheiben nicht auf kleine legen", "neutral");
            gewaehlt = -1; zeichne(); return;
          }
          verlauf.push(pos);
          pos = ziehe(pos, gewaehlt, s);
          zuege++; gewaehlt = -1; zeichne();
          if (istGleich(pos, aufgabe.ziel)) done("geschafft");
          else if (zuege >= grenze) done("grenze");
        }));
        onTap(rueck, () => {
          if (!verlauf.length) return;
          pos = verlauf.pop(); gewaehlt = -1; zeichne();
        });
      });
      if (ergebnis == null || !ctx.alive()) return null;
      feldTuerme.classList.add("pl-turm-gesperrt");
      rueck.disabled = true;

      const score = ergebnis === "geschafft" ? turmScore(zuege, aufgabe.optimal) : 0;
      punkte += score;
      if (ergebnis === "geschafft" && zuege <= aufgabe.optimal) { optimalGeloest++; feedback(stage, "Perfekt – mit den wenigsten Zügen!", "gut"); }
      else if (ergebnis === "geschafft") feedback(stage, `Geschafft in ${zuege} Zügen`, "gut");
      else feedback(stage, "Das war knifflig – nächste Aufgabe", "neutral");
      await sleep(1800);
      if (!ctx.alive()) return null;
    }
    if (!ctx.alive()) return null;
    return {
      score: punkte / rahmen.runden,
      text: `${optimalGeloest} von ${rahmen.runden} ${rahmen.runden === 1 ? "Aufgabe" : "Aufgaben"} mit den wenigsten Zügen gelöst.`,
    };
  },
};
