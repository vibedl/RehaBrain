// Gedächtnis: Wörter hören (verbales Lernen und Erinnern, angelehnt an Wortlisten-Lerntests)
// Eine Liste von Alltagswörtern anhören (oder lesen), danach die gehörten Wörter aus Kacheln antippen.
// Ab mittleren Stufen mehrere Lerndurchgänge (Lernkurve) und ein späterer Abruf nach einer Zwischenaufgabe.
import { h, sleep, debounced, feedback } from "../core/ui.js";
import { speak, stopSpeaking } from "../core/speech.js";
import { wartenAuf, zwischenaufgabe } from "./einkaufsliste.js";

// ---------- Wortschatz: 13 Alltagsgruppen, je 10 Wörter, alle verschieden ----------
export const WORTGRUPPEN = {
  obst: ["Apfel", "Birne", "Kirsche", "Pflaume", "Banane", "Traube", "Zitrone", "Erdbeere", "Pfirsich", "Melone"],
  gemuese: ["Karotte", "Gurke", "Tomate", "Zwiebel", "Kartoffel", "Paprika", "Bohne", "Erbse", "Salat", "Kohl"],
  moebel: ["Tisch", "Stuhl", "Schrank", "Sofa", "Regal", "Bett", "Kommode", "Sessel", "Hocker", "Bank"],
  tiere: ["Hund", "Katze", "Pferd", "Kuh", "Schaf", "Ziege", "Hase", "Ente", "Huhn", "Esel"],
  kleidung: ["Hose", "Jacke", "Mantel", "Hemd", "Rock", "Schal", "Mütze", "Socke", "Bluse", "Pullover"],
  kueche: ["Topf", "Pfanne", "Löffel", "Gabel", "Messer", "Teller", "Tasse", "Schüssel", "Kanne", "Sieb"],
  natur: ["Baum", "Blume", "Wiese", "Berg", "Fluss", "Wolke", "Stein", "Wald", "See", "Sonne"],
  werkzeug: ["Hammer", "Zange", "Säge", "Nagel", "Schraube", "Bohrer", "Leiter", "Pinsel", "Schaufel", "Meißel"],
  berufe: ["Bäcker", "Arzt", "Lehrer", "Maler", "Koch", "Gärtner", "Bauer", "Förster", "Schneider", "Friseur"],
  fahrzeuge: ["Auto", "Bus", "Zug", "Fahrrad", "Schiff", "Taxi", "Roller", "Traktor", "Boot", "Flugzeug"],
  koerper: ["Hand", "Fuß", "Nase", "Ohr", "Knie", "Arm", "Auge", "Mund", "Bein", "Finger"],
  haushalt: ["Besen", "Eimer", "Lampe", "Kissen", "Decke", "Spiegel", "Uhr", "Vorhang", "Teppich", "Schlüssel"],
  musik: ["Geige", "Flöte", "Trommel", "Klavier", "Gitarre", "Harfe", "Trompete", "Orgel", "Glocke", "Tuba"],
};

// ---------- Reine Logik (testbar) ----------

/** Schwierigkeit je Stufe 1–20 */
export function woerterParameter(stufe) {
  const s = Math.max(1, Math.min(20, Math.round(stufe)));
  const laenge = 5 + Math.round(((s - 1) * 5) / 19); // 5 … 10 Wörter
  return {
    laenge,
    gruppen: laenge <= 6 ? 2 : 3,                    // Wörter stammen aus 2–3 Themengruppen (Ordnen hilft beim Merken)
    durchgaenge: s <= 4 ? 1 : s <= 10 ? 2 : 3,
    verzoegert: s >= 7,                              // späterer Abruf nach einer Zwischenaufgabe
    pauseSek: s < 12 ? 20 : 35,
    ablenker: laenge + (s >= 10 ? 2 : 0),
    aehnlich: Math.min(1, 0.3 + s * 0.035),          // Anteil Ablenker aus denselben Themengruppen
    wortMs: Math.max(1500, 2600 - s * 50),           // Anzeigedauer je Wort im Lese-Modus
  };
}

/** Liste und Ablenker erzeugen; alle Wörter verschieden. */
export function erzeugeWortliste(stufe, rng = Math.random) {
  const p = woerterParameter(stufe);
  const mischen = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const gruppen = mischen(Object.keys(WORTGRUPPEN)).slice(0, p.gruppen);
  const liste = [];
  const vorrat = Object.fromEntries(gruppen.map((g) => [g, mischen(WORTGRUPPEN[g])]));
  for (let i = 0; liste.length < p.laenge; i++) liste.push(vorrat[gruppen[i % gruppen.length]].shift());

  const gleicheGruppe = mischen(gruppen.flatMap((g) => vorrat[g]));
  const andere = mischen(Object.keys(WORTGRUPPEN).filter((g) => !gruppen.includes(g)).flatMap((g) => WORTGRUPPEN[g]));
  const nAehnlich = Math.min(gleicheGruppe.length, Math.round(p.ablenker * p.aehnlich));
  const ablenker = [...gleicheGruppe.slice(0, nAehnlich), ...andere.slice(0, p.ablenker - nAehnlich)];
  return { liste: mischen(liste), ablenker, gruppen, parameter: p };
}

/** Auswertung eines Abrufs: Treffer minus falsch angetippte, bezogen auf die Listenlänge */
export function bewerteAbruf(liste, gewaehlt) {
  const soll = new Set(liste);
  let treffer = 0, fehl = 0;
  for (const w of new Set(gewaehlt)) (soll.has(w) ? treffer++ : fehl++);
  return { treffer, fehl, vergessen: soll.size - treffer, punkte: Math.max(0, (treffer - fehl) / soll.size) };
}

/** Gesamtwert: Mittel der Lerndurchgänge, mit späterem Abruf 60 : 40 gewichtet */
export function woerterScore(lernPunkte, spaetPunkte = null) {
  const mittel = lernPunkte.length ? lernPunkte.reduce((a, b) => a + b, 0) / lernPunkte.length : 0;
  return spaetPunkte == null ? mittel : 0.6 * mittel + 0.4 * spaetPunkte;
}

// ---------- Sprachausgabe-Helfer (auch von geschichte.js genutzt) ----------

/** Gibt es eine deutsche Stimme? Wartet kurz, weil Stimmen oft verzögert geladen werden. */
export async function sprachVerfuegbar() {
  if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  const deutsch = () => speechSynthesis.getVoices().some((v) => /^de/i.test(v.lang));
  if (deutsch()) return true;
  const ende = performance.now() + 1500;
  while (performance.now() < ende) {
    await sleep(100);
    if (deutsch()) return true;
  }
  return false;
}

/** Spricht einen Text (bewusst, nach Antippen) und wartet, bis er zu Ende ist. false bei Abbruch. */
export async function sprichUndWarte(ctx, text) {
  speak(text, { force: true });
  const start = performance.now();
  const maxMs = 2500 + text.length * 110;
  // kurz warten, bis die Ausgabe wirklich beginnt
  while (!speechSynthesis.speaking && performance.now() - start < 600) {
    if (!ctx.alive()) { stopSpeaking(); return false; }
    await sleep(40);
  }
  while ((speechSynthesis.speaking || speechSynthesis.pending) && performance.now() - start < maxMs) {
    if (!ctx.alive()) { stopSpeaking(); return false; }
    await sleep(60);
  }
  return ctx.alive();
}

/**
 * Auswahl „Anhören“ oder „Nur lesen“. Ohne Sprachausgabe: freundlicher Hinweis, dann Lese-Variante.
 * Gibt "hoeren" | "lesen" zurück, null bei Abbruch.
 */
export async function modusWahl(ctx, parent, was = "die Wörter") {
  const box = h("div.au-modus");
  parent.append(box);
  box.append(h("p.hinweis", { text: "Einen Moment …" }));
  const kannSprechen = await sprachVerfuegbar();
  if (!ctx.alive()) return null;
  box.replaceChildren();
  if (!kannSprechen) {
    box.append(h("p.hinweis.gross", { text: `Auf diesem Gerät ist keine deutsche Sprachausgabe verfügbar. Sie lesen ${was} deshalb.` }));
    const ok = await wartenAuf(ctx, (fertig) => {
      box.append(h("div.knopfreihe", {}, h("button.knopf.gross.primaer", { text: "Verstanden", onclick: debounced(() => fertig(true)) })));
    });
    box.remove();
    return ok == null ? null : "lesen";
  }
  box.append(h("p.hinweis.gross", { text: `Möchten Sie ${was} anhören oder lieber lesen?` }));
  const wahl = await wartenAuf(ctx, (fertig) => {
    box.append(h("div.knopfreihe.au-modus-knoepfe", {},
      h("button.knopf.gross.primaer.au-modus-knopf", { onclick: debounced(() => fertig("hoeren")) },
        h("span.au-modus-bild", { html: LAUTSPRECHER }), h("span", { text: "Anhören" })),
      h("button.knopf.gross.au-modus-knopf", { onclick: debounced(() => fertig("lesen")) },
        h("span.au-modus-bild", { html: BUCH }), h("span", { text: "Nur lesen" }))));
  });
  box.remove();
  return wahl;
}

export const LAUTSPRECHER = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 18h8l10-8v28l-10-8H8z"/><path d="M33 17a9 9 0 0 1 0 14M38 12a16 16 0 0 1 0 24"/></svg>`;
export const BUCH = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 12c-5-4-12-4-18-2v28c6-2 13-2 18 2 5-4 12-4 18-2V10c-6-2-13-2-18 2z"/><path d="M24 12v28"/></svg>`;

// ---------- Modul ----------

export default {
  id: "woerter",
  bereich: "Gedächtnis",
  titel: "Wörter hören",
  icon: "",
  anleitung: (stufe) => {
    const p = woerterParameter(stufe);
    let t = `Sie hören oder lesen ${p.laenge} Wörter. Danach tippen Sie alle Wörter an, die vorkamen.`;
    if (p.durchgaenge > 1) t += ` Die Liste kommt ${p.durchgaenge}-mal, so können Sie sich jedes Mal mehr merken.`;
    if (p.verzoegert) t += " Später werden Sie noch einmal danach gefragt.";
    return t;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const runde = erzeugeWortliste(stufe);
    const p = runde.parameter;
    const hinweis = h("p.hinweis", { text: "" });
    const flaeche = h("div.au-wort-flaeche");
    stage.append(hinweis, flaeche);

    let modus = await modusWahl(ctx, flaeche, "die Wörter");
    if (modus == null || !ctx.alive()) return null;

    // Darbietung einer Liste; bei Hörproblemen jederzeit auf Lesen umschaltbar
    const darbieten = async (nr) => {
      flaeche.replaceChildren();
      hinweis.textContent = p.durchgaenge > 1 ? `Durchgang ${nr} von ${p.durchgaenge}: Merken Sie sich die Wörter` : "Merken Sie sich die Wörter";
      if (modus === "hoeren") {
        const box = h("div.au-wort-hoeren", {}, h("span.au-wort-lautsprecher", { html: LAUTSPRECHER }));
        const stand = h("p.hinweis.gross", { text: nr === 1 ? "Tippen Sie auf „Anhören“, wenn Sie bereit sind." : "Die Liste kommt noch einmal – in anderer Reihenfolge." });
        box.append(stand);
        flaeche.append(box);
        const los = await wartenAuf(ctx, (fertig) => {
          box.append(h("div.knopfreihe", {}, h("button.knopf.gross.primaer", { onclick: debounced(() => fertig(true)) }, h("span.au-modus-bild", { html: LAUTSPRECHER }), h("span", { text: "Anhören" }))));
        });
        if (los == null) return null;
        box.querySelector(".knopfreihe")?.remove();
        let wechsel = false;
        const lesenKnopf = h("button.knopf", { text: "Ich höre nichts – lieber lesen", onclick: debounced(() => { wechsel = true; stopSpeaking(); }) });
        box.append(h("div.knopfreihe", {}, lesenKnopf));
        box.classList.add("au-wort-spricht");
        for (let i = 0; i < runde.liste.length; i++) {
          if (wechsel) break;
          stand.textContent = `Wort ${i + 1} von ${runde.liste.length}`;
          if (!(await sprichUndWarte(ctx, runde.liste[i]))) return null;
          if (wechsel) break;
          await sleep(900);
          if (!ctx.alive()) return null;
        }
        box.classList.remove("au-wort-spricht");
        if (wechsel) { modus = "lesen"; return darbieten(nr); }
        await sleep(500);
        return ctx.alive() ? true : null;
      }
      // Lesen: Wörter einzeln nacheinander, groß
      const anzeige = h("div.au-wort-karte", { text: "" });
      const stand = h("p.hinweis", { text: "" });
      flaeche.append(anzeige, stand);
      if (nr === 1) {
        anzeige.textContent = "Bereit?";
        const los = await wartenAuf(ctx, (fertig) => {
          flaeche.append(h("div.knopfreihe", {}, h("button.knopf.gross.primaer", { text: "Wörter zeigen", onclick: debounced(() => fertig(true)) })));
        });
        if (los == null) return null;
        flaeche.querySelector(".knopfreihe")?.remove();
      }
      for (let i = 0; i < runde.liste.length; i++) {
        anzeige.textContent = "";
        await sleep(350);
        if (!ctx.alive()) return null;
        anzeige.textContent = runde.liste[i];
        stand.textContent = `Wort ${i + 1} von ${runde.liste.length}`;
        await sleep(p.wortMs);
        if (!ctx.alive()) return null;
      }
      return true;
    };

    // Abruf: Kacheln antippen (Liste + Ablenker, gemischt)
    const abrufen = async (titel) => {
      flaeche.replaceChildren();
      hinweis.textContent = titel;
      const woerter = [...runde.liste, ...runde.ablenker];
      for (let i = woerter.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [woerter[i], woerter[j]] = [woerter[j], woerter[i]]; }
      const gewaehlt = new Set();
      const kacheln = woerter.map((w) => {
        const k = h("button.au-wort-kachel", { text: w, "aria-pressed": "false" });
        k.onclick = debounced(() => {
          if (gewaehlt.has(w)) gewaehlt.delete(w); else gewaehlt.add(w);
          k.setAttribute("aria-pressed", String(gewaehlt.has(w)));
          k.classList.toggle("au-wort-an", gewaehlt.has(w));
        });
        return k;
      });
      flaeche.append(h("div.au-wort-raster", {}, kacheln));
      const reihe = h("div.knopfreihe");
      flaeche.append(reihe);
      const ok = await wartenAuf(ctx, (fertig) => {
        reihe.append(h("button.knopf.gross.primaer", { text: "Fertig", onclick: debounced(() => fertig(true)) }));
      });
      if (ok == null) return null;
      reihe.remove();
      kacheln.forEach((k, i) => {
        k.onclick = null; k.disabled = true;
        if (runde.liste.includes(woerter[i])) k.classList.add(gewaehlt.has(woerter[i]) ? "au-wort-getroffen" : "au-wort-vergessen");
      });
      const e = bewerteAbruf(runde.liste, [...gewaehlt]);
      hinweis.textContent = "Grün eingerahmt: die Wörter aus der Liste";
      feedback(stage, e.vergessen === 0 && e.fehl === 0 ? "Alle richtig!" : `${e.treffer} von ${runde.liste.length} Wörtern`, e.punkte >= 0.8 ? "gut" : "neutral");
      const weiter = await wartenAuf(ctx, (fertig) => {
        flaeche.append(h("div.knopfreihe", {}, h("button.knopf.gross", { text: "Weiter", onclick: debounced(() => fertig(true)) })));
      });
      return weiter == null ? null : e;
    };

    const lern = [];
    for (let d = 1; d <= p.durchgaenge; d++) {
      if ((await darbieten(d)) == null || !ctx.alive()) return null;
      const e = await abrufen("Tippen Sie alle Wörter an, die Sie gerade gehört oder gelesen haben. Dann auf „Fertig“.");
      if (e == null || !ctx.alive()) return null;
      lern.push(e);
      if (d < p.durchgaenge) runde.liste = [...runde.liste].sort(() => Math.random() - 0.5); // neue Reihenfolge
    }

    let spaet = null;
    if (p.verzoegert) {
      flaeche.replaceChildren();
      hinweis.textContent = "Kurz etwas anderes";
      if ((await zwischenaufgabe(ctx, flaeche, p.pauseSek)) == null || !ctx.alive()) return null;
      spaet = await abrufen("Erinnern Sie sich noch? Tippen Sie die Wörter aus der Liste an – ohne sie noch einmal zu hören.");
      if (spaet == null || !ctx.alive()) return null;
    }

    // Lernkurve zeigen
    const n = runde.liste.length;
    if (lern.length > 1 || spaet) {
      flaeche.replaceChildren();
      hinweis.textContent = "";
      const zeile = (titel, e) => h("div.au-verlauf-zeile", {},
        h("span.au-verlauf-titel", { text: titel }),
        h("span.au-verlauf-spur", {}, h("span.au-verlauf-balken", { style: { width: `${Math.round((e.treffer / n) * 100)}%` } })),
        h("span.au-verlauf-wert", { text: `${e.treffer} von ${n}` }));
      const kurve = h("div.au-verlauf", {},
        lern.map((e, i) => zeile(`Durchgang ${i + 1}`, e)),
        spaet ? zeile("Später", spaet) : null);
      const besser = lern.length > 1 && lern[lern.length - 1].treffer > lern[0].treffer;
      flaeche.append(h("p.hinweis.gross", { text: besser ? "Ihre Lernkurve – mit jeder Wiederholung mehr behalten" : "Ihre Ergebnisse im Überblick" }), kurve);
      const ok = await wartenAuf(ctx, (fertig) => {
        flaeche.append(h("div.knopfreihe", {}, h("button.knopf.gross.primaer", { text: "Weiter", onclick: debounced(() => fertig(true)) })));
      });
      if (ok == null || !ctx.alive()) return null;
    }

    const score = woerterScore(lern.map((e) => e.punkte), spaet?.punkte ?? null);
    let text = lern.length > 1
      ? `Gemerkt: ${lern.map((e) => e.treffer).join(" → ")} von ${n} Wörtern.`
      : `${lern[0].treffer} von ${n} Wörtern gemerkt.`;
    if (spaet) text += ` Später noch ${spaet.treffer} von ${n}.`;
    return { score, text };
  },
};
