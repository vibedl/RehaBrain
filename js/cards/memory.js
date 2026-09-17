// Karten Stufe 2: Paare finden (Memory)
import { h, sleep, shuffle, debounced } from "../core/ui.js";
import { neuesDeck, karteElement } from "./deck.js";

export default {
  id: "memory",
  bereich: "Kartenspiele",
  titel: "Paare finden",
  icon: "🃏",
  anleitung: () => "Alle Karten liegen verdeckt. Decken Sie zwei Karten auf. Sind es die gleichen, bleiben sie liegen. Finden Sie alle Paare.",

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const paare = Math.min(16, 3 + Math.floor(stufe / 2));
    const motive = neuesDeck(settings.blatt).slice(0, paare);
    const karten = shuffle([...motive, ...motive].map((k, i) => ({ ...k, key: i })));
    const spalten = paare <= 4 ? 4 : paare <= 8 ? 4 : paare <= 12 ? 6 : 8;

    const hinweis = h("p.hinweis", { text: `${paare} Paare finden` });
    const brett = h("div.memorybrett", { style: { gridTemplateColumns: `repeat(${spalten}, 1fr)`, width: `min(100%, ${spalten * 150}px)` } });
    stage.append(hinweis, brett);

    const offen = new Set();
    let versuche = 0, gefunden = 0, gewaehlt = [], sperre = false;

    const zeichnen = () => {
      brett.replaceChildren(...karten.map((k) => {
        const sichtbar = offen.has(k.key) || gewaehlt.includes(k);
        const el = karteElement(k, { verdeckt: !sichtbar, tag: "button" });
        if (offen.has(k.key)) el.classList.add("erledigt");
        el.onclick = debounced(() => waehle(k));
        return el;
      }));
    };

    let fertig;
    const ende = new Promise((r) => { fertig = r; });

    async function waehle(k) {
      if (sperre || offen.has(k.key) || gewaehlt.includes(k)) return;
      gewaehlt.push(k);
      zeichnen();
      if (gewaehlt.length < 2) return;
      versuche++;
      const [a, b] = gewaehlt;
      sperre = true;
      if (a.id === b.id) {
        offen.add(a.key); offen.add(b.key); gefunden++;
        await sleep(400);
      } else {
        await sleep(Math.max(900, 1800 - stufe * 40)); // genug Zeit zum Anschauen
      }
      gewaehlt = [];
      sperre = false;
      hinweis.textContent = `${gefunden} von ${paare} Paaren gefunden`;
      zeichnen();
      if (gefunden === paare) fertig(true);
    }

    zeichnen();
    const warte = setInterval(() => { if (!ctx.alive()) fertig(false); }, 300);
    const ok = await ende;
    clearInterval(warte);
    if (!ok) return null;
    // Perfektes Spiel: versuche == paare. Mit ~1,6-facher Versuchszahl gilt es noch als sehr gut.
    const score = Math.min(1, (paare * 1.6) / versuche) ;
    return { score, text: `Alle ${paare} Paare in ${versuche} Versuchen gefunden.` };
  },
};
