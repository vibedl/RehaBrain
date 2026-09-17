// Aufmerksamkeit: Suchbild – alle Zielobjekte zwischen Ablenkern finden
import { h, sleep, rand, pick, shuffle, feedback } from "../core/ui.js";

// Gruppen ähnlicher Objekte: in höheren Stufen kommen die Ablenker aus derselben Gruppe
const GRUPPEN = [
  ["🍎", "🍅", "🍒", "🍓"],
  ["🐶", "🐱", "🦊", "🐻"],
  ["🌷", "🌹", "🌺", "🌸"],
  ["🚗", "🚕", "🚙", "🚌"],
  ["⚽", "🏀", "🎾", "⚾"],
];

export default {
  id: "suchbild",
  bereich: "Aufmerksamkeit",
  titel: "Suchbild",
  icon: "🔍",
  anleitung: () => "Oben sehen Sie ein Bild. Finden und tippen Sie alle gleichen Bilder im Feld darunter. Wenn Sie alle gefunden haben, tippen Sie auf „Fertig“.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const bretter = 3;
    const anzahl = Math.min(42, 9 + stufe * 2);
    const spalten = anzahl <= 12 ? 4 : anzahl <= 30 ? 6 : 7;
    let gefunden = 0, gesamtZiele = 0, fehlTipps = 0;

    for (let b = 0; b < bretter && ctx.alive(); b++) {
      stage.innerHTML = "";
      const gruppe = pick(GRUPPEN);
      const ziel = pick(gruppe);
      const ablenkerPool = stufe >= 8
        ? gruppe.filter((x) => x !== ziel)
        : GRUPPEN.filter((g) => g !== gruppe).flat();
      const zielAnzahl = 2 + rand(Math.min(4, 1 + Math.floor(stufe / 4)));
      gesamtZiele += zielAnzahl;
      const items = shuffle([
        ...Array(zielAnzahl).fill(ziel),
        ...Array.from({ length: anzahl - zielAnzahl }, () => pick(ablenkerPool)),
      ]);

      let offen = zielAnzahl;
      const zaehler = h("span", { text: `Brett ${b + 1} von ${bretter}` });
      const kopf = h("div.suchkopf", {}, h("span.suchziel", { text: ziel, "aria-label": "Gesuchtes Bild" }), zaehler);
      const fertigBtn = h("button.knopf.sekundaer", { text: "Fertig" });
      const raster = h("div.suchraster", { style: { gridTemplateColumns: `repeat(${spalten}, 1fr)` } },
        items.map((it) => h("button.suchitem", {
          text: it,
          onTap: (e) => {
            const btn = e.currentTarget;
            if (btn.disabled) return;
            if (it === ziel) { btn.disabled = true; btn.classList.add("gefunden"); gefunden++; offen--; }
            else { fehlTipps++; btn.classList.add("wackeln"); setTimeout(() => btn.classList.remove("wackeln"), 400); }
          },
        })));
      stage.append(kopf, raster, fertigBtn);

      await new Promise((resolve) => {
        fertigBtn.onclick = resolve;
        const warte = setInterval(() => {
          if (offen === 0 || !ctx.alive()) { clearInterval(warte); resolve(); }
        }, 200);
      });
      if (!ctx.alive()) return null;
      feedback(stage, offen === 0 ? "Alle gefunden!" : `${zielAnzahl - offen} von ${zielAnzahl} gefunden`, offen === 0 ? "gut" : "neutral");
      await sleep(1100);
    }
    if (!ctx.alive()) return null;
    const score = gefunden / (gesamtZiele + fehlTipps * 0.5);
    return { score, text: `${gefunden} von ${gesamtZiele} Bildern gefunden.` };
  },
};
