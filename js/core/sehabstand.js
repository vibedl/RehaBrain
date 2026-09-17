// Kopf-Fit – Sehabstand-Kalibrierung ohne Kamera (wiederverwendbar für Übungen im Bereich „Sehen & Raum“)
// 1. Eine Bankkarte (85,6 mm breit) an ein Rechteck auf dem Bildschirm halten und die Größe anpassen → Pixel pro mm
// 2. Sitzabstand wählen (40 / 50 / 60 cm) → Winkelgrade lassen sich in Bildschirm-Pixel umrechnen.
// Gespeichert in bests.sehkalibrierung = { pxProMm, abstandCm, bildschirm, datum, geschaetzt }
import { h, debounced } from "./ui.js";

// ---------- Reine Logik (ohne DOM, in Node testbar) ----------

export const KARTE_MM = 85.6;
export const KARTE_HOEHE_MM = 53.98;
export const ABSTAENDE_CM = [40, 50, 60];
/** CSS-Pixel pro mm bei „Standard-Bildschirm“ (96 dpi) – nur Notlösung ohne Karte */
export const STANDARD_PX_PRO_MM = 96 / 25.4;

/** Bildschirmkennung, unabhängig von Hoch-/Querformat */
export function bildschirmKennung(breite, hoehe) {
  if (!breite || !hoehe) return null;
  return `${Math.max(breite, hoehe)}x${Math.min(breite, hoehe)}`;
}
const aktuellerBildschirm = () =>
  typeof screen !== "undefined" ? bildschirmKennung(screen.width, screen.height) : null;

/** Muss (neu) kalibriert werden? Ja, wenn nichts gespeichert ist oder sich der Bildschirm geändert hat. */
export function kalibrierungNoetig(bests, bildschirm = aktuellerBildschirm()) {
  const k = bests?.sehkalibrierung;
  if (!k || !(k.pxProMm > 0) || !(k.abstandCm > 0)) return true;
  if (bildschirm && k.bildschirm && k.bildschirm !== bildschirm) return true;
  return false;
}

/** Pixel pro mm aus der eingestellten Breite des Karten-Rechtecks */
export const pxProMmAusKarte = (kartenBreitePx) => kartenBreitePx / KARTE_MM;

/** Sehwinkel (Grad, Abstand von der Blickmitte) → Bildschirm-Pixel */
export function gradZuPx(grad, kalib) {
  const abstandMm = kalib.abstandCm * 10;
  return Math.tan((grad * Math.PI) / 180) * abstandMm * kalib.pxProMm;
}

/** Bildschirm-Pixel (Abstand von der Blickmitte) → Sehwinkel in Grad */
export function pxZuGrad(px, kalib) {
  const abstandMm = kalib.abstandCm * 10;
  return (Math.atan(px / kalib.pxProMm / abstandMm) * 180) / Math.PI;
}

/** Kalibrierungs-Objekt bauen */
export function baueKalibrierung(pxProMm, abstandCm, { geschaetzt = false, bildschirm = aktuellerBildschirm(), datum = new Date().toISOString().slice(0, 10) } = {}) {
  return { pxProMm: Math.round(pxProMm * 1000) / 1000, abstandCm, bildschirm, datum, geschaetzt };
}

// ---------- Darstellung ----------

const kartenSVG = () => `<svg viewBox="0 0 856 540" preserveAspectRatio="none" aria-hidden="true">
  <rect x="4" y="4" width="848" height="532" rx="32" class="sv-kal-karte"/>
  <rect x="80" y="170" width="120" height="90" rx="12" class="sv-kal-chip"/>
  <path d="M80 380h420M80 440h260" class="sv-kal-linie"/></svg>`;

/** Bild: Person vor dem Bildschirm mit Abstandspfeil */
function abstandSVG(cm) {
  const x = 60 + cm * 3.2; // Kopfposition
  return `<svg viewBox="0 0 320 150" aria-hidden="true" class="sv-kal-bild">
    <rect x="16" y="30" width="12" height="80" rx="3" class="sv-kal-geraet"/>
    <path d="M22 110v18M10 128h24" class="sv-kal-strich"/>
    <circle cx="${x}" cy="62" r="17" class="sv-kal-kopf"/>
    <path d="M${x - 5} 60h-10" class="sv-kal-strich"/>
    <path d="M${x} 80v20c0 10 6 18 18 28M${x - 4} 96l-24 12" class="sv-kal-strich"/>
    <path d="M30 62H${x - 20}" class="sv-kal-pfeil" stroke-dasharray="5 6"/>
    <path d="M38 55l-8 7 8 7M${x - 28} 55l8 7-8 7" class="sv-kal-pfeil"/>
    <text x="${(30 + x - 20) / 2}" y="46" text-anchor="middle" class="sv-kal-text">${cm} cm</text></svg>`;
}

/**
 * Kalibrierung zeigen. Löst mit dem gespeicherten Kalibrierungs-Objekt auf, oder mit null bei Abbruch
 * (stage nicht mehr im Dokument oder opt.alive() liefert false).
 * @param {HTMLElement} stage
 * @param {object} bests  wird beschrieben: bests.sehkalibrierung
 * @param {{alive?: () => boolean}} [opt]
 */
export function zeigeKalibrierung(stage, bests, { alive = () => true } = {}) {
  return new Promise((resolve) => {
    let fertig = false;
    const ende = (wert) => {
      if (fertig) return;
      fertig = true;
      clearInterval(waechter);
      document.removeEventListener("keydown", tasten);
      stage.replaceChildren();
      resolve(wert);
    };
    const waechter = setInterval(() => { if (!alive() || !stage.isConnected) ende(null); }, 300);
    let tasten = () => {};

    const alt = bests.sehkalibrierung;
    const verfuegbar = () => Math.max(160, (stage.clientWidth || 600) - 16);
    let breite = Math.min(verfuegbar(), Math.round((alt?.pxProMm > 0 && !alt.geschaetzt ? alt.pxProMm : STANDARD_PX_PRO_MM) * KARTE_MM));
    let pxProMm = null, geschaetzt = false;

    // ---- Schritt 1: Karte ----
    const schrittKarte = () => {
      const karte = h("div.sv-kal-kartenrahmen", { html: kartenSVG() });
      const mass = h("p.hinweis", { "aria-live": "polite" });
      const setze = (w) => {
        breite = Math.max(120, Math.min(verfuegbar(), Math.round(w)));
        karte.style.width = breite + "px";
        karte.style.height = Math.round((breite * KARTE_HOEHE_MM) / KARTE_MM) + "px";
        mass.textContent = `Breite: ${breite} Bildpunkte`;
      };
      const knopf = (text, delta, label) => h("button.knopf.gross.sv-kal-plusminus", {
        text, "aria-label": label, onTap: () => setze(breite + delta),
      });
      tasten = (e) => {
        if (e.key === "+" || e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setze(breite + (e.shiftKey ? 20 : 2)); }
        else if (e.key === "-" || e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setze(breite - (e.shiftKey ? 20 : 2)); }
      };
      document.addEventListener("keydown", tasten);
      stage.replaceChildren(
        h("p.hinweis.gross", { text: "Schritt 1 von 2: Bildschirm vermessen" }),
        h("p.sv-kal-text-block", { text: "Halten Sie eine Bankkarte (EC-Karte, Krankenkassenkarte) flach auf das Rechteck. Machen Sie das Rechteck mit den Knöpfen so groß, dass es genau so breit ist wie die Karte." }),
        h("div.sv-kal-kartenplatz", {}, karte),
        mass,
        h("div.knopfreihe.sv-kal-reihe", {},
          knopf("− viel", -20, "Viel kleiner"), knopf("−", -2, "Etwas kleiner"),
          knopf("+", 2, "Etwas größer"), knopf("+ viel", 20, "Viel größer")),
        h("div.knopfreihe", {},
          h("button.knopf", {
            text: "Ich habe keine Karte",
            onTap: () => { geschaetzt = true; pxProMm = STANDARD_PX_PRO_MM; document.removeEventListener("keydown", tasten); schrittAbstand(); },
          }),
          h("button.knopf.gross.primaer", {
            text: "Passt genau",
            onTap: () => { geschaetzt = false; pxProMm = pxProMmAusKarte(breite); document.removeEventListener("keydown", tasten); schrittAbstand(); },
          })),
      );
      setze(breite);
    };

    // ---- Schritt 2: Abstand ----
    const schrittAbstand = () => {
      const vorwahl = ABSTAENDE_CM.includes(alt?.abstandCm) ? alt.abstandCm : 50;
      stage.replaceChildren(...[
        h("p.hinweis.gross", { text: "Schritt 2 von 2: Sitzabstand" }),
        h("p.sv-kal-text-block", { text: "Wie weit sind Ihre Augen vom Bildschirm entfernt? Ein Unterarm (Ellbogen bis Fingerspitzen) ist etwa 45 cm lang, ein ausgestreckter Arm etwa 60 cm. Bleiben Sie während der Übung ungefähr so sitzen." }),
        geschaetzt ? h("p.leise-text.sv-kal-text-block", { text: "Ohne Karte wird die Bildschirmgröße nur geschätzt. Die Übung funktioniert trotzdem, die Gradangaben sind dann ungenauer." }) : null,
        h("div.sv-kal-abstaende", { role: "radiogroup", "aria-label": "Sitzabstand" },
          ABSTAENDE_CM.map((cm) => h("button.sv-kal-abstand" + (cm === vorwahl ? ".sv-kal-vorwahl" : ""), {
            role: "radio", "aria-checked": String(cm === vorwahl), "aria-label": `${cm} Zentimeter`,
            html: abstandSVG(cm) + `<span>${cm} cm${cm === 40 ? " – nah" : cm === 50 ? " – mittel" : " – Armlänge"}</span>`,
            onTap: () => {
              const k = baueKalibrierung(pxProMm, cm, { geschaetzt });
              bests.sehkalibrierung = k;
              ende(k);
            },
          }))),
        h("div.knopfreihe", {}, h("button.knopf", { text: "Zurück zur Karte", onTap: schrittKarte })),
      ].filter(Boolean));
    };

    schrittKarte();
  });
}

/** Knopf-Handler-Helfer für Module, die die Kalibrierung neu starten wollen */
export const neuKalibrierenKnopf = (fn) => {
  const b = h("button.knopf", { text: "Bildschirm neu vermessen" });
  b.onclick = debounced(fn);
  return b;
};
