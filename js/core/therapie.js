// Kopf-Fit – Therapeuten-Bereich: PIN-Schutz, Therapiepläne, Teilen ohne Server, Ergebnis-Rückweg.
// Reine Logik (PIN-Hash, Plan-Serialisierung, Kompression, Hash-Link, Sitzungstakt) ist ohne DOM
// in Node testbar. Die Oberflächen-Funktionen rendern wie die übrigen core-Bausteine direkt in `app`.
import { h, feedback, sleep } from "./ui.js";
import { icon } from "./icons.js";
import { updateProfile, MIN_LEVEL, MAX_LEVEL } from "./profile.js";
import { qrSVG } from "./qr.js";
import { bereichsVerlauf, diagrammSVG, zeitraum, imZeitraum } from "./bericht.js";

// ---------- PIN (gehasht mit SHA-256 + Salt über crypto.subtle) ----------

const bytesZuHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Zufälliges Salt als Hex-String (16 Byte) */
export function erzeugeSalt() {
  const arr = new Uint8Array(16);
  (globalThis.crypto ?? crypto).getRandomValues(arr);
  return bytesZuHex(arr);
}

/** SHA-256(salt + pin) als Hex-String */
export async function hashPin(pin, salt) {
  const daten = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await (globalThis.crypto ?? crypto).subtle.digest("SHA-256", daten);
  return bytesZuHex(digest);
}

export const hatPin = (profil) => !!profil.therapeut?.pinHash;

/** Neue PIN festlegen (überschreibt eine vorhandene) */
export async function pinSetzen(profil, pin) {
  const pinSalt = erzeugeSalt();
  const pinHash = await hashPin(pin, pinSalt);
  profil.therapeut = { pinHash, pinSalt, erstellt: new Date().toISOString().slice(0, 10) };
  updateProfile(profil);
}

/** Prüft eine eingegebene PIN gegen den gespeicherten Hash */
export async function pinPruefen(profil, pin) {
  if (!hatPin(profil)) return false;
  return (await hashPin(pin, profil.therapeut.pinSalt)) === profil.therapeut.pinHash;
}

// ---------- Therapiepläne ----------

export const PLAN_APP = "kopf-fit-plan";
export const PLAN_VERSION = 1;
export const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Leerer, neuer Plan */
export function leererPlan(name = "Neuer Plan") {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    uebungen: [],           // [{ id, modus: "adaptiv"|"fest", stufe, minStufe, maxStufe, durchgaenge }]
    dauerMinuten: 20,
    pauseNachMinuten: 15,
    wochentage: [],          // leer = jeden Tag
    notiz: "",
  };
}

const klemmeStufe = (s) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(s)));

/** Standardeinstellungen für eine neu ins Plan aufgenommene Übung */
export function neuePlanUebung(modulId, stufeVorschlag = 4) {
  return { id: modulId, modus: "adaptiv", stufe: klemmeStufe(stufeVorschlag), minStufe: MIN_LEVEL, maxStufe: MAX_LEVEL, durchgaenge: 1 };
}

export function uebungHinzufuegen(plan, modulId, stufeVorschlag) {
  if (plan.uebungen.some((u) => u.id === modulId)) return plan;
  return { ...plan, uebungen: [...plan.uebungen, neuePlanUebung(modulId, stufeVorschlag)] };
}

export function uebungEntfernen(plan, modulId) {
  return { ...plan, uebungen: plan.uebungen.filter((u) => u.id !== modulId) };
}

/** Übung im Plan verschieben: richtung -1 (hoch) oder +1 (runter) */
export function uebungVerschieben(plan, modulId, richtung) {
  const liste = [...plan.uebungen];
  const i = liste.findIndex((u) => u.id === modulId);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= liste.length) return plan;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  return { ...plan, uebungen: liste };
}

export function uebungAktualisieren(plan, modulId, patch) {
  return {
    ...plan,
    uebungen: plan.uebungen.map((u) => {
      if (u.id !== modulId) return u;
      const neu = { ...u, ...patch };
      neu.stufe = klemmeStufe(neu.stufe);
      neu.minStufe = klemmeStufe(neu.minStufe);
      neu.maxStufe = klemmeStufe(Math.max(neu.minStufe, neu.maxStufe));
      neu.durchgaenge = Math.max(1, Math.min(9, Math.round(neu.durchgaenge)));
      return neu;
    }),
  };
}

export function planPlausibel(plan) {
  return !!plan && typeof plan.name === "string" && plan.name.trim().length > 0
    && Array.isArray(plan.uebungen) && plan.uebungen.length > 0
    && plan.uebungen.every((u) => typeof u.id === "string" && ["adaptiv", "fest"].includes(u.modus))
    && Number.isFinite(plan.dauerMinuten) && plan.dauerMinuten > 0
    && Array.isArray(plan.wochentage) && plan.wochentage.every((w) => w >= 0 && w <= 6);
}

// ---------- Speichern im Profil (mehrere Pläne) ----------

export const planListe = (profil) => profil.therapiePlaene ?? [];

export function planSpeichern(profil, plan) {
  const liste = planListe(profil);
  const i = liste.findIndex((p) => p.id === plan.id);
  profil.therapiePlaene = i >= 0 ? liste.map((p, idx) => (idx === i ? plan : p)) : [...liste, plan];
  updateProfile(profil);
  return plan;
}

export function planLoeschen(profil, planId) {
  profil.therapiePlaene = planListe(profil).filter((p) => p.id !== planId);
  if (profil.therapieAktiverPlanId === planId) profil.therapieAktiverPlanId = null;
  updateProfile(profil);
}

export function planAktivieren(profil, planId) {
  profil.therapieAktiverPlanId = planId;
  updateProfile(profil);
}

export function planDeaktivieren(profil) {
  profil.therapieAktiverPlanId = null;
  updateProfile(profil);
}

/**
 * Der Plan, der den automatischen Tagesvorschlag ersetzen soll – nur wenn heute
 * einer der geplanten Wochentage ist (leere Liste = jeden Tag).
 */
export function aktiverPlan(profil, jetzt = new Date()) {
  const plan = planListe(profil).find((p) => p.id === profil.therapieAktiverPlanId);
  if (!plan) return null;
  const heute = (jetzt.getDay() + 6) % 7; // 0 = Montag, wie WOCHENTAGE
  if (plan.wochentage.length && !plan.wochentage.includes(heute)) return null;
  return plan;
}

/** Übungsliste des Plans, in Modul-Objekte aufgelöst (fehlende Module werden übersprungen) */
export function planModule(plan, module) {
  return plan.uebungen.map((u) => module.find((m) => m.id === u.id)).filter(Boolean);
}

/** Stufe, mit der eine Plan-Übung heute startet: fest = eingetragene Stufe, adaptiv = persönliche Stufe (geklemmt auf min/max) */
export function planStufe(planUebung, persoenlicheStufe) {
  if (planUebung.modus === "fest") return planUebung.stufe;
  return Math.max(planUebung.minStufe, Math.min(planUebung.maxStufe, persoenlicheStufe));
}

// ---------- Sitzungstakt: Pausenhinweise ----------

/**
 * Minuten-Zeitpunkte, zu denen ein Pausenhinweis erscheinen soll (0 < t < dauerMinuten).
 * pauseNachMinuten = 0 oder leer → keine Pausenhinweise.
 */
export function pausenZeitpunkte(plan) {
  if (!plan.pauseNachMinuten) return [];
  const punkte = [];
  for (let t = plan.pauseNachMinuten; t < plan.dauerMinuten; t += plan.pauseNachMinuten) punkte.push(t);
  return punkte;
}

/**
 * Sitzungstakt-Steuerung: liefert bei jedem Aufruf von `pruefe(minutenSeitStart)`
 * höchstens einmal je Zeitpunkt true (danach false, bis zurückgesetzt).
 */
export function sitzungsTakt(plan) {
  const punkte = pausenZeitpunkte(plan);
  const erledigt = new Set();
  return {
    punkte,
    /** true, wenn genau jetzt ein noch nicht gezeigter Pausenpunkt erreicht ist */
    pruefe(minutenSeitStart) {
      const treffer = punkte.find((p) => minutenSeitStart >= p && !erledigt.has(p));
      if (treffer == null) return false;
      erledigt.add(treffer);
      return true;
    },
    zuruecksetzen() { erledigt.clear(); },
  };
}

// ---------- Serialisierung als Datei (.kopffit-plan) ----------

/** Nur Plan-Einstellungen – keine Gesundheits-/Ergebnisdaten */
function planNutzdaten(plan) {
  const { id, name, uebungen, dauerMinuten, pauseNachMinuten, wochentage, notiz } = plan;
  return { id, name, uebungen, dauerMinuten, pauseNachMinuten, wochentage, notiz: notiz ?? "" };
}

export function planSerialisieren(plan) {
  return JSON.stringify({ app: PLAN_APP, version: PLAN_VERSION, plan: planNutzdaten(plan) }, null, 2);
}

/** @throws Error mit freundlichem deutschen Text bei kaputten/fremden Daten */
export function planDeserialisieren(json) {
  let parsed;
  try { parsed = JSON.parse(json); } catch { throw new Error("Diese Datei ist kein gültiger Kopf-Fit-Plan."); }
  if (!parsed || parsed.app !== PLAN_APP || !parsed.plan) throw new Error("Diese Datei ist kein Kopf-Fit-Plan.");
  const plan = { ...leererPlan(), ...planNutzdaten(parsed.plan), id: parsed.plan.id ?? leererPlan().id };
  if (!planPlausibel(plan)) throw new Error("Der Plan enthält keine gültigen Übungen.");
  return plan;
}

// ---------- Teilen als Link: Kompression + base64url im URL-Hash ----------

const b64urlZuBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const bytesZuB64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function stromLesen(stream) {
  const teile = [];
  const reader = stream.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; teile.push(value); }
  const laenge = teile.reduce((s, t) => s + t.length, 0);
  const out = new Uint8Array(laenge);
  let off = 0; for (const t of teile) { out.set(t, off); off += t.length; }
  return out;
}

const kannKomprimieren = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

/** 1 Byte Kennung (1 = deflate-raw, 0 = unkomprimiert) + Nutzdaten */
async function komprimieren(bytes) {
  if (!kannKomprimieren()) return Uint8Array.of(0, ...bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const komprimiert = await stromLesen(stream);
  return Uint8Array.of(1, ...komprimiert);
}

async function dekomprimieren(bytes) {
  const [kennung, ...rest] = bytes;
  const nutzdaten = Uint8Array.from(rest);
  if (kennung === 0) return nutzdaten;
  if (kennung !== 1) throw new Error("Unbekanntes Format.");
  if (!kannKomprimieren()) throw new Error("Dieser Link kann auf diesem Gerät nicht gelesen werden.");
  const stream = new Blob([nutzdaten]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return stromLesen(stream);
}

/** Plan → "plan=<base64url>" (ohne führendes '#') */
export async function planZuHashWert(plan) {
  const json = planSerialisieren(plan);
  const bytes = await komprimieren(new TextEncoder().encode(json));
  return `plan=${bytesZuB64url(bytes)}`;
}

/** Vollständiger Link inkl. #, aus origin+pathname der laufenden Seite */
export async function planZuLink(plan, basis = (typeof location !== "undefined" ? location.href.split("#")[0] : "")) {
  return `${basis}#${await planZuHashWert(plan)}`;
}

/**
 * Plan aus einem URL-Hash (mit oder ohne führendes '#') lesen.
 * @returns {Promise<object|null>} Plan, oder null, wenn der Hash keinen Plan enthält
 * @throws Error bei vorhandenem, aber kaputtem "plan="-Wert
 */
export async function planAusHash(hash) {
  const wert = String(hash ?? "").replace(/^#/, "");
  const treffer = /(?:^|&)plan=([^&]+)/.exec(wert);
  if (!treffer) return null;
  let bytes;
  try { bytes = b64urlZuBytes(treffer[1]); } catch { throw new Error("Der Link ist unvollständig oder beschädigt."); }
  const roh = await dekomprimieren(bytes);
  return planDeserialisieren(new TextDecoder().decode(roh));
}

/**
 * Beim Öffnen der App: prüft den aktuellen URL-Hash auf einen Plan-Link und fragt
 * freundlich nach, ob er übernommen werden soll. Räumt den Hash danach immer auf.
 * @param {object} o
 * @param {HTMLElement} o.app     Wurzelelement, in das die Nachfrage gerendert wird
 * @param {object} o.profil       aktuelles Profil
 * @param {Function} o.weiter     (uebernommenerPlanOderNull) => void – geht danach normal weiter
 */
export async function planAusHashUebernehmen({ app, profil, weiter }) {
  const hash = typeof location !== "undefined" ? location.hash : "";
  if (!/plan=/.test(hash)) return weiter?.(null);
  const raeumeAuf = () => { try { history.replaceState(null, "", location.pathname + location.search); } catch { /* ignoriert */ } };

  let plan;
  try { plan = await planAusHash(hash); }
  catch (err) {
    raeumeAuf();
    return zeigeHashFehler({ app, text: err.message, weiter });
  }
  if (!plan) { raeumeAuf(); return weiter?.(null); }

  app.replaceChildren(
    h("main.inhalt.schmal.mittig.th-uebernahme", {},
      h("div.symbol-gross.a-copper", {}, icon("therapie")),
      h("h1", { text: "Plan von Ihrer Therapeutin übernehmen?", tabindex: "-1" }),
      h("p.anleitung", { text: `„${plan.name}“ mit ${plan.uebungen.length} Übungen, etwa ${plan.dauerMinuten} Minuten.` }),
      plan.notiz ? h("p.leise-text", { text: `Notiz: ${plan.notiz}` }) : null,
      h("p.leise-text", { text: "Der Link enthält nur die Planeinstellungen, keine Ergebnisse oder Gesundheitsdaten." }),
      h("div.knopfreihe", {},
        h("button.knopf", { text: "Nein, danke", onTap: () => { raeumeAuf(); weiter?.(null); } }),
        h("button.knopf.gross.primaer", {
          text: "Plan übernehmen",
          onTap: () => {
            const gespeichert = planSpeichern(profil, plan);
            planAktivieren(profil, gespeichert.id);
            raeumeAuf();
            weiter?.(gespeichert);
          },
        })),
    ),
  );
}

function zeigeHashFehler({ app, text, weiter }) {
  app.replaceChildren(
    h("main.inhalt.schmal.mittig", {},
      h("h1", { text: "Plan-Link konnte nicht gelesen werden", tabindex: "-1" }),
      h("p.anleitung", { text }),
      h("button.knopf.gross.primaer", { text: "Weiter zu Kopf-Fit", onTap: () => weiter?.(null) })),
  );
}

// ---------- Ergebnis-Rückweg (Export für die Therapeutin, Import-Ansicht) ----------

export const ERGEBNIS_APP = "kopf-fit-ergebnisse";

/** Nur Verlauf/Stufen der Plan-Übungen – Name optional anonymisierbar */
export function ergebnisseErstellen(profil, plan, { anonym = false } = {}) {
  const ids = new Set(plan.uebungen.map((u) => u.id));
  const verlauf = profil.history.filter((e) => ids.has(e.modul))
    .map(({ t, modul, stufe, score, neueStufe }) => ({ t, modul, stufe, score, neueStufe }));
  return {
    app: ERGEBNIS_APP, version: 1,
    name: anonym ? null : profil.name,
    planId: plan.id, planName: plan.name,
    erstellt: new Date().toISOString(),
    verlauf,
  };
}

export function ergebnisseSerialisieren(profil, plan, opt) {
  return JSON.stringify(ergebnisseErstellen(profil, plan, opt), null, 2);
}

/** @throws Error mit freundlichem Text bei kaputten/fremden Daten */
export function ergebnisseDeserialisieren(json) {
  let parsed;
  try { parsed = JSON.parse(json); } catch { throw new Error("Diese Datei ist keine gültige Kopf-Fit-Ergebnisdatei."); }
  if (!parsed || parsed.app !== ERGEBNIS_APP || !Array.isArray(parsed.verlauf)) throw new Error("Diese Datei ist keine Kopf-Fit-Ergebnisdatei.");
  return parsed;
}

/** Bereichsdiagramme aus einer importierten Ergebnisdatei (nutzt bericht.js-Logik) */
export function ergebnisseAuswerten(daten, module, bereiche, art = "4w") {
  const raum = zeitraum(art);
  const eintraege = imZeitraum(daten.verlauf, raum);
  const bereichsNamen = [...new Set(module.filter((m) => daten.verlauf.some((e) => e.modul === m.id)).map((m) => m.bereich))];
  return {
    ...daten, ...raum, art,
    anzahl: eintraege.length,
    bereiche: bereichsNamen.map((name) => {
      const ids = module.filter((m) => m.bereich === name).map((m) => m.id);
      return { name, punkte: bereichsVerlauf(daten.verlauf, ids, raum) };
    }),
  };
}

// ---------- Oberfläche ----------

function kopf(titel, eyebrow, zurueck, aktionen = []) {
  return h("header.kopf.schmal", {},
    h("div.kopf-links", {},
      zurueck ? h("button.knopf", { onTap: zurueck }, icon("zurueck"), h("span", { text: "Zurück" })) : null,
      h("div.kopf-titel", {}, eyebrow ? h("span.eyebrow", { text: eyebrow }) : null, h("h1", { text: titel, tabindex: "-1" }))),
    h("div.kopf-aktionen", {}, aktionen));
}

/**
 * Öffnet den Therapeuten-Bereich (PIN-geschützt). Rendert direkt in `app` wie die
 * übrigen core-Bausteine (einstufung.js, bericht.js) und ersetzt dessen Inhalt.
 * @param {object} o
 * @param {HTMLElement} o.app
 * @param {object} o.profil
 * @param {Array} o.module      MODULE-Liste aus app.js
 * @param {Array} o.bereiche    BEREICHE-Liste aus app.js
 * @param {Function} o.zurueck  () => void – Knopf „Zurück“ auf der obersten Ebene
 */
export function zeigeTherapeutenbereich({ app, profil, module, bereiche, zurueck }) {
  const zeige = (...kinder) => { app.replaceChildren(...kinder); window.scrollTo?.(0, 0); app.querySelector("h1")?.focus?.(); };

  if (!hatPin(profil)) return pinEinrichten();
  return pinAbfragen();

  // ---- PIN ----
  function pinEinrichten() {
    let eins = "", fehler = "";
    const zeichnen = () => zeige(
      kopf("Therapeuten-Bereich einrichten", "Kopf-Fit", zurueck),
      h("main.inhalt.schmal.mittig.th-pin", {},
        h("p.anleitung", { text: "Legen Sie eine 4-stellige PIN fest, die nur Sie und die Therapeutin/der Therapeut kennen. Damit ist dieser Bereich vor versehentlichem Ändern geschützt." }),
        pinFeld((wert) => { eins = wert; if (wert.length === 4) { zeichnen2(wert); } }),
        fehler ? h("p.leise-text", { text: fehler }) : null),
    );
    const zeichnen2 = (ersteEingabe) => {
      let zwei = "";
      zeige(
        kopf("PIN bestätigen", "Kopf-Fit", zurueck),
        h("main.inhalt.schmal.mittig.th-pin", {},
          h("p.anleitung", { text: "Bitte geben Sie die PIN noch einmal ein." }),
          pinFeld(async (wert) => {
            zwei = wert;
            if (wert.length !== 4) return;
            if (wert !== ersteEingabe) { fehler = "Die PIN stimmte beim zweiten Mal nicht überein. Bitte noch einmal."; return zeichnen(); }
            await pinSetzen(profil, wert);
            zeigePlaene();
          })),
      );
    };
    zeichnen();
  }

  function pinAbfragen() {
    let fehlversuche = 0;
    const zeichnen = () => zeige(
      kopf("Therapeuten-Bereich", "PIN eingeben", zurueck),
      h("main.inhalt.schmal.mittig.th-pin", {},
        h("p.anleitung", { text: "Bitte geben Sie die 4-stellige PIN ein." }),
        pinFeld(async (wert) => {
          if (wert.length !== 4) return;
          if (await pinPruefen(profil, wert)) return zeigePlaene();
          fehlversuche++;
          feedback(app, "Die PIN war leider nicht richtig.", "neutral");
          zeichnen();
        }),
        h("button.knopf.th-vergessen", { text: "PIN vergessen?", onTap: pinVergessen })),
    );
    zeichnen();
  }

  function pinVergessen() {
    zeige(
      kopf("PIN vergessen", "Therapeuten-Bereich", zurueck),
      h("main.inhalt.schmal.mittig", {},
        h("p.anleitung", { text: "Die PIN kann aus Datenschutzgründen nicht angezeigt werden. Sichern Sie zuerst über „Einstellungen → Daten sichern“ alle Daten, löschen Sie danach das Profil und legen Sie es neu an. Eine neue PIN können Sie dann sofort festlegen." }),
        h("button.knopf.gross.primaer", { text: "Verstanden", onTap: zurueck })),
    );
  }

  function pinFeld(onFertig) {
    let werte = [];
    const zeile = h("div.eingabezeile.th-pin-zeile");
    const render = () => { zeile.textContent = werte.map(() => "•").join(" ") + " _".repeat(4 - werte.length); };
    render();
    const tasten = [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((t) => h("button.taste", {
      text: t, "aria-label": t === "⌫" ? "Löschen" : t === "✓" ? "Fertig" : String(t),
      onTap: () => {
        if (t === "⌫") werte.pop();
        else if (t === "✓") { if (werte.length === 4) onFertig(werte.join("")); return; }
        else if (werte.length < 4) werte.push(t);
        render();
        if (werte.length === 4) onFertig(werte.join(""));
      },
    }));
    return h("div.th-pin-eingabe", {}, zeile, h("div.tastenfeld", {}, tasten));
  }

  // ---- Plan-Übersicht ----
  function zeigePlaene() {
    const plaene = planListe(profil);
    zeige(
      kopf("Therapeuten-Bereich", profil.name, zurueck,
        [h("button.knopf", { onTap: zeigeErgebnisImport }, icon("bericht"), h("span", { text: "Ergebnisse ansehen" }))]),
      h("main.inhalt.schmal.th-plaene", {},
        h("section.box", {},
          h("h2", { text: "Therapiepläne" }),
          plaene.length ? h("ul.th-planliste", {}, plaene.map((p) => h("li", {},
            h("button.knopf.th-planzeile" + (profil.therapieAktiverPlanId === p.id ? ".aktiv" : ""), { onTap: () => zeigePlanEditor(p.id) },
              h("span.name", { text: p.name }),
              h("span.leise-text", { text: `${p.uebungen.length} Übungen · ${p.dauerMinuten} Min.` }),
              profil.therapieAktiverPlanId === p.id ? h("span.th-abzeichen", { text: "Aktiv" }) : null)))) : h("p.leise-text", { text: "Noch kein Plan angelegt." }),
          h("button.knopf.gross.primaer", { text: "Neuen Plan anlegen", onTap: () => zeigePlanEditor(planSpeichern(profil, leererPlan(`Plan ${plaene.length + 1}`)).id) }),
          profil.therapieAktiverPlanId ? h("button.knopf", { text: "Automatischen Vorschlag wieder verwenden", onTap: () => { planDeaktivieren(profil); zeigePlaene(); } }) : null),
      ),
    );
  }

  // ---- Plan-Editor ----
  function zeigePlanEditor(planId) {
    let plan = planListe(profil).find((p) => p.id === planId);
    if (!plan) return zeigePlaene();
    const speichernUndZeichnen = (neu) => { plan = planSpeichern(profil, neu); zeigePlanEditor(plan.id); };

    const nameFeld = h("input.eingabe", { value: plan.name, "aria-label": "Name des Plans", maxlength: "40" });
    nameFeld.addEventListener("change", () => speichernUndZeichnen({ ...plan, name: nameFeld.value.trim() || plan.name }));

    const wochentagsknoepfe = h("div.knopfreihe.th-wochentage", { role: "group", "aria-label": "Wochentage" },
      WOCHENTAGE.map((label, i) => h("button.knopf.option" + (plan.wochentage.includes(i) ? ".aktiv" : ""), {
        text: label, "aria-pressed": String(plan.wochentage.includes(i)),
        onTap: () => speichernUndZeichnen({ ...plan, wochentage: plan.wochentage.includes(i) ? plan.wochentage.filter((w) => w !== i) : [...plan.wochentage, i].sort() }),
      })));

    const zahlFeld = (titel, wert, min, max, key) => h("label.th-feld", {},
      h("span", { text: titel }),
      h("input", { type: "number", value: wert, min, max, onChange: (e) => speichernUndZeichnen({ ...plan, [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) }) }));

    const notizFeld = h("textarea.th-notiz", { text: plan.notiz, "aria-label": "Notiz für die Person (optional)", rows: "2", placeholder: "Notiz (optional, wird beim Teilen mitgeschickt)" });
    notizFeld.addEventListener("change", () => speichernUndZeichnen({ ...plan, notiz: notizFeld.value }));

    const modulAuswahl = h("select.eingabe.th-modulauswahl", { "aria-label": "Übung hinzufügen" },
      h("option", { value: "", text: "Übung hinzufügen …" }),
      bereiche.map((b) => h("optgroup", { label: b.name ?? b },
        module.filter((m) => m.bereich === (b.name ?? b) && !plan.uebungen.some((u) => u.id === m.id))
          .map((m) => h("option", { value: m.id, text: m.titel })))));
    modulAuswahl.addEventListener("change", () => {
      if (!modulAuswahl.value) return;
      speichernUndZeichnen(uebungHinzufuegen(plan, modulAuswahl.value, plan.uebungen.length ? plan.uebungen[plan.uebungen.length - 1].stufe : 4));
    });

    const uebungsZeile = (u, i) => {
      const m = module.find((mm) => mm.id === u.id);
      if (!m) return null;
      return h("li.th-uebungszeile", {},
        h("div.th-uebungskopf", {},
          h("span.zeile-icon", {}, icon(m.id)),
          h("span.name", { text: m.titel }),
          h("div.th-pfeile", {},
            h("button.knopf", { "aria-label": "Nach oben", onTap: () => speichernUndZeichnen(uebungVerschieben(plan, u.id, -1)), disabled: i === 0 }, "▲"),
            h("button.knopf", { "aria-label": "Nach unten", onTap: () => speichernUndZeichnen(uebungVerschieben(plan, u.id, 1)), disabled: i === plan.uebungen.length - 1 }, "▼"),
            h("button.knopf.gefahr", { "aria-label": `${m.titel} entfernen`, onTap: () => speichernUndZeichnen(uebungEntfernen(plan, u.id)) }, "✕"))),
        h("div.knopfreihe", { role: "radiogroup", "aria-label": "Stufe" },
          h("button.knopf.option" + (u.modus === "adaptiv" ? ".aktiv" : ""), { text: "Stufe passt sich an", onTap: () => speichernUndZeichnen(uebungAktualisieren(plan, u.id, { modus: "adaptiv" })) }),
          h("button.knopf.option" + (u.modus === "fest" ? ".aktiv" : ""), { text: "Feste Stufe", onTap: () => speichernUndZeichnen(uebungAktualisieren(plan, u.id, { modus: "fest" })) })),
        u.modus === "fest"
          ? h("label.th-feld", {}, h("span", { text: "Stufe" }), h("input", { type: "number", value: u.stufe, min: MIN_LEVEL, max: MAX_LEVEL, onChange: (e) => speichernUndZeichnen(uebungAktualisieren(plan, u.id, { stufe: Number(e.target.value) })) }))
          : h("div.th-min-max", {},
              h("label.th-feld", {}, h("span", { text: "Mindeststufe" }), h("input", { type: "number", value: u.minStufe, min: MIN_LEVEL, max: MAX_LEVEL, onChange: (e) => speichernUndZeichnen(uebungAktualisieren(plan, u.id, { minStufe: Number(e.target.value) })) })),
              h("label.th-feld", {}, h("span", { text: "Höchststufe" }), h("input", { type: "number", value: u.maxStufe, min: MIN_LEVEL, max: MAX_LEVEL, onChange: (e) => speichernUndZeichnen(uebungAktualisieren(plan, u.id, { maxStufe: Number(e.target.value) })) }))),
        h("label.th-feld", {}, h("span", { text: "Durchgänge" }), h("input", { type: "number", value: u.durchgaenge, min: "1", max: "9", onChange: (e) => speichernUndZeichnen(uebungAktualisieren(plan, u.id, { durchgaenge: Number(e.target.value) })) })));
    };

    zeige(
      kopf("Plan bearbeiten", plan.name, zeigePlaene),
      h("main.inhalt.schmal.th-editor", {},
        h("section.box", {}, h("h2", { text: "Name" }), nameFeld),
        h("section.box", {}, h("h2", { text: "Wochentage" }), h("p.leise-text", { text: "Keine Auswahl = jeden Tag." }), wochentagsknoepfe),
        h("section.box", {},
          h("h2", { text: "Sitzung" }),
          zahlFeld("Sitzungsdauer gesamt (Minuten)", plan.dauerMinuten, 5, 90, "dauerMinuten"),
          zahlFeld("Pausenhinweis nach (Minuten, 0 = aus)", plan.pauseNachMinuten, 0, 60, "pauseNachMinuten")),
        h("section.box", {},
          h("h2", { text: "Übungen" }),
          plan.uebungen.length ? h("ol.th-uebungsliste", {}, plan.uebungen.map(uebungsZeile)) : h("p.leise-text", { text: "Noch keine Übung ausgewählt." }),
          modulAuswahl),
        h("section.box", {}, h("h2", { text: "Notiz für die Person" }), notizFeld),
        h("section.box", {},
          h("h2", { text: "Aktiver Plan" }),
          h("p.leise-text", { text: "Der aktive Plan ersetzt auf der Startseite den automatischen Tagesvorschlag." }),
          profil.therapieAktiverPlanId === plan.id
            ? h("button.knopf.option.aktiv", { text: "Ist aktiv", onTap: () => { planDeaktivieren(profil); zeigePlanEditor(plan.id); } })
            : h("button.knopf.primaer", { text: "Diesen Plan aktivieren", onTap: () => { planAktivieren(profil, plan.id); zeigePlanEditor(plan.id); }, disabled: !plan.uebungen.length })),
        h("section.box", {}, h("h2", { text: "Teilen" }),
          h("div.knopfreihe", {},
            h("button.knopf", { onTap: () => planDateiExportieren(plan) }, icon("teilen"), h("span", { text: "Als Datei exportieren" })),
            h("button.knopf", { onTap: () => planDateiImportieren(speichernUndZeichnen) }, icon("teilen"), h("span", { text: "Aus Datei importieren" })),
            h("button.knopf.primaer", { onTap: () => zeigePlanTeilen(plan), text: "Link & QR-Code anzeigen" }))),
        h("section.box", {}, h("h2", { text: "Löschen" }),
          h("button.knopf.gefahr", { text: "Plan löschen", onTap: () => { if (confirm(`Plan „${plan.name}“ wirklich löschen?`)) { planLoeschen(profil, plan.id); zeigePlaene(); } } })),
      ),
    );
  }

  function planDateiExportieren(plan) {
    const blob = new Blob([planSerialisieren(plan)], { type: "application/json" });
    h("a", { href: URL.createObjectURL(blob), download: `${plan.name.replace(/[^\wäöüßÄÖÜ -]/g, "").trim() || "plan"}.kopffit-plan` }).click();
  }

  function planDateiImportieren(weiter) {
    const datei = h("input", { type: "file", accept: ".kopffit-plan,application/json", style: { display: "none" } });
    datei.addEventListener("change", async () => {
      try {
        const plan = planDeserialisieren(await datei.files[0].text());
        weiter(planSpeichern(profil, plan));
      } catch (err) { alert(err.message); }
    });
    document.body.append(datei);
    datei.click();
  }

  async function zeigePlanTeilen(plan) {
    zeige(kopf("Plan teilen", plan.name, () => zeigePlanEditor(plan.id)),
      h("main.inhalt.schmal.mittig.th-teilen", {}, h("p.leise-text", { text: "Der Link wird erstellt …" })));
    const link = await planZuLink(plan);
    const container = h("main.inhalt.schmal.mittig.th-teilen", {},
      h("p.anleitung", { text: "Diesen Link öffnen oder den QR-Code scannen, um den Plan auf einem anderen Gerät zu übernehmen. Es werden keine Ergebnisse übertragen." }),
      h("div.th-qr", { html: qrSVG(link, { titel: `QR-Code für ${plan.name}` }) }),
      h("textarea.th-link", { readOnly: true, rows: "3", text: link }),
      h("div.knopfreihe", {},
        h("button.knopf.primaer", { text: "Link kopieren", onTap: async () => { try { await navigator.clipboard.writeText(link); feedback(app, "Link kopiert.", "gut"); } catch { /* Zwischenablage nicht verfügbar */ } } })));
    zeige(kopf("Plan teilen", plan.name, () => zeigePlanEditor(plan.id)), container);
  }

  // ---- Ergebnis-Import (Ansicht für die Therapeutin) ----
  function zeigeErgebnisImport() {
    const datei = h("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
    datei.addEventListener("change", async () => {
      try {
        const daten = ergebnisseDeserialisieren(await datei.files[0].text());
        zeigeErgebnisAnsicht(daten);
      } catch (err) { alert(err.message); }
    });
    document.body.append(datei);
    zeige(
      kopf("Ergebnisse ansehen", "Therapeuten-Bereich", zeigePlaene),
      h("main.inhalt.schmal.mittig", {},
        h("p.anleitung", { text: "Öffnen Sie hier eine Ergebnisdatei, die Ihnen die übende Person exportiert und geschickt hat (E-Mail, USB-Stick o. ä.)." }),
        h("button.knopf.gross.primaer", { text: "Ergebnisdatei öffnen", onTap: () => datei.click() })),
    );
  }

  function zeigeErgebnisAnsicht(daten) {
    const ausgewertet = ergebnisseAuswerten(daten, module, bereiche);
    zeige(
      kopf(daten.name ?? "Ergebnisse (anonym)", daten.planName, zeigeErgebnisImport),
      h("main.inhalt.schmal", {},
        h("p.leise-text", { text: `${ausgewertet.anzahl} Übungen in den letzten 4 Wochen. Exportiert am ${new Date(daten.erstellt).toLocaleDateString("de-DE")}.` }),
        ausgewertet.bereiche.map((b) => h("section.bereich", {},
          h("h3", { text: b.name }),
          h("div.th-diagramm", { html: diagrammSVG(b, ausgewertet, []) }))),
        !ausgewertet.bereiche.length ? h("p.leise-text", { text: "Keine Übungen im Zeitraum." }) : null),
    );
  }
}

// Export für Ergebnis-Rückweg (aus zeigeTherapeutenbereich heraus genutzt, aber auch
// eigenständig aufrufbar, z. B. von der Startseite aus)
export function ergebnisExportKnopf(profil, plan, opt) {
  const blob = new Blob([ergebnisseSerialisieren(profil, plan, opt)], { type: "application/json" });
  const dateiname = `kopf-fit-ergebnisse-${(opt?.anonym ? "anonym" : profil.name)}-${new Date().toISOString().slice(0, 10)}.json`;
  h("a", { href: URL.createObjectURL(blob), download: dateiname }).click();
}
