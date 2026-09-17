// Skat-Schule: Quiz-Übungen mit großen Karten als Vorstufe zum Skat.
// Stufe 1–3 Augen einer Karte · 4–6 Augen zusammenzählen · 5–8 Trumpf erkennen · 8–12 Wer gewinnt den Stich?
// 10–14 Welche Karte dürfen Sie legen? · 13–16 Spitzen zählen · 15–18 Reizwert · 17–20 Spielwert nach dem Spiel
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { neuesDeck, karteElement, kartenName } from "./deck.js";
import { kartenStyles, warteAufEingabe } from "./tisch.js";
import {
  augen, augenSumme, istTrumpf, stichSieger, legaleKarten, spitzen, spielwert, neuesSpielObjekt,
  sortiereSkatHand, spielName, farbNameSkat, bedienFarbe,
} from "./skatregeln.js";
import { FARBEN, RANG } from "./engine.js";

/* ================================================================ Aufgaben (ohne DOM) */

/** „Buben“ bzw. „Unter“ je nach Blatt */
export const bubenWort = (blatt) => (blatt === "deutsch" ? "Unter" : "Buben");

const zufall = (n, rng) => Math.floor(rng() * n);
const waehle = (arr, rng) => arr[zufall(arr.length, rng)];

/** Welche Aufgabentypen gibt es auf dieser Stufe? */
export function aufgabenTypen(stufe) {
  const s = Math.max(1, Math.min(20, stufe | 0 || 1));
  if (s <= 3) return ["augen1"];
  if (s <= 4) return ["augen1", "augenSumme"];
  if (s <= 6) return ["augenSumme", "trumpf"];
  if (s <= 8) return ["trumpf", "augenSumme", "stich"];
  if (s <= 10) return ["stich", "bedienen", "trumpf"];
  if (s <= 12) return ["stich", "bedienen"];
  if (s <= 14) return ["bedienen", "spitzen", "stich"];
  if (s <= 16) return ["spitzen", "reizwert", "bedienen"];
  if (s <= 18) return ["reizwert", "spielwert", "stich"];
  return ["spielwert", "reizwert", "bedienen", "spitzen"];
}

function zufallsSpiel(rng, { nullErlaubt = true } = {}) {
  const r = rng();
  if (r < 0.6) return neuesSpielObjekt("farbe", { trumpf: waehle(FARBEN, rng) });
  if (r < 0.85 || !nullErlaubt) return neuesSpielObjekt("grand");
  return neuesSpielObjekt("null");
}

/** Zahlen-Antwortmöglichkeiten rund um die richtige Lösung (eindeutig, sortiert). */
function zahlOptionen(richtig, rng, kandidaten = null) {
  const set = new Set([richtig]);
  const pool = kandidaten ?? [richtig - 10, richtig - 4, richtig - 3, richtig - 2, richtig + 2, richtig + 3, richtig + 4, richtig + 10, richtig + 11];
  const gemischt = [...pool].sort(() => rng() - 0.5);
  for (const x of gemischt) { if (set.size >= 4) break; if (x >= 0) set.add(x); }
  return [...set].sort((a, b) => a - b);
}

/**
 * Erzeugt eine Aufgabe. Rückgabe:
 * { typ, frage, spiel?, karten (Anzeige), antwort: "zahl"|"janein"|"karte", optionen?, richtig (Zahl|bool|Karten-ids[]), erklaerung }
 */
export function erzeugeAufgabe(typ, stufe = 10, rng = Math.random, blatt = "franzoesisch") {
  const deck = neuesDeck(blatt).sort(() => rng() - 0.5);
  switch (typ) {
    case "augen1": {
      // auf Stufe 1 bevorzugt Karten mit Augen, damit die Werte gelernt werden
      const k = stufe <= 1 ? deck.find((x) => augen(x) > 0) : deck[0];
      return { typ, frage: "Wie viele Augen zählt diese Karte?", karten: [k], antwort: "zahl", optionen: [0, 2, 3, 4, 10, 11], richtig: augen(k),
        erklaerung: `${kartenName(k)} zählt ${augen(k)} Augen.` };
    }
    case "augenSumme": {
      const n = stufe <= 5 ? 2 : stufe <= 7 ? 3 : 4;
      const karten = deck.slice(0, n);
      const summe = augenSumme(karten);
      return { typ, frage: "Wie viele Augen sind das zusammen?", karten, antwort: "zahl", optionen: zahlOptionen(summe, rng), richtig: summe,
        erklaerung: `${karten.map(augen).join(" + ")} = ${summe} Augen.` };
    }
    case "trumpf": {
      const spiel = zufallsSpiel(rng);
      // etwa die Hälfte Trümpfe, Buben öfter zeigen (die typische Falle)
      let k = deck[0];
      if (rng() < 0.35) k = deck.find((x) => x.rang === RANG.BUBE);
      else if (spiel.art === "farbe" && rng() < 0.4) k = deck.find((x) => x.farbe === spiel.trumpf);
      const t = istTrumpf(k, spiel);
      let erkl;
      if (spiel.art === "null") erkl = "Im Nullspiel gibt es keinen Trumpf.";
      else if (k.rang === RANG.BUBE) erkl = `${bubenWort(blatt)} sind im ${spiel.art === "grand" ? "Grand" : "Farbspiel"} immer Trumpf.`;
      else if (spiel.art === "grand") erkl = `Im Grand sind nur die vier ${bubenWort(blatt)} Trumpf.`;
      else erkl = t ? `${farbNameSkat(spiel.trumpf, blatt)} ist Trumpf.` : `Trumpf sind nur ${farbNameSkat(spiel.trumpf, blatt)} und die ${bubenWort(blatt)}.`;
      return { typ, frage: `Gespielt wird ${spielName(spiel, blatt)}. Ist diese Karte Trumpf?`, spiel, karten: [k], antwort: "janein", richtig: t, erklaerung: erkl };
    }
    case "stich": {
      const spiel = zufallsSpiel(rng, { nullErlaubt: stufe >= 10 });
      // erste Karte beliebig, die anderen zu 60 % bedienend (sonst wird es zu leicht)
      const erste = deck[0];
      const karten = [erste];
      const rest = deck.slice(1);
      for (let i = 0; i < 2; i++) {
        const passend = rest.filter((x) => bedienFarbe(x, spiel) === bedienFarbe(erste, spiel) && !karten.includes(x));
        const k = passend.length && rng() < 0.6 ? waehle(passend, rng) : rest.find((x) => !karten.includes(x));
        karten.push(k);
      }
      const si = stichSieger(karten, spiel);
      return { typ, frage: `${spielName(spiel, blatt)}: Welche Karte gewinnt den Stich? Die linke Karte wurde zuerst gespielt.`, spiel, karten, antwort: "karte",
        waehlbar: karten.map((k) => k.id), richtig: [karten[si].id], erklaerung: `${kartenName(karten[si])} gewinnt den Stich.` };
    }
    case "bedienen": {
      // Hand mit gültigen UND ungültigen Karten
      for (let versuch = 0; versuch < 50; versuch++) {
        const spiel = zufallsSpiel(rng, { nullErlaubt: stufe >= 12 });
        const d = neuesDeck(blatt).sort(() => rng() - 0.5);
        const stich = d.slice(0, stufe >= 13 && rng() < 0.5 ? 2 : 1);
        const hand = sortiereSkatHand(d.slice(2, 2 + (stufe <= 11 ? 5 : 7)), spiel);
        const legal = legaleKarten(hand, stich, spiel);
        if (legal.length === hand.length || legal.length === 0) continue;
        const gef = bedienFarbe(stich[0], spiel);
        const was = gef === "trumpf" ? "Trumpf" : farbNameSkat(gef, blatt);
        return { typ, frage: `${spielName(spiel, blatt)}: Welche Karte dürfen Sie legen? Tippen Sie eine erlaubte Karte an.`, spiel, stich, karten: hand, antwort: "karte",
          waehlbar: hand.map((k) => k.id), richtig: legal.map((k) => k.id),
          erklaerung: `${was} ist gefordert – Sie müssen ${was} bedienen${gef !== "trumpf" && spiel.art !== "null" ? ` (${bubenWort(blatt)} zählen dabei nicht als Farbe)` : ""}.` };
      }
      return erzeugeAufgabe("stich", stufe, rng, blatt);
    }
    case "spitzen": {
      const spiel = rng() < 0.7 ? neuesSpielObjekt("farbe", { trumpf: waehle(FARBEN, rng) }) : neuesSpielObjekt("grand");
      const hand = sortiereSkatHand(deck.slice(0, 10), spiel);
      const sp = spitzen(hand, spiel);
      const opts = [];
      const max = spiel.art === "grand" ? 4 : 6;
      for (const mit of [true, false]) for (let n = 1; n <= max; n++) opts.push({ mit, n });
      const richtigText = `${sp.mit ? "mit" : "ohne"} ${sp.anzahl}`;
      const auswahl = [richtigText];
      for (const o of opts.sort(() => rng() - 0.5)) { const t = `${o.mit ? "mit" : "ohne"} ${o.n}`; if (auswahl.length < 4 && !auswahl.includes(t)) auswahl.push(t); }
      return { typ, frage: `${spielName(spiel, blatt)}: Mit oder ohne wie viele Spitzen spielen Sie?`, spiel, karten: hand, antwort: "text", optionen: auswahl.sort(), richtig: richtigText,
        erklaerung: `Die Trumpfreihe beginnt mit dem ${blatt === "deutsch" ? "Eichel-Unter" : "Kreuz-Buben"}. Sie spielen ${richtigText}.` };
    }
    case "reizwert": {
      const spiel = rng() < 0.75 ? neuesSpielObjekt("farbe", { trumpf: waehle(FARBEN, rng) }) : neuesSpielObjekt("grand");
      const hand = sortiereSkatHand(deck.slice(0, 10), spiel);
      const sp = spitzen(hand, spiel);
      const w = spielwert(spiel, { spitzenAnzahl: sp.anzahl });
      const kand = [w.grund * (sp.anzahl), w.grund * (sp.anzahl + 2), w.grund * (sp.anzahl + 3), w.grund * Math.max(1, sp.anzahl - 1), w.grund * 2].filter((x) => x !== w.wert && x >= 18);
      return { typ, frage: `Sie möchten ${spielName(spiel, blatt)} spielen. Bis zu welchem Wert dürfen Sie reizen?`, spiel, karten: hand, antwort: "zahl", optionen: zahlOptionen(w.wert, rng, kand), richtig: w.wert,
        erklaerung: `${sp.mit ? "Mit" : "Ohne"} ${sp.anzahl}, Spiel ${sp.anzahl + 1}: ${sp.anzahl + 1} × ${w.grund} = ${w.wert}.` };
    }
    case "spielwert":
    default: {
      const spiel = neuesSpielObjekt(rng() < 0.7 ? "farbe" : "grand", { trumpf: waehle(FARBEN, rng), hand: rng() < 0.3 });
      const anzahl = 1 + zufall(spiel.art === "grand" ? 3 : 4, rng);
      const schneider = rng() < 0.3;
      const w = spielwert(spiel, { spitzenAnzahl: anzahl, schneider });
      const teile = [`mit ${anzahl}`, `Spiel ${anzahl + 1}`];
      let st = anzahl + 1;
      if (spiel.hand) teile.push(`Hand ${++st}`);
      if (schneider) teile.push(`Schneider ${++st}`);
      const kand = [w.grund * (st - 1), w.grund * (st + 1), (w.grund === 24 ? 12 : w.grund + 1) * st, w.grund * (st + 2)];
      const zustand = [`${spielName(spiel, blatt)}`, `mit ${anzahl} ${anzahl === 1 ? "Spitze" : "Spitzen"}`, schneider ? "gewonnen mit Schneider (90 Augen oder mehr)" : "gewonnen mit 75 Augen"].join(", ");
      return { typ, frage: `${zustand}. Wie viel ist das Spiel wert?`, spiel, karten: [], antwort: "zahl", optionen: zahlOptionen(w.wert, rng, kand), richtig: w.wert,
        erklaerung: `${teile.join(", ")}: ${st} × ${w.grund} = ${w.wert}.` };
    }
  }
}

/** Antwort prüfen. */
export function pruefeAntwort(aufgabe, antwort) {
  if (aufgabe.antwort === "karte") return aufgabe.richtig.includes(antwort);
  return antwort === aufgabe.richtig;
}

/* ================================================================ Oberfläche */

export default {
  id: "skatschule",
  bereich: "Kartenspiele",
  titel: "Skat-Schule",
  icon: "",
  anleitung: (stufe) => {
    const t = aufgabenTypen(stufe);
    const teile = [];
    if (t.includes("augen1") || t.includes("augenSumme")) teile.push("Augen zählen: Ass (Daus) 11, Zehn 10, König 4, Dame (Ober) 3, Bube (Unter) 2, die anderen 0");
    if (t.includes("trumpf")) teile.push("Trumpf erkennen");
    if (t.includes("stich")) teile.push("sagen, wer den Stich gewinnt");
    if (t.includes("bedienen")) teile.push("eine erlaubte Karte finden");
    if (t.includes("spitzen") || t.includes("reizwert") || t.includes("spielwert")) teile.push("Spitzen und Spielwerte berechnen");
    return `Kleine Skat-Aufgaben: ${teile.join(", ")}. Lassen Sie sich Zeit – es gibt kein Zeitlimit.`;
  },

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const blatt = settings?.blatt ?? "franzoesisch";
    kartenStyles();
    skatStyles();
    const runden = 10;
    const typen = aufgabenTypen(stufe);
    let richtig = 0;

    const zaehler = h("p.hinweis");
    const frageEl = h("p.hinweis.gross.sk-frage", { "aria-live": "polite" });
    const stichEl = h("div.sk-schule-stich");
    const platz = h("div.sk-schule-karten");
    const knoepfe = h("div.knopfreihe.sk-schule-knoepfe");
    const erklaerung = h("p.hinweis.sk-erklaerung", { "aria-live": "polite" });
    stage.append(h("div.sk-schule", {}, zaehler, frageEl, stichEl, platz, knoepfe, erklaerung));

    let letzterTyp = null;
    for (let r = 0; r < runden; r++) {
      if (!ctx.alive()) return null;
      let typ = typen[r % typen.length];
      if (typen.length > 1 && typ === letzterTyp) typ = typen[(r + 1) % typen.length];
      letzterTyp = typ;
      const a = erzeugeAufgabe(typ, stufe, Math.random, blatt);
      zaehler.textContent = `Aufgabe ${r + 1} von ${runden}`;
      frageEl.textContent = a.frage;
      erklaerung.textContent = "";
      stichEl.replaceChildren();
      if (a.stich) stichEl.append(h("span.sk-schule-label", { text: "Im Stich liegt:" }), ...a.stich.map((k) => karteElement(k)));
      platz.classList.toggle("sk-viele", a.karten.length > 5);
      knoepfe.replaceChildren();

      const antwort = await warteAufEingabe(ctx, (ende) => {
        if (a.antwort === "karte") {
          platz.replaceChildren(...a.karten.map((k) => {
            const el = karteElement(k, { tag: "button" });
            el.type = "button";
            el.onclick = debounced(() => ende(k.id));
            return el;
          }));
        } else {
          platz.replaceChildren(...a.karten.map((k) => karteElement(k)));
          const opts = a.antwort === "janein" ? [{ w: true, t: "Ja, Trumpf" }, { w: false, t: "Nein" }] : a.optionen.map((o) => ({ w: o, t: String(o) }));
          knoepfe.replaceChildren(...opts.map((o) => h("button.knopf.gross.sk-antwort", { type: "button", text: o.t, onclick: debounced(() => ende(o.w)) })));
        }
      }, () => {
        platz.querySelectorAll("button").forEach((b) => { b.onclick = null; b.disabled = true; });
        knoepfe.querySelectorAll("button").forEach((b) => { b.onclick = null; b.disabled = true; });
      });
      if (antwort == null || !ctx.alive()) return null;

      const ok = pruefeAntwort(a, antwort);
      if (ok) { richtig++; feedback(stage, "Richtig!", "gut"); }
      else feedback(stage, "Nicht ganz – schauen Sie hier", "neutral");
      // Lösung zeigen
      if (a.antwort === "karte") {
        platz.querySelectorAll("button.karte").forEach((b, i) => {
          if (a.richtig.includes(a.karten[i].id)) b.classList.add("sk-richtig");
          else b.classList.add("sk-blass");
        });
      } else {
        knoepfe.querySelectorAll("button").forEach((b, i) => {
          const opts = a.antwort === "janein" ? [true, false] : a.optionen;
          if (opts[i] === a.richtig) b.classList.add("sk-richtig");
        });
      }
      erklaerung.textContent = a.erklaerung;
      await sleep(ok ? 1800 : 3600);
      if (!ctx.alive()) return null;
    }
    const score = Math.round((richtig / runden) * 100) / 100;
    return { score, text: `${richtig} von ${runden} Skat-Aufgaben richtig.` };
  },
};

/** css/skat.css einmalig nachladen. */
export function skatStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-sk-styles], link[href$="css/skat.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/skat.css", import.meta.url).href;
  link.setAttribute("data-sk-styles", "");
  document.head.append(link);
}
