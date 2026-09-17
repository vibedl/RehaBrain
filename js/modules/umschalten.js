// Aufmerksamkeit: Blick wechseln (Aufmerksamkeitswechsel / Task-Switching)
// Links eine Zahl (gerade oder ungerade?), rechts ein Buchstabe (Vokal oder Konsonant?).
// Ein Hinweis zeigt, welches Feld gerade zählt. Geantwortet wird mit den Knöpfen unter diesem Feld.
import { h, sleep, debounced, feedback } from "../core/ui.js";
import { median } from "./wachheit.js";

// ---------- Reine Logik (testbar) ----------

export const VOKALE = ["A", "E", "I", "O", "U"];
export const KONSONANTEN = ["B", "D", "F", "G", "K", "L", "M", "N", "P", "R", "S", "T"];

/** Schwierigkeit je Stufe 1–20 */
export function umschaltParameter(stufe) {
  const s = Math.max(1, Math.min(20, Math.round(stufe)));
  return {
    anzahl: s <= 5 ? 20 : s <= 12 ? 28 : 36,
    // Wechsel: erst lange, dann kurze feste Folgen, später zufällig
    wechsel: s <= 4 ? "bloecke4" : s <= 9 ? "bloecke2" : "zufall",
    wechselWkt: s <= 9 ? null : Math.min(0.6, 0.35 + (s - 10) * 0.03),
    beideZeigen: s >= 5,                                       // im anderen Feld steht auch etwas
    hinweisMs: s <= 11 ? null : Math.max(500, 1500 - (s - 12) * 120), // Hinweis nur kurz sichtbar
    zeitLimit: s <= 3 ? null : Math.max(2500, 9000 - s * 330),        // ms je Aufgabe
    nochmal: s <= 5,                                           // Tipp ins falsche Feld darf korrigiert werden
  };
}

/** Aufgabenfolge: [{ aufgabe: "zahl"|"buchstabe", zahl, buchstabe, wechsel }] */
export function planeUmschalten(p, rng = Math.random) {
  const pickR = (arr) => arr[Math.floor(rng() * arr.length)];
  const folge = [];
  let aufgabe = rng() < 0.5 ? "zahl" : "buchstabe";
  let lauf = 0;
  for (let i = 0; i < p.anzahl; i++) {
    if (i > 0) {
      let wechseln;
      if (p.wechsel === "bloecke4") wechseln = lauf >= 4;
      else if (p.wechsel === "bloecke2") wechseln = lauf >= 2;
      else wechseln = lauf >= 4 || (lauf >= 1 && rng() < p.wechselWkt);
      if (wechseln) { aufgabe = aufgabe === "zahl" ? "buchstabe" : "zahl"; lauf = 0; }
    }
    lauf++;
    const vorher = folge[i - 1];
    let zahl, buchstabe;
    // Antworten ungefähr ausgewogen, aber nie dasselbe Zeichen zweimal hintereinander
    do { zahl = 1 + Math.floor(rng() * 9); } while (vorher && zahl === vorher.zahl);
    do { buchstabe = rng() < 0.5 ? pickR(VOKALE) : pickR(KONSONANTEN); } while (vorher && buchstabe === vorher.buchstabe);
    folge.push({ aufgabe, zahl, buchstabe, wechsel: i > 0 && aufgabe !== vorher.aufgabe });
  }
  return folge;
}

export function richtigeAntwort(item) {
  if (item.aufgabe === "zahl") return item.zahl % 2 === 0 ? "gerade" : "ungerade";
  return VOKALE.includes(item.buchstabe) ? "vokal" : "konsonant";
}

/**
 * Auswertung. antworten: [{ item, antwort: string|null, rt: ms|null, falschesFeld: bool }]
 * Wechselkosten = Median-Zeit bei Wechsel minus bei Wiederholung (nur richtige Antworten).
 */
export function auswertenUmschalten(antworten) {
  const gruppe = (wechsel) => {
    const a = antworten.filter((x) => x.item.wechsel === wechsel);
    const ok = a.filter((x) => x.antwort === richtigeAntwort(x.item));
    return { n: a.length, richtig: ok.length, median: median(ok.map((x) => x.rt).filter((v) => v != null)) };
  };
  const richtig = antworten.filter((x) => x.antwort === richtigeAntwort(x.item)).length;
  const wechsel = gruppe(true), wiederhol = gruppe(false);
  return {
    gesamt: antworten.length, richtig,
    falschesFeld: antworten.filter((x) => x.falschesFeld).length,
    zuLangsam: antworten.filter((x) => x.antwort == null && !x.falschesFeld).length,
    wechsel, wiederhol,
    wechselKosten: wechsel.median != null && wiederhol.median != null ? wechsel.median - wiederhol.median : null,
    score: antworten.length ? richtig / antworten.length : 0,
  };
}

// ---------- Darstellung ----------

const FELDER = {
  zahl: { titel: "Zahl", frage: "gerade oder ungerade?", antworten: [["gerade", "gerade"], ["ungerade", "ungerade"]] },
  buchstabe: { titel: "Buchstabe", frage: "Vokal oder Konsonant?", antworten: [["vokal", "Vokal"], ["konsonant", "Konsonant"]] },
};

export default {
  id: "umschalten",
  bereich: "Aufmerksamkeit",
  titel: "Blick wechseln",
  icon: "",
  anleitung: (stufe) => {
    const p = umschaltParameter(stufe);
    return "Links steht eine Zahl, rechts ein Buchstabe. Der Rahmen zeigt, welches Feld gerade zählt – antworten Sie mit den Knöpfen unter diesem Feld."
      + (p.hinweisMs ? " Der Rahmen leuchtet nur kurz auf, merken Sie sich die Seite." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = umschaltParameter(stufe);
    const folge = planeUmschalten(p);
    const antworten = [];

    const info = h("p.hinweis", { text: "Gleich geht es los …" });
    const bereiche = {};
    const feld = h("div.au-um-feld");
    for (const key of ["zahl", "buchstabe"]) {
      const f = FELDER[key];
      const zeichen = h("div.au-um-zeichen", { text: "" });
      const knoepfe = f.antworten.map(([wert, label]) => {
        const k = h("button.knopf.gross.au-um-antwort", { text: label });
        k.dataset.wert = wert;
        return k;
      });
      const el = h("section.au-um-bereich", { "data-feld": key },
        h("span.au-um-jetzt", { text: "Jetzt hier" }),
        h("h2.au-um-titel", { text: f.titel }),
        h("p.au-um-frage", { text: f.frage }),
        zeichen,
        h("div.au-um-knoepfe", {}, knoepfe));
      bereiche[key] = { el, zeichen, knoepfe };
      feld.append(el);
    }
    stage.append(info, feld);

    let offen = null; // { item, start, resolve, falschesFeld }
    for (const key of ["zahl", "buchstabe"]) {
      for (const k of bereiche[key].knoepfe) {
        k.onclick = debounced(() => {
          if (!offen) return;
          if (key !== offen.item.aufgabe) {
            offen.falschesFeld = true;
            feedback(stage, `Gerade zählt das Feld „${FELDER[offen.item.aufgabe].titel}“`, "neutral");
            if (!p.nochmal) offen.resolve({ antwort: "falsches-feld", rt: performance.now() - offen.start });
            return;
          }
          offen.resolve({ antwort: k.dataset.wert, rt: performance.now() - offen.start });
        });
      }
    }

    const warte = async (ms) => {
      const ende = performance.now() + ms;
      while (performance.now() < ende) { if (!ctx.alive()) return false; await sleep(Math.min(50, ende - performance.now())); }
      return ctx.alive();
    };

    try {
      if (!(await warte(1500))) return null;
      for (let i = 0; i < folge.length; i++) {
        const item = folge[i];
        info.textContent = `Aufgabe ${i + 1} von ${folge.length}`;
        feld.dataset.aktiv = item.aufgabe;
        feld.classList.remove("au-um-ohne-hinweis");
        for (const key of ["zahl", "buchstabe"]) {
          const zeigen = key === item.aufgabe || p.beideZeigen;
          bereiche[key].zeichen.textContent = zeigen ? (key === "zahl" ? String(item.zahl) : item.buchstabe) : "";
        }
        let hinweisTimer = null;
        if (p.hinweisMs) hinweisTimer = setTimeout(() => feld.classList.add("au-um-ohne-hinweis"), p.hinweisMs);

        const start = performance.now();
        const ergebnis = await new Promise((resolve) => {
          let fertig = false;
          const zu = (w) => {
            if (fertig) return;
            fertig = true; clearInterval(iv);
            const ff = offen?.falschesFeld ?? false;
            offen = null;
            resolve(w && { ...w, falschesFeld: ff || w.antwort === "falsches-feld" });
          };
          offen = { item, start, resolve: zu, falschesFeld: false };
          const iv = setInterval(() => {
            if (!ctx.alive()) zu(null);
            else if (p.zeitLimit && performance.now() - start > p.zeitLimit) zu({ antwort: null, rt: null });
          }, 50);
        });
        clearTimeout(hinweisTimer);
        if (!ergebnis || !ctx.alive()) return null;

        const eintrag = { item, antwort: ergebnis.antwort === "falsches-feld" ? null : ergebnis.antwort, rt: ergebnis.rt, falschesFeld: ergebnis.falschesFeld };
        antworten.push(eintrag);
        if (eintrag.antwort == null && !eintrag.falschesFeld) feedback(stage, "Etwas zu langsam – weiter geht's", "neutral");
        else if (eintrag.antwort === richtigeAntwort(item)) {
          const k = bereiche[item.aufgabe].knoepfe.find((b) => b.dataset.wert === eintrag.antwort);
          k.classList.add("au-um-ok");
          setTimeout(() => k.classList.remove("au-um-ok"), 450);
        } else if (eintrag.antwort != null) {
          feedback(stage, item.aufgabe === "zahl" ? `${item.zahl} ist ${richtigeAntwort(item)}` : `${item.buchstabe} ist ein ${richtigeAntwort(item) === "vokal" ? "Vokal" : "Konsonant"}`, "neutral");
        }
        feld.dataset.aktiv = "";
        bereiche.zahl.zeichen.textContent = ""; bereiche.buchstabe.zeichen.textContent = "";
        if (!(await warte(eintrag.antwort === richtigeAntwort(item) ? 450 : 1100))) return null;
      }
    } finally {
      offen = null;
      for (const key of ["zahl", "buchstabe"]) bereiche[key].knoepfe.forEach((k) => { k.onclick = null; });
    }
    if (!ctx.alive()) return null;

    const e = auswertenUmschalten(antworten);
    let text = `${e.richtig} von ${e.gesamt} Aufgaben richtig.`;
    if (e.wechselKosten != null) {
      text += e.wechselKosten > 150
        ? ` Nach einem Wechsel brauchten Sie etwa ${Math.round(e.wechselKosten / 100) / 10} Sekunden länger – das ist beim Umschalten ganz normal.`
        : " Beim Umschalten waren Sie kaum langsamer als sonst.";
    }
    return { score: e.score, text };
  },
};
