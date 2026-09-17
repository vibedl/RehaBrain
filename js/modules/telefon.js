// Beruf & Alltag: Telefonnotiz – ein Anruf als Text-Dialog (oder zum Anhören), wichtige Angaben
// (Name, Rückrufnummer, Anliegen, Uhrzeit) in eine Notiz übernehmen; ab höheren Stufen mit Ablenkung/Rückfragen.
import { h, sleep, rand, pick, shuffle, feedback, onTap, debounced } from "../core/ui.js";

const VORNAMEN = ["Sabine", "Jürgen", "Elif", "Thorsten", "Carla", "Rainer", "Meike", "Ozan", "Brigitte", "Holger"];
const NACHNAMEN = ["Winkler", "Pohl", "Demir", "Rausch", "Steiner", "Brandt", "Kellner", "Nowak", "Herzog", "Lange"];
const FIRMEN = ["Autohaus Brandt", "Steuerbüro Herzog", "Zahnarztpraxis Dr. Olsen", "Physiotherapie Ahorn", "Handwerksbetrieb Lange & Söhne", "Reisebüro Fernweh", "Kindergarten Sonnenblume"];
const ANLIEGEN = [
  "möchte einen Termin verschieben",
  "hat eine Frage zur letzten Rechnung",
  "möchte einen Rückruf wegen eines Angebots",
  "meldet sich wegen einer Reparatur",
  "möchte den Liefertermin bestätigen",
  "hat eine Rückfrage zu den Unterlagen",
  "möchte sich für morgen entschuldigen",
  "ruft wegen einer Änderung im Vertrag an",
];
const ABLENKUNGEN = [
  "Übrigens, es soll morgen regnen.",
  "Grüßen Sie bitte Ihre Familie von mir.",
  "Ich war letzte Woche auch schon mal dran, kam aber nicht durch.",
  "Die Straße vor Ihrem Haus wird diese Woche saniert, falls Sie das noch nicht wussten.",
  "Ach ja, herzlichen Glückwunsch nachträglich zum Geburtstag!",
];
const RUECKFRAGEN = [
  { frage: "Und für wann noch mal genau?", info: "zeit" },
  { frage: "Wie war noch gleich Ihre... nein, halt, wie war die Nummer, unter der ich Sie erreiche?", info: "nummer" },
  { frage: "Sagen Sie mir bitte noch mal Ihren Namen?", info: "name" },
];

const rand2 = () => String(rand(90) + 10).padStart(2, "0");
const nummer = () => `0${16 + rand(80)} ${rand2()}${rand2()}${rand2()}${rand2()}`;
const zeit = () => `${8 + rand(10)}:${pick(["00", "15", "30", "45"])}`;

/** Schwierigkeit je Stufe */
export function telefonStufe(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    felder: s <= 4 ? 3 : 4,             // Name, Nummer, Anliegen, (+Uhrzeit ab Stufe 5)
    ablenkung: s >= 8,                   // unwichtiger Nebensatz im Dialog
    rueckfragen: s >= 13 ? 2 : s >= 9 ? 1 : 0,
    ziffernfeld: s >= 6,                 // Rückrufnummer per Tastenfeld statt Auswahl
    ablenkerZahl: s <= 10 ? 3 : 4,
    anrufe: s <= 9 ? 3 : 2,
};
}

/** Ein Anruf: Dialogzeilen + die abzufragenden Fakten */
export function erstelleAnruf(stufe) {
  const p = telefonStufe(stufe);
  const name = `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`;
  const firma = rand(2) ? pick(FIRMEN) : null;
  const anliegen = pick(ANLIEGEN);
  const rueckrufnummer = nummer();
  const uhr = zeit();
  const fakten = { name: firma ? `${name}, ${firma}` : name, nummer: rueckrufnummer, anliegen, zeit: uhr };

  const zeilen = [
    { sprecher: "anrufer", text: `Guten Tag, hier ist ${name}${firma ? " von " + firma : ""}.` },
    { sprecher: "sie", text: "Guten Tag, was kann ich für Sie tun?" },
    { sprecher: "anrufer", text: `Ich ${anliegen}.` },
  ];
  if (p.ablenkung) zeilen.push({ sprecher: "anrufer", text: pick(ABLENKUNGEN) });
  zeilen.push({ sprecher: "anrufer", text: `Rufen Sie mich bitte unter ${rueckrufnummer} zurück, am besten um ${uhr} Uhr.` });
  zeilen.push({ sprecher: "sie", text: "Ich richte das aus. Auf Wiederhören!" });

  const rueckfragen = shuffle(RUECKFRAGEN).slice(0, p.rueckfragen).map((r) => ({ ...r, antwort: fakten[r.info === "nummer" ? "nummer" : r.info] }));

  return { fakten, zeilen, rueckfragen, felder: (p.felder >= 4 ? ["name", "nummer", "anliegen", "zeit"] : ["name", "nummer", "anliegen"]) };
}

const FELD_LABEL = { name: "Name", nummer: "Rückrufnummer", anliegen: "Anliegen", zeit: "Rückruf um" };

function ablenkerFuer(feld, richtig, anzahl) {
  if (feld === "name") return shuffle([...VORNAMEN.map((v) => `${v} ${pick(NACHNAMEN)}`)].filter((n) => n !== richtig)).slice(0, anzahl);
  if (feld === "anliegen") return shuffle(ANLIEGEN.filter((a) => a !== richtig)).slice(0, anzahl);
  if (feld === "zeit") { const s = new Set(); while (s.size < anzahl) { const z = zeit(); if (z !== richtig) s.add(z); } return [...s]; }
  const s = new Set();
  while (s.size < anzahl) { const n = nummer(); if (n !== richtig) s.add(n); }
  return [...s];
}

/** Punkte: Anteil richtig übernommener Notiz-Felder plus richtig beantwortete Rückfragen */
export function telefonScore(richtigFelder, gesamtFelder, richtigRueckfragen = 0, gesamtRueckfragen = 0) {
  const basis = gesamtFelder ? richtigFelder / gesamtFelder : 0;
  if (!gesamtRueckfragen) return basis;
  return 0.75 * basis + 0.25 * (richtigRueckfragen / gesamtRueckfragen);
}

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

function tastenfeld(ctx, parent, laenge = 12) {
  const werte = [];
  const zeile = h("div.ba-daten-eingabe", { text: "_".repeat(laenge) });
  const feld = h("div.tastenfeld");
  parent.append(zeile, feld);
  const render = () => { zeile.textContent = werte.length ? werte.join("") + " " + (werte.join("").length < laenge ? "_".repeat(Math.max(0, laenge - werte.join("").length)) : "") : "_".repeat(laenge); };
  return warte(ctx, (fertig) => {
    for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"]) {
      feld.append(h("button.taste", {
        text: t, "aria-label": t === "⌫" ? "Löschen" : t === "✓" ? "Fertig" : String(t),
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

export default {
  id: "telefon",
  bereich: "Beruf & Alltag",
  titel: "Telefonnotiz",
  icon: "",
  anleitung: (stufe) => {
    const p = telefonStufe(stufe);
    return "Lesen Sie das Telefongespräch und schreiben Sie die wichtigen Angaben in die Notiz."
      + (p.ablenkung ? " Nicht alles im Gespräch ist wichtig – nur das, was für den Rückruf gebraucht wird." : "")
      + (p.rueckfragen ? " Manchmal fragt die Person am Telefon noch einmal nach." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = telefonStufe(stufe);
    let punkte = 0, gesamt = 0;

    for (let runde = 0; runde < p.anrufe && ctx.alive(); runde++) {
      stage.replaceChildren();
      const anruf = erstelleAnruf(stufe);
      const kopf = h("p.hinweis", { text: `Anruf ${runde + 1} von ${p.anrufe}` });
      const dialog = h("div.ba-tel-dialog", { "aria-label": "Telefongespräch" });
      stage.append(kopf, dialog);

      for (const z of anruf.zeilen) {
        if (!ctx.alive()) return null;
        dialog.append(h(`div.ba-tel-zeile.ba-tel-${z.sprecher}`, {}, h("span.ba-tel-label", { text: z.sprecher === "anrufer" ? "Anrufer" : "Sie" }), h("p", { text: z.text })));
        if (z.sprecher === "anrufer") ctx.speak(z.text);
        dialog.scrollTop = dialog.scrollHeight;
        await sleep(1100);
      }
      if (!ctx.alive()) return null;

      // Rückfragen: kurze Zwischenfragen, live beantwortet
      let richtigRueck = 0;
      for (const r of anruf.rueckfragen) {
        if (!ctx.alive()) return null;
        dialog.append(h("div.ba-tel-zeile.ba-tel-anrufer", {}, h("span.ba-tel-label", { text: "Anrufer" }), h("p", { text: r.frage })));
        ctx.speak(r.frage);
        const reihe = h("div.knopfreihe");
        stage.append(reihe);
        const richtig = r.antwort;
        const pool = r.info === "nummer" ? [nummer(), nummer(), nummer()] : r.info === "zeit" ? [zeit(), zeit(), zeit()] : [`${pick(VORNAMEN)} ${pick(NACHNAMEN)}`, `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`];
        const optionen = shuffle([richtig, ...pool.filter((x) => x !== richtig).slice(0, 2)]);
        const wahl = await warte(ctx, (done) => { for (const o of optionen) reihe.append(h("button.knopf.gross", { text: o, onTap: () => done(o) })); });
        reihe.remove();
        if (wahl == null || !ctx.alive()) return null;
        if (wahl === richtig) { richtigRueck++; feedback(stage, "Richtig beantwortet", "gut"); } else feedback(stage, `Es war: ${richtig}`, "neutral");
        await sleep(800);
      }

      // Notiz ausfüllen
      const notizKopf = h("p.hinweis.gross", { text: "Füllen Sie jetzt die Telefonnotiz aus" });
      const notiz = h("dl.ba-tel-notiz", { "aria-label": "Telefonnotiz" });
      const arbeitsplatz = h("div.ba-daten-eingabebereich");
      stage.append(notizKopf, notiz, arbeitsplatz);
      const eintraege = {};
      const zeichneNotiz = () => notiz.replaceChildren(...anruf.felder.map((f) => h("div.ba-daten-zeile", {}, h("dt", { text: FELD_LABEL[f] }), h("dd" + (eintraege[f] ? ".ba-daten-ausgefuellt" : ""), { text: eintraege[f] ?? "…" }))));
      zeichneNotiz();

      let richtigFelder = 0;
      for (const f of anruf.felder) {
        if (!ctx.alive()) return null;
        const richtig = anruf.fakten[f];
        arbeitsplatz.replaceChildren(h("p.hinweis", { text: `${FELD_LABEL[f]}:` }));
        let wert;
        if (f === "nummer" && p.ziffernfeld) {
          wert = await tastenfeld(ctx, arbeitsplatz, richtig.replace(/\D/g, "").length);
          if (wert == null) return null;
          const stimmt = wert === richtig.replace(/\D/g, "");
          eintraege[f] = stimmt ? richtig : wert;
          if (stimmt) { richtigFelder++; feedback(stage, "Richtig", "gut"); } else feedback(stage, `Richtig wäre: ${richtig}`, "neutral");
        } else {
          const reihe = h("div.knopfreihe");
          arbeitsplatz.append(reihe);
          const optionen = shuffle([richtig, ...ablenkerFuer(f, richtig, p.ablenkerZahl)]);
          wert = await warte(ctx, (done) => { for (const o of optionen) reihe.append(h("button.knopf.gross", { text: o, onTap: () => done(o) })); });
          if (wert == null) return null;
          eintraege[f] = wert;
          if (wert === richtig) { richtigFelder++; feedback(stage, "Richtig", "gut"); } else feedback(stage, `Richtig wäre: ${richtig}`, "neutral");
        }
        zeichneNotiz();
        await sleep(800);
        if (!ctx.alive()) return null;
        arbeitsplatz.replaceChildren();
      }

      punkte += telefonScore(richtigFelder, anruf.felder.length, richtigRueck, anruf.rueckfragen.length);
      gesamt += 1;
      const weiter = await warte(ctx, (done) => {
        stage.append(h("div.knopfreihe", {}, h("button.knopf.primaer.gross", { text: runde + 1 < p.anrufe ? "Nächster Anruf" : "Fertig", onTap: () => done(true) })));
      });
      if (weiter == null || !ctx.alive()) return null;
    }
    if (!ctx.alive()) return null;
    return { score: gesamt ? punkte / gesamt : 0, text: `${p.anrufe} Telefonnotizen ausgefüllt.` };
  },
};
