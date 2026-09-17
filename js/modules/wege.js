// Gedächtnis: Wege merken (Corsi-Prinzip) – aufleuchtende Felder in der gleichen Reihenfolge antippen
import { h, sleep, shuffle, feedback, debounced } from "../core/ui.js";

export default {
  id: "wege",
  bereich: "Gedächtnis",
  titel: "Wege merken",
  icon: "🟦",
  anleitung: () => "Felder leuchten nacheinander auf. Tippen Sie die Felder danach in derselben Reihenfolge an.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const seite = stufe >= 9 ? 4 : 3;
    const laenge = Math.min(9, 2 + Math.floor(stufe / 2));
    const takt = Math.max(550, 1000 - stufe * 20);
    const runden = 5;
    let richtig = 0;

    const hinweis = h("p.hinweis");
    const felder = Array.from({ length: seite * seite }, (_, i) => h("button.feld", { "aria-label": `Feld ${i + 1}` }));
    const brett = h("div.brett", { style: { gridTemplateColumns: `repeat(${seite}, 1fr)` } }, felder);
    stage.append(hinweis, brett);

    for (let r = 0; r < runden && ctx.alive(); r++) {
      const folge = shuffle(felder.map((_, i) => i)).slice(0, laenge);
      hinweis.textContent = `Runde ${r + 1} von ${runden} – zuschauen`;
      brett.classList.add("gesperrt");
      await sleep(900);
      for (const i of folge) {
        if (!ctx.alive()) return null;
        felder[i].classList.add("leuchtet");
        await sleep(takt);
        felder[i].classList.remove("leuchtet");
        await sleep(200);
      }
      hinweis.textContent = "Jetzt Sie";
      brett.classList.remove("gesperrt");

      const ok = await new Promise((resolve) => {
        let pos = 0;
        felder.forEach((f, i) => {
          f.onclick = debounced(() => {
            f.classList.add("gewaehlt");
            setTimeout(() => f.classList.remove("gewaehlt"), 300);
            if (i !== folge[pos]) return resolve(false);
            if (++pos === folge.length) resolve(true);
          });
        });
        const warte = setInterval(() => { if (!ctx.alive()) { clearInterval(warte); resolve(null); } }, 300);
      });
      felder.forEach((f) => { f.onclick = null; });
      if (ok == null) return null;
      if (ok) { richtig++; feedback(stage, "Richtig!", "gut"); }
      else feedback(stage, "Knapp daneben – nächste Runde", "neutral");
      await sleep(1100);
    }
    if (!ctx.alive()) return null;
    return { score: richtig / runden, text: `${richtig} von ${runden} Wegen richtig (je ${laenge} Felder).` };
  },
};
