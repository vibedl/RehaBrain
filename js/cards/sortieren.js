// Karten Stufe 1: Karten nach Farbe sortieren; ab Stufe 8 wechselt die Regel (Farbe ↔ Bild/Zahl)
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { BLAETTER, neuesDeck, karteElement, istBild, farbSymbol } from "./deck.js";

export default {
  id: "sortieren",
  bereich: "Kartenspiele",
  titel: "Karten sortieren",
  icon: "🗂️",
  anleitung: (stufe) => stufe >= 8
    ? "Legen Sie jede Karte auf den passenden Stapel. Achtung: Oben steht, ob nach FARBE oder nach BILD und ZAHL sortiert wird – das wechselt."
    : "Oben sehen Sie eine Karte. Tippen Sie auf den Stapel mit der gleichen Farbe.",

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const blatt = BLAETTER[settings.blatt];
    const deck = neuesDeck(settings.blatt).slice(0, 12);
    let richtig = 0;
    let regel = "farbe";

    const hinweis = h("p.hinweis.gross");
    const kartePlatz = h("div.kartenplatz");
    const stapel = h("div.stapelreihe");
    stage.append(hinweis, kartePlatz, stapel);

    for (let i = 0; i < deck.length && ctx.alive(); i++) {
      const k = deck[i];
      if (stufe >= 8 && i > 0 && Math.random() < 0.3) regel = regel === "farbe" ? "bild" : "farbe";
      hinweis.textContent = regel === "farbe" ? "Nach FARBE sortieren" : "Nach BILD oder ZAHL sortieren";
      kartePlatz.replaceChildren(karteElement(k));

      const ziele = regel === "farbe"
        ? blatt.farben.map((f, fi) => ({ label: [farbSymbol(f), f.name], css: f.css, passt: k.farbIndex === fi }))
        : [
            { label: "Bildkarte", css: "neutral", passt: istBild(k) },
            { label: "Zahl oder Ass", css: "neutral", passt: !istBild(k) },
          ];

      const ok = await new Promise((resolve) => {
        stapel.replaceChildren(...ziele.map((z) =>
          h(`button.stapel.${z.css}`, { onclick: debounced(() => resolve(z.passt)) }, z.label)));
        const warte = setInterval(() => { if (!ctx.alive()) { clearInterval(warte); resolve(null); } }, 300);
      });
      if (ok == null) return null;
      if (ok) { richtig++; feedback(stage, "Richtig!", "gut"); }
      else feedback(stage, "Das war ein anderer Stapel", "neutral");
      await sleep(700);
    }
    if (!ctx.alive()) return null;
    return { score: richtig / deck.length, text: `${richtig} von ${deck.length} Karten richtig sortiert.` };
  },
};
