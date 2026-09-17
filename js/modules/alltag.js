// Gedächtnis: Alltag – Termine, Uhrzeiten, Notizen und PINs merken und danach Fragen beantworten
import { h, sleep, rand, pick, shuffle, feedback, debounced } from "../core/ui.js";
import { wartenAuf, weiterKnopf, frageAuswahl, zwischenaufgabe } from "./einkaufsliste.js";

const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Vier eindeutige Antworten: die richtige plus Ablenker aus `kandidaten` (bereits ohne Duplikate der Lösung) */
export function antwortOptionen(loesung, kandidaten, n = 4) {
  const rest = [...new Set(kandidaten.filter((k) => k !== loesung))];
  return shuffle([loesung, ...shuffle(rest).slice(0, n - 1)]);
}

export const zeitText = (std, min) => `${std}:${String(min).padStart(2, "0")} Uhr`;

/** Ablenker für eine Uhrzeit (24-h-Format bei Terminen, 12-h bei der analogen Uhr) */
function zeitAblenker(std, min, { max = 23, min0 = 0, schritt = 30 } = {}) {
  const norm = (s) => ((s - min0 + (max - min0 + 1) * 4) % (max - min0 + 1)) + min0;
  const liste = [
    [norm(std + 1), min], [norm(std - 1), min], [std, (min + schritt) % 60], [std, (min + 60 - schritt) % 60],
    [norm(std + 2), min], [norm(std + 1), (min + schritt) % 60],
  ];
  return liste.map(([s, m]) => zeitText(s, m));
}

/** Schwierigkeit je Stufe 1–20 */
export function stufenParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    aufgaben: 4,
    terminFragen: s <= 5 ? 1 : s <= 11 ? 2 : 3,
    uhrSchritt: s < 5 ? 60 : s < 10 ? 30 : s < 15 ? 15 : 5,     // Genauigkeit der Uhrzeit in Minuten
    notizPunkte: Math.min(4, 1 + Math.floor(s / 5)),            // 1 … 4 Punkte auf dem Zettel
    pinLaenge: s < 8 ? 4 : s < 14 ? 5 : 6,
    pauseSek: s <= 3 ? 0 : s <= 10 ? 8 : s <= 15 ? 12 : 15,      // Zwischenaufgabe vor den Fragen
  };
}

// ---------- Aufgaben-Generatoren ----------

export function erzeugeTermin(stufe) {
  const p = stufenParameter(stufe);
  const arten = ["Hausarzt", "Zahnarzt", "Augenarzt", "Friseur", "Physiotherapie", "Fußpflege"];
  const mitbringen = ["die Versichertenkarte", "die Brille", "den Medikamentenplan", "die Überweisung"];
  const art = pick(arten), tag = pick(TAGE), std = 8 + rand(10);
  const schritt = stufe < 6 ? 60 : stufe < 12 ? 30 : 15;
  const min = rand(60 / schritt) * schritt;
  const zeit = zeitText(std, min);
  const ding = pick(mitbringen);
  const fragen = [{ frage: "Um wie viel Uhr ist der Termin?", loesung: zeit, optionen: antwortOptionen(zeit, zeitAblenker(std, min, { schritt: schritt === 60 ? 30 : schritt })) }];
  if (p.terminFragen >= 2) fragen.push({ frage: "An welchem Tag ist der Termin?", loesung: tag, optionen: antwortOptionen(tag, TAGE) });
  if (p.terminFragen >= 3) fragen.push({ frage: "Was sollen Sie mitbringen?", loesung: ding, optionen: antwortOptionen(ding, mitbringen) });
  const zeilen = [art, `${tag}, ${zeit}`];
  if (p.terminFragen >= 3) zeilen.push(`Bitte ${ding} mitbringen`);
  else fragen.push({ frage: "Wohin geht der Termin?", loesung: art, optionen: antwortOptionen(art, arten) });
  // bei niedrigen Stufen nur so viele Fragen wie vorgesehen
  return { typ: "termin", titel: "Ihr Termin", zeilen, sprechen: `Termin: ${art}, am ${tag} um ${zeit}.${p.terminFragen >= 3 ? ` Bitte ${ding} mitbringen.` : ""}`, fragen: fragen.slice(0, p.terminFragen) };
}

export function erzeugeUhr(stufe) {
  const p = stufenParameter(stufe);
  const std = 1 + rand(12);
  const min = rand(60 / p.uhrSchritt) * p.uhrSchritt;
  const zeit = zeitText(std, min);
  const ablenker = zeitAblenker(std, min, { max: 12, min0: 1, schritt: p.uhrSchritt === 60 ? 30 : p.uhrSchritt });
  // vertauschte Zeiger als typischer Ablesefehler
  if (p.uhrSchritt <= 15 && min % 5 === 0 && min > 0 && min / 5 <= 12 && std * 5 < 60) ablenker.unshift(zeitText(min / 5, std * 5));
  const anlass = pick(["Der Bus kommt um diese Uhrzeit.", "Um diese Uhrzeit kommt der Besuch.", "Um diese Uhrzeit beginnt die Gymnastik.", "Um diese Uhrzeit gibt es Mittagessen."]);
  const optionen = shuffle([zeit, ...[...new Set(ablenker.filter((a) => a !== zeit))].slice(0, 3)]);
  return {
    typ: "uhr", titel: "Merken Sie sich die Uhrzeit", anlass, std, min,
    fragen: [{ frage: "Welche Uhrzeit hat die Uhr gezeigt?", loesung: zeit, optionen }],
  };
}

const NOTIZ_BAUSTEINE = [
  () => {
    const t = pick([8, 12, 14, 16, 18, 20]);
    return { text: `Tabletten um ${t} Uhr nehmen`, frage: "Wann sollen die Tabletten genommen werden?", loesung: `${t} Uhr`, pool: [8, 12, 14, 16, 18, 20].map((x) => `${x} Uhr`) };
  },
  () => {
    const pool = ["die Tochter", "den Sohn", "die Schwester", "die Nachbarin", "den Enkel"];
    const w = pick(pool);
    return { text: `${w[0].toUpperCase() + w.slice(1)} anrufen`, frage: "Wen sollen Sie anrufen?", loesung: w, pool };
  },
  () => {
    const pool = ["Brot", "Milch", "Briefmarken", "Kaffee", "Äpfel"];
    const w = pick(pool);
    return { text: `${w} kaufen`, frage: "Was sollen Sie kaufen?", loesung: w, pool };
  },
  () => {
    const w = pick(TAGE.slice(0, 5));
    return { text: `Müll rausstellen am ${w}`, frage: "An welchem Tag kommt die Müllabfuhr?", loesung: w, pool: TAGE.slice(0, 5) };
  },
  () => {
    const pool = ["in der Schublade", "im Blumentopf", "bei der Nachbarin", "in der Jackentasche"];
    const w = pick(pool);
    return { text: `Ersatzschlüssel liegt ${w}`, frage: "Wo liegt der Ersatzschlüssel?", loesung: w, pool };
  },
  () => {
    const pool = ["Frau Weber", "Herrn Schulz", "Frau Becker", "Herrn Wagner"];
    const w = pick(pool);
    return { text: `Kaffeetrinken mit ${w}`, frage: "Mit wem sind Sie zum Kaffee verabredet?", loesung: w, pool };
  },
];

export function erzeugeNotiz(stufe) {
  const p = stufenParameter(stufe);
  const punkte = shuffle(NOTIZ_BAUSTEINE).slice(0, p.notizPunkte).map((f) => f());
  return {
    typ: "notiz", titel: "Ihre Notiz",
    zeilen: punkte.map((x) => x.text),
    sprechen: punkte.map((x) => x.text).join(". ") + ".",
    fragen: punkte.map((x) => ({ frage: x.frage, loesung: x.loesung, optionen: antwortOptionen(x.loesung, x.pool) })),
  };
}

export function erzeugePin(stufe) {
  const p = stufenParameter(stufe);
  let pin;
  do { pin = Array.from({ length: p.pinLaenge }, () => rand(10)).join(""); } while (/^(\d)\1+$/.test(pin));
  const wofuer = pick(["für die Haustür", "für das Fahrradschloss", "für den Hotel-Safe", "für das Garagentor"]);
  return { typ: "pin", titel: `Code ${wofuer}`, pin, fragen: [{ frage: `Wie lautet der Code ${wofuer}?`, loesung: pin, pin: true }] };
}

const GENERATOREN = { termin: erzeugeTermin, uhr: erzeugeUhr, notiz: erzeugeNotiz, pin: erzeugePin };

/** Mischung der Aufgabentypen für eine Runde: jeder Typ einmal, in zufälliger Reihenfolge */
export function erzeugeRunde(stufe) {
  const p = stufenParameter(stufe);
  const typen = shuffle(Object.keys(GENERATOREN));
  while (typen.length < p.aufgaben) typen.push(pick(Object.keys(GENERATOREN)));
  return typen.slice(0, p.aufgaben).map((t) => GENERATOREN[t](stufe));
}

// ---------- Analoge Uhr ----------
export function uhrSvg(std, min) {
  const striche = Array.from({ length: 12 }, (_, i) => {
    const w = (i * Math.PI) / 6;
    const r1 = i % 3 === 0 ? 70 : 76, r2 = 84;
    return `<line x1="${(100 + Math.sin(w) * r1).toFixed(1)}" y1="${(100 - Math.cos(w) * r1).toFixed(1)}" x2="${(100 + Math.sin(w) * r2).toFixed(1)}" y2="${(100 - Math.cos(w) * r2).toFixed(1)}" stroke-width="${i % 3 === 0 ? 5 : 3}"/>`;
  }).join("");
  const zahlen = [12, 3, 6, 9].map((z) => {
    const w = (z * Math.PI) / 6;
    return `<text x="${(100 + Math.sin(w) * 56).toFixed(1)}" y="${(100 - Math.cos(w) * 56 + 8).toFixed(1)}">${z}</text>`;
  }).join("");
  const wMin = (min / 60) * 360;
  const wStd = ((std % 12) + min / 60) * 30;
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
<circle cx="100" cy="100" r="92" fill="var(--kartenweiss)" stroke="var(--gd-tinte)" stroke-width="5"/>
<g stroke="var(--gd-tinte)" stroke-linecap="round">${striche}</g>
<g fill="var(--gd-tinte-hell)" font-family="var(--serif)" font-size="24" text-anchor="middle">${zahlen}</g>
<line x1="100" y1="100" x2="100" y2="52" stroke="var(--gd-tinte)" stroke-width="9" stroke-linecap="round" transform="rotate(${wStd} 100 100)"/>
<line x1="100" y1="100" x2="100" y2="26" stroke="var(--gd-uhr-zeiger)" stroke-width="5" stroke-linecap="round" transform="rotate(${wMin} 100 100)"/>
<circle cx="100" cy="100" r="7" fill="var(--gd-tinte)"/>
</svg>`;
}

// ---------- Ziffern-Tastenfeld (wie in zahlen.js, lokal) ----------
function tastenfeld(ctx, parent, laenge) {
  const werte = [];
  const zeile = h("div.eingabezeile");
  const render = () => { zeile.textContent = werte.join(" ") + " _".repeat(laenge - werte.length); };
  render();
  const feld = h("div.tastenfeld");
  parent.append(zeile, feld);
  return wartenAuf(ctx, (fertig) => {
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

// ---------- Darstellung ----------
function darstellung(aufgabe) {
  if (aufgabe.typ === "uhr") {
    return h("div.gd-alltag-uhrbox", {},
      h("p.hinweis.gross", { text: aufgabe.anlass }),
      h("div.gd-alltag-uhr", { html: uhrSvg(aufgabe.std, aufgabe.min), role: "img", "aria-label": "Analoge Uhr" }));
  }
  if (aufgabe.typ === "pin") {
    return h("div.gd-alltag-zettel.gd-alltag-pinzettel", {},
      h("p.gd-alltag-titel", { text: aufgabe.titel }),
      h("p.gd-alltag-pin", { text: aufgabe.pin.split("").join(" ") }));
  }
  return h(`div.gd-alltag-zettel.gd-alltag-${aufgabe.typ}`, {},
    h("p.gd-alltag-titel", { text: aufgabe.titel }),
    h("ul.gd-alltag-zeilen", {}, aufgabe.zeilen.map((z) => h("li", { text: z }))));
}

export default {
  id: "alltag",
  bereich: "Gedächtnis",
  titel: "Alltag merken",
  icon: "",
  anleitung: () => "Sie sehen nacheinander Termine, Uhren, Notizen und Codes. Merken Sie sich alles in Ruhe. Danach beantworten Sie Fragen dazu.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = stufenParameter(stufe);
    const aufgaben = erzeugeRunde(stufe);
    const hinweis = h("p.hinweis");
    const flaeche = h("div.gd-alltag-flaeche");
    stage.append(hinweis, flaeche);
    let richtig = 0, gesamt = 0;

    for (let i = 0; i < aufgaben.length; i++) {
      if (!ctx.alive()) return null;
      const a = aufgaben[i];
      hinweis.textContent = `Aufgabe ${i + 1} von ${aufgaben.length} – gut merken`;
      flaeche.replaceChildren(darstellung(a));
      if (a.sprechen) ctx.speak(a.sprechen);
      else if (a.typ === "pin") ctx.speak(`${a.titel}: ${a.pin.split("").join(" ")}`);
      await sleep(800);
      if ((await weiterKnopf(ctx, flaeche)) == null) return null;
      flaeche.replaceChildren();

      if (p.pauseSek) {
        hinweis.textContent = "Kurz etwas anderes";
        if ((await zwischenaufgabe(ctx, flaeche, p.pauseSek)) == null) return null;
      } else {
        await sleep(1500);
      }
      if (!ctx.alive()) return null;

      for (const f of a.fragen) {
        gesamt++;
        hinweis.textContent = `Aufgabe ${i + 1} von ${aufgaben.length} – Ihre Antwort`;
        if (f.pin) {
          const box = h("div.gd-frage", {}, h("p.hinweis.gross", { text: f.frage }));
          flaeche.append(box);
          const eingabe = await tastenfeld(ctx, box, f.loesung.length);
          box.remove();
          if (eingabe == null) return null;
          if (eingabe === f.loesung) { richtig++; feedback(stage, "Richtig!", "gut"); }
          else feedback(stage, `Der Code war: ${f.loesung.split("").join(" ")}`, "neutral");
          await sleep(1400);
        } else {
          const w = await frageAuswahl(ctx, flaeche, {
            frage: f.frage,
            loesung: f.loesung,
            optionen: f.optionen.map((o) => ({ inhalt: o, wert: o })),
            nachWahl: (wahl) => (wahl === f.loesung ? feedback(stage, "Richtig!", "gut") : feedback(stage, `Richtig wäre: ${f.loesung}`, "neutral")),
          });
          if (w == null) return null;
          if (w === f.loesung) richtig++;
        }
      }
    }
    if (!ctx.alive()) return null;
    return { score: gesamt ? richtig / gesamt : 0, text: `${richtig} von ${gesamt} Fragen zu Terminen, Uhren, Notizen und Codes richtig.` };
  },
};
