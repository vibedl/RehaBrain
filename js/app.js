// Kopf-Fit – Steuerung der Bildschirme (Gestaltung: Richtung A „Klar & ruhig“)
import { h, feedback } from "./core/ui.js";
import { icon } from "./core/icons.js";
import { speak, stopSpeaking, setSpeechEnabled } from "./core/speech.js";
import { exportAll, importAll, load, save } from "./core/store.js";
import { starteEinstufung, hatZwischenstand } from "./core/einstufung.js";
import { oeffneBericht } from "./core/bericht.js";
import {
  listProfiles, createProfile, updateProfile, deleteProfile, levelOf, adapt, isBadDay, toggleBadDay, today, MAX_LEVEL,
} from "./core/profile.js";

// Aufmerksamkeit
import reaktion from "./modules/reaktion.js";
import suchbild from "./modules/suchbild.js";
import geteilt from "./modules/geteilt.js";
// Gedächtnis
import zahlen from "./modules/zahlen.js";
import wege from "./modules/wege.js";
import einkaufsliste from "./modules/einkaufsliste.js";
import gesichter from "./modules/gesichter.js";
import alltag from "./modules/alltag.js";
// Planen & Denken
import einkaufen from "./modules/einkaufen.js";
import turm from "./modules/turm.js";
import regeln from "./modules/regeln.js";
import ablauf from "./modules/ablauf.js";
// Sehen & Raum
import durchstreichen from "./modules/durchstreichen.js";
import blicksprung from "./modules/blicksprung.js";
import figuren from "./modules/figuren.js";
// Kartenspiele (Reihenfolge = Kartenspiel-Leiter)
import sortieren from "./cards/sortieren.js";
import memory from "./cards/memory.js";
import hoeher from "./cards/hoeher.js";
import schnipp from "./cards/schnipp.js";
import maumau from "./cards/maumau.js";
import siebzehnundvier from "./cards/siebzehnundvier.js";
import patience from "./cards/patience.js";
import romme from "./cards/romme.js";
import sechsundsechzig from "./cards/sechsundsechzig.js";
import skatschule from "./cards/skatschule.js";
import skat from "./cards/skat.js";

const MODULE = [
  reaktion, suchbild, geteilt,
  zahlen, wege, einkaufsliste, gesichter, alltag,
  einkaufen, turm, regeln, ablauf,
  durchstreichen, blicksprung, figuren,
  sortieren, memory, hoeher, schnipp, maumau, patience, romme, siebzehnundvier, sechsundsechzig, skatschule, skat,
];
const BEREICHE = [
  { name: "Aufmerksamkeit", akzent: "a-blau" },
  { name: "Gedächtnis", akzent: "a-sage" },
  { name: "Planen & Denken", akzent: "a-pflaume" },
  { name: "Sehen & Raum", akzent: "a-ocker" },
  { name: "Kartenspiele", akzent: "a-copper" },
];
const akzentVon = (m) => BEREICHE.find((b) => b.name === m.bereich).akzent;

const app = document.getElementById("app");
let profil = null;
let laufendeSitzung = null; // { alive: bool }
let plan = null;            // { liste: Modul[], index } – laufendes Tagestraining

// ---------- Darstellung ----------
function applySettings() {
  const s = profil?.settings;
  const root = document.documentElement;
  const darstellung = s?.darstellung ?? load("darstellung", "auto");
  if (darstellung === "auto") delete root.dataset.theme; else root.dataset.theme = darstellung;
  root.dataset.schrift = s?.schrift ?? "gross";
  root.dataset.kontrast = s?.kontrast ? "hoch" : "normal";
  root.dataset.ruhig = s?.ruhig ? "ja" : "nein";
  setSpeechEnabled(s?.autoVorlesen ?? false);
  const dunkel = root.dataset.theme === "dunkel" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dunkel ? "#161514" : "#F9F7F4");
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySettings);

function screen(...children) {
  if (laufendeSitzung) laufendeSitzung.alive = false;
  laufendeSitzung = null;
  stopSpeaking();
  app.replaceChildren(...children);
  window.scrollTo(0, 0);
  app.querySelector("h1")?.focus?.();
}

const zurueckKnopf = (fn, text = "Zurück") =>
  h("button.knopf", { onTap: fn }, icon("zurueck"), h("span", { text }));
const einstellungenKnopf = () =>
  h("button.knopf", { "aria-label": "Einstellungen", onTap: zeigeEinstellungen }, icon("einstellungen"));

function kopfzeile({ titel, eyebrow, zurueck, aktionen = [], schmal = true }) {
  return h("header.kopf" + (schmal ? ".schmal" : ""), {},
    h("div.kopf-links", {},
      zurueck ? zurueckKnopf(zurueck) : null,
      h("div.kopf-titel", {},
        eyebrow ? h("span.eyebrow", { text: eyebrow }) : null,
        h("h1", { text: titel, tabindex: "-1" }))),
    h("div.kopf-aktionen", {}, aktionen));
}

// ---------- Tagesvorschlag ----------
function vorschlag() {
  // je Bereich die Übung, die am längsten nicht gespielt wurde
  const zuletzt = (id) => {
    for (let i = profil.history.length - 1; i >= 0; i--) if (profil.history[i].modul === id) return profil.history[i].t;
    return 0;
  };
  return BEREICHE.map((b) => MODULE.filter((m) => m.bereich === b.name).sort((x, y) => zuletzt(x.id) - zuletzt(y.id))[0])
    .filter(Boolean)
    .sort((x, y) => zuletzt(x.id) - zuletzt(y.id))
    .slice(0, 3);
}

function wochentage() {
  const jetzt = new Date();
  const montag = new Date(jetzt);
  montag.setHours(0, 0, 0, 0);
  montag.setDate(jetzt.getDate() - ((jetzt.getDay() + 6) % 7));
  const geuebt = new Set(profil.history.map((e) => new Date(e.t).toDateString()));
  return ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((kurz, i) => {
    const tag = new Date(montag);
    tag.setDate(montag.getDate() + i);
    return { kurz, an: geuebt.has(tag.toDateString()), heute: tag.toDateString() === jetzt.toDateString() };
  });
}

// ---------- Profile ----------
function zeigeProfile() {
  profil = null;
  plan = null;
  applySettings();
  const profile = listProfiles();
  const name = h("input.eingabe", { placeholder: "Vorname", "aria-label": "Vorname", maxlength: "30" });
  const anlegen = () => {
    if (!name.value.trim()) { name.focus(); return; }
    profil = createProfile(name.value);
    zeigeEinstufung();
  };
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") anlegen(); });

  screen(
    kopfzeile({ titel: "Wer übt heute?", eyebrow: "Kopf-Fit" }),
    h("main.inhalt.schmal", {},
      profile.length ? h("div.profilliste", {}, profile.map((p) =>
        h("button.profilkarte", { onTap: () => { profil = p; zeigeStart(); } },
          h("span.avatar", { text: p.name.slice(0, 1).toUpperCase() }), h("span", { text: p.name })))) : null,
      h("section.box", {},
        h("h2", { text: profile.length ? "Neue Person anlegen" : "Wie heißen Sie?" }),
        h("div.zeile", {}, name, h("button.knopf.primaer", { text: "Weiter", onTap: anlegen }))),
      h("p.rechtlich", { text: "Kopf-Fit ist ein Gedächtnis- und Konzentrationstraining für zu Hause. Es ersetzt keine ärztliche oder therapeutische Behandlung." }),
    ),
  );
}

// ---------- Startseite ----------
function zeigeStart() {
  plan = null;
  applySettings();
  const schlecht = isBadDay(profil);
  const heute = vorschlag();
  const woche = wochentage();
  const datum = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  screen(
    kopfzeile({
      titel: `Guten Tag, ${profil.name}`,
      schmal: false,
      eyebrow: datum,
      aktionen: [
        h("button.knopf", { onTap: zeigeVerlauf }, icon("verlauf"), h("span", { text: "Verlauf" })),
        einstellungenKnopf(),
      ],
    }),
    h("main.inhalt", {},
      h("div.start", {},
        h("div.spalte", {},
          h("section.heute", {},
            h("span.eyebrow", { text: "Heute vorgeschlagen" }),
            h("h2", { text: `${heute.length} Übungen · etwa 15 Minuten` }),
            h("div.heute-liste", {}, heute.map((m, i) =>
              h("div", {}, h("span.n", { text: i + 1 }), h("span", { text: m.titel })))),
            h("button.knopf.primaer.gross", {
              text: "Training starten",
              onTap: () => { plan = { liste: heute, index: 0 }; zeigeAnleitung(heute[0]); },
            })),
          !profil.einstufung || hatZwischenstand(profil)
            ? h("button.knopf.tagesknopf", { onTap: zeigeEinstufung }, icon("einstufung"),
                h("span", { text: hatZwischenstand(profil) ? "Einstufung fortsetzen" : "Einstufung machen (ca. 15 Minuten)" }))
            : null,
          h("button.knopf.tagesknopf" + (schlecht ? ".aktiv" : ""), {
            text: schlecht ? "Heute ist ein schwerer Tag – es wird nicht herabgestuft" : "Heute geht es mir nicht so gut",
            "aria-pressed": String(schlecht),
            onTap: () => { toggleBadDay(profil); zeigeStart(); },
          }),
          h("div.woche", {},
            h("span.eyebrow", { text: "Diese Woche" }),
            h("span.zahl", { text: `${woche.filter((t) => t.an).length} von 7 Tagen geübt` }),
            h("div.wochenleiste", {}, woche.map((t) =>
              h("span" + (t.heute ? ".heute-tag" : ""), {}, h("i" + (t.an ? ".an" : "")), t.kurz))))),

        h("div.spalte", {},
          h("nav.liste", { "aria-label": "Alle Übungen" },
            BEREICHE.filter((b) => MODULE.some((m) => m.bereich === b.name)).map((b) => [
              h("div.gruppe", { text: b.name }),
              MODULE.filter((m) => m.bereich === b.name).map((m) =>
                h(`button.zeile-uebung.${b.akzent}`, { onTap: () => { plan = null; zeigeAnleitung(m); } },
                  h("span.zeile-icon", {}, icon(m.id)),
                  h("span.name", { text: m.titel }),
                  h("span.stufe", { text: `Stufe ${levelOf(profil, m.id)}` }),
                  icon("weiter"))),
            ]))),
      ),
    ),
  );
}

// ---------- Anleitung ----------
function zeigeAnleitung(m) {
  const stufe = levelOf(profil, m.id);
  const text = m.anleitung(stufe);
  const schritt = plan ? `Übung ${plan.index + 1} von ${plan.liste.length}` : m.bereich;
  screen(
    kopfzeile({ titel: m.titel, eyebrow: schritt, zurueck: zeigeStart }),
    h("main.inhalt.schmal.mittig", {},
      h(`div.symbol-gross.${akzentVon(m)}`, {}, icon(m.id)),
      h("span.eyebrow", { text: `Stufe ${stufe} von ${MAX_LEVEL}` }),
      h("p.anleitung", { text }),
      h("div.knopfreihe", {},
        h("button.knopf", { onTap: () => speak(text, { force: true }) }, icon("vorlesen"), h("span", { text: "Vorlesen" })),
        h("button.knopf.gross.primaer", { text: "Los geht's", onTap: () => starteUebung(m) })),
    ),
  );
  speak(text);
}

// ---------- Übung ----------
async function starteUebung(m) {
  const stufe = levelOf(profil, m.id);
  const stage = h("div.stage");
  screen(
    h("header.kopf.uebung-kopf", {},
      h("div.kopf-links", {},
        h("button.knopf", { onTap: zeigeStart }, icon("schliessen"), h("span", { text: "Beenden" })),
        h("h1", { text: m.titel, tabindex: "-1" })),
      h("span.stufe-klein", { text: `Stufe ${stufe}` })),
    h("main.inhalt.uebung" + (m.bereich === "Kartenspiele" ? ".tisch" : ""), {}, stage),
  );
  const sitzung = { alive: true };
  laufendeSitzung = sitzung;

  const ctx = {
    stage, stufe, settings: profil.settings, bests: profil.bests,
    alive: () => sitzung.alive,
    speak: (t) => speak(t),
  };
  let ergebnis;
  try {
    ergebnis = await m.run(ctx);
  } catch (err) {
    console.error(err);
    feedback(stage, "Da ist etwas schiefgelaufen.", "neutral");
    return;
  }
  if (!ergebnis || !sitzung.alive) return; // abgebrochen

  const { alt, neu } = adapt(profil, m.id, Math.max(0, Math.min(1, ergebnis.score)));
  zeigeErgebnis(m, ergebnis, alt, neu);
}

function zeigeErgebnis(m, ergebnis, alt, neu) {
  const lob = ergebnis.score >= 0.8 ? "Sehr gut gemacht" : ergebnis.score >= 0.5 ? "Gut gemacht" : "Danke fürs Üben";
  const stufeText = neu > alt ? "Beim nächsten Mal geht es eine Stufe höher weiter."
    : neu < alt ? "Beim nächsten Mal wird es etwas leichter."
    : "Sie bleiben auf dieser Stufe.";
  const naechste = plan && plan.index + 1 < plan.liste.length ? plan.liste[plan.index + 1] : null;
  const planFertig = plan && !naechste;

  screen(
    kopfzeile({ titel: m.titel, eyebrow: "Ergebnis" }),
    h("main.inhalt.schmal.mittig", {},
      h("div.ergebnis-zahl", {}, h("small", { text: neu > alt ? "Neue Stufe" : "Stufe" }), String(neu)),
      h("h2.lob", { text: planFertig ? "Training für heute geschafft" : lob }),
      h("p.anleitung", { text: ergebnis.text }),
      h("p.leise-text", { text: stufeText }),
      h("div.knopfreihe", {},
        h("button.knopf", { text: "Zur Übersicht", onTap: zeigeStart }),
        naechste
          ? h("button.knopf.gross.primaer", {
              text: `Weiter: ${naechste.titel}`,
              onTap: () => { plan.index++; zeigeAnleitung(naechste); },
            })
          : h("button.knopf.gross.primaer", { text: "Noch einmal", onTap: () => { plan = null; zeigeAnleitung(m); } })),
    ),
  );
  speak(`${planFertig ? "Training für heute geschafft." : lob + "."} ${ergebnis.text} ${stufeText}`);
}

// ---------- Einstufung ----------
function zeigeEinstufung() {
  plan = null;
  screen(); // beendet eine laufende Übung und das Vorlesen
  starteEinstufung({ app, profil, module: MODULE, bereiche: BEREICHE, speak, onFertig: zeigeStart, onAbbruch: zeigeStart });
}

// ---------- Verlauf ----------
function zeigeVerlauf() {
  const hist = profil.history;
  const tage = new Set(hist.map((e) => new Date(e.t).toDateString()));
  screen(
    kopfzeile({ titel: "Mein Verlauf", eyebrow: profil.name, zurueck: zeigeStart }),
    h("main.inhalt.schmal", {},
      h("div.knopfreihe", {},
        h("button.knopf.primaer", { onTap: () => oeffneBericht(profil, MODULE, BEREICHE) }, icon("bericht"), h("span", { text: "Bericht drucken oder als PDF" })),
        h("button.knopf", { onTap: zeigeEinstufung }, icon("einstufung"), h("span", { text: profil.einstufung ? "Einstufung wiederholen" : "Einstufung machen" }))),
      h("p.einleitung", { text: `An ${tage.size} Tagen geübt, ${hist.length} Übungen insgesamt.` }),
      MODULE.map((m) => {
        const eintraege = hist.filter((e) => e.modul === m.id);
        if (!eintraege.length) return null;
        return h("section.verlauf", {},
          h("h2", { text: `${m.titel} · Stufe ${levelOf(profil, m.id)}` }),
          h("div.balken", { "aria-label": "Stufen der letzten Übungen" },
            eintraege.slice(-20).map((e) => h("span", {
              style: { height: `${(e.neueStufe / MAX_LEVEL) * 100}%` },
              title: `${new Date(e.t).toLocaleDateString("de-DE")}: Stufe ${e.neueStufe}`,
            }))));
      }),
      hist.length ? null : h("p.leise-text", { text: "Noch keine Übungen – starten Sie auf der Übersicht mit dem Vorschlag für heute." }),
    ),
  );
}

// ---------- Einstellungen ----------
function zeigeEinstellungen() {
  const s = profil.settings;
  s.darstellung ??= "auto";
  const setze = (k, v) => {
    s[k] = v; updateProfile(profil);
    if (k === "darstellung") save("darstellung", v); // auch für den Profil-Bildschirm merken
    applySettings(); zeigeEinstellungen();
  };
  const wahl = (titel, key, optionen) => h("section.einstellung", {},
    h("h2", { text: titel }),
    h("div.knopfreihe", { role: "radiogroup" }, optionen.map(([wert, label]) =>
      h("button.knopf.option" + (s[key] === wert ? ".aktiv" : ""), {
        text: label, role: "radio", "aria-checked": String(s[key] === wert), onTap: () => setze(key, wert),
      }))));

  // Skat-Hausregeln (werden vom Skat-Modul über ctx.settings.skat gelesen)
  s.skat = { ramsch: true, schieberamsch: false, bock: true, kontra: false, ...(s.skat ?? {}) };
  const skatRegeln = () => h("section.einstellung", {},
    h("h2", { text: "Skat-Hausregeln" }),
    [["ramsch", "Ramsch, wenn alle passen"], ["schieberamsch", "Schieberamsch"], ["bock", "Bockrunden"], ["kontra", "Kontra und Re"]].map(([key, label]) =>
      h("div.knopfreihe", { role: "group", "aria-label": label },
        h("span.einstellung-label", { text: label }),
        [[true, "An"], [false, "Aus"]].map(([wert, text]) =>
          h("button.knopf.option" + (s.skat[key] === wert ? ".aktiv" : ""), {
            text, "aria-pressed": String(s.skat[key] === wert),
            onTap: () => { s.skat = { ...s.skat, [key]: wert }; updateProfile(profil); zeigeEinstellungen(); },
          })))));

  const datei = h("input", { type: "file", accept: "application/json", style: { display: "none" } });
  datei.addEventListener("change", async () => {
    try { importAll(await datei.files[0].text()); alert("Sicherung wiederhergestellt."); zeigeProfile(); }
    catch { alert("Die Datei konnte nicht gelesen werden."); }
  });

  screen(
    kopfzeile({ titel: "Einstellungen", eyebrow: profil.name, zurueck: zeigeStart }),
    h("main.inhalt.schmal", {},
      wahl("Darstellung", "darstellung", [["hell", "Hell"], ["dunkel", "Dunkel"], ["auto", "Wie das Gerät"]]),
      wahl("Schriftgröße", "schrift", [["normal", "Normal"], ["gross", "Groß"], ["extra", "Sehr groß"]]),
      wahl("Kartenblatt", "blatt", [["franzoesisch", "Französisch ♣ ♠ ♥ ♦"], ["deutsch", "Deutsch (Eichel, Grün, Rot, Schellen)"]]),
      skatRegeln(),
      wahl("Automatisch vorlesen", "autoVorlesen", [[false, "Aus"], [true, "An"]]),
      wahl("Stärkerer Kontrast", "kontrast", [[false, "Aus"], [true, "An"]]),
      wahl("Weniger Bewegung", "ruhig", [[false, "Aus"], [true, "An"]]),
      h("section.einstellung", {},
        h("h2", { text: "Daten sichern" }),
        h("p.leise-text", { text: "Alle Daten bleiben auf diesem Gerät. Mit einer Sicherungsdatei lassen sie sich auf ein anderes Gerät übertragen." }),
        h("div.knopfreihe", {},
          h("button.knopf", {
            text: "Sicherung speichern",
            onTap: () => {
              const blob = new Blob([exportAll()], { type: "application/json" });
              h("a", { href: URL.createObjectURL(blob), download: `kopf-fit-sicherung-${today()}.json` }).click();
            },
          }),
          h("button.knopf", { text: "Sicherung laden", onTap: () => datei.click() }),
          datei)),
      h("section.einstellung", {},
        h("h2", { text: "Profil" }),
        h("div.knopfreihe", {},
          h("button.knopf", { text: "Person wechseln", onTap: zeigeProfile }),
          h("button.knopf.gefahr", {
            text: `Profil „${profil.name}“ löschen`,
            onTap: () => { if (confirm(`Profil ${profil.name} mit allen Ergebnissen wirklich löschen?`)) { deleteProfile(profil.id); zeigeProfile(); } },
          }))),
    ),
  );
}

// ---------- Start ----------
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
const profile = listProfiles();
if (profile.length === 1) { profil = profile[0]; zeigeStart(); } else zeigeProfile();
