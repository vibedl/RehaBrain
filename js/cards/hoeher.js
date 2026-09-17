// Karten Stufe 3: Höher oder tiefer? Ab Stufe 6 wird die Karte nach kurzer Zeit verdeckt (merken!)
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { neuesDeck, karteElement, BLAETTER } from "./deck.js";

export default {
  id: "hoeher",
  bereich: "Kartenspiele",
  titel: "Höher oder tiefer",
  icon: "↕️",
  anleitung: (stufe) =>
    "Sie sehen eine Karte. Ist die nächste Karte höher oder tiefer? Die Reihenfolge steht über den Karten: von der 7 (niedrigste) bis zum Ass (höchste). Bei gleichem Wert zählt jede Antwort als richtig."
    + (stufe >= 6 ? " Die Karte wird bald umgedreht – merken Sie sie sich." : ""),

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const deck = neuesDeck(settings.blatt);
    const runden = 10;
    let richtig = 0;

    const reihe = BLAETTER[settings.blatt].werte.join(" · ");
    const hinweis = h("p.hinweis");
    const platz = h("div.kartenplatz.zwei");
    const knoepfe = h("div.knopfreihe");
    stage.append(hinweis, h("p.reihenfolge", { text: reihe }), platz, knoepfe);

    let aktuell = deck.pop();
    for (let r = 0; r < runden && ctx.alive(); r++) {
      hinweis.textContent = `Runde ${r + 1} von ${runden}`;
      platz.replaceChildren(karteElement(aktuell), karteElement(null, { verdeckt: true }));
      if (stufe >= 6) {
        await sleep(Math.max(1200, 3500 - stufe * 100));
        if (!ctx.alive()) return null;
        platz.firstChild.replaceWith(karteElement(null, { verdeckt: true }));
      }

      const tipp = await new Promise((resolve) => {
        knoepfe.replaceChildren(
          h("button.knopf.gross", { text: "Höher", onclick: debounced(() => resolve("hoch")) }),
          h("button.knopf.gross", { text: "Tiefer", onclick: debounced(() => resolve("tief")) }),
        );
        const warte = setInterval(() => { if (!ctx.alive()) { clearInterval(warte); resolve(null); } }, 300);
      });
      knoepfe.replaceChildren();
      if (tipp == null) return null;

      const naechste = deck.pop();
      platz.replaceChildren(karteElement(aktuell), karteElement(naechste));
      const ok = naechste.rang === aktuell.rang
        || (tipp === "hoch" && naechste.rang > aktuell.rang)
        || (tipp === "tief" && naechste.rang < aktuell.rang);
      if (ok) { richtig++; feedback(stage, "Richtig!", "gut"); }
      else feedback(stage, "Diesmal nicht", "neutral");
      await sleep(1400);
      aktuell = naechste;
    }
    if (!ctx.alive()) return null;
    return { score: richtig / runden, text: `${richtig} von ${runden} richtig geschätzt.` };
  },
};
