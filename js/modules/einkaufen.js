// Planen & Denken: Einkaufen mit Budget – Liste abarbeiten, ohne mehr Geld auszugeben, als man hat
import { h, sleep, rand, shuffle, feedback, onTap } from "../core/ui.js";

// ---------- Artikel (einfache Strich-Symbole) ----------
const S = (inner) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const F = 'style="fill:var(--copper-subtle)"';

export const ARTIKEL = {
  brot: { name: "Brot", preis: 249, svg: S(`<path ${F} d="M8 30c0-10 7-16 16-16s16 6 16 16v6H8z"/><path d="M17 20l3 6M24 18v7M31 20l-3 6"/>`) },
  milch: { name: "Milch", preis: 109, svg: S(`<path ${F} d="M16 16l4-6h8l4 6v28H16z"/><path d="M16 26h16"/>`) },
  aepfel: { name: "Äpfel", preis: 229, svg: S(`<path ${F} d="M24 16c-8-5-16 1-15 11 1 9 8 15 15 12 7 3 14-3 15-12 1-10-7-16-15-11z"/><path d="M24 16c0-4 2-7 5-8"/>`) },
  kaese: { name: "Käse", preis: 279, svg: S(`<path ${F} d="M6 34l30-20 6 8v12z"/><circle cx="20" cy="30" r="2"/><circle cx="32" cy="27" r="2"/>`) },
  eier: { name: "Eier", preis: 199, svg: S(`<ellipse ${F} cx="16" cy="27" rx="8" ry="11"/><ellipse ${F} cx="32" cy="27" rx="8" ry="11"/>`) },
  butter: { name: "Butter", preis: 219, svg: S(`<path ${F} d="M6 22l10-6h26v14l-10 6H6z"/><path d="M6 22h26l10-6M32 22v14"/>`) },
  kaffee: { name: "Kaffee", preis: 549, svg: S(`<path ${F} d="M10 18h24v14a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z"/><path d="M34 22h4a4 4 0 0 1 0 8h-4M18 6v6M26 6v6"/>`) },
  nudeln: { name: "Nudeln", preis: 129, svg: S(`<rect ${F} x="12" y="8" width="24" height="34" rx="3"/><path d="M18 18l12 6M18 26l12 6M18 34l12-12"/>`) },
  tomaten: { name: "Tomaten", preis: 189, svg: S(`<circle ${F} cx="24" cy="28" r="14"/><path d="M18 14l6 4 6-4M24 18v-8"/>`) },
  bananen: { name: "Bananen", preis: 159, svg: S(`<path ${F} d="M8 18c4 16 20 24 34 16-12 0-22-8-26-20z"/><path d="M14 14l-4-4"/>`) },
  fisch: { name: "Fisch", preis: 449, svg: S(`<path ${F} d="M6 24c8-10 22-10 30 0-8 10-22 10-30 0z"/><path d="M36 24l8-7v14z"/><circle cx="14" cy="22" r="1.5"/>`) },
  saft: { name: "Saft", preis: 169, svg: S(`<path ${F} d="M14 14h20v30H14z"/><path d="M18 14l2-6h8l2 6M20 26h8"/>`) },
  zucker: { name: "Zucker", preis: 119, svg: S(`<rect ${F} x="10" y="12" width="28" height="30" rx="2"/><path d="M16 22h16M16 30h10"/>`) },
  joghurt: { name: "Joghurt", preis: 89, svg: S(`<path ${F} d="M12 16h24l-3 26H15z"/><path d="M10 16h28"/>`) },
  reis: { name: "Reis", preis: 179, svg: S(`<path ${F} d="M14 10h20l2 32H12z"/><path d="M20 24l2 2M26 22l2 2M22 32l2 2"/>`) },
  moehren: { name: "Möhren", preis: 99, svg: S(`<path ${F} d="M12 36L34 14l4 4-22 22z"/><path d="M36 12l4-6M38 14l6-2M20 26l3 3M26 20l3 3"/>`) },
};

const VARIANTEN = ["Hausmarke", "Markenware", "Bio"];

/** Betrag in Cent als „3,49 €“ */
export const euro = (cent) => `${Math.floor(cent / 100)},${String(Math.abs(cent) % 100).padStart(2, "0")} €`;

export const korbSumme = (korb) => korb.reduce((s, a) => s + a.preis, 0);

/** Prüft einen Einkauf: alle Listenartikel genau einmal, nichts Zusätzliches, im Budget */
export function pruefeEinkauf(liste, korb, budget) {
  const summe = korbSumme(korb);
  const arten = korb.map((a) => a.art);
  const fehlend = liste.filter((art) => !arten.includes(art));
  const extra = korb.filter((a, i) => !liste.includes(a.art) || arten.indexOf(a.art) !== i);
  const imBudget = summe <= budget;
  return { summe, fehlend, extra, imBudget, rest: budget - summe, ok: fehlend.length === 0 && extra.length === 0 && imBudget };
}

/** Aufgabe für eine Stufe: Liste, Regal (Artikel mit Varianten), Budget in Cent */
export function erstelleAufgabe(stufe, zufall = rand) {
  const mische = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = zufall(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const listLaenge = Math.min(8, 2 + Math.floor(stufe / 3));
  const ablenker = Math.min(6, 2 + Math.floor(stufe / 4));
  const variantenZahl = stufe >= 13 ? 3 : stufe >= 6 ? 2 : 1;
  const arten = mische(Object.keys(ARTIKEL));
  const liste = arten.slice(0, listLaenge);
  const sonstige = arten.slice(listLaenge, listLaenge + ablenker);

  let uid = 0;
  const regal = [];
  let guenstigsteSumme = 0;
  for (const art of liste) {
    const basis = ARTIKEL[art].preis;
    guenstigsteSumme += basis;
    // Varianten: die günstigste kostet den Grundpreis, alle anderen mindestens 0,60 € mehr
    const preise = [basis];
    let p = basis;
    for (let v = 1; v < variantenZahl; v++) { p += 60 + 10 * zufall(7); preise.push(p); }
    const namen = mische(VARIANTEN).slice(0, variantenZahl);
    preise.forEach((preis, v) => regal.push({ uid: uid++, art, preis, variante: variantenZahl > 1 ? namen[v] : "" }));
  }
  for (const art of sonstige) regal.push({ uid: uid++, art, preis: ARTIKEL[art].preis, variante: "" });

  // Budget: großzügig in niedrigen Stufen, später knapp (jede teurere Variante sprengt es)
  let budget;
  if (variantenZahl === 1) budget = Math.ceil(guenstigsteSumme / 100) * 100 + (stufe <= 3 ? 500 : 200);
  else if (stufe < 13) budget = Math.ceil(guenstigsteSumme / 50) * 50;
  else budget = Math.ceil(guenstigsteSumme / 10) * 10;
  return { liste, regal: mische(regal), budget, guenstigsteSumme, varianten: variantenZahl > 1 };
}

/** Antwortmöglichkeiten fürs Restgeld (richtiger Betrag + nahe Ablenker, alle ≥ 0) */
export function restgeldOptionen(rest, anzahl, zufall = rand) {
  const abstaende = [10, -10, 50, -50, 100, -100, 20, -20];
  const set = new Set([rest]);
  for (const d of abstaende) {
    if (set.size >= anzahl) break;
    if (rest + d >= 0 && zufall(4) !== 0) set.add(rest + d);
  }
  for (let d = 30; set.size < anzahl; d += 30) set.add(rest + d);
  return [...set].sort((a, b) => a - b);
}

/** Punkte für eine Einkaufsrunde (0..1) */
export function einkaufScore(pruefung, listLaenge, hinweise = 0) {
  if (pruefung.ok) return Math.max(0.6, 1 - 0.2 * hinweise);
  const getroffen = listLaenge - pruefung.fehlend.length;
  let s = Math.max(0, (getroffen - pruefung.extra.length) / listLaenge) * 0.6;
  if (!pruefung.imBudget) s *= 0.6;
  return s;
}

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

export default {
  id: "einkaufen",
  bereich: "Planen & Denken",
  titel: "Einkaufen",
  icon: "",
  anleitung: (stufe) =>
    "Kaufen Sie alles, was auf dem Einkaufszettel steht. Tippen Sie einen Artikel im Regal an, um ihn in den Korb zu legen. Ein Tipp auf den Korb legt ihn zurück."
    + (stufe >= 6 ? " Manche Artikel gibt es mehrfach – achten Sie auf den Preis, das Geld ist knapp." : " Geben Sie nicht mehr Geld aus, als Sie haben.")
    + (stufe >= 9 ? " An der Kasse fragen wir Sie, wie viel Geld Sie zurückbekommen." : ""),

  async run(ctx) {
    const { stage, stufe } = ctx;
    const fahrten = 3;
    const summeSichtbar = stufe <= 10;
    let punkte = 0, perfekt = 0;

    for (let f = 0; f < fahrten && ctx.alive(); f++) {
      stage.replaceChildren();
      const aufgabe = erstelleAufgabe(stufe);
      const korb = [];
      let hinweise = 0;

      const kopf = h("p.hinweis", { text: `Einkauf ${f + 1} von ${fahrten}` });
      const geld = h("div.pl-einkauf-geld", {}, h("span", { text: "Ihr Geld" }), h("strong", { text: euro(aufgabe.budget) }));
      const zettel = h("ul.pl-einkauf-zettel", { "aria-label": "Einkaufszettel" });
      const regal = h("div.pl-einkauf-regal", { "aria-label": "Regal" });
      const korbListe = h("div.pl-einkauf-korbliste");
      const summe = h("p.pl-einkauf-summe");
      const knoepfe = h("div.knopfreihe");
      stage.append(
        kopf,
        h("div.pl-einkauf-oben", {}, geld, h("div.pl-einkauf-zettelbox", {}, h("span.pl-einkauf-titel", { text: "Einkaufszettel" }), zettel)),
        regal,
        h("div.pl-einkauf-korb", {}, h("span.pl-einkauf-titel", { text: "Ihr Korb" }), korbListe, summe),
        knoepfe,
      );

      const zeichneZettel = () => zettel.replaceChildren(...aufgabe.liste.map((art) => {
        const drin = korb.some((a) => a.art === art);
        return h("li" + (drin ? ".erledigt" : ""), { text: ARTIKEL[art].name });
      }));
      const zeichneKorb = () => {
        korbListe.replaceChildren(...(korb.length ? korb.map((a) => h("button.pl-einkauf-korbteil", {
          "aria-label": `${ARTIKEL[a.art].name} zurücklegen`,
          onTap: () => { korb.splice(korb.indexOf(a), 1); aktualisiere(); },
        }, h("span", { html: ARTIKEL[a.art].svg }), h("span", { text: `${ARTIKEL[a.art].name}${a.variante ? " (" + a.variante + ")" : ""}` }),
        h("span.pl-einkauf-preis", { text: euro(a.preis) }), h("span.pl-einkauf-zurueck", { text: "zurücklegen" }))) : [h("span.pl-einkauf-leer", { text: "Noch leer" })]));
        summe.textContent = summeSichtbar ? `Im Korb: ${euro(korbSumme(korb))}` : `${korb.length} ${korb.length === 1 ? "Artikel" : "Artikel"} im Korb`;
      };
      const aktualisiere = () => {
        zeichneZettel(); zeichneKorb();
        regal.querySelectorAll("button").forEach((b) => b.classList.toggle("im-korb", korb.some((a) => a.uid === Number(b.dataset.uid))));
      };

      regal.append(...aufgabe.regal.map((a) => h("button.pl-einkauf-artikel", {
        "data-uid": a.uid,
        "aria-label": `${ARTIKEL[a.art].name}${a.variante ? ", " + a.variante : ""}, ${euro(a.preis)}`,
        onTap: () => {
          if (korb.some((k) => k.uid === a.uid)) { feedback(stage, "Liegt schon im Korb", "neutral"); return; }
          korb.push(a); aktualisiere();
        },
      }, h("span.pl-einkauf-bild", { html: ARTIKEL[a.art].svg }), h("span.pl-einkauf-name", { text: ARTIKEL[a.art].name }),
      a.variante ? h("span.pl-einkauf-variante", { text: a.variante }) : null, h("span.pl-einkauf-preis", { text: euro(a.preis) }))));
      aktualisiere();

      // Einkaufen, bis an der Kasse bezahlt wird
      let pruefung;
      for (;;) {
        const los = await warte(ctx, (done) => {
          knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: "Zur Kasse", onTap: () => done(true) }));
        });
        if (los == null || !ctx.alive()) return null;
        pruefung = pruefeEinkauf(aufgabe.liste, korb, aufgabe.budget);
        if (pruefung.ok || hinweise >= 2) break;
        const grund = pruefung.fehlend.length ? "Auf dem Zettel steht noch etwas, das nicht im Korb liegt."
          : pruefung.extra.length ? "Im Korb liegt etwas, das nicht auf dem Zettel steht."
          : "Das Geld reicht dafür nicht ganz.";
        kopf.textContent = grund;
        const weiter = await warte(ctx, (done) => {
          knoepfe.replaceChildren(
            h("button.knopf.gross", { text: "Weiter einkaufen", onTap: () => done("weiter") }),
            h("button.knopf.gross", { text: "Trotzdem bezahlen", onTap: () => done("zahlen") }),
          );
        });
        if (weiter == null || !ctx.alive()) return null;
        hinweise++;
        kopf.textContent = `Einkauf ${f + 1} von ${fahrten}`;
        if (weiter === "zahlen") break;
      }
      knoepfe.replaceChildren();
      regal.classList.add("pl-einkauf-gesperrt");
      korbListe.classList.add("pl-einkauf-gesperrt");

      let score = einkaufScore(pruefung, aufgabe.liste.length, hinweise);
      if (pruefung.ok) feedback(stage, "Gut eingekauft!", "gut");
      else feedback(stage, pruefung.imBudget ? "Nicht ganz vollständig" : "Etwas zu teuer", "neutral");
      await sleep(1100);
      if (!ctx.alive()) return null;

      // Restgeld im Kopf ausrechnen
      if (stufe >= 9 && pruefung.imBudget) {
        kopf.textContent = `Sie bezahlen mit ${euro(aufgabe.budget)}. Wie viel Geld bekommen Sie zurück?`;
        const optionen = restgeldOptionen(pruefung.rest, stufe >= 15 ? 4 : 3);
        const wahl = await warte(ctx, (done) => {
          knoepfe.replaceChildren(...optionen.map((o) => h("button.knopf.gross", { text: euro(o), onTap: () => done(o) })));
        });
        if (wahl == null || !ctx.alive()) return null;
        knoepfe.replaceChildren();
        const restOk = wahl === pruefung.rest;
        score = 0.7 * score + (restOk ? 0.3 : 0);
        feedback(stage, restOk ? "Richtig gerechnet!" : `Zurück gibt es ${euro(pruefung.rest)}`, restOk ? "gut" : "neutral");
        await sleep(1300);
        if (!ctx.alive()) return null;
      }

      kopf.textContent = `Bezahlt: ${euro(pruefung.summe)}` + (aufgabe.varianten ? ` – am günstigsten wären ${euro(aufgabe.guenstigsteSumme)} gewesen.` : ".");
      const weiter = await warte(ctx, (done) => {
        knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: f + 1 < fahrten ? "Nächster Einkauf" : "Fertig", onTap: () => done(true) }));
      });
      if (weiter == null || !ctx.alive()) return null;
      punkte += score;
      if (score >= 0.95) perfekt++;
    }
    if (!ctx.alive()) return null;
    return { score: punkte / fahrten, text: `${perfekt} von ${fahrten} Einkäufen ohne Fehler erledigt.` };
  },
};
