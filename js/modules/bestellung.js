// Beruf & Alltag: Bestellung prüfen – Katalog-Bestellung nach Vorgaben zusammenstellen
// (Mengen, Größen, Budget, Lieferzeit) und anschließend die Rechnung prüfen (Fehler finden).
import { h, sleep, rand, pick, shuffle, feedback, onTap } from "../core/ui.js";

const S = (inner) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const F = 'style="fill:var(--copper-subtle)"';

export const KATALOG = {
  ordner: { name: "Aktenordner", preis: 349, groessen: null, liefertage: 1, svg: S(`<rect ${F} x="10" y="6" width="24" height="36" rx="2"/><path d="M34 6l8 4v28l-8 4"/><path d="M18 6v36"/>`) },
  papier: { name: "Druckerpapier A4", preis: 549, groessen: null, liefertage: 2, svg: S(`<rect ${F} x="12" y="6" width="24" height="34" rx="1"/><path d="M16 16h16M16 22h16M16 28h10"/>`) },
  toner: { name: "Tonerkartusche", preis: 6900, groessen: null, liefertage: 4, svg: S(`<rect ${F} x="12" y="16" width="24" height="20" rx="3"/><path d="M18 16v-6h12v6"/>`) },
  stuehle: { name: "Bürostuhl", preis: 8900, groessen: ["S", "M", "L"], liefertage: 7, svg: S(`<path ${F} d="M14 10h20v16H14z"/><path d="M14 26l-4 14M34 26l4 14M14 34h20"/>`) },
  handschuhe: { name: "Arbeitshandschuhe", preis: 599, groessen: ["S", "M", "L", "XL"], liefertage: 3, svg: S(`<path ${F} d="M14 44V22a4 4 0 0 1 8 0v-8a4 4 0 0 1 8 0v6a4 4 0 0 1 8 0v4a4 4 0 0 1 6 4v16z"/>`) },
  warnwesten: { name: "Warnwesten", preis: 449, groessen: ["S", "M", "L", "XL"], liefertage: 3, svg: S(`<path ${F} d="M18 8l6 4 6-4 6 6-4 4v22H16V18l-4-4z"/><path d="M20 16v20M28 16v20" stroke-dasharray="2 4"/>`) },
  kaffee: { name: "Kaffeepulver 500g", preis: 649, groessen: null, liefertage: 2, svg: S(`<path ${F} d="M10 18h24v14a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z"/><path d="M34 22h4a4 4 0 0 1 0 8h-4"/>`) },
  becher: { name: "Pappbecher (Pack)", preis: 279, groessen: null, liefertage: 1, svg: S(`<path ${F} d="M14 18h20l-3 22H17z"/><path d="M12 18h24"/>`) },
  klemmbretter: { name: "Klemmbretter", preis: 399, groessen: null, liefertage: 2, svg: S(`<rect ${F} x="10" y="10" width="22" height="30" rx="2"/><rect x="16" y="6" width="10" height="8" rx="2"/>`) },
  regale: { name: "Lagerregal", preis: 12900, groessen: ["M", "L"], liefertage: 10, svg: S(`<path d="M8 8v34M40 8v34M8 18h32M8 28h32M8 42h32"/>`) },
  schilder: { name: "Hinweisschilder", preis: 899, groessen: null, liefertage: 5, svg: S(`<rect ${F} x="8" y="14" width="32" height="18" rx="2"/><path d="M24 32v10M18 42h12"/>`) },
  erstehilfe: { name: "Erste-Hilfe-Koffer", preis: 3400, groessen: null, liefertage: 4, svg: S(`<rect ${F} x="8" y="16" width="32" height="22" rx="3"/><path d="M24 22v10M19 27h10"/><path d="M18 16v-4h12v4"/>`) },
};

export const euro = (cent) => `${Math.floor(cent / 100)},${String(Math.abs(cent) % 100).padStart(2, "0")} €`;

/** Schwierigkeit je Stufe */
export function bestellungStufe(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    positionen: s <= 3 ? 2 : s <= 7 ? 3 : s <= 12 ? 4 : s <= 16 ? 5 : 6,
    mitGroesse: s >= 5,
    mitLieferzeit: s >= 9,
    budgetKnapp: s >= 13,          // Budget zwingt zu Mengen-Entscheidungen
    rechnungFehler: s >= 7,
    fehlerAnzahl: s <= 11 ? 1 : s <= 16 ? 2 : 3,
  };
}

/** Bestellauftrag: Vorgaben pro Artikel (Menge, ggf. Größe, ggf. spätester Liefertermin), Budget */
export function erstelleAuftrag(stufe) {
  const p = bestellungStufe(stufe);
  const arten = shuffle(Object.keys(KATALOG));
  const vorgaben = [];
  let summe = 0;
  for (const art of arten) {
    if (vorgaben.length >= p.positionen) break;
    const artikel = KATALOG[art];
    const menge = 1 + rand(p.budgetKnapp ? 6 : 4);
    const groesse = p.mitGroesse && artikel.groessen ? pick(artikel.groessen) : null;
    const spaetestens = p.mitLieferzeit ? artikel.liefertage + (rand(3) - 1 >= 0 ? rand(4) : 0) : null;
    vorgaben.push({ art, menge, groesse, spaetestens: spaetestens != null ? Math.max(artikel.liefertage - 1, spaetestens) : null });
    summe += artikel.preis * menge;
  }
  const spielraum = p.budgetKnapp ? 1.03 + rand(8) / 100 : 1.3; // knapp: 3–10 % Spielraum, sonst großzügig
  const budget = Math.ceil((summe * spielraum) / 100) * 100;
  return { vorgaben, budget, summeOhneLimit: summe, p };
}

/** Prüft eine Zusammenstellung {art, menge, groesse}[] gegen den Auftrag */
export function pruefeBestellung(auftrag, korb) {
  const summe = korb.reduce((s, a) => s + KATALOG[a.art].preis * a.menge, 0);
  const probleme = [];
  for (const v of auftrag.vorgaben) {
    const eintrag = korb.find((a) => a.art === v.art && (v.groesse == null || a.groesse === v.groesse));
    if (!eintrag) probleme.push({ art: v.art, grund: "fehlt" });
    else if (eintrag.menge !== v.menge) probleme.push({ art: v.art, grund: "menge" });
    else if (v.spaetestens != null && KATALOG[v.art].liefertage > v.spaetestens) probleme.push({ art: v.art, grund: "lieferzeit" });
  }
  const erwartet = new Set(auftrag.vorgaben.map((v) => v.art));
  for (const a of korb) if (!erwartet.has(a.art)) probleme.push({ art: a.art, grund: "unnoetig" });
  const imBudget = summe <= auftrag.budget;
  return { summe, probleme, imBudget, ok: probleme.length === 0 && imBudget, rest: auftrag.budget - summe };
}

/** Punkte für die Zusammenstellung */
export function bestellungScore(pruefung, positionen) {
  if (pruefung.ok) return 1;
  const fehlerhaft = new Set(pruefung.probleme.map((p) => p.art)).size;
  let s = Math.max(0, (positionen - fehlerhaft) / positionen);
  if (!pruefung.imBudget) s *= 0.7;
  return s;
}

// ---------- Rechnungsprüfung ----------
/** Erzeugt eine Rechnung zur bestätigten Bestellung, ggf. mit eingebauten Fehlern */
export function erstelleRechnung(auftrag, korb, fehlerAnzahl) {
  const zeilen = korb.map((a) => ({ art: a.art, menge: a.menge, einzelpreis: KATALOG[a.art].preis, summe: KATALOG[a.art].preis * a.menge, groesse: a.groesse }));
  const fehlerIdx = [];
  if (zeilen.length && fehlerAnzahl > 0) {
    const kandidaten = shuffle(zeilen.map((_, i) => i));
    while (fehlerIdx.length < Math.min(fehlerAnzahl, zeilen.length)) fehlerIdx.push(kandidaten[fehlerIdx.length]);
    for (const i of fehlerIdx) {
      const z = zeilen[i];
      const art = pick(["rechenfehler", "mengenfehler", "artikelfehler"]);
      if (art === "rechenfehler") z.summe = z.summe + pick([-500, -200, 200, 500, 1000]);
      else if (art === "mengenfehler") { z.menge = Math.max(1, z.menge + pick([-2, -1, 1, 2])); z.summe = z.einzelpreis * z.menge; }
      else { const andere = Object.keys(KATALOG).find((k) => k !== z.art && !zeilen.some((zz) => zz.art === k)); if (andere) { z.art = andere; z.einzelpreis = KATALOG[andere].preis; z.summe = z.einzelpreis * z.menge; } }
    }
  }
  const gesamtsumme = zeilen.reduce((s, z) => s + z.summe, 0);
  return { zeilen, fehlerIdx: [...fehlerIdx].sort((a, b) => a - b), gesamtsumme };
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
  id: "bestellung",
  bereich: "Beruf & Alltag",
  titel: "Bestellung prüfen",
  icon: "",
  anleitung: (stufe) => {
    const p = bestellungStufe(stufe);
    return "Stellen Sie die Bestellung nach der Vorgabe zusammen: Menge" + (p.mitGroesse ? ", Größe" : "") + " und Budget müssen stimmen."
      + (p.mitLieferzeit ? " Manches muss auch rechtzeitig geliefert werden." : "")
      + (p.rechnungFehler ? " Danach prüfen Sie die Rechnung auf Fehler." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = bestellungStufe(stufe);
    const auftrag = erstelleAuftrag(stufe);
    const korb = [];

    const kopf = h("p.hinweis", { text: "Bestellung zusammenstellen" });
    const vorgabeBox = h("div.ba-best-vorgabe", { "aria-label": "Vorgabe" });
    const geld = h("div.pl-einkauf-geld", {}, h("span", { text: "Budget" }), h("strong", { text: euro(auftrag.budget) }));
    const katalog = h("div.ba-best-katalog", { "aria-label": "Katalog" });
    const korbBox = h("div.ba-best-korb", { "aria-label": "Ihre Bestellung" });
    const knoepfe = h("div.knopfreihe");
    stage.append(kopf, h("div.ba-best-oben", {}, geld, vorgabeBox), katalog, korbBox, knoepfe);

    vorgabeBox.replaceChildren(h("h3.ba-titel", { text: "Vorgabe" }),
      h("ul.ba-best-liste", {}, auftrag.vorgaben.map((v) => h("li", {},
        h("strong", { text: `${v.menge}× ${KATALOG[v.art].name}` }),
        v.groesse ? h("span", { text: ` – Größe ${v.groesse}` }) : null,
        v.spaetestens != null ? h("span", { text: ` – spätestens in ${v.spaetestens} ${v.spaetestens === 1 ? "Tag" : "Tagen"}` }) : null))));

    const zeichneKorb = () => korbBox.replaceChildren(h("h3.ba-titel", { text: "Ihre Bestellung" }),
      korb.length ? h("ul.ba-best-liste", {}, korb.map((a, i) => h("li.ba-best-korbzeile", {},
        h("span", { text: `${a.menge}× ${KATALOG[a.art].name}${a.groesse ? " (" + a.groesse + ")" : ""}` }),
        h("span", { text: euro(KATALOG[a.art].preis * a.menge) }),
        h("button.knopf", { text: "Entfernen", onTap: () => { korb.splice(i, 1); zeichneKorb(); } }))))
        : h("p.ba-best-leer", { text: "Noch nichts bestellt" }),
      h("p.ba-best-summe", { text: `Zwischensumme: ${euro(korb.reduce((s, a) => s + KATALOG[a.art].preis * a.menge, 0))}` }));
    zeichneKorb();

    katalog.replaceChildren(...Object.entries(KATALOG).map(([art, info]) => h("div.ba-best-artikel", {},
      h("span.ba-best-bild", { html: info.svg }), h("span.ba-best-name", { text: info.name }),
      h("span.ba-best-preis", { text: `${euro(info.preis)} / Stück` }),
      p.mitLieferzeit ? h("span.ba-best-liefer", { text: `Lieferzeit ${info.liefertage} ${info.liefertage === 1 ? "Tag" : "Tage"}` }) : null,
      h("button.knopf", {
        text: "Hinzufügen",
        onTap: () => {
          const mitGroesse = p.mitGroesse && info.groessen;
          if (mitGroesse) {
            // Größenauswahl anzeigen statt direkt hinzufügen
            zeigeGroessenwahl(art, info);
          } else {
            const vorhanden = korb.find((a) => a.art === art);
            if (vorhanden) vorhanden.menge++; else korb.push({ art, menge: 1, groesse: null });
            zeichneKorb();
          }
        },
      }))));

    function zeigeGroessenwahl(art, info) {
      const overlay = h("div.ba-best-overlay", {}, h("p.hinweis.gross", { text: `${info.name} – welche Größe?` }),
        h("div.knopfreihe", {}, info.groessen.map((g) => h("button.knopf.gross", {
          text: g,
          onTap: () => {
            const vorhanden = korb.find((a) => a.art === art && a.groesse === g);
            if (vorhanden) vorhanden.menge++; else korb.push({ art, menge: 1, groesse: g });
            overlay.remove(); zeichneKorb();
          },
        }))),
        h("button.knopf", { text: "Abbrechen", onTap: () => overlay.remove() }));
      stage.append(overlay);
    }

    const fertig = await warte(ctx, (done) => {
      knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: "Bestellung abschicken", onTap: () => done(true) }));
    });
    if (fertig == null || !ctx.alive()) return null;
    knoepfe.replaceChildren();
    katalog.classList.add("ba-best-gesperrt");

    const pruefung = pruefeBestellung(auftrag, korb);
    const scoreZusammenstellung = bestellungScore(pruefung, auftrag.vorgaben.length);
    feedback(stage, pruefung.ok ? "Gut zusammengestellt!" : pruefung.imBudget ? "Nicht ganz passend" : "Das Budget reicht nicht", pruefung.ok ? "gut" : "neutral");
    await sleep(1300);
    if (!ctx.alive()) return null;

    let scoreRechnung = 1, hatteRechnung = false;
    if (p.rechnungFehler && korb.length) {
      hatteRechnung = true;
      stage.replaceChildren();
      const rechnung = erstelleRechnung(auftrag, korb, p.fehlerAnzahl);
      const gewaehlt = new Set();
      const kopf2 = h("p.hinweis.gross", { text: "Prüfen Sie die Rechnung. Tippen Sie jede Zeile an, die nicht stimmt." });
      const tabelle = h("div.ba-best-rechnung", { "aria-label": "Rechnung" });
      const knoepfe2 = h("div.knopfreihe");
      stage.append(kopf2, tabelle, knoepfe2);
      const zeichne = () => tabelle.replaceChildren(...rechnung.zeilen.map((z, i) => h("button.ba-best-rechnungszeile" + (gewaehlt.has(i) ? ".ba-gewaehlt" : ""), {
        onTap: () => { gewaehlt.has(i) ? gewaehlt.delete(i) : gewaehlt.add(i); zeichne(); },
      }, h("span", { text: `${z.menge}× ${KATALOG[z.art].name}` }), h("span", { text: euro(z.einzelpreis) }), h("span", { text: euro(z.summe) }))),
      h("div.ba-best-rechnungszeile.ba-best-gesamt", {}, h("span", { text: "Gesamt" }), h("span"), h("span", { text: euro(rechnung.gesamtsumme) })));
      zeichne();
      const w = await warte(ctx, (done) => { knoepfe2.replaceChildren(h("button.knopf.primaer.gross", { text: "Prüfung abschließen", onTap: () => done(true) })); });
      if (w == null || !ctx.alive()) return null;
      const treffer = [...gewaehlt].filter((i) => rechnung.fehlerIdx.includes(i)).length;
      const falsch = [...gewaehlt].filter((i) => !rechnung.fehlerIdx.includes(i)).length;
      scoreRechnung = rechnung.fehlerIdx.length ? Math.max(0, treffer / rechnung.fehlerIdx.length - 0.25 * falsch) : (gewaehlt.size === 0 ? 1 : 0.5);
      const perfekt = scoreRechnung >= 0.999;
      feedback(stage, perfekt ? "Alle Fehler gefunden!" : "So war die Rechnung gemeint", perfekt ? "gut" : "neutral");
      await sleep(1400);
    }

    if (!ctx.alive()) return null;
    const score = hatteRechnung ? 0.6 * scoreZusammenstellung + 0.4 * scoreRechnung : scoreZusammenstellung;
    return {
      score,
      text: pruefung.ok ? "Bestellung genau nach Vorgabe zusammengestellt." : `${auftrag.vorgaben.length - new Set(pruefung.probleme.map((p) => p.art)).size} von ${auftrag.vorgaben.length} Positionen richtig.`,
    };
  },
};
