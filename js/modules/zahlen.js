// Gedächtnis: Zahlenfolgen merken (ab Stufe 11 abwechselnd rückwärts)
import { h, sleep, rand, feedback } from "../core/ui.js";

export default {
  id: "zahlen",
  bereich: "Gedächtnis",
  titel: "Zahlen merken",
  icon: "🔢",
  anleitung: (stufe) => stufe >= 11
    ? "Zahlen erscheinen nacheinander. Merken Sie sich die Reihenfolge. Achten Sie darauf, ob Sie VORWÄRTS oder RÜCKWÄRTS eingeben sollen."
    : "Zahlen erscheinen nacheinander. Merken Sie sich die Reihenfolge und tippen Sie sie danach auf dem Tastenfeld ein.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const laenge = Math.min(9, 2 + Math.floor(stufe / 2));
    const takt = Math.max(700, 1400 - stufe * 30);
    const runden = 5;
    let richtig = 0;

    const anzeige = h("div.zahlanzeige", { "aria-live": "polite" });
    const hinweis = h("p.hinweis");
    stage.append(hinweis, anzeige);

    for (let r = 0; r < runden && ctx.alive(); r++) {
      const folge = Array.from({ length: laenge }, () => rand(10));
      const rueckwaerts = stufe >= 11 && r % 2 === 1;
      hinweis.textContent = `Runde ${r + 1} von ${runden} – gut aufpassen`;
      anzeige.textContent = "";
      await sleep(1000);
      for (const z of folge) {
        if (!ctx.alive()) return null;
        anzeige.textContent = z;
        ctx.speak(String(z));
        await sleep(takt);
        anzeige.textContent = "";
        await sleep(250);
      }

      hinweis.textContent = rueckwaerts ? "Jetzt RÜCKWÄRTS eingeben" : "Jetzt eingeben";
      const eingabe = await tastenfeld(stage, laenge, ctx);
      if (eingabe == null) return null;
      const soll = rueckwaerts ? [...folge].reverse() : folge;
      if (eingabe.join("") === soll.join("")) { richtig++; feedback(stage, "Richtig!", "gut"); }
      else feedback(stage, `Es war: ${soll.join(" ")}`, "neutral");
      await sleep(1300);
    }
    if (!ctx.alive()) return null;
    return { score: richtig / runden, text: `${richtig} von ${runden} Folgen richtig (je ${laenge} Zahlen).` };
  },
};

function tastenfeld(stage, laenge, ctx) {
  return new Promise((resolve) => {
    const werte = [];
    const zeile = h("div.eingabezeile");
    const render = () => { zeile.textContent = werte.join(" ") + " _".repeat(laenge - werte.length); };
    render();
    const fertig = () => { feld.remove(); zeile.remove(); resolve(werte); };
    const tasten = [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((t) =>
      h("button.taste", {
        text: t,
        "aria-label": t === "⌫" ? "Löschen" : t === "✓" ? "Fertig" : String(t),
        onTap: () => {
          if (t === "⌫") werte.pop();
          else if (t === "✓") { if (werte.length) return fertig(); }
          else if (werte.length < laenge) werte.push(t);
          render();
          if (werte.length === laenge) setTimeout(fertig, 350);
        },
      }));
    const feld = h("div.tastenfeld", {}, tasten);
    stage.append(zeile, feld);
    const warte = setInterval(() => { if (!ctx.alive()) { clearInterval(warte); resolve(null); } }, 300);
  });
}
