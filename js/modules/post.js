// Beruf & Alltag: Post bearbeiten – Posteingang nach Regeln in Ablagefächer sortieren,
// Fristen erkennen, Dringendes nach Reihenfolge erledigen; Regeln ändern sich zwischendurch.
import { h, sleep, rand, pick, shuffle, feedback, onTap } from "../core/ui.js";

// ---------- Fächer ----------
export const FAECHER = {
  dringend: "Dringend",
  rechnungen: "Rechnungen",
  aemter: "Ämter & Versicherungen",
  termine: "Termine",
  persoenlich: "Persönliches",
  werbung: "Altpapier (Werbung)",
  kern: "Für Herrn Kern",
};

const REGELTEXT = {
  rechnungen: "Rechnungen kommen in „Rechnungen“.",
  aemter: "Post von Ämtern, Krankenkasse und Versicherungen kommt in „Ämter & Versicherungen“.",
  termine: "Einladungen und Terminbestätigungen kommen in „Termine“.",
  persoenlich: "Karten und Briefe von Familie, Freunden und Nachbarn kommen in „Persönliches“.",
  werbung: "Werbung kommt ins „Altpapier“.",
};

// ---------- Vorlagen (alle Namen erfunden) ----------
const VORLAGEN = {
  rechnungen: [
    ["Stadtwerke Birkenfeld", "Rechnung: Strom-Abschlag"],
    ["Kabelnetz Nordwest GmbH", "Rechnung: Internet und Telefon"],
    ["Autowerkstatt Brandt", "Rechnung: Inspektion Ihres Autos"],
    ["Zahnarztpraxis Dr. Olsen", "Rechnung: Zahnreinigung"],
    ["Hausverwaltung Kranz & Söhne", "Rechnung: Nachzahlung Nebenkosten"],
    ["Musikschule Tonleiter", "Rechnung: Kursgebühr Gitarre"],
    ["Schornsteinfeger Ruß & Co.", "Rechnung: Kaminkehren"],
  ],
  aemter: [
    ["Finanzamt Birkenfeld", "Bitte reichen Sie fehlende Belege ein"],
    ["Krankenkasse GesundPlus", "Antrag Reha-Nachsorge: Unterlagen fehlen"],
    ["Versorgungsamt Lindenau", "Bescheid über Ihren Antrag"],
    ["Bürgeramt Lindenau", "Ihr neuer Personalausweis liegt bereit"],
    ["Hausrat-Versicherung Sicher & Gut", "Schadensmeldung: Bitte Fotos nachreichen"],
    ["Arbeitsagentur Lindenau", "Bitte melden Sie sich zurück"],
  ],
  termine: [
    ["Physiotherapie Ahorn", "Terminbestätigung"],
    ["TSV Eichenau 1921 e. V.", "Einladung zur Mitgliederversammlung"],
    ["Schreinerei Holtkamp, Personalbüro", "Einladung: Gespräch zur Wiedereingliederung"],
    ["Grundschule am Weiher", "Einladung zum Elternabend"],
    ["Augenarztpraxis Dr. Sommer", "Erinnerung an Ihren Kontrolltermin"],
    ["Nachbarschaftshilfe Lindenau", "Einladung zum Helfertreffen"],
  ],
  persoenlich: [
    ["Hanna (Postkarte)", "Viele Grüße von der Ostsee!"],
    ["Onkel Rudi", "Glückwunschkarte zum Geburtstag"],
    ["Ihre Nachbarin Frau Aydin", "Danke für die Hilfe beim Umzug!"],
    ["Tim und Lea", "Fotos vom Wanderwochenende"],
    ["Ihre Schwester Carla", "Ein langer Brief mit Neuigkeiten"],
  ],
  werbung: [
    ["Möbelhaus Kranich", "Herbst-Rabatt: 30 Prozent auf alle Sofas"],
    ["Pizzeria Bella Nonna", "Neue Speisekarte – jetzt mit Lieferdienst"],
    ["Fitnessstudio Kraftwerk", "Probetraining geschenkt"],
    ["Gartencenter Grünfink", "Katalog: Pflanzen für den Herbst"],
    ["Optik Klarblick", "Gutschein: zweite Brille gratis"],
    ["Reisebüro Fernweh", "Last-Minute-Angebote"],
  ],
};

const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const tagPlus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const datumKurz = (d) => `${WOCHENTAGE[d.getDay()].slice(0, 2)}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
export const datumLang = (d) => `${WOCHENTAGE[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
const euro = (cent) => `${Math.floor(cent / 100)},${String(cent % 100).padStart(2, "0")} €`;

/** Schwierigkeit je Stufe */
export function postStufe(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    anzahl: Math.min(14, 6 + Math.floor((s - 1) / 2)),
    arten: s >= 7 ? ["rechnungen", "aemter", "termine", "persoenlich", "werbung"]
      : s >= 4 ? ["rechnungen", "termine", "persoenlich", "werbung"] : ["rechnungen", "persoenlich", "werbung"],
    frist: s >= 8 ? 7 : 0,              // „Frist in den nächsten X Tagen → Dringend“
    tageHilfe: s <= 9,                  // „(in 3 Tagen)“ neben dem Datum
    fristNah: s >= 13,                  // Fristen knapp an der Grenze
    werbeFalle: s >= 11,                // Werbung mit „nur bis …“-Datum
    empfaengerWechsel: s >= 10,         // Regeländerung: Post für den Nachbarn
    fristWechsel: s >= 16 ? 3 : 0,      // Regeländerung: neue Frist-Grenze
    prioritaet: s >= 12,                // Dringendes in Reihenfolge bringen
  };
}

/** Ziel-Fach eines Schreibens nach den gerade gültigen Regeln */
export function zielFach(brief, regeln) {
  if (regeln.empfaenger && brief.an === "kern") return "kern";
  if (regeln.frist && brief.fristTage != null && (brief.art === "rechnungen" || brief.art === "aemter") && brief.fristTage <= regeln.frist) return "dringend";
  return brief.art;
}

/** Regeln als Textliste (neueste Änderungen zuerst) */
export function regelTexte(regeln, arten) {
  const t = [];
  if (regeln.empfaenger) t.push({ neu: true, text: "Post an Herrn Kern kommt in „Für Herrn Kern“ – egal, was es ist." });
  if (regeln.frist) t.push({ neu: regeln.fristGeaendert, text: `Rechnungen und Amtspost mit Frist in den nächsten ${regeln.frist} Tagen kommen in „Dringend“.` });
  for (const a of arten) t.push({ text: REGELTEXT[a] });
  return t;
}

/** Fächer, die bei diesen Regeln sichtbar sind */
export function sichtbareFaecher(regeln, arten) {
  return Object.keys(FAECHER).filter((f) => (f === "dringend" ? !!regeln.frist : f === "kern" ? !!regeln.empfaenger : arten.includes(f)));
}

/** Eine komplette Posteingangs-Aufgabe */
export function erstellePost(stufe) {
  const p = postStufe(stufe);
  for (let versuch = 0; versuch < 200; versuch++) {
    const heute = new Date(2026, 2 + rand(8), 1 + rand(28));
    while (heute.getDay() === 0 || heute.getDay() === 6) heute.setDate(heute.getDate() + 1);
    const n = p.anzahl;
    const wechselKern = p.empfaengerWechsel ? Math.floor(n / 2) : -1;
    const wechselFrist = p.fristWechsel ? Math.floor((3 * n) / 4) : -1;
    const regelnBei = (i) => {
      const r = { frist: p.frist, empfaenger: false, fristGeaendert: false };
      if (wechselKern >= 0 && i >= wechselKern) r.empfaenger = true;
      if (wechselFrist >= 0 && i >= wechselFrist) { r.frist = p.fristWechsel; r.fristGeaendert = true; }
      return r;
    };
    // Arten verteilen: jede mindestens einmal
    const arten = [...p.arten];
    while (arten.length < n) arten.push(pick(p.arten));
    const folge = shuffle(arten);
    const benutzt = new Set();
    const briefe = folge.map((art, i) => {
      const regeln = regelnBei(i);
      const frei = VORLAGEN[art].filter(([abs]) => !benutzt.has(abs));
      const [absender, betreff] = pick(frei.length ? frei : VORLAGEN[art]);
      benutzt.add(absender);
      const b = { nr: i, art, absender, betreff, an: "sie", fristTage: null, datumTage: null, zusatz: "" };
      if (regeln.empfaenger && rand(10) < 3) b.an = "kern";
      if (art === "rechnungen" || art === "aemter") {
        const thr = regeln.frist || 7;
        const dringend = rand(10) < 4;
        let tage;
        if (dringend) tage = p.fristNah ? Math.max(1, thr - rand(2)) : 1 + rand(Math.max(1, thr - 1));
        else tage = p.fristNah ? thr + 2 + rand(3) : thr + 3 + rand(14);
        if (tage === thr + 1) tage++;
        // Nach einem Frist-Wechsel: knapp über der neuen Grenze, aber unter der alten (Falle)
        if (regeln.fristGeaendert && !dringend && rand(2)) tage = p.fristWechsel + 2 + rand(3);
        b.fristTage = tage;
        b.betrag = 1500 + rand(30000);
        b.zusatz = art === "rechnungen" ? `${euro(b.betrag)} – bitte zahlen bis` : "Frist:";
      } else if (art === "termine") {
        b.datumTage = 2 + rand(20);
        b.zusatz = `Termin: ${pick(["9:30", "10:00", "14:00", "16:30", "19:00"])} Uhr am`;
      } else if (art === "werbung" && p.werbeFalle && rand(2)) {
        b.datumTage = 1 + rand(4);
        b.zusatz = "Angebot gilt nur bis";
      }
      return b;
    });
    const loesungen = briefe.map((b, i) => zielFach(b, regelnBei(i)));
    // Bedingungen prüfen
    const dringend = briefe.filter((b, i) => loesungen[i] === "dringend");
    if (p.frist && dringend.length < (p.prioritaet ? 2 : 1)) continue;
    if (new Set(dringend.map((b) => b.fristTage)).size !== dringend.length) continue;
    if (p.prioritaet && dringend.length > 4) continue;
    if (p.empfaengerWechsel && briefe.filter((b) => b.an === "kern").length < 2) continue;
    // nach dem Frist-Wechsel mindestens ein Brief, bei dem die neue Regel etwas ändert
    if (p.fristWechsel) {
      const falle = briefe.some((b, i) => i >= wechselFrist && b.fristTage != null && b.an !== "kern"
        && b.fristTage > p.fristWechsel && b.fristTage <= p.frist);
      if (!falle) continue;
    }
    return { heute, briefe, loesungen, regelnBei, wechselKern, wechselFrist, arten: p.arten, p };
  }
  throw new Error("Post-Aufgabe konnte nicht erzeugt werden");
}

/** Richtige Erledigungs-Reihenfolge der dringenden Schreiben (früheste Frist zuerst) */
export function prioritaetsFolge(aufgabe) {
  return aufgabe.briefe.filter((b, i) => aufgabe.loesungen[i] === "dringend").sort((a, b) => a.fristTage - b.fristTage).map((b) => b.nr);
}

/** Punkte: Anteil richtig einsortierter Briefe; Reihenfolge zählt ein Viertel, wenn gefordert */
export function postScore(richtig, gesamt, prioRichtig = null, prioGesamt = 0) {
  const s = gesamt ? richtig / gesamt : 0;
  if (prioRichtig == null || !prioGesamt) return s;
  return 0.75 * s + 0.25 * (prioRichtig / prioGesamt);
}

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

const BRIEF_SVG = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="12" width="36" height="26" rx="2"/><path d="M6 14l18 13 18-13"/></svg>`;

function briefElement(b, heute, p) {
  const datum = b.fristTage != null ? tagPlus(heute, b.fristTage) : b.datumTage != null ? tagPlus(heute, b.datumTage) : null;
  const tage = b.fristTage ?? b.datumTage;
  return h("article.ba-post-brief", { "aria-live": "polite" },
    h("div.ba-post-briefkopf", {}, h("span.ba-post-symbol", { html: BRIEF_SVG }),
      h("div", {}, h("div.ba-post-klein", { text: "Von" }), h("div.ba-post-absender", { text: b.absender }))),
    h("div.ba-post-an", { text: b.an === "kern" ? "An: Herrn Jonas Kern" : "An: Sie" }),
    h("p.ba-post-betreff", { text: b.betreff }),
    b.zusatz && datum ? h("p.ba-post-zusatz", {}, `${b.zusatz} `, h("strong", { text: datumLang(datum) }),
      p.tageHilfe && tage != null ? h("span.ba-post-tage", { text: ` (in ${tage} ${tage === 1 ? "Tag" : "Tagen"})` }) : null) : null);
}

export default {
  id: "post",
  bereich: "Beruf & Alltag",
  titel: "Post bearbeiten",
  icon: "",
  anleitung: (stufe) => {
    const p = postStufe(stufe);
    return "Sortieren Sie die Post in die richtigen Fächer. Lesen Sie jeden Brief und tippen Sie dann auf das passende Fach. Die Regeln stehen immer daneben."
      + (p.frist ? " Achten Sie auf Fristen – Eiliges kommt in „Dringend“." : "")
      + (p.empfaengerWechsel ? " Unterwegs können sich Regeln ändern." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const aufgabe = erstellePost(stufe);
    const { p, heute, briefe } = aufgabe;
    let richtig = 0;

    const kopf = h("p.hinweis", { text: `Heute ist ${datumLang(heute)}` });
    const regelBox = h("section.ba-regeln", { "aria-label": "Regeln" });
    const briefPlatz = h("div.ba-post-platz");
    const zaehler = h("p.hinweis");
    const faecher = h("div.ba-post-faecher", { "aria-label": "Ablagefächer" });
    const knoepfe = h("div.knopfreihe");
    stage.append(kopf, h("div.ba-post-oben", {}, h("div.ba-post-links", {}, zaehler, briefPlatz), regelBox), faecher, knoepfe);
    const inhalt = { dringend: 0 };

    const zeigeRegeln = (regeln) => {
      regelBox.replaceChildren(h("h3.ba-titel", { text: "Regeln" }),
        h("ul.ba-regelliste", {}, regelTexte(regeln, aufgabe.arten).map((r) => h("li" + (r.neu ? ".ba-neu" : ""), { text: r.text }))));
    };

    for (let i = 0; i < briefe.length; i++) {
      if (!ctx.alive()) return null;
      const regeln = aufgabe.regelnBei(i);
      // Regeländerung ankündigen
      if (i === aufgabe.wechselKern || i === aufgabe.wechselFrist) {
        const text = i === aufgabe.wechselKern
          ? "Neue Regel: Ihr Nachbar Herr Kern ist verreist. Seine Post kommt ab jetzt in das Fach „Für Herrn Kern“ – egal, was es ist."
          : `Neue Regel: Ab jetzt ist nur noch dringend, was in den nächsten ${regeln.frist} Tagen fällig ist.`;
        briefPlatz.replaceChildren(h("div.ba-meldung", {}, h("p.hinweis.gross", { text })));
        faecher.replaceChildren();
        zeigeRegeln(regeln);
        ctx.speak(text);
        const ok = await warte(ctx, (done) => knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: "Verstanden", onTap: () => done(true) })));
        if (ok == null || !ctx.alive()) return null;
        knoepfe.replaceChildren();
      }
      zeigeRegeln(regeln);
      const b = briefe[i];
      zaehler.textContent = `Brief ${i + 1} von ${briefe.length}`;
      briefPlatz.replaceChildren(briefElement(b, heute, p));
      ctx.speak(`Von ${b.absender}. ${b.betreff}.`);
      const loesung = aufgabe.loesungen[i];
      const wahl = await warte(ctx, (done) => {
        faecher.replaceChildren(...sichtbareFaecher(regeln, aufgabe.arten).map((f) => h("button.ba-fach", {
          "data-fach": f, onTap: () => done(f),
        }, h("span.ba-fach-name", { text: FAECHER[f] }))));
      });
      if (wahl == null || !ctx.alive()) return null;
      faecher.querySelectorAll("button").forEach((btn) => { btn.disabled = true; if (btn.dataset.fach === loesung) btn.classList.add("ba-richtig"); });
      if (wahl === loesung) { richtig++; feedback(stage, "Richtig abgelegt", "gut"); }
      else feedback(stage, `Das gehört in „${FAECHER[loesung]}“`, "neutral");
      if (loesung === "dringend") inhalt.dringend++;
      await sleep(wahl === loesung ? 900 : 2000);
    }
    if (!ctx.alive()) return null;

    // Reihenfolge der dringenden Post
    let prioRichtig = null, prioGesamt = 0;
    if (p.prioritaet) {
      const folge = prioritaetsFolge(aufgabe);
      prioGesamt = folge.length;
      const gewaehlt = [];
      faecher.replaceChildren();
      zaehler.textContent = "Zum Schluss";
      regelBox.replaceChildren(h("h3.ba-titel", { text: "Im Fach „Dringend“" }),
        h("p", { text: "Was erledigen Sie zuerst? Tippen Sie die Schreiben in der Reihenfolge an, in der sie fällig sind – das Früheste zuerst." }));
      briefPlatz.replaceChildren();
      const liste = h("div.ba-prio-liste");
      briefPlatz.append(h("p.hinweis.gross", { text: `Heute ist ${datumLang(heute)}` }), liste);
      const fertig = await warte(ctx, (done) => {
        const zeichne = () => liste.replaceChildren(...shuffleFest.map((nr) => {
          const b = briefe[nr];
          const pos = gewaehlt.indexOf(nr);
          return h("button.ba-prio" + (pos >= 0 ? ".ba-gewaehlt" : ""), {
            onTap: () => {
              if (pos >= 0) gewaehlt.splice(pos, 1); else gewaehlt.push(nr);
              zeichne();
              knoepfe.replaceChildren(gewaehlt.length === folge.length ? h("button.knopf.primaer.gross", { text: "Fertig", onTap: () => done(true) }) : "");
            },
          }, h("span.ba-prio-nr", { text: pos >= 0 ? pos + 1 : "" }),
          h("span", {}, h("strong", { text: b.absender }), h("br"), `${b.betreff} – fällig ${datumLang(tagPlus(heute, b.fristTage))}`));
        }));
        const shuffleFest = shuffle(folge);
        zeichne();
      });
      if (fertig == null || !ctx.alive()) return null;
      knoepfe.replaceChildren();
      prioRichtig = gewaehlt.filter((nr, k) => folge[k] === nr).length;
      if (prioRichtig === prioGesamt) feedback(stage, "Gute Reihenfolge!", "gut");
      else {
        feedback(stage, "So wäre die Reihenfolge nach Fälligkeit", "neutral");
        liste.replaceChildren(...folge.map((nr, k) => h("div.ba-prio.ba-loesung", {}, h("span.ba-prio-nr", { text: k + 1 }),
          h("span", {}, h("strong", { text: briefe[nr].absender }), h("br"), `fällig ${datumLang(tagPlus(heute, briefe[nr].fristTage))}`))));
      }
      await sleep(1200);
      const w = await warte(ctx, (done) => knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: "Weiter", onTap: () => done(true) })));
      if (w == null || !ctx.alive()) return null;
    }

    const score = postScore(richtig, briefe.length, prioRichtig, prioGesamt);
    return {
      score,
      text: `${richtig} von ${briefe.length} Briefen richtig abgelegt` + (prioGesamt ? `, Reihenfolge ${prioRichtig} von ${prioGesamt} richtig.` : "."),
    };
  },
};
