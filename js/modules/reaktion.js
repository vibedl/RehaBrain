// Aufmerksamkeit: Reaktion (ab Stufe 5 mit Go/No-Go: nur beim grünen Kreis tippen)
import { h, sleep, rand, feedback } from "../core/ui.js";

export default {
  id: "reaktion",
  bereich: "Aufmerksamkeit",
  titel: "Reaktion",
  icon: "⚡",
  anleitung: (stufe) => stufe >= 5
    ? "Warten Sie, bis ein Kreis erscheint. Tippen Sie nur, wenn er GRÜN ist. Bei einem roten Kreis nicht tippen."
    : "Warten Sie, bis der grüne Kreis erscheint. Tippen Sie dann so schnell es geht auf die große Fläche.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const runden = 10;
    const goNoGo = stufe >= 5;
    // Anzeigedauer: in niedrigen Stufen großzügig, persönliche Messung zählt mehr als Grenzen
    const anzeige = goNoGo ? Math.max(1200, 4000 - stufe * 140) : 6000;
    const zeiten = [];
    let richtig = 0;

    const kreis = h("div.reiz");
    const flaeche = h("button.tippflaeche", { "aria-label": "Tippfläche" }, kreis);
    const info = h("p.hinweis", { text: "Bereit machen …" });
    stage.append(info, flaeche);

    for (let i = 0; i < runden && ctx.alive(); i++) {
      info.textContent = `Runde ${i + 1} von ${runden}`;
      kreis.className = "reiz";
      let getippt = null;
      let zeigtReiz = false;
      let start = 0;
      const handler = () => {
        if (!zeigtReiz) { feedback(stage, "Noch warten …", "neutral"); return; }
        if (getippt == null) getippt = performance.now() - start;
      };
      flaeche.onclick = handler;

      await sleep(1000 + rand(2500));
      if (!ctx.alive()) return null;

      const ziel = !goNoGo || Math.random() < 0.7;
      kreis.className = "reiz sichtbar " + (ziel ? "gruen" : "rot");
      zeigtReiz = true;
      start = performance.now();

      const ende = start + anzeige;
      while (getippt == null && performance.now() < ende && ctx.alive()) await sleep(30);
      zeigtReiz = false;
      kreis.className = "reiz";
      flaeche.onclick = null;

      if (ziel && getippt != null) {
        richtig++; zeiten.push(getippt);
        feedback(stage, `${Math.round(getippt)} ms`, "gut");
      } else if (!ziel && getippt == null) {
        richtig++; feedback(stage, "Gut abgewartet!", "gut");
      } else if (!ziel) {
        feedback(stage, "Der war rot – beim nächsten Mal warten", "neutral");
      } else {
        feedback(stage, "Etwas zu spät – weiter geht's", "neutral");
      }
      await sleep(900);
    }
    if (!ctx.alive()) return null;

    const mittel = zeiten.length ? zeiten.reduce((a, b) => a + b, 0) / zeiten.length : null;
    // Vergleich mit der eigenen Bestzeit statt mit festen Normen
    const best = ctx.bests.reaktion;
    let score = richtig / runden;
    let text = `${richtig} von ${runden} richtig.`;
    if (mittel) {
      text += ` Durchschnitt: ${Math.round(mittel)} ms.`;
      if (!best || mittel < best) { ctx.bests.reaktion = mittel; text += " Neue persönliche Bestzeit!"; }
      else if (mittel > best * 1.3) score = Math.min(score, 0.79); // deutlich langsamer als sonst → nicht hochstufen
    }
    return { score, text };
  },
};
