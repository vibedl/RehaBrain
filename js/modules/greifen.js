// Visuomotorik: Sortieren mit Ziel – ein Objekt erscheint, antippen und dann den passenden Behälter antippen;
// ab höheren Stufen zusätzlich per Ziehen möglich (nie Pflicht) und die Objekte bewegen sich langsam.
import { h, feedback, shuffle } from "../core/ui.js";
import {
  klemme, mittelwert, stufenwert, tempoGegenBest, merkeBest, leseBest, tippErkennung, warte, warteAuf,
} from "./vm-kern.js";

// ---------- Reine Logik (testbar) ----------

const FORMEN = ["kreis", "quadrat", "dreieck"];
export const FORMNAME = { kreis: "Kreis", quadrat: "Viereck", dreieck: "Dreieck" };

export function greifenParameter(stufe) {
  const s = klemme(Math.round(stufe), 1, 20);
  return {
    kategorien: s <= 10 ? 2 : 3,
    runden: Math.round(stufenwert(s, 6, 14)),
    bewegt: s >= 12,
    geschwindigkeit: s >= 12 ? stufenwert(s, 10, 32) : 0, // px/s
    ziehenErlaubt: s >= 7,                                 // Ziehen zusätzlich möglich, nie verpflichtend
    versuche: 2,
  };
}

/** Reihenfolge der Kategorien für eine Sitzung planen: gleichmäßig verteilt, nie 3-mal dieselbe hintereinander */
export function planeRunden(runden, kategorien, rng = Math.random) {
  const aus = [];
  for (let i = 0; i < runden; i++) {
    let k;
    do { k = Math.floor(rng() * kategorien); } while (aus.length >= 2 && aus[aus.length - 1] === k && aus[aus.length - 2] === k);
    aus.push(k);
  }
  return aus.map((k) => ({ kategorie: k, form: FORMEN[k % FORMEN.length] }));
}

/** Feste, zufällig gemischte Reihenfolge der Behälter für eine Sitzung */
export function planeBehaelter(kategorien) {
  return shuffle(Array.from({ length: kategorien }, (_, i) => i));
}

export function greifenAuswertung(ergebnisse, bestMs = null) {
  const n = ergebnisse.length || 1;
  const erste = ergebnisse.filter((e) => e.ersterVersuch).length;
  const richtige = ergebnisse.filter((e) => e.richtig);
  const msListe = richtige.map((e) => e.ms).filter((x) => x > 0);
  const msProObjekt = msListe.length ? mittelwert(msListe) : null;
  const tempo = msProObjekt ? tempoGegenBest(msProObjekt, bestMs) : 0.6;
  const gezogen = ergebnisse.filter((e) => e.gezogen).length;
  const trefferQuote = erste / n;
  return {
    score: klemme(0.75 * trefferQuote + 0.25 * tempo),
    erste, gesamt: ergebnisse.length, trefferQuote, msProObjekt, tempo, gezogen,
  };
}

// ---------- Darstellung ----------

const FORM_SVG = {
  kreis: '<circle cx="24" cy="24" r="17"/>',
  quadrat: '<rect x="8" y="8" width="32" height="32" rx="3"/>',
  dreieck: '<path d="M24 6L44 42H4Z" stroke-linejoin="round"/>',
};
const svgForm = (form) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.5" aria-hidden="true">${FORM_SVG[form]}</svg>`;

export default {
  id: "greifen",
  bereich: "Visuomotorik",
  titel: "Sortieren mit Ziel",
  icon: "",
  anleitung: (stufe) => {
    const p = greifenParameter(stufe);
    const basis = p.kategorien === 2
      ? "Ein Kreis oder ein Viereck erscheint. Tippen Sie das Objekt an und danach den Behälter mit der gleichen Form."
      : "Ein Kreis, ein Viereck oder ein Dreieck erscheint. Tippen Sie das Objekt an und danach den Behälter mit der gleichen Form.";
    const zusatz = p.ziehenErlaubt ? " Sie können das Objekt auch mit dem Finger direkt in den Behälter ziehen – Antippen geht aber immer." : "";
    const bewegt = p.bewegt ? " Das Objekt bewegt sich langsam – das ist Absicht, lassen Sie sich Zeit." : "";
    return basis + zusatz + bewegt;
  },

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const p = greifenParameter(stufe);
    const plan = planeRunden(p.runden, p.kategorien);
    const behaelterOrdnung = planeBehaelter(p.kategorien);
    const ziehenAn = p.ziehenErlaubt && settings?.greifenZiehen !== false;

    const info = h("p.hinweis", { text: "" });
    const tablett = h("div.vm-greif-tablett");
    const objekt = h("button.vm-greif-objekt", { "aria-label": "Objekt" });
    tablett.append(objekt);
    const behaelter = behaelterOrdnung.map((k) =>
      h("button.vm-greif-behaelter", { "aria-label": `Behälter: ${FORMNAME[FORMEN[k % FORMEN.length]]}` },
        h("span.vm-greif-symbol", { html: svgForm(FORMEN[k % FORMEN.length]) }),
        h("span.vm-greif-name", { text: FORMNAME[FORMEN[k % FORMEN.length]] })));
    const reiheBehaelter = h("div.vm-greif-reihe", {}, behaelter);
    stage.append(info, tablett, reiheBehaelter);

    const ergebnisse = [];
    try {
      if (!(await warte(ctx, 700))) return null;
      for (let r = 0; r < plan.length; r++) {
        const { kategorie, form } = plan[r];
        info.textContent = `Objekt ${r + 1} von ${plan.length}`;
        objekt.innerHTML = svgForm(form);
        objekt.className = "vm-greif-objekt";
        objekt.style.left = "50%"; objekt.style.top = "50%";
        behaelter.forEach((b) => b.classList.remove("vm-greif-aktiv", "vm-greif-falsch"));

        // langsame, gleichmäßige Bewegung innerhalb des Tabletts (Bounce an den Rändern)
        let bewegung = null;
        if (p.bewegt) {
          const winkel = Math.random() * Math.PI * 2;
          bewegung = { vx: Math.cos(winkel) * p.geschwindigkeit, vy: Math.sin(winkel) * p.geschwindigkeit, x: 0, y: 0, letzte: performance.now() };
        }

        const start = performance.now();
        const erg = await warteAuf(ctx, (fertig) => {
          let versuche = 0, aufgenommen = false, raf = 0;
          const grenzen = () => {
            const r1 = tablett.getBoundingClientRect(), r2 = objekt.getBoundingClientRect();
            return { maxX: (r1.width - r2.width) / 2 - 6, maxY: (r1.height - r2.height) / 2 - 6 };
          };
          const treiben = () => {
            if (bewegung && !aufgenommen) {
              const jetzt = performance.now(), dt = (jetzt - bewegung.letzte) / 1000;
              bewegung.letzte = jetzt;
              const { maxX, maxY } = grenzen();
              bewegung.x += bewegung.vx * dt; bewegung.y += bewegung.vy * dt;
              if (bewegung.x > maxX) { bewegung.x = maxX; bewegung.vx *= -1; }
              if (bewegung.x < -maxX) { bewegung.x = -maxX; bewegung.vx *= -1; }
              if (bewegung.y > maxY) { bewegung.y = maxY; bewegung.vy *= -1; }
              if (bewegung.y < -maxY) { bewegung.y = -maxY; bewegung.vy *= -1; }
              objekt.style.transform = `translate(-50%, -50%) translate(${bewegung.x}px, ${bewegung.y}px)`;
            }
            raf = requestAnimationFrame(treiben);
          };
          if (bewegung) raf = requestAnimationFrame(treiben);

          const versuchZaehlen = () => { versuche++; };
          const aufnehmen = () => {
            if (aufgenommen) return;
            aufgenommen = true;
            versuchZaehlen();
            objekt.classList.add("vm-greif-genommen");
            if (bewegung) { cancelAnimationFrame(raf); }
            behaelter.forEach((b) => b.classList.add("vm-greif-aktiv"));
            info.textContent = "Jetzt den passenden Behälter antippen";
          };
          const platzieren = (istRichtig, viaZiehen) => {
            behaelter.forEach((b) => b.classList.remove("vm-greif-aktiv"));
            if (istRichtig) {
              fertig({ richtig: true, ersterVersuch: versuche <= 1, ms: performance.now() - start, gezogen: !!viaZiehen });
            } else if (versuche >= p.versuche) {
              fertig({ richtig: false, ersterVersuch: false, ms: 0, gezogen: !!viaZiehen });
            } else {
              aufgenommen = false;
              objekt.classList.remove("vm-greif-genommen");
              behaelter.forEach((b) => b.classList.add("vm-greif-aktiv"));
              feedback(stage, "Das ist ein anderer Behälter – noch einmal", "neutral");
              if (bewegung) raf = requestAnimationFrame(treiben);
            }
          };
          const trennenObjekt = tippErkennung(objekt, {
            tipp: () => aufnehmen(),
            ziehSchwelle: ziehenAn ? 22 : 999999,
            ziehStart: () => { aufnehmen(); return ziehenAn; },
            ziehBewegt: (pt) => {
              const r1 = tablett.getBoundingClientRect();
              objekt.style.transform = "translate(-50%, -50%)";
              objekt.style.left = `${klemme(pt.x, 0, r1.width)}px`;
              objekt.style.top = `${klemme(pt.y, 0, r1.height)}px`;
              objekt.classList.add("vm-greif-hebt");
              const unter = document.elementFromPoint(pt.x + r1.left, pt.y + r1.top);
              behaelter.forEach((b) => b.classList.toggle("vm-greif-ueber", b.contains(unter)));
            },
            ziehEnde: (pt) => {
              objekt.classList.remove("vm-greif-hebt");
              const r1 = tablett.getBoundingClientRect();
              const unter = document.elementFromPoint(pt.x + r1.left, pt.y + r1.top);
              const treffer = behaelter.find((b) => b.contains(unter));
              behaelter.forEach((b) => b.classList.remove("vm-greif-ueber"));
              if (treffer) {
                versuchZaehlen();
                platzieren(behaelterOrdnung[behaelter.indexOf(treffer)] === kategorie, true);
              } else {
                objekt.style.left = "50%"; objekt.style.top = "50%"; objekt.style.transform = "translate(-50%, -50%)";
                if (aufgenommen && bewegung) raf = requestAnimationFrame(treiben);
              }
            },
          });
          const klicks = behaelter.map((b, i) => {
            const fn = () => { if (aufgenommen) platzieren(behaelterOrdnung[i] === kategorie, false); };
            b.addEventListener("click", fn);
            return fn;
          });
          return () => {
            trennenObjekt();
            behaelter.forEach((b, i) => b.removeEventListener("click", klicks[i]));
            cancelAnimationFrame(raf);
          };
        });
        if (erg == null || !ctx.alive()) return null;
        ergebnisse.push(erg);
        if (erg.richtig) { feedback(stage, "Richtig einsortiert", "gut"); }
        else { feedback(stage, `Das war ein ${FORMNAME[form]} – weiter geht's`, "neutral"); }
        if (!(await warte(ctx, 650))) return null;
      }
    } finally {
      // nichts offen zu räumen – Handler wurden je Runde entfernt
    }
    if (!ctx.alive()) return null;

    const best = leseBest(ctx.bests, "greifen", "msProObjekt");
    const a = greifenAuswertung(ergebnisse, best);
    const neu = a.msProObjekt != null && merkeBest(ctx.bests, "greifen", "msProObjekt", a.msProObjekt, true);
    let text = `${a.erste} von ${a.gesamt} Objekten richtig einsortiert.`;
    if (a.msProObjekt) text += ` Im Mittel ${(a.msProObjekt / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s dafür gebraucht.`;
    if (a.gezogen) text += ` ${a.gezogen}-mal gezogen statt angetippt.`;
    if (neu) text += " Neue persönliche Bestzeit!";
    return { score: a.score, text };
  },
};
