// Karten Stufe 4: Schnipp-Schnapp gegen den Computer – bei gleichem Wert wie die Karte davor „Schnapp!“ tippen
import { h, sleep, rand, feedback, debounced } from "../core/ui.js";
import { neuesDeck, karteElement } from "./deck.js";

export default {
  id: "schnipp",
  bereich: "Kartenspiele",
  titel: "Schnipp-Schnapp",
  icon: "👋",
  anleitung: () => "Karten werden nacheinander aufgedeckt. Hat die neue Karte den GLEICHEN WERT wie die Karte davor (zum Beispiel zwei Könige), tippen Sie schnell auf „Schnapp!“. Seien Sie schneller als der Computer.",

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const anzahl = 20;
    const takt = Math.max(1200, 3400 - stufe * 110);          // Zeit pro Karte
    const cpuZeit = Math.max(700, 2600 - stufe * 100);         // so lange wartet der Computer

    // Folge bauen, in der etwa jede dritte Karte ein Treffer ist
    const pool = neuesDeck(settings.blatt);
    const folge = [pool.pop()];
    while (folge.length < anzahl) {
      const vorher = folge[folge.length - 1];
      const i = Math.random() < 0.33
        ? pool.findIndex((k) => k.rang === vorher.rang)
        : pool.findIndex((k) => k.rang !== vorher.rang);
      folge.push(pool.splice(i >= 0 ? i : rand(pool.length), 1)[0] ?? neuesDeck(settings.blatt)[0]);
    }

    let du = 0, computer = 0, treffer = 0, fehlTipps = 0;
    const stand = h("div.spielstand");
    const platz = h("div.kartenplatz.zwei");
    let aktiv = null; // { istTreffer, entschieden }
    const knopf = h("button.knopf.riesig", {
      text: "Schnapp!",
      onclick: debounced(() => {
        if (!aktiv || aktiv.entschieden) return;
        aktiv.entschieden = true;
        if (aktiv.istTreffer) { du++; feedback(stage, "Schnapp! Punkt für Sie", "gut"); }
        else { fehlTipps++; feedback(stage, "Die Werte waren verschieden", "neutral"); }
        zeigeStand();
      }),
    });
    const zeigeStand = () => { stand.textContent = `Sie: ${du}   ·   Computer: ${computer}`; };
    zeigeStand();
    stage.append(stand, platz, knopf);

    for (let i = 1; i < folge.length && ctx.alive(); i++) {
      const vorher = folge[i - 1], neu = folge[i];
      const istTreffer = vorher.rang === neu.rang;
      if (istTreffer) treffer++;
      platz.replaceChildren(karteElement(vorher), karteElement(neu));
      platz.lastChild.classList.add("neu");
      aktiv = { istTreffer, entschieden: false };

      const start = performance.now();
      while (performance.now() - start < takt && ctx.alive()) {
        if (istTreffer && !aktiv.entschieden && performance.now() - start > cpuZeit) {
          aktiv.entschieden = true; computer++;
          feedback(stage, "Der Computer war schneller", "neutral");
          zeigeStand();
        }
        await sleep(40);
      }
    }
    if (!ctx.alive()) return null;
    const score = treffer ? Math.max(0, (du - fehlTipps * 0.5) / treffer) : 1;
    const sieger = du > computer ? "Gewonnen!" : du === computer ? "Unentschieden." : "Der Computer hat diesmal gewonnen.";
    return { score, text: `${sieger} Sie ${du} : ${computer} Computer.` };
  },
};
