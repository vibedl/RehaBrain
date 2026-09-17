// Planen & Denken: Regeln wechseln (vereinfachtes Wisconsin-Prinzip) – nach Farbe, Form oder Anzahl zuordnen
import { h, sleep, rand, feedback, debounced } from "../core/ui.js";

// Karten sind immer hell (wie Spielkarten), daher feste Kartenfarben aus css/planen.css
export const FARBEN = ["var(--pl-regeln-f0)", "var(--pl-regeln-f1)", "var(--pl-regeln-f2)", "var(--pl-regeln-f3)"];
export const FORMEN = ["kreis", "dreieck", "quadrat", "stern"];
export const REGEL_TEXT = { farbe: "nach Farbe", form: "nach Form", anzahl: "nach Anzahl" };

/** Vorlagekarten oben: Karte i hat Farbe i, Form i, Anzahl i+1 */
export const vorlagen = (anzahl) => Array.from({ length: anzahl }, (_, i) => ({ farbe: i, form: i, anzahl: i + 1 }));

/** Passt die Karte nach der Regel zur Vorlage? */
export const passt = (karte, vorlage, regel) => karte[regel] === vorlage[regel];

/** Neue Karte: jede Regel-Dimension zeigt auf eine andere Vorlage, damit die Rückmeldung eindeutig ist */
export function erzeugeKarte(vorlagenZahl, dims, zufall = rand) {
  const idx = Array.from({ length: vorlagenZahl }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = zufall(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const werte = { farbe: zufall(vorlagenZahl), form: zufall(vorlagenZahl), anzahl: zufall(vorlagenZahl) };
  dims.forEach((d, i) => { werte[d] = idx[i]; });
  return { farbe: werte.farbe, form: werte.form, anzahl: werte.anzahl + 1 };
}

/** Vorlage-Index, der nach der Regel passt */
export const richtigeVorlage = (karte, regel) => (regel === "anzahl" ? karte.anzahl - 1 : karte[regel]);

export function naechsteRegel(aktuell, dims, zufall = rand) {
  const rest = dims.filter((d) => d !== aktuell);
  return rest[zufall(rest.length)];
}

/** Schwierigkeit pro Stufe */
export function regelnStufe(stufe) {
  const dims = stufe <= 4 ? ["farbe", "form"] : ["farbe", "form", "anzahl"];
  const sichtbar = stufe <= 6;
  return {
    dims,
    vorlagen: stufe <= 4 ? 3 : 4,
    sichtbar,
    angekuendigt: !sichtbar && stufe <= 12,
    // sichtbar: Wechsel nach festen Karten; versteckt: Wechsel nach so vielen Treffern in Folge
    wechselNach: sichtbar ? Math.max(3, 7 - Math.ceil(stufe / 2)) : Math.max(3, 6 - Math.floor((stufe - 7) / 4)),
    versuche: 24,
  };
}

/** Score: bei versteckter Regel sind pro Regelphase einige Suchfehler unvermeidbar und werden nicht angerechnet */
export function regelScore(richtig, versuche, phasen, dimsAnzahl, versteckt) {
  const erlaubt = versteckt ? phasen * (dimsAnzahl - 1) : 0;
  return Math.max(0, Math.min(1, richtig / Math.max(1, versuche - erlaubt)));
}

// ---------- Darstellung ----------
const POSITIONEN = {
  1: [[50, 50]],
  2: [[50, 28], [50, 72]],
  3: [[50, 22], [50, 50], [50, 78]],
  4: [[28, 30], [72, 30], [28, 70], [72, 70]],
};

function form(name, x, y, r, farbe) {
  const st = `style="fill:${farbe}"`;
  if (name === "kreis") return `<circle ${st} cx="${x}" cy="${y}" r="${r}"/>`;
  if (name === "quadrat") return `<rect ${st} x="${x - r * 0.88}" y="${y - r * 0.88}" width="${r * 1.76}" height="${r * 1.76}" rx="2"/>`;
  if (name === "dreieck") return `<path ${st} d="M${x} ${y - r} L${x + r * 1.1} ${y + r * 0.8} L${x - r * 1.1} ${y + r * 0.8}Z"/>`;
  const pkt = [];
  for (let i = 0; i < 10; i++) {
    const w = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r * 1.1;
    pkt.push(`${(x + rr * Math.cos(w)).toFixed(1)} ${(y + rr * Math.sin(w)).toFixed(1)}`);
  }
  return `<path ${st} d="M${pkt.join(" L")}Z"/>`;
}

function kartenSvg(k) {
  const r = k.anzahl === 1 ? 26 : k.anzahl === 2 ? 20 : k.anzahl === 3 ? 15 : 17;
  const inhalt = POSITIONEN[k.anzahl].map(([x, y]) => form(FORMEN[k.form], x, y * 1.4, r, FARBEN[k.farbe])).join("");
  return `<svg viewBox="0 0 100 140" aria-hidden="true">${inhalt}</svg>`;
}

const kartenLabel = (k) => `${k.anzahl} ${["Kreis", "Dreieck", "Quadrat", "Stern"][k.form]}${k.anzahl > 1 ? ["e", "e", "e", "e"][k.form] : ""}, Farbe ${["Kupfer", "Grün", "Blau", "Dunkel"][k.farbe]}`;

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

export default {
  id: "regeln",
  bereich: "Planen & Denken",
  titel: "Regeln wechseln",
  icon: "",
  anleitung: (stufe) => {
    const s = regelnStufe(stufe);
    const dimText = s.dims.length === 2 ? "Farbe oder Form" : "Farbe, Form oder Anzahl";
    return `Ordnen Sie die untere Karte einer der oberen Karten zu – ${dimText}. `
      + (s.sichtbar ? "Die aktuelle Regel steht über den Karten. Achtung, sie wechselt ab und zu."
        : "Die Regel wird nicht verraten. Finden Sie sie über die Rückmeldung heraus – und merken Sie, wenn sie sich ändert.");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const s = regelnStufe(stufe);
    const refs = vorlagen(s.vorlagen);
    let regel = s.dims[rand(s.dims.length)];
    let richtig = 0, phasen = 1, serie = 0, seitWechsel = 0;

    const regelZeile = h("p.hinweis.gross.pl-regeln-regel");
    const zaehler = h("p.hinweis");
    const refKnoepfe = refs.map((k) => h("button.pl-regeln-karte", { html: kartenSvg(k), "aria-label": kartenLabel(k) }));
    const reihe = h("div.pl-regeln-vorlagen", {}, refKnoepfe);
    const aktuelle = h("div.pl-regeln-karte.pl-regeln-aktuell");
    const rueck = h("p.pl-regeln-rueck", { "aria-live": "polite" });
    stage.append(zaehler, regelZeile, reihe, h("div.pl-regeln-pfeil", { html: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 40V8M12 20l12-12 12 12"/></svg>' }), aktuelle, rueck);

    for (let v = 0; v < s.versuche && ctx.alive(); v++) {
      zaehler.textContent = `Karte ${v + 1} von ${s.versuche}`;
      regelZeile.textContent = s.sichtbar ? `Sortieren Sie ${REGEL_TEXT[regel]}` : "Welche Regel gilt gerade?";
      const karte = erzeugeKarte(s.vorlagen, s.dims);
      aktuelle.innerHTML = kartenSvg(karte);
      aktuelle.setAttribute("aria-label", kartenLabel(karte));

      const wahl = await warte(ctx, (done) => {
        refKnoepfe.forEach((k, i) => { k.onclick = debounced(() => done(i)); });
      });
      refKnoepfe.forEach((k) => { k.onclick = null; });
      if (wahl == null || !ctx.alive()) return null;

      const ok = passt(karte, refs[wahl], regel);
      refKnoepfe[wahl].classList.add(ok ? "pl-regeln-treffer" : "pl-regeln-daneben");
      if (ok) { richtig++; serie++; rueck.textContent = "Passt"; feedback(stage, "Passt", "gut"); }
      else { serie = 0; rueck.textContent = "Passt nicht"; feedback(stage, "Passt nicht", "neutral"); }
      seitWechsel++;
      await sleep(1100);
      refKnoepfe[wahl].classList.remove("pl-regeln-treffer", "pl-regeln-daneben");
      if (!ctx.alive()) return null;
      rueck.textContent = "";

      const wechsel = s.sichtbar ? seitWechsel >= s.wechselNach : serie >= s.wechselNach;
      if (wechsel && v < s.versuche - 2) {
        regel = naechsteRegel(regel, s.dims);
        phasen++; serie = 0; seitWechsel = 0;
        if (s.sichtbar) { feedback(stage, `Neue Regel: ${REGEL_TEXT[regel]}`, "gut"); await sleep(1300); }
        else if (s.angekuendigt) { feedback(stage, "Achtung, die Regel ändert sich", "neutral"); await sleep(1300); }
        if (!ctx.alive()) return null;
      }
    }
    if (!ctx.alive()) return null;
    const score = regelScore(richtig, s.versuche, phasen, s.dims.length, !s.sichtbar);
    return { score, text: `${richtig} von ${s.versuche} Karten passend zugeordnet, ${phasen - 1} Regelwechsel.` };
  },
};
