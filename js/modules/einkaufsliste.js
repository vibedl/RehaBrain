// Gedächtnis: Einkaufsliste merken – Artikel einprägen und später aus einer größeren Auswahl wiedererkennen
import { h, sleep, rand, pick, shuffle, feedback, debounced } from "../core/ui.js";

// ---------- Gemeinsame Helfer für die Gedächtnis-Module (auch von gesichter.js und alltag.js genutzt) ----------

/** Wartet auf eine Eingabe; löst bei Abbruch der Übung mit null auf. setup(fertig) baut die Bedienelemente. */
export function wartenAuf(ctx, setup) {
  return new Promise((resolve) => {
    let erledigt = false;
    const fertig = (wert) => {
      if (erledigt) return;
      erledigt = true;
      clearInterval(warte);
      resolve(wert);
    };
    const warte = setInterval(() => { if (!ctx.alive()) fertig(null); }, 300);
    setup(fertig);
  });
}

/** Ein großer Knopf „Weiter“ o. Ä.; löst mit true auf, bei Abbruch mit null */
export function weiterKnopf(ctx, parent, text = "Ich habe es mir gemerkt") {
  const reihe = h("div.knopfreihe");
  parent.append(reihe);
  return wartenAuf(ctx, (fertig) => {
    reihe.append(h("button.knopf.gross.primaer", { text, onclick: debounced(() => fertig(true)) }));
  }).then((w) => { reihe.remove(); return w; });
}

/**
 * Frage mit großen Antwortknöpfen. optionen: [{ inhalt: string|Node, wert, label? }]
 * Gibt den gewählten Wert zurück (null bei Abbruch). Der Knopf des richtigen Werts wird kurz markiert.
 */
export function frageAuswahl(ctx, parent, { frage, optionen, loesung, bild = null, klasse = "", nachWahl = null }) {
  const box = h("div.gd-frage");
  if (bild) box.append(bild);
  if (frage) box.append(h("p.hinweis.gross", { text: frage }));
  const reihe = h("div.knopfreihe.gd-antworten" + (klasse ? "." + klasse : ""));
  box.append(reihe);
  parent.append(box);
  return wartenAuf(ctx, (fertig) => {
    for (const o of optionen) {
      const knopf = h("button.knopf.gross.gd-antwort", { "aria-label": o.label ?? (typeof o.inhalt === "string" ? o.inhalt : undefined) }, o.inhalt);
      knopf.dataset.wert = String(o.wert);
      knopf.onclick = debounced(() => {
        reihe.querySelectorAll("button").forEach((b) => {
          b.disabled = true;
          if (loesung !== undefined && b.dataset.wert === String(loesung)) b.classList.add("gd-richtig");
        });
        knopf.classList.add("gd-gewaehlt");
        if (nachWahl) nachWahl(o.wert);
        fertig(o.wert);
      });
      reihe.append(knopf);
    }
  }).then(async (w) => {
    if (w != null) await sleep(loesung !== undefined && String(w) !== String(loesung) ? 1600 : 900);
    box.remove();
    return w;
  });
}

/** Einfache Rechenaufgabe als Ablenkung: Ergebnis 0–20, drei Antworten */
export function rechenaufgabe() {
  let a, b, plus = Math.random() < 0.6;
  if (plus) { a = 1 + rand(10); b = 1 + rand(10); } else { a = 5 + rand(15); b = 1 + rand(a); }
  const loesung = plus ? a + b : a - b;
  const optionen = new Set([loesung]);
  while (optionen.size < 3) {
    const d = pick([-2, -1, 1, 2, 3]);
    if (loesung + d >= 0) optionen.add(loesung + d);
  }
  return { text: `${a} ${plus ? "+" : "−"} ${b} = ?`, loesung, optionen: shuffle([...optionen]) };
}

/** Zwischenaufgabe: für etwa `sekunden` einfache Rechenaufgaben. Gibt true zurück, null bei Abbruch. */
export async function zwischenaufgabe(ctx, parent, sekunden) {
  const box = h("div.gd-zwischen");
  box.append(h("p.hinweis", { text: "Zwischendurch etwas rechnen – danach geht es weiter." }));
  parent.append(box);
  const ende = performance.now() + sekunden * 1000;
  while (performance.now() < ende) {
    const aufgabe = rechenaufgabe();
    const w = await frageAuswahl(ctx, box, {
      frage: aufgabe.text,
      loesung: aufgabe.loesung,
      optionen: aufgabe.optionen.map((z) => ({ inhalt: String(z), wert: z })),
    });
    if (w == null || !ctx.alive()) { box.remove(); return null; }
  }
  box.remove();
  return true;
}

// ---------- Artikel ----------
const F = (farbe) => `fill="var(--gd-${farbe})"`;
const svg = (inner) =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ARTIKEL = [
  // Backwaren
  { name: "Brot", gruppe: "backwaren", svg: `<path d="M8 44 Q8 20 32 20 Q56 20 56 44 V50 H8Z" ${F("hellbraun")}/><path d="M20 28l4 8M31 25l4 8M42 28l4 8"/>` },
  { name: "Brötchen", gruppe: "backwaren", svg: `<ellipse cx="32" cy="38" rx="22" ry="14" ${F("hellbraun")}/><path d="M20 34 Q32 42 44 34"/>` },
  { name: "Brezel", gruppe: "backwaren", svg: `<path d="M21 50 C4 42 8 14 26 18 C38 21 36 40 24 46 M43 50 C60 42 56 14 38 18 C26 21 28 40 40 46 M20 50 L44 50" stroke="var(--gd-braun)" stroke-width="6"/>` },
  { name: "Kuchen", gruppe: "backwaren", svg: `<path d="M10 42 L50 24 L54 42Z" ${F("gelbhell")}/><path d="M10 42 V52 H54 V42Z" ${F("hellbraun")}/><circle cx="46" cy="22" r="5" ${F("rot")}/>` },
  // Kühlregal
  { name: "Milch", gruppe: "kuehl", svg: `<path d="M20 22 L26 10 H38 L44 22 V56 H20Z" ${F("weiss")}/><path d="M20 22 H44"/><rect x="25" y="32" width="14" height="12" rx="2" ${F("blauhell")}/>` },
  { name: "Käse", gruppe: "kuehl", svg: `<path d="M8 46 L40 20 L56 30 V50 H8Z" ${F("gelb")}/><path d="M8 46 H56"/><circle cx="22" cy="41" r="2.5"/><circle cx="36" cy="36" r="3"/><circle cx="46" cy="43" r="2.5"/>` },
  { name: "Joghurt", gruppe: "kuehl", svg: `<path d="M16 22 H48 L44 56 H20Z" ${F("weiss")}/><rect x="13" y="15" width="38" height="7" rx="2" ${F("rosa")}/><path d="M24 36 Q32 30 40 36"/>` },
  { name: "Butter", gruppe: "kuehl", svg: `<path d="M8 30 L20 22 H56 L44 30Z" ${F("gelbhell")}/><path d="M8 30 H44 V46 H8Z" ${F("gelbhell")}/><path d="M44 30 L56 22 V38 L44 46Z" ${F("gelb")}/>` },
  { name: "Eier", gruppe: "kuehl", svg: `<ellipse cx="23" cy="36" rx="11" ry="15" ${F("weiss")}/><ellipse cx="42" cy="39" rx="10" ry="13" ${F("hellbraun")}/>` },
  { name: "Fisch", gruppe: "kuehl", svg: `<path d="M6 32 Q24 12 44 32 Q24 52 6 32Z" ${F("blauhell")}/><path d="M44 32 L58 20 V44Z" ${F("blauhell")}/><circle cx="16" cy="30" r="1.5" fill="currentColor"/>` },
  { name: "Wurst", gruppe: "kuehl", svg: `<path d="M8 36 C10 22 24 20 34 22 C48 24 58 34 56 44 C54 50 48 48 46 44 C42 34 30 32 18 38 C12 42 8 42 8 36Z" ${F("wurst")}/><path d="M56 44 L60 48M8 36 L4 34"/>` },
  // Obst
  { name: "Apfel", gruppe: "obst", svg: `<path d="M32 22 C20 14 8 24 12 40 C16 54 28 56 32 52 C36 56 48 54 52 40 C56 24 44 14 32 22Z" ${F("rot")}/><path d="M32 22 V12"/><path d="M33 15 Q40 7 47 11 Q41 18 33 15Z" ${F("gruen")}/>` },
  { name: "Birne", gruppe: "obst", svg: `<path d="M32 14 C26 14 26 26 22 32 C12 42 18 57 32 57 C46 57 52 42 42 32 C38 26 38 14 32 14Z" ${F("gruenhell")}/><path d="M32 14 L34 6"/>` },
  { name: "Banane", gruppe: "obst", svg: `<path d="M12 16 Q12 52 52 48 Q58 46 55 41 Q22 42 20 14Z" ${F("gelb")}/><path d="M12 16 L18 12"/>` },
  { name: "Orange", gruppe: "obst", svg: `<circle cx="32" cy="36" r="20" ${F("orange")}/><path d="M32 16 Q38 8 44 10 Q40 17 32 16Z" ${F("gruen")}/><circle cx="26" cy="32" r="0.8"/><circle cx="38" cy="40" r="0.8"/><circle cx="30" cy="46" r="0.8"/>` },
  { name: "Zitrone", gruppe: "obst", svg: `<ellipse cx="32" cy="34" rx="22" ry="15" ${F("gelb")}/><path d="M10 34 H5M54 34 H59"/>` },
  { name: "Kirschen", gruppe: "obst", svg: `<path d="M22 40 Q24 22 36 10 M42 38 Q40 22 36 10"/><path d="M36 10 Q48 6 52 14 Q44 18 36 10Z" ${F("gruen")}/><circle cx="21" cy="47" r="9" ${F("rot")}/><circle cx="43" cy="45" r="9" ${F("rot")}/>` },
  { name: "Weintrauben", gruppe: "obst", svg: `<path d="M32 16 V6"/><g ${F("lila")}><circle cx="25" cy="22" r="6"/><circle cx="39" cy="22" r="6"/><circle cx="19" cy="33" r="6"/><circle cx="32" cy="33" r="6"/><circle cx="45" cy="33" r="6"/><circle cx="25" cy="44" r="6"/><circle cx="39" cy="44" r="6"/><circle cx="32" cy="54" r="6"/></g>` },
  // Gemüse
  { name: "Karotte", gruppe: "gemuese", svg: `<path d="M46 20 C52 26 48 32 44 34 L12 56 L34 24 C38 20 42 18 46 20Z" ${F("orange")}/><path d="M46 20 L52 8 M48 22 L60 16 M44 19 L42 8" stroke="var(--gd-gruen)" stroke-width="3.5"/><path d="M30 34 l5 3 M24 43 l4 3"/>` },
  { name: "Tomate", gruppe: "gemuese", svg: `<circle cx="32" cy="38" r="20" ${F("rot")}/><path d="M22 20 L32 24 L42 20 M32 24 V13" stroke="var(--gd-gruen)" stroke-width="3.5"/>` },
  { name: "Gurke", gruppe: "gemuese", svg: `<rect x="6" y="24" width="52" height="17" rx="8.5" ${F("gruen")}/><circle cx="20" cy="32" r="0.8"/><circle cx="32" cy="30" r="0.8"/><circle cx="44" cy="33" r="0.8"/>` },
  { name: "Kartoffel", gruppe: "gemuese", svg: `<path d="M10 36 C8 24 24 18 36 20 C50 22 58 30 54 40 C50 50 30 53 20 49 C13 46 10 42 10 36Z" ${F("hellbraun")}/><circle cx="24" cy="32" r="1.2" fill="currentColor"/><circle cx="40" cy="30" r="1.2" fill="currentColor"/><circle cx="34" cy="42" r="1.2" fill="currentColor"/>` },
  { name: "Zwiebel", gruppe: "gemuese", svg: `<path d="M32 10 C28 22 12 28 14 42 C16 56 48 56 50 42 C52 28 36 22 32 10Z" ${F("zwiebel")}/><path d="M32 18 Q24 34 29 54 M32 18 Q40 34 35 54"/>` },
  { name: "Paprika", gruppe: "gemuese", svg: `<path d="M18 24 C9 30 11 53 22 55 C27 57 30 53 32 53 C34 53 37 57 42 55 C53 53 55 30 46 24 C40 20 24 20 18 24Z" ${F("rot")}/><path d="M32 22 Q31 14 36 10" stroke="var(--gd-gruen)" stroke-width="4"/>` },
  { name: "Salat", gruppe: "gemuese", svg: `<circle cx="32" cy="36" r="21" ${F("gruenhell")}/><path d="M32 57 V22 M32 44 L20 31 M32 38 L44 26 M32 50 L46 40"/>` },
  // Getränke
  { name: "Wasser", gruppe: "getraenke", svg: `<path d="M26 6 H38 V14 Q46 20 46 28 V58 H18 V28 Q18 20 26 14Z" ${F("blauhell")}/><path d="M18 38 Q25 34 32 38 T46 38"/>` },
  { name: "Saft", gruppe: "getraenke", svg: `<path d="M18 18 H46 L42 58 H22Z" ${F("orange")}/><path d="M36 18 L44 4"/><path d="M19 26 H45"/>` },
  { name: "Kaffee", gruppe: "getraenke", svg: `<path d="M10 28 H44 V42 Q44 56 27 56 Q10 56 10 42Z" ${F("braun")}/><path d="M44 32 Q54 32 54 39 Q54 46 44 46"/><path d="M20 20 Q16 14 20 8 M30 20 Q26 14 30 8"/>` },
  { name: "Tee", gruppe: "getraenke", svg: `<path d="M32 30 V16 L40 10"/><rect x="36" y="4" width="12" height="9" rx="1" ${F("weiss")}/><rect x="18" y="30" width="28" height="26" rx="3" ${F("gruenhell")}/><path d="M24 38 H40"/>` },
  // Vorrat
  { name: "Nudeln", gruppe: "vorrat", svg: `<path d="M8 20 L28 32 L8 44Z" ${F("gelbhell")}/><path d="M56 20 L36 32 L56 44Z" ${F("gelbhell")}/><rect x="27" y="27" width="10" height="10" rx="2" ${F("gelb")}/>` },
  { name: "Reis", gruppe: "vorrat", svg: `<path d="M16 16 H48 L52 58 H12Z" ${F("weiss")}/><path d="M16 16 Q32 24 48 16"/><g fill="currentColor" stroke="none"><ellipse cx="26" cy="38" rx="2.5" ry="1.2"/><ellipse cx="34" cy="44" rx="2.5" ry="1.2"/><ellipse cx="40" cy="36" rx="2.5" ry="1.2"/><ellipse cx="30" cy="50" rx="2.5" ry="1.2"/></g>` },
  { name: "Mehl", gruppe: "vorrat", svg: `<path d="M16 12 H48 V58 H16Z" ${F("weiss")}/><path d="M16 22 H48"/><path d="M32 52 V32 M32 38 l-5-4 M32 38 l5-4 M32 45 l-5-4 M32 45 l5-4" stroke="var(--gd-hellbraun)" stroke-width="3"/>` },
  { name: "Zucker", gruppe: "vorrat", svg: `<rect x="10" y="34" width="20" height="20" rx="2" ${F("weiss")}/><rect x="34" y="34" width="20" height="20" rx="2" ${F("weiss")}/><rect x="22" y="12" width="20" height="20" rx="2" ${F("weiss")}/>` },
  { name: "Honig", gruppe: "vorrat", svg: `<rect x="15" y="22" width="34" height="34" rx="7" ${F("honig")}/><rect x="13" y="13" width="38" height="10" rx="2" ${F("braun")}/><path d="M32 32 l6 3.5 v7 l-6 3.5 l-6 -3.5 v-7Z"/>` },
  { name: "Marmelade", gruppe: "vorrat", svg: `<rect x="15" y="22" width="34" height="34" rx="4" ${F("rot")}/><path d="M11 14 H53 L49 23 H15Z" ${F("weiss")}/><rect x="21" y="32" width="22" height="14" rx="2" ${F("weiss")}/>` },
  { name: "Schokolade", gruppe: "vorrat", svg: `<rect x="14" y="8" width="36" height="48" rx="3" ${F("braun")}/><path d="M14 20 H50 M14 32 H50 M14 44 H50 M26 8 V56 M38 8 V56"/>` },
];

export const artikelSvg = (artikel) => svg(artikel.svg);

// ---------- Logik ----------

/** Schwierigkeit je Stufe 1–20 */
export function stufenParameter(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  const laenge = 3 + Math.round(((s - 1) * 7) / 19); // 3 … 10
  return {
    laenge,
    nacheinander: s >= 12,                          // ab Stufe 12 einzeln statt als ganze Liste
    anzeigeMs: Math.max(1800, 3200 - s * 60),       // nur bei „nacheinander“
    pauseSek: s < 6 ? 0 : s < 12 ? 15 : 20,          // Ablenkung vor dem Wiedererkennen
    optionen: Math.min(18, laenge * 2 + (s >= 10 ? 2 : 0)),
    aehnlich: s <= 5 ? 0 : Math.min(1, (s - 5) / 13), // Anteil Ablenker aus denselben Warengruppen
    runden: s < 6 ? 3 : 2,
  };
}

/** Liste und Auswahl (Liste + Ablenker) für eine Runde */
export function erzeugeRunde(stufe, artikel = ARTIKEL) {
  const p = stufenParameter(stufe);
  const liste = shuffle(artikel).slice(0, p.laenge);
  const rest = artikel.filter((a) => !liste.includes(a));
  const gruppen = new Set(liste.map((a) => a.gruppe));
  const nAblenker = p.optionen - p.laenge;
  const aehnlich = shuffle(rest.filter((a) => gruppen.has(a.gruppe)));
  const fremd = shuffle(rest.filter((a) => !gruppen.has(a.gruppe)));
  const nAehnlich = Math.min(aehnlich.length, Math.round(nAblenker * p.aehnlich));
  let ablenker = aehnlich.slice(0, nAehnlich);
  ablenker = ablenker.concat(fremd.slice(0, nAblenker - ablenker.length));
  if (ablenker.length < nAblenker) ablenker = ablenker.concat(aehnlich.slice(nAehnlich, nAehnlich + nAblenker - ablenker.length));
  return { liste, ablenker, optionen: shuffle([...liste, ...ablenker]), parameter: p };
}

/** Auswertung: Treffer minus Fehlalarme, bezogen auf die Listenlänge (0–1) */
export function bewerteAuswahl(liste, gewaehlt) {
  const namen = new Set(liste.map((a) => a.name ?? a));
  const auswahl = new Set(gewaehlt.map((a) => a.name ?? a));
  let treffer = 0, fehl = 0;
  for (const n of auswahl) (namen.has(n) ? treffer++ : fehl++);
  const punkte = Math.max(0, (treffer - fehl) / namen.size);
  return { treffer, fehl, vergessen: namen.size - treffer, punkte };
}

// ---------- Modul ----------

const artikelKachel = (a, tag = "div") =>
  h(`${tag}.gd-liste-artikel`, {}, h("span.gd-liste-bild", { html: artikelSvg(a) }), h("span.gd-liste-name", { text: a.name }));

export default {
  id: "einkaufsliste",
  bereich: "Gedächtnis",
  titel: "Einkaufsliste",
  icon: "",
  anleitung: (stufe) => {
    const p = stufenParameter(stufe);
    return (p.nacheinander
      ? "Die Artikel einer Einkaufsliste erscheinen nacheinander. Merken Sie sich alle."
      : "Sie sehen eine Einkaufsliste. Merken Sie sich die Artikel in Ruhe.")
      + (p.pauseSek ? " Nach einer kurzen Rechenaufgabe" : " Danach")
      + " tippen Sie alle Artikel an, die auf der Liste standen.";
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = stufenParameter(stufe);
    const hinweis = h("p.hinweis");
    const flaeche = h("div.gd-liste-flaeche");
    stage.append(hinweis, flaeche);
    let summe = 0, treffer = 0, gesamt = 0;

    for (let r = 0; r < p.runden; r++) {
      if (!ctx.alive()) return null;
      const runde = erzeugeRunde(stufe);
      flaeche.replaceChildren();

      // Phase 1: einprägen
      hinweis.textContent = `Runde ${r + 1} von ${p.runden} – merken Sie sich die Einkaufsliste`;
      if (p.nacheinander) {
        await sleep(900);
        for (const a of runde.liste) {
          if (!ctx.alive()) return null;
          flaeche.replaceChildren(h("div.gd-liste-einzeln", {}, artikelKachel(a)));
          ctx.speak(a.name);
          await sleep(p.anzeigeMs);
          flaeche.replaceChildren();
          await sleep(300);
        }
      } else {
        flaeche.append(h("div.gd-liste-zettel", {}, runde.liste.map((a) => artikelKachel(a))));
        ctx.speak(runde.liste.map((a) => a.name).join(", "));
        if ((await weiterKnopf(ctx, flaeche)) == null) return null;
        flaeche.replaceChildren();
      }
      if (!ctx.alive()) return null;

      // Pause mit Ablenkung
      if (p.pauseSek) {
        hinweis.textContent = "Kurz etwas anderes";
        if ((await zwischenaufgabe(ctx, flaeche, p.pauseSek)) == null) return null;
      } else {
        await sleep(1200);
      }
      if (!ctx.alive()) return null;

      // Phase 2: wiedererkennen
      hinweis.textContent = "Tippen Sie alle Artikel an, die auf der Liste standen. Dann auf „Fertig“.";
      const gewaehlt = new Set();
      const knoepfe = runde.optionen.map((a) => {
        const k = artikelKachel(a, "button");
        k.setAttribute("aria-pressed", "false");
        k.onclick = debounced(() => {
          if (gewaehlt.has(a)) gewaehlt.delete(a); else gewaehlt.add(a);
          k.setAttribute("aria-pressed", String(gewaehlt.has(a)));
          k.classList.toggle("gd-liste-an", gewaehlt.has(a));
        });
        return k;
      });
      const raster = h("div.gd-liste-raster", {}, knoepfe);
      const reihe = h("div.knopfreihe");
      flaeche.append(raster, reihe);
      const ok = await wartenAuf(ctx, (fertig) => {
        reihe.append(h("button.knopf.gross.primaer", { text: "Fertig", onclick: debounced(() => fertig(true)) }));
      });
      if (ok == null) return null;
      reihe.remove();
      knoepfe.forEach((k) => { k.onclick = null; k.disabled = true; });

      const e = bewerteAuswahl(runde.liste, [...gewaehlt]);
      summe += e.punkte; treffer += e.treffer; gesamt += runde.liste.length;
      runde.optionen.forEach((a, i) => {
        if (runde.liste.includes(a)) knoepfe[i].classList.add(gewaehlt.has(a) ? "gd-liste-getroffen" : "gd-liste-vergessen");
      });
      hinweis.textContent = "Eingerahmt: die Artikel, die auf der Liste standen";
      if (e.vergessen === 0 && e.fehl === 0) feedback(stage, "Alles richtig!", "gut");
      else feedback(stage, `${e.treffer} von ${runde.liste.length} erkannt`, e.punkte >= 0.8 ? "gut" : "neutral");
      await wartenAuf(ctx, (fertig) => { flaeche.append(h("div.knopfreihe", {}, h("button.knopf.gross", { text: "Weiter", onclick: debounced(() => fertig(true)) }))); });
    }
    if (!ctx.alive()) return null;
    return {
      score: summe / p.runden,
      text: `${treffer} von ${gesamt} Artikeln wiedererkannt (Listen mit je ${p.laenge} Artikeln).`,
    };
  },
};
