// Kopf-Fit – Barrierefreiheit auf Profi-Niveau: Schalter-/Tastatur-Scanning, Tipp-Verzögerung
// (Verweildauer), Doppeltipp-Sperrzeit, Farbfehlsichtigkeits-sichere Markierungen.
// Arbeitet generisch über DOM-Buttons in `.stage` (MutationObserver) – Module werden nicht verändert.
import { h } from "./ui.js";

// ============================================================
// 1) Scanning-Modus: Elemente in .stage nacheinander hervorheben,
//    eine Taste (Leertaste/Enter oder ein großer Bildschirm-Schalter) wählt aus.
//    Zusätzlich: Pfeiltasten-Navigation im 2D-Raster für Raster-Übungen.
// ============================================================

const AUSWAHLBAR = 'button, [role="button"], a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Sichtbare, nicht gesperrte Elemente innerhalb eines Containers, in DOM-Reihenfolge */
function findeElemente(container) {
  return [...container.querySelectorAll(AUSWAHLBAR)].filter((el) => {
    if (el.disabled || el.getAttribute("aria-hidden") === "true" || el.hasAttribute("hidden")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** Elemente nach Raster-Zeilen gruppieren (Toleranz für leicht ungleiche Pixelwerte) */
function nachZeilenGruppieren(elemente, toleranz = 12) {
  const zeilen = [];
  for (const el of elemente) {
    const y = el.getBoundingClientRect().top;
    let zeile = zeilen.find((z) => Math.abs(z.y - y) <= toleranz);
    if (!zeile) { zeile = { y, els: [] }; zeilen.push(zeile); }
    zeile.els.push(el);
  }
  zeilen.sort((a, b) => a.y - b.y);
  for (const z of zeilen) z.els.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return zeilen.map((z) => z.els);
}

/**
 * Startet den Scanning-Modus für einen Container (Standard: die `.stage` der laufenden Übung).
 * @param {object} o
 * @param {HTMLElement} [o.container]     Standard: erstes `.stage`-Element im Dokument
 * @param {number} [o.tempoMs]            Zeit je Element, bevor zum nächsten weitergeht (Standard 1600 ms)
 * @param {string} [o.auswahlTaste]       Taste, die auswählt (Standard " " Leertaste; auch Enter wirkt immer)
 * @returns {{ stop: Function, pause: Function, weiter: Function, aktiv: () => boolean }}
 */
export function starteScanning({ container, tempoMs = 1600, auswahlTaste = " " } = {}) {
  const wurzel = container ?? document.querySelector(".stage") ?? document.body;
  let elemente = findeElemente(wurzel);
  let index = -1;
  let timer = null;
  let laeuft = true;
  let markierung = null;

  const markiere = (el) => {
    markierung?.classList.remove("bd-scan-aktiv");
    markierung = el ?? null;
    markierung?.classList.add("bd-scan-aktiv");
    markierung?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };

  const weiter = () => {
    if (!elemente.length) return;
    index = (index + 1) % elemente.length;
    markiere(elemente[index]);
  };

  const zurueck = () => {
    if (!elemente.length) return;
    index = (index - 1 + elemente.length) % elemente.length;
    markiere(elemente[index]);
  };

  const neuStart = () => { elemente = findeElemente(wurzel); if (index >= elemente.length) index = -1; };

  const auswaehlen = () => { if (index >= 0 && elemente[index]) elemente[index].click(); };

  const takt = () => { if (!laeuft) return; weiter(); timer = setTimeout(takt, tempoMs); };

  const beobachter = new MutationObserver(() => neuStart());
  beobachter.observe(wurzel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "aria-hidden"] });

  const taste = (e) => {
    if (e.key === auswahlTaste || e.key === "Enter") { e.preventDefault(); auswaehlen(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); clearTimeout(timer); weiter(); if (laeuft) timer = setTimeout(takt, tempoMs); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); clearTimeout(timer); zurueck(); if (laeuft) timer = setTimeout(takt, tempoMs); }
  };
  document.addEventListener("keydown", taste);

  timer = setTimeout(takt, tempoMs);

  return {
    aktiv: () => laeuft || index >= 0,
    pause() { laeuft = false; clearTimeout(timer); },
    fortsetzen() { laeuft = true; timer = setTimeout(takt, tempoMs); },
    auswaehlen,
    weiter,
    zurueck,
    stop() {
      laeuft = false;
      clearTimeout(timer);
      document.removeEventListener("keydown", taste);
      beobachter.disconnect();
      markiere(null);
    },
  };
}

/**
 * Pfeiltasten-Navigation im 2D-Raster (z. B. Suchbild, Wege): Pfeile bewegen den Tastaturfokus
 * zwischen Rasterzellen, Leertaste/Enter lösen den Standard-Klick aus (nativ über Fokus + Enter).
 * @param {HTMLElement} container   Elternelement des Rasters (z. B. `.suchraster`, `.brett`)
 * @returns {{ stop: Function }}
 */
export function rasterNavigation(container) {
  const taste = (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const elemente = findeElemente(container);
    if (!elemente.length) return;
    const aktiv = document.activeElement;
    const zeilen = nachZeilenGruppieren(elemente);
    let zi = zeilen.findIndex((z) => z.includes(aktiv));
    let si = zi >= 0 ? zeilen[zi].indexOf(aktiv) : -1;
    if (zi < 0) { zeilen[0][0]?.focus(); e.preventDefault(); return; }
    if (e.key === "ArrowRight") si++;
    else if (e.key === "ArrowLeft") si--;
    else if (e.key === "ArrowDown") { zi++; si = Math.min(si, (zeilen[zi]?.length ?? 1) - 1); }
    else if (e.key === "ArrowUp") { zi--; si = Math.min(si, (zeilen[zi]?.length ?? 1) - 1); }
    zi = Math.max(0, Math.min(zeilen.length - 1, zi));
    si = Math.max(0, Math.min(zeilen[zi].length - 1, si));
    zeilen[zi][si]?.focus();
    e.preventDefault();
  };
  container.addEventListener("keydown", taste);
  return { stop: () => container.removeEventListener("keydown", taste) };
}

// ============================================================
// 2) Tipp-Verzögerung (Verweildauer) und Doppeltipp-Sperrzeit
//    Reine Funktionen – der Koordinator hängt sie in ui.js ein (siehe Abschlussbericht).
// ============================================================

/** Aktuelle Einstellungen, global über alle Übungen (aus profil.settings gefüllt) */
const einstellungen = { verweildauerMs: 0, sperrzeitMs: 300 };

/** Vom Koordinator beim Anwenden der Profileinstellungen aufzurufen */
export function setzeBedienungsEinstellungen({ verweildauerMs, sperrzeitMs } = {}) {
  if (verweildauerMs != null) einstellungen.verweildauerMs = Math.max(0, verweildauerMs);
  if (sperrzeitMs != null) einstellungen.sperrzeitMs = Math.max(0, sperrzeitMs);
}
export const bedienungsEinstellungen = () => ({ ...einstellungen });

/**
 * Ersatz für ui.js' `debounced`: schluckt Tipps innerhalb der Sperrzeit (wie bisher, Standard 300 ms,
 * aber einstellbar) UND verlangt bei Verweildauer > 0 ein Halten von mindestens dieser Zeit, bevor
 * der Tipp zählt (gegen versehentliches Antippen bei Tremor). Reine Logik, ohne DOM-Zugriff nötig.
 */
export function debouncedMitVerweildauer(fn, { verweildauerMs = () => einstellungen.verweildauerMs, sperrzeitMs = () => einstellungen.sperrzeitMs } = {}) {
  let lastTap = -Infinity;
  let haltStart = null;
  const dauerFn = typeof verweildauerMs === "function" ? verweildauerMs : () => verweildauerMs;
  const sperreFn = typeof sperrzeitMs === "function" ? sperrzeitMs : () => sperrzeitMs;

  const auf = () => { haltStart = performance.now(); };
  const ab = (e) => {
    const dauer = dauerFn();
    const jetzt = performance.now();
    if (dauer > 0) {
      const gehalten = haltStart == null ? 0 : jetzt - haltStart;
      haltStart = null;
      if (gehalten < dauer) return; // zu kurz gehalten – zählt nicht
    }
    if (jetzt - lastTap < sperreFn()) return;
    lastTap = jetzt;
    fn(e);
  };
  return { pointerdown: auf, mousedown: auf, touchstart: auf, click: ab };
}

/**
 * Hängt Verweildauer + Sperrzeit an ein Element (Alternative zu `onTap`, wenn Halten geprüft werden soll).
 */
export function mitVerweildauer(el, fn, opt) {
  const handler = debouncedMitVerweildauer(fn, opt);
  el.addEventListener("pointerdown", handler.pointerdown);
  el.addEventListener("click", handler.click);
  return el;
}

// ============================================================
// 3) Farbfehlsichtigkeits-sichere Markierungen: Muster/Symbole zusätzlich zu Farben.
//    Aktiviert über CSS-Klasse `bd-muster` am <html> (siehe bedienung.css).
// ============================================================

export const MUSTER_KLASSE = "bd-muster";

export function setzeMusterModus(an) {
  document.documentElement.classList.toggle(MUSTER_KLASSE, !!an);
}

export const musterModusAktiv = () => document.documentElement.classList.contains(MUSTER_KLASSE);

// ============================================================
// Einstellungs-Oberfläche (kleiner Baustein für zeigeEinstellungen in app.js, siehe Bericht)
// ============================================================

/**
 * Baut die Einstellungs-Abschnitte für Barrierefreiheit. Der Koordinator hängt das Ergebnis
 * in js/app.js' zeigeEinstellungen() ein (siehe Integrationsanleitung im Abschlussbericht).
 * @param {object} s          profil.settings (wird direkt verändert)
 * @param {Function} setze    (key, wert) => void – wie in app.js vorhanden
 */
export function bedienungsEinstellungenAbschnitte(s, setze) {
  const wahl = (titel, key, optionen, hinweis) => h("section.einstellung", {},
    h("h2", { text: titel }),
    hinweis ? h("p.leise-text", { text: hinweis }) : null,
    h("div.knopfreihe", { role: "radiogroup" }, optionen.map(([wert, label]) =>
      h("button.knopf.option" + (s[key] === wert ? ".aktiv" : ""), {
        text: label, role: "radio", "aria-checked": String(s[key] === wert), onTap: () => setze(key, wert),
      }))));

  return [
    wahl("Tipp-Verzögerung (Verweildauer)", "verweildauerMs",
      [[0, "Aus"], [300, "Kurz (0,3 s)"], [600, "Mittel (0,6 s)"], [1000, "Lang (1 s)"]],
      "Ein Tipp zählt erst, wenn so lange gehalten wurde. Hilft gegen versehentliches Antippen."),
    wahl("Doppeltipp-Sperrzeit", "sperrzeitMs",
      [[150, "Kurz"], [300, "Normal"], [600, "Lang"], [1000, "Sehr lang"]],
      "So lange werden weitere Tipps auf denselben Knopf nach einem Tipp ignoriert (gegen Zittern)."),
    wahl("Muster zusätzlich zu Farben", "farbmuster", [[false, "Aus"], [true, "An"]],
      "Zeigt bei Richtig/Falsch und Markierungen zusätzlich Symbole, nicht nur Farbe – hilfreich bei Farbfehlsichtigkeit."),
    wahl("Scanning-Modus (Schalter-Bedienung)", "scanning", [[false, "Aus"], [true, "An"]],
      "Elemente werden nacheinander hervorgehoben; eine Taste (Leertaste/Enter) wählt aus. Für Ein-Schalter-Bedienung."),
    s.scanning ? wahl("Scanning-Tempo", "scanTempoMs", [[900, "Schnell"], [1600, "Normal"], [2600, "Langsam"]]) : null,
  ].filter(Boolean);
}
