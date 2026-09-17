// Beruf & Alltag: Daten übertragen – Angaben von einem Beleg in eine Tabelle übertragen
// (Antippen des richtigen Werts oder Ziffernfeld), ab höheren Stufen Fehler zwischen zwei Listen finden.
import { h, sleep, rand, pick, shuffle, feedback, onTap, debounced } from "../core/ui.js";

const VORNAMEN = ["Anna", "Tobias", "Mehmet", "Julia", "Sven", "Katrin", "Bastian", "Nora", "Heike", "Dennis", "Petra", "Lukas"];
const NACHNAMEN = ["Berger", "Krause", "Yilmaz", "Fuchs", "Lehmann", "Brandt", "Voss", "Kellner", "Winter", "Nowak"];
const STRASSEN = ["Ahornweg", "Birkenallee", "Lindenstraße", "Kastanienweg", "Marktplatz", "Talstraße", "Bergweg", "Rosenweg"];
const ORTE = [["Lindenau", "48231"], ["Birkenfeld", "51075"], ["Talheim", "72820"], ["Eichenau", "82223"], ["Waldbronn", "76337"]];
const ARTIKEL = ["Aktenordner", "Druckerpapier A4", "Tonerkartusche", "Klebeband", "Kugelschreiber", "Briefumschläge C4", "Notizblöcke", "Heftklammern", "Verlängerungskabel", "Mülltüten", "Handtuchrollen", "Kaffeepulver"];

const rand2 = () => String(rand(90) + 10).padStart(2, "0");
const telefon = () => `0${2 + rand(8)}${rand(10)} ${rand2()}${rand2()}${rand2()}`;
const kundennr = () => String(100000 + rand(900000));
const iban = () => `DE${10 + rand(89)} ${400 + rand(500)} ${rand2()}${rand2()} ${rand2()}${rand2()} ${rand2()}${rand2()} ${rand2()}${rand2()}`;

/** Schwierigkeit je Stufe */
export function datenStufe(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    felderAdresse: s <= 3 ? 3 : s <= 7 ? 4 : s <= 12 ? 5 : 6,
    zeilenLieferschein: s <= 4 ? 3 : s <= 9 ? 4 : s <= 14 ? 5 : 6,
    ziffernfeld: s >= 6,          // Kundennummer/Telefon per Tastenfeld statt Auswahl
    ablenkerZahl: s <= 8 ? 3 : 4,
    modusFehler: s >= 10,         // ab hier: Fehler-finden statt Übertragen
    fehlerAnzahl: s <= 13 ? 2 : s <= 17 ? 3 : 4,
    aufgaben: s <= 9 ? 3 : 2,
  };
}

function person() {
  const vor = pick(VORNAMEN), nach = pick(NACHNAMEN), [ort, plz] = pick(ORTE);
  return {
    vorname: vor, nachname: nach, strasse: `${pick(STRASSEN)} ${1 + rand(120)}`,
    plz, ort, telefon: telefon(), kundennr: kundennr(), geburtsdatum: `${String(1 + rand(28)).padStart(2, "0")}.${String(1 + rand(12)).padStart(2, "0")}.${1945 + rand(65)}`,
  };
}

const FELD_LABEL = { vorname: "Vorname", nachname: "Nachname", strasse: "Straße, Hausnummer", plz: "PLZ", ort: "Ort", telefon: "Telefon", kundennr: "Kundennummer", geburtsdatum: "Geburtsdatum" };
const FELD_REIHENFOLGE = ["vorname", "nachname", "strasse", "plz", "ort", "telefon", "kundennr", "geburtsdatum"];

/** Ablenker-Werte für ein Feld (falsche Auswahlmöglichkeiten) */
function ablenkerFuer(feld, richtig, anzahl) {
  const pools = { vorname: VORNAMEN, nachname: NACHNAMEN, ort: ORTE.map((o) => o[0]), plz: ORTE.map((o) => o[1]), strasse: STRASSEN.map((s) => `${s} ${1 + rand(120)}`) };
  const pool = pools[feld];
  if (pool) {
    const rest = shuffle(pool.filter((p) => p !== richtig));
    return rest.slice(0, anzahl);
  }
  // Zahlen/Telefonnummern: leicht abgewandelte Varianten
  const varianten = new Set();
  while (varianten.size < anzahl) {
    const chars = richtig.split("");
    const i = chars.findIndex((c) => /\d/.test(c));
    const idx = i < 0 ? 0 : i + rand(Math.max(1, chars.length - i));
    if (/\d/.test(chars[idx])) chars[idx] = String((Number(chars[idx]) + 1 + rand(8)) % 10);
    const v = chars.join("");
    if (v !== richtig) varianten.add(v);
  }
  return [...varianten];
}

/** Adress-Übertragungsaufgabe: Formular → Tabellenfelder */
export function erstelleAdressAufgabe(stufe) {
  const p = datenStufe(stufe);
  const pers = person();
  const felder = FELD_REIHENFOLGE.slice(0, p.felderAdresse);
  const aufgaben = felder.map((feld) => {
    const richtig = pers[feld];
    const zifferneingabe = p.ziffernfeld && /^[\d.]+$/.test(richtig.replace(/[\s\/]/g, ""));
    if (zifferneingabe) return { feld, richtig, tastenfeld: true };
    const optionen = shuffle([richtig, ...ablenkerFuer(feld, richtig, p.ablenkerZahl)]);
    return { feld, richtig, optionen };
  });
  return { pers, aufgaben };
}

/** Lieferschein → Bestellliste, mit Fehlern (ab höheren Stufen) */
export function erstelleLieferschein(stufe) {
  const p = datenStufe(stufe);
  const n = p.zeilenLieferschein;
  const gewaehlt = shuffle(ARTIKEL).slice(0, n);
  const original = gewaehlt.map((name) => ({ name, menge: 1 + rand(9), preis: 149 + rand(2000) }));
  const abweichung = original.map((z) => ({ ...z }));
  const fehlerIdx = [];
  if (p.modusFehler) {
    const kandidaten = shuffle(original.map((_, i) => i));
    while (fehlerIdx.length < Math.min(p.fehlerAnzahl, n)) fehlerIdx.push(kandidaten[fehlerIdx.length]);
    for (const i of fehlerIdx) {
      const art = pick(["menge", "preis", "name"]);
      if (art === "menge") abweichung[i].menge = Math.max(1, abweichung[i].menge + pick([-2, -1, 1, 2, 3]));
      else if (art === "preis") abweichung[i].preis = Math.max(10, abweichung[i].preis + pick([-300, -150, 150, 300, 500]));
      else { const andere = ARTIKEL.filter((a) => !gewaehlt.includes(a)); abweichung[i].name = pick(andere); }
    }
  }
  return { original, abweichung, fehlerIdx: [...fehlerIdx].sort((a, b) => a - b) };
}

/** Bewertung Fehler-finden: Treffer minus falsche Meldungen, nie unter 0 */
export function fehlerScore(gewaehlt, fehlerIdx) {
  const treffer = gewaehlt.filter((i) => fehlerIdx.includes(i)).length;
  const falsch = gewaehlt.filter((i) => !fehlerIdx.includes(i)).length;
  const basis = fehlerIdx.length ? treffer / fehlerIdx.length : 1;
  return Math.max(0, basis - 0.25 * falsch);
}

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

function tastenfeld(ctx, parent, laenge = 14, vorlage = "") {
  const werte = [];
  const zeile = h("div.ba-daten-eingabe", { text: "_".repeat(Math.max(6, laenge)) });
  const feld = h("div.tastenfeld");
  parent.append(zeile, feld);
  const render = () => { zeile.textContent = werte.length ? werte.join("") : "_".repeat(Math.max(6, laenge)); };
  return warte(ctx, (fertig) => {
    for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"]) {
      feld.append(h("button.taste", {
        text: t,
        "aria-label": t === "⌫" ? "Löschen" : t === "✓" ? "Fertig" : String(t),
        onclick: debounced(() => {
          if (t === "⌫") werte.pop();
          else if (t === "✓") { if (werte.length) return fertig(werte.join("")); }
          else if (werte.length < laenge) werte.push(t);
          render();
          if (werte.length === laenge) setTimeout(() => fertig(werte.join("")), 350);
        }),
      }));
    }
  }).then((w) => { feld.remove(); zeile.remove(); return w; });
}

const euro = (cent) => `${Math.floor(cent / 100)},${String(cent % 100).padStart(2, "0")} €`;

function formularKarte(pers) {
  return h("div.ba-daten-formular", {}, h("h3.ba-titel", { text: "Neuer Kunde – Formular" }),
    h("dl.ba-daten-liste", {}, FELD_REIHENFOLGE.map((f) => h("div.ba-daten-zeile", {},
      h("dt", { text: FELD_LABEL[f] }), h("dd", { text: pers[f] })))));
}

export default {
  id: "daten",
  bereich: "Beruf & Alltag",
  titel: "Daten übertragen",
  icon: "",
  anleitung: (stufe) => {
    const p = datenStufe(stufe);
    return p.modusFehler
      ? "Vergleichen Sie den Lieferschein mit der Bestellung. Tippen Sie jede Zeile an, die nicht übereinstimmt."
      : "Übertragen Sie die Angaben vom Formular in die Tabelle. Tippen Sie den passenden Wert an" + (p.ziffernfeld ? " oder geben Sie ihn über das Tastenfeld ein." : ".");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = datenStufe(stufe);
    let gesamt = 0, punkte = 0;

    for (let runde = 0; runde < p.aufgaben && ctx.alive(); runde++) {
      stage.replaceChildren();
      const kopf = h("p.hinweis", { text: `Aufgabe ${runde + 1} von ${p.aufgaben}` });
      stage.append(kopf);

      if (p.modusFehler) {
        const auf = erstelleLieferschein(stufe);
        const infoBox = h("div.ba-daten-vergleich");
        stage.append(
          h("p.hinweis.gross", { text: "Original-Bestellung und Lieferschein vergleichen" }),
          infoBox,
        );
        const gewaehlt = new Set();
        const knoepfe = h("div.knopfreihe");
        stage.append(knoepfe);
        const zeichne = () => {
          infoBox.replaceChildren(
            h("div.ba-daten-spalte", {}, h("h3.ba-titel", { text: "Bestellt" }),
              auf.original.map((z, i) => h("div.ba-daten-zeile2", { text: `${z.menge}× ${z.name} – ${euro(z.preis)}` }))),
            h("div.ba-daten-spalte", {}, h("h3.ba-titel", { text: "Lieferschein (antippen bei Abweichung)" }),
              auf.abweichung.map((z, i) => h("button.ba-daten-zeile2.ba-daten-pruef" + (gewaehlt.has(i) ? ".ba-gewaehlt" : ""), {
                text: `${z.menge}× ${z.name} – ${euro(z.preis)}`,
                onTap: () => { gewaehlt.has(i) ? gewaehlt.delete(i) : gewaehlt.add(i); zeichne(); },
              }))),
          );
        };
        zeichne();
        const fertig = await warte(ctx, (done) => {
          knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: "Fertig geprüft", onTap: () => done(true) }));
        });
        if (fertig == null || !ctx.alive()) return null;
        knoepfe.replaceChildren();
        const score = fehlerScore([...gewaehlt], auf.fehlerIdx);
        punkte += score; gesamt += 1;
        const perfekt = score >= 0.999;
        feedback(stage, perfekt ? "Alle Abweichungen gefunden!" : "So war es gemeint", perfekt ? "gut" : "neutral");
        if (!perfekt) {
          infoBox.replaceChildren(
            h("div.ba-daten-spalte", {}, h("h3.ba-titel", { text: "Bestellt" }),
              auf.original.map((z) => h("div.ba-daten-zeile2", { text: `${z.menge}× ${z.name} – ${euro(z.preis)}` }))),
            h("div.ba-daten-spalte", {}, h("h3.ba-titel", { text: "Lieferschein" }),
              auf.abweichung.map((z, i) => h("div.ba-daten-zeile2" + (auf.fehlerIdx.includes(i) ? ".ba-loesung" : ""), { text: `${z.menge}× ${z.name} – ${euro(z.preis)}` }))),
          );
        }
        await sleep(1600);
        const w = await warte(ctx, (done) => knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: runde + 1 < p.aufgaben ? "Weiter" : "Fertig", onTap: () => done(true) })));
        if (w == null || !ctx.alive()) return null;
        continue;
      }

      // Übertragungs-Modus
      const auf = erstelleAdressAufgabe(stufe);
      const formular = formularKarte(auf.pers);
      const tabelle = h("dl.ba-daten-tabelle", { "aria-label": "Ihre Tabelle" });
      stage.append(h("div.ba-daten-oben", {}, formular, h("div.ba-daten-zielbox", {}, h("h3.ba-titel", { text: "Tabelle (Ihre Eingabe)" }), tabelle)));
      let richtigFelder = 0;
      const eintraege = {};
      const zeichneTabelle = () => tabelle.replaceChildren(...FELD_REIHENFOLGE.slice(0, p.felderAdresse).map((f) =>
        h("div.ba-daten-zeile", {}, h("dt", { text: FELD_LABEL[f] }), h("dd" + (eintraege[f] ? ".ba-daten-ausgefuellt" : ""), { text: eintraege[f] ?? "…" }))));
      zeichneTabelle();

      const arbeitsplatz = h("div.ba-daten-eingabebereich");
      stage.append(arbeitsplatz);

      for (const aufg of auf.aufgaben) {
        if (!ctx.alive()) return null;
        arbeitsplatz.replaceChildren(h("p.hinweis.gross", { text: `${FELD_LABEL[aufg.feld]}: welcher Wert stimmt?` }));
        let wert;
        if (aufg.tastenfeld) {
          const laenge = aufg.richtig.length;
          wert = await tastenfeld(ctx, arbeitsplatz, laenge);
          if (wert == null) return null;
          const stimmt = wert.replace(/\D/g, "") === aufg.richtig.replace(/\D/g, "");
          eintraege[aufg.feld] = stimmt ? aufg.richtig : wert;
          if (stimmt) { richtigFelder++; feedback(stage, "Richtig übernommen", "gut"); }
          else feedback(stage, `Im Formular steht: ${aufg.richtig}`, "neutral");
        } else {
          const reihe = h("div.knopfreihe");
          arbeitsplatz.append(reihe);
          wert = await warte(ctx, (done) => {
            for (const o of aufg.optionen) reihe.append(h("button.knopf.gross", { text: o, onTap: () => done(o) }));
          });
          if (wert == null) return null;
          eintraege[aufg.feld] = wert;
          if (wert === aufg.richtig) { richtigFelder++; feedback(stage, "Richtig übernommen", "gut"); }
          else feedback(stage, `Im Formular steht: ${aufg.richtig}`, "neutral");
        }
        zeichneTabelle();
        await sleep(900);
        if (!ctx.alive()) return null;
        arbeitsplatz.replaceChildren();
      }
      punkte += richtigFelder / auf.aufgaben.length; gesamt += 1;
      const w = await warte(ctx, (done) => {
        stage.append(h("div.knopfreihe", {}, h("button.knopf.primaer.gross", { text: runde + 1 < p.aufgaben ? "Weiter" : "Fertig", onTap: () => done(true) })));
      });
      if (w == null || !ctx.alive()) return null;
    }
    if (!ctx.alive()) return null;
    return { score: gesamt ? punkte / gesamt : 0, text: p.modusFehler ? `Abweichungen in ${p.aufgaben} Lieferscheinen geprüft.` : `${p.aufgaben} Formulare in die Tabelle übertragen.` };
  },
};
