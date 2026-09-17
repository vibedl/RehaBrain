// Planen & Denken: Alltagsabläufe ordnen – Schritte in die richtige Reihenfolge bringen
import { h, sleep, rand, feedback, onTap } from "../core/ui.js";

export const ABLAEUFE = [
  { titel: "Kaffee kochen", schritte: ["Filtertüte in die Maschine legen", "Kaffeepulver in die Filtertüte geben", "Deckel der Maschine schließen", "Maschine einschalten", "Warten, bis der Kaffee durchgelaufen ist", "Kanne aus der Maschine nehmen", "Kaffee in die Tasse gießen", "Kaffee trinken"] },
  { titel: "Einen Brief verschicken", schritte: ["Brief schreiben", "Brief unterschreiben", "Brief falten", "Brief in den Umschlag stecken", "Umschlag zukleben", "Briefmarke aufkleben", "Zum Briefkasten gehen", "Brief einwerfen"] },
  { titel: "Zähne putzen", schritte: ["Ins Badezimmer gehen", "Zahnbürste nehmen", "Zahnpasta auf die Bürste geben", "Zähne zwei Minuten putzen", "Zahnpasta ausspucken", "Mund mit Wasser ausspülen", "Zahnbürste abspülen", "Zahnbürste in den Becher stellen"] },
  { titel: "Einen Arzttermin vereinbaren", schritte: ["Telefonnummer der Praxis heraussuchen", "Nummer wählen", "Warten, bis sich jemand meldet", "Den eigenen Namen nennen", "Grund für den Termin sagen", "Einen Termin vorgeschlagen bekommen", "Termin bestätigen und auflegen", "Termin in den Kalender eintragen"] },
  { titel: "Wäsche waschen", schritte: ["Wäsche nach Farben sortieren", "Wäsche in die Maschine legen", "Tür der Maschine schließen", "Waschprogramm wählen", "Maschine starten", "Warten, bis die Maschine fertig ist", "Nasse Wäsche herausnehmen", "Wäsche aufhängen"] },
  { titel: "Tee kochen", schritte: ["Wasserkocher mit Wasser füllen", "Wasserkocher einschalten", "Warten, bis das Wasser kocht", "Heißes Wasser in die Tasse gießen", "Teebeutel ins Wasser hängen", "Tee einige Minuten ziehen lassen", "Teebeutel herausnehmen", "Tee trinken"] },
  { titel: "Einkaufen gehen", schritte: ["Einkaufszettel schreiben", "Einkaufszettel einstecken", "Zum Supermarkt gehen", "Einkaufswagen nehmen", "Waren in den Wagen legen", "An der Kasse bezahlen", "Nach Hause gehen", "Einkäufe einräumen"] },
  { titel: "Rührei braten", schritte: ["Pfanne auf den Herd stellen", "Herd einschalten", "Butter in die Pfanne geben", "Eier in die Pfanne schlagen", "Eier umrühren", "Warten, bis die Eier fest sind", "Herd ausschalten", "Rührei auf den Teller geben"] },
  { titel: "Tabletten einnehmen", schritte: ["Medikamentenplan ansehen", "Richtige Dose aus dem Schrank holen", "Dose öffnen", "Tablette herausnehmen", "Tablette in den Mund nehmen", "Mit Wasser herunterschlucken", "Einnahme im Plan abhaken"] },
  { titel: "Eine Pflanze umtopfen", schritte: ["Einen größeren Topf holen", "Etwas Erde in den neuen Topf füllen", "Pflanze aus dem alten Topf ziehen", "Pflanze in den neuen Topf setzen", "Topf mit Erde auffüllen", "Erde leicht andrücken", "Pflanze gießen"] },
  { titel: "Mit dem Bus fahren", schritte: ["Fahrplan ansehen", "Zur Haltestelle gehen", "Auf den Bus warten", "In den Bus einsteigen", "Fahrkarte vorzeigen", "Sitzplatz suchen", "Halteknopf drücken", "Aussteigen"] },
  { titel: "Geld abheben", schritte: ["Zur Bank gehen", "Karte in den Automaten stecken", "Geheimzahl eingeben", "Betrag auswählen", "Karte wieder herausnehmen", "Geld aus dem Automaten nehmen", "Geld ins Portemonnaie stecken"] },
  { titel: "Einen Kuchen backen", schritte: ["Rezept lesen", "Zutaten abwiegen", "Zutaten zu einem Teig verrühren", "Teig in die Form füllen", "Form in den Ofen schieben", "Kuchen backen lassen", "Kuchen aus dem Ofen nehmen", "Kuchen abkühlen lassen"] },
  { titel: "Ein Geschenk verpacken", schritte: ["Geschenk in einen Karton legen", "Karton schließen", "Geschenkpapier zuschneiden", "Karton in das Papier einschlagen", "Papier mit Klebeband festkleben", "Schleife binden", "Geschenk überreichen"] },
];

/** Stufe → Anzahl Schritte, Ablenker, Aufgaben pro Runde */
export function ablaufStufe(stufe) {
  const schritte = Math.min(8, 3 + Math.floor((stufe - 1) / 3));
  const ablenker = stufe >= 14 ? 2 : stufe >= 8 ? 1 : 0;
  return { schritte, ablenker, aufgaben: schritte <= 5 ? 4 : 3 };
}

/** Aufgabe: Teilfolge (Reihenfolge bleibt), Ablenker aus anderen Abläufen, gemischter Vorrat */
export function erstelleAblauf(stufe, zufall = rand, ausschluss = []) {
  const { schritte: n, ablenker } = ablaufStufe(stufe);
  let kandidaten = ABLAEUFE.filter((a) => a.schritte.length >= n && !ausschluss.includes(a.titel));
  if (!kandidaten.length) kandidaten = ABLAEUFE.filter((a) => a.schritte.length >= n);
  const ablauf = kandidaten[zufall(kandidaten.length)];
  const idx = ablauf.schritte.map((_, i) => i);
  while (idx.length > n) idx.splice(zufall(idx.length), 1);
  const loesung = idx.map((i) => ablauf.schritte[i]);
  const fremde = ABLAEUFE.filter((a) => a !== ablauf).flatMap((a) => a.schritte);
  const stoerer = [];
  while (stoerer.length < ablenker) {
    const s = fremde[zufall(fremde.length)];
    if (!stoerer.includes(s) && !loesung.includes(s)) stoerer.push(s);
  }
  const vorrat = [...loesung, ...stoerer];
  for (let i = vorrat.length - 1; i > 0; i--) { const j = zufall(i + 1); [vorrat[i], vorrat[j]] = [vorrat[j], vorrat[i]]; }
  return { titel: ablauf.titel, loesung, stoerer, vorrat };
}

/** Bewertung: längste Teilfolge in richtiger Reihenfolge (ein verrutschter Schritt kostet nur einen Punkt) */
export function pruefeAblauf(gelegt, loesung) {
  const rang = gelegt.map((s) => loesung.indexOf(s));
  const ablenkerGelegt = rang.filter((r) => r < 0).length;
  const gueltig = rang.filter((r) => r >= 0);
  const lis = [];
  for (let i = 0; i < gueltig.length; i++) {
    lis[i] = 1;
    for (let j = 0; j < i; j++) if (gueltig[j] < gueltig[i]) lis[i] = Math.max(lis[i], lis[j] + 1);
  }
  const inOrdnung = gueltig.length ? Math.max(...lis) : 0;
  const richtigePlaetze = gelegt.filter((s, i) => loesung[i] === s).length;
  const ok = gelegt.length === loesung.length && richtigePlaetze === loesung.length;
  const score = Math.max(0, (inOrdnung - ablenkerGelegt) / loesung.length);
  return { ok, richtigePlaetze, inOrdnung, ablenkerGelegt, score: ok ? 1 : Math.min(score, 0.9) };
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
  id: "ablauf",
  bereich: "Planen & Denken",
  titel: "Abläufe ordnen",
  icon: "",
  anleitung: (stufe) =>
    "Bringen Sie die Schritte in die richtige Reihenfolge. Tippen Sie immer den Schritt an, der als Nächstes kommt. Ein Tipp auf einen gelegten Schritt nimmt ihn wieder heraus."
    + (ablaufStufe(stufe).ablenker ? " Vorsicht: Einige Schritte gehören gar nicht dazu – lassen Sie diese liegen." : ""),

  async run(ctx) {
    const { stage, stufe } = ctx;
    const { aufgaben } = ablaufStufe(stufe);
    const benutzt = [];
    let punkte = 0, perfekt = 0;

    for (let a = 0; a < aufgaben && ctx.alive(); a++) {
      stage.replaceChildren();
      const aufgabe = erstelleAblauf(stufe, rand, benutzt);
      benutzt.push(aufgabe.titel);
      const n = aufgabe.loesung.length;
      const plaetze = Array(n).fill(null);

      const zaehler = h("p.hinweis", { text: `Ablauf ${a + 1} von ${aufgaben}` });
      const titel = h("p.hinweis.gross", { text: aufgabe.titel });
      const folge = h("ol.pl-ablauf-folge", { "aria-label": "Ihre Reihenfolge" });
      const vorrat = h("div.pl-ablauf-vorrat", { "aria-label": "Schritte zur Auswahl" });
      const knoepfe = h("div.knopfreihe");
      stage.append(zaehler, titel, folge, h("p.pl-ablauf-titel", { text: "Schritte zur Auswahl" }), vorrat, knoepfe);

      let fertigMelden = null;
      const pruefKnopf = h("button.knopf.primaer.gross", { text: "Fertig", onTap: () => fertigMelden && fertigMelden(true) });

      const zeichne = () => {
        folge.replaceChildren(...plaetze.map((s, i) => h("li", {},
          s
            ? h("button.pl-ablauf-platz.belegt", { "aria-label": `Platz ${i + 1}: ${s} – herausnehmen`, onTap: () => { plaetze[i] = null; zeichne(); } },
              h("span.pl-ablauf-nr", { text: i + 1 }), h("span", { text: s }))
            : h("div.pl-ablauf-platz", {}, h("span.pl-ablauf-nr", { text: i + 1 }), h("span.pl-ablauf-leer", { text: "…" })))));
        vorrat.replaceChildren(...aufgabe.vorrat.filter((s) => !plaetze.includes(s)).map((s) => h("button.pl-ablauf-schritt", {
          text: s,
          onTap: () => {
            const frei = plaetze.indexOf(null);
            if (frei < 0) { feedback(stage, "Alle Plätze sind belegt", "neutral"); return; }
            plaetze[frei] = s; zeichne();
          },
        })));
        const voll = !plaetze.includes(null);
        pruefKnopf.disabled = !voll;
        knoepfe.replaceChildren(pruefKnopf);
      };
      zeichne();

      const los = await warte(ctx, (done) => { fertigMelden = done; });
      if (los == null || !ctx.alive()) return null;

      const erg = pruefeAblauf(plaetze, aufgabe.loesung);
      punkte += erg.score;
      if (erg.ok) perfekt++;
      folge.classList.add("pl-ablauf-gesperrt");
      vorrat.classList.add("pl-ablauf-gesperrt");
      if (erg.ok) {
        feedback(stage, "Genau richtig!", "gut");
        zaehler.textContent = "Alles in der richtigen Reihenfolge.";
      } else {
        feedback(stage, "Fast – so ist die Reihenfolge", "neutral");
        zaehler.textContent = erg.ablenkerGelegt ? "Richtige Reihenfolge (ohne die Schritte, die nicht dazugehören):" : "So ist die richtige Reihenfolge:";
        folge.replaceChildren(...aufgabe.loesung.map((s, i) => h("li", {},
          h("div.pl-ablauf-platz" + (plaetze[i] === s ? ".passt" : ".loesung"), {}, h("span.pl-ablauf-nr", { text: i + 1 }), h("span", { text: s })))));
        vorrat.replaceChildren();
      }
      await sleep(900);
      if (!ctx.alive()) return null;
      const weiter = await warte(ctx, (done) => {
        knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: a + 1 < aufgaben ? "Nächster Ablauf" : "Fertig", onTap: () => done(true) }));
      });
      if (weiter == null || !ctx.alive()) return null;
    }
    if (!ctx.alive()) return null;
    return { score: punkte / aufgaben, text: `${perfekt} von ${aufgaben} Abläufen ganz richtig geordnet.` };
  },
};
