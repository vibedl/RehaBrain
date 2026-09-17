// Beruf & Alltag: Tag planen – Termine und Erledigungen mit Bedingungen (Öffnungszeiten, Wege,
// Pausen, Tabletten-Zeiten) in einen Tagesplan einsetzen; Konflikte erkennen; Überraschungsänderung.
import { h, sleep, rand, pick, shuffle, feedback, onTap, debounced } from "../core/ui.js";

const START = 7 * 60, ENDE = 20 * 60; // Tagesfenster in Minuten
const uhrzeit = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const raster = (min, schritt) => Math.round(min / schritt) * schritt;

// ---------- Aufgaben-Vorlagen ----------
const AUFGABEN_POOL = [
  { titel: "Physiotherapie", ort: "Physiotherapie Ahorn", dauer: 45, oeffnet: [8 * 60, 18 * 60], fest: true },
  { titel: "Rezept in der Apotheke abholen", ort: "Apotheke am Markt", dauer: 15, oeffnet: [8 * 60, 18 * 60 + 30] },
  { titel: "Geld abheben", ort: "Sparkasse Lindenau", dauer: 15, oeffnet: [9 * 60, 16 * 60] },
  { titel: "Einkaufen", ort: "Supermarkt Frisch & Nah", dauer: 30, oeffnet: [7 * 60, 20 * 60] },
  { titel: "Päckchen aufgeben", ort: "Post-Filiale", dauer: 15, oeffnet: [8 * 60, 17 * 60] },
  { titel: "Ausweis abholen", ort: "Bürgeramt", dauer: 20, oeffnet: [8 * 60, 12 * 60] },
  { titel: "Arzttermin", ort: "Praxis Dr. Sommer", dauer: 30, oeffnet: [8 * 60, 17 * 60], fest: true },
  { titel: "Wäsche aufhängen", ort: "zu Hause", dauer: 15, oeffnet: [START, ENDE] },
  { titel: "Telefonat mit dem Büro", ort: "zu Hause", dauer: 20, oeffnet: [9 * 60, 17 * 60] },
  { titel: "Mittagessen", ort: "zu Hause", dauer: 30, oeffnet: [11 * 60 + 30, 14 * 60] },
];

/** Deterministische, plausible Wegzeit zwischen zwei Orten (8–27 Minuten, 0 wenn gleicher Ort) */
function wegzeitZwischen(a, b) {
  if (a === b) return 0;
  let hash = 0;
  for (const c of [a, b].sort().join("|")) hash = (hash * 31 + c.charCodeAt(0)) % 997;
  return raster(8 + (hash % 20), 5);
}

/** Schwierigkeit je Stufe */
export function tagesplanStufe(stufe) {
  const s = Math.max(1, Math.min(20, stufe));
  return {
    anzahl: s <= 3 ? 3 : s <= 7 ? 4 : s <= 12 ? 5 : s <= 16 ? 6 : 7,
    wegzeiten: s >= 5,           // Wegzeiten zwischen Orten berücksichtigen
    pausen: s >= 8,              // Mittagspause muss eingehalten werden
    tabletten: s >= 11,          // Tabletten-Erinnerungen im Plan sichtbar
    ueberraschung: s >= 14,      // mitten in der Planung ändert sich etwas
    rasterMin: s <= 6 ? 30 : 15,
  };
}

/** Baut EINE gültige Reihenfolge/Belegung für die gegebenen Aufgaben (Greedy, first-fit, zufällige Bauordnung).
 *  Gibt bei Erfolg die Liste {id, zeit} zurück, sonst null. */
function konstruiere(tasks, p, zufall = rand) {
  const platziert = []; // {id, zeit, dauer, ort}
  const bauordnung = shuffle(tasks);
  for (const task of bauordnung) {
    let gefunden = null;
    for (let t = raster(task.oeffnet[0], p.rasterMin); t + task.dauer <= Math.min(task.oeffnet[1], ENDE); t += p.rasterMin) {
      const probe = [...platziert, { id: task.id, zeit: t, dauer: task.dauer, ort: task.ort }].sort((a, b) => a.zeit - b.zeit);
      let ok = true;
      for (let i = 1; i < probe.length; i++) {
        const luecke = probe[i].zeit - (probe[i - 1].zeit + probe[i - 1].dauer);
        if (luecke < 0) { ok = false; break; }
        if (p.wegzeiten && luecke < wegzeitZwischen(probe[i - 1].ort, probe[i].ort)) { ok = false; break; }
      }
      if (ok) { gefunden = t; break; }
    }
    if (gefunden == null) return null;
    platziert.push({ id: task.id, zeit: gefunden, dauer: task.dauer, ort: task.ort });
  }
  return platziert.sort((a, b) => a.zeit - b.zeit);
}

/** Eine Tagesplan-Aufgabe erzeugen: wählt Erledigungen, konstruiert einen nachweislich gültigen Plan
 *  und übernimmt dessen Zeiten für die "festen" Termine. */
export function erstelleTagesplan(stufe) {
  const p = tagesplanStufe(stufe);
  for (let versuch = 0; versuch < 500; versuch++) {
    const pool = shuffle(AUFGABEN_POOL);
    let auswahl = pool.slice(0, p.anzahl).map((a, i) => ({ ...a, id: i }));
    if (p.pausen && !auswahl.some((a) => a.titel === "Mittagessen")) {
      const mittag = AUFGABEN_POOL.find((a) => a.titel === "Mittagessen");
      auswahl = [{ ...mittag, id: auswahl.length }, ...auswahl.slice(0, -1)];
    }
    const loesung = konstruiere(auswahl, p);
    if (!loesung) continue;
    // "fest" Termine bekommen ihre konstruierte Zeit fix zugewiesen; Rest bleibt frei wählbar
    const zeitVon = new Map(loesung.map((x) => [x.id, x.zeit]));
    const gewaehlt = auswahl.map((a) => (a.fest ? { ...a, zeit: zeitVon.get(a.id) } : a));
    const tabletten = p.tabletten ? [10 * 60, 16 * 60] : [];
    const ueberraschung = p.ueberraschung && rand(2)
      ? { text: pick([
          "Die Physiotherapie ruft an: Ihr Termin verschiebt sich um eine Stunde nach hinten.",
          "Ein Nachbar bittet Sie kurzfristig, seine Pakete von der Post abzuholen – das dauert jetzt länger als gedacht.",
          "Die Sparkasse hat heute wegen einer Systemumstellung früher geschlossen.",
        ]) }
      : null;
    return { gewaehlt, loesung, tabletten, ueberraschung, stufe, p };
  }
  throw new Error("Tagesplan-Aufgabe konnte nicht erzeugt werden");
}

/** Ein Referenzplan (bereits bei der Erzeugung nachweislich gültig) */
export function planVorschlag(aufgabe) {
  return aufgabe.loesung.map((x) => ({ id: x.id, zeit: x.zeit }));
}

/** Prüft, ob ein gegebener Plan (Liste {id, zeit}) gültig ist: keine Überlappung, Öffnungszeiten, Wegzeit, Pause */
export function pruefePlan(aufgabe, plan) {
  return findeKonflikte(aufgabe, plan).length === 0 && plan.length === aufgabe.gewaehlt.length
    && (!aufgabe.p.pausen || plan.some((a) => aufgabe.gewaehlt.find((g) => g.id === a.id)?.titel === "Mittagessen"));
}

/** Findet echte Konflikte im vom Nutzer gebauten Plan, mit Begründung je betroffener Erledigung */
export function findeKonflikte(aufgabe, plan) {
  const { gewaehlt, p } = aufgabe;
  const sortiert = [...plan].sort((a, b) => a.zeit - b.zeit);
  const konflikte = [];
  for (let i = 0; i < sortiert.length; i++) {
    const a = sortiert[i];
    const voll = gewaehlt.find((g) => g.id === a.id);
    if (!voll) continue;
    if (a.zeit < voll.oeffnet[0] || a.zeit + voll.dauer > voll.oeffnet[1]) konflikte.push({ id: a.id, grund: "geschlossen" });
    if (voll.fest && a.zeit !== voll.zeit) konflikte.push({ id: a.id, grund: "fest" });
    if (i > 0) {
      const prev = sortiert[i - 1];
      const prevVoll = gewaehlt.find((g) => g.id === prev.id);
      const luecke = a.zeit - (prev.zeit + prevVoll.dauer);
      if (luecke < 0) konflikte.push({ id: a.id, grund: "ueberlappt" });
      else if (p.wegzeiten && luecke < wegzeitZwischen(prevVoll.ort, voll.ort)) konflikte.push({ id: a.id, grund: "weg" });
    }
  }
  return konflikte;
}

/** Bewertung: Anteil der Termine ohne Konflikt, mit Abzug bei fehlender Mittagspause */
export function tagesplanScore(aufgabe, plan) {
  const konflikte = new Set(findeKonflikte(aufgabe, plan).map((k) => k.id));
  const ok = aufgabe.gewaehlt.length - konflikte.size;
  let score = aufgabe.gewaehlt.length ? ok / aufgabe.gewaehlt.length : 0;
  if (aufgabe.p.pausen) {
    const mittag = plan.find((a) => aufgabe.gewaehlt.find((g) => g.id === a.id)?.titel === "Mittagessen");
    if (!mittag) score *= 0.85;
  }
  return Math.max(0, Math.min(1, score));
}

function warte(ctx, setup) {
  return new Promise((resolve) => {
    let fertig = false;
    const t = setInterval(() => { if (!ctx.alive()) done(null); }, 300);
    function done(v) { if (fertig) return; fertig = true; clearInterval(t); resolve(v); }
    setup(done);
  });
}

function slotListe(p) {
  const slots = [];
  for (let t = START; t < ENDE; t += p.rasterMin) slots.push(t);
  return slots;
}

export default {
  id: "tagesplan",
  bereich: "Beruf & Alltag",
  titel: "Tag planen",
  icon: "",
  anleitung: (stufe) => {
    const p = tagesplanStufe(stufe);
    return "Tippen Sie eine Erledigung an und dann die Uhrzeit im Tagesplan, zu der sie stattfinden soll. Achten Sie auf die Öffnungszeiten."
      + (p.wegzeiten ? " Denken Sie an die Wegzeit zwischen den Orten." : "")
      + (p.pausen ? " Planen Sie auch Ihre Mittagspause ein." : "")
      + (p.ueberraschung ? " Es kann sein, dass sich mitten am Tag etwas ändert." : "");
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = tagesplanStufe(stufe);
    const aufgabe = erstelleTagesplan(stufe);
    const slots = slotListe(p);
    const plan = []; // { id, zeit }
    let gewaehlteAufgabe = null;

    const kopf = h("p.hinweis", { text: "Planen Sie Ihren Tag" });
    const restListe = h("div.ba-tag-erledigungen", { "aria-label": "Noch einzuplanen" });
    const zeitstrahl = h("div.ba-tag-zeitstrahl", { "aria-label": "Tagesplan" });
    const knoepfe = h("div.knopfreihe");
    stage.append(kopf, restListe, zeitstrahl, knoepfe);

    let fertigMelden = null;
    const zeichne = () => {
      restListe.replaceChildren(...aufgabe.gewaehlt.filter((a) => !plan.some((x) => x.id === a.id)).map((a) =>
        h("button.ba-tag-karte" + (gewaehlteAufgabe?.id === a.id ? ".ba-gewaehlt" : ""), {
          onTap: () => { gewaehlteAufgabe = gewaehlteAufgabe?.id === a.id ? null : a; zeichne(); },
        }, h("strong", { text: a.titel }), h("span", { text: `${a.ort} · ${a.dauer} Min` }),
        a.fest ? h("span.ba-tag-festlabel", { text: `Fest: ${uhrzeit(a.zeit)}` }) : h("span", { text: `Geöffnet ${uhrzeit(a.oeffnet[0])}–${uhrzeit(a.oeffnet[1])}` }))));

      zeitstrahl.replaceChildren(...slots.map((t) => {
        const eintrag = plan.find((a) => a.zeit === t);
        const voll = eintrag && aufgabe.gewaehlt.find((g) => g.id === eintrag.id);
        const tablette = aufgabe.tabletten.find((x) => Math.abs(x - t) < p.rasterMin / 2);
        return h("button.ba-tag-slot" + (voll ? ".ba-tag-belegt" : ""), {
          "aria-label": voll ? `${uhrzeit(t)}: ${voll.titel} – entfernen` : `${uhrzeit(t)} frei`,
          onTap: () => {
            if (voll) { plan.splice(plan.findIndex((a) => a.id === eintrag.id), 1); zeichne(); return; }
            if (!gewaehlteAufgabe) { feedback(stage, "Zuerst eine Erledigung antippen", "neutral"); return; }
            if (gewaehlteAufgabe.fest && gewaehlteAufgabe.zeit !== t) { feedback(stage, `Dieser Termin ist fest um ${uhrzeit(gewaehlteAufgabe.zeit)}`, "neutral"); return; }
            plan.push({ id: gewaehlteAufgabe.id, zeit: t });
            gewaehlteAufgabe = null;
            zeichne();
          },
        }, h("span.ba-tag-zeit", { text: uhrzeit(t) }),
        voll ? h("span.ba-tag-titel", { text: voll.titel }) : tablette != null ? h("span.ba-tag-tablette", { text: "Tabletten" }) : null);
      }));

      const vollstaendig = plan.length === aufgabe.gewaehlt.length;
      knoepfe.replaceChildren(vollstaendig ? h("button.knopf.primaer.gross", { text: "Plan prüfen", onTap: () => fertigMelden && fertigMelden(true) }) : "");
    };
    zeichne();

    const los = await warte(ctx, (done) => { fertigMelden = done; });
    if (los == null || !ctx.alive()) return null;

    // Überraschung: mitten in der Planung ändert sich etwas – ein Termin muss neu eingeplant werden
    if (aufgabe.ueberraschung) {
      knoepfe.replaceChildren();
      const meldung = h("div.ba-meldung", {}, h("p.hinweis.gross", { text: aufgabe.ueberraschung.text }));
      stage.insertBefore(meldung, restListe);
      ctx.speak(aufgabe.ueberraschung.text);
      const weiter = await warte(ctx, (done) => { knoepfe.replaceChildren(h("button.knopf.primaer.gross", { text: "Plan anpassen", onTap: () => done(true) })); });
      meldung.remove();
      if (weiter == null || !ctx.alive()) return null;
      const opfer = pick(aufgabe.gewaehlt);
      const idx = plan.findIndex((a) => a.id === opfer.id);
      if (idx >= 0) plan.splice(idx, 1);
      zeichne();
      const los2 = await warte(ctx, (done) => { fertigMelden = done; });
      if (los2 == null || !ctx.alive()) return null;
    }

    const konflikte = findeKonflikte(aufgabe, plan);
    const score = tagesplanScore(aufgabe, plan);
    zeitstrahl.querySelectorAll("button.ba-tag-belegt").forEach((btn) => {
      const nr = btn.querySelector(".ba-tag-zeit").textContent;
      const zeit = Number(nr.slice(0, 2)) * 60 + Number(nr.slice(3));
      const eintrag = plan.find((a) => a.zeit === zeit);
      if (eintrag && konflikte.some((k) => k.id === eintrag.id)) btn.classList.add("ba-tag-konflikt");
    });
    if (konflikte.length === 0) feedback(stage, "Guter, machbarer Tagesplan!", "gut");
    else feedback(stage, `${new Set(konflikte.map((k) => k.id)).size} Termine passen so nicht`, "neutral");
    await sleep(1600);
    if (!ctx.alive()) return null;

    const betroffen = new Set(konflikte.map((k) => k.id)).size;
    return {
      score,
      text: betroffen === 0 ? `Alle ${aufgabe.gewaehlt.length} Erledigungen ohne Konflikt eingeplant.` : `${aufgabe.gewaehlt.length - betroffen} von ${aufgabe.gewaehlt.length} Erledigungen ohne Konflikt eingeplant.`,
    };
  },
};
