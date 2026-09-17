// Tisch-Oberfläche für Kartenspiele mit Gegnern (Mau-Mau, später Rommé, Sechsundsechzig, Skat).
// Baut Statuszeile, verdeckte Gegner-Hände, Nachzieh- und Ablagestapel und die eigene Hand
// als Reihe großer antippbarer Karten. Die Spielregeln selbst stehen NICHT hier (siehe engine.js
// und die einzelnen Spiele) – der Tisch meldet nur, was angetippt wurde.
import { h, sleep, debounced } from "../core/ui.js";
import { karteElement, kartenName, BLAETTER } from "./deck.js";

/** css/karten.css einmalig nachladen, falls sie nicht schon in index.html eingebunden ist. */
export function kartenStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-kt-styles], link[href$="css/karten.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/karten.css", import.meta.url).href;
  link.setAttribute("data-kt-styles", "");
  document.head.append(link);
}

/**
 * Wartet auf eine Eingabe. `aufbau(resolve)` hängt Handler an; bricht die Übung ab, wird mit null aufgelöst.
 * `aufraeumen` wird in jedem Fall danach aufgerufen.
 */
export function warteAufEingabe(ctx, aufbau, aufraeumen = () => {}) {
  return new Promise((resolve) => {
    let fertig = false;
    const ende = (wert) => {
      if (fertig) return;
      fertig = true;
      clearInterval(warte);
      aufraeumen();
      resolve(wert);
    };
    const warte = setInterval(() => { if (!ctx.alive()) ende(null); }, 300);
    aufbau(ende);
  });
}

/** Farbname passend zum gewählten Blatt ("herz" -> "Herz" bzw. "Rot") */
export function farbName(farbe, blatt = "franzoesisch") {
  return BLAETTER[blatt].farben.find((f) => f.id === farbe)?.name ?? farbe;
}
/** CSS-Klasse der Farbe ("herz" -> "herz" bzw. "rot"), passend zu .stapel.* und .karte.* in style.css */
export function farbCss(farbe, blatt = "franzoesisch") {
  return BLAETTER[blatt].farben.find((f) => f.id === farbe)?.css ?? farbe;
}

export class Tisch {
  /**
   * @param ctx  Übungs-Kontext (stage, settings, alive …)
   * @param opts.gegner  Namen der Gegner, z. B. ["Computer 1", "Computer 2"]
   */
  constructor(ctx, { gegner = [] } = {}) {
    kartenStyles();
    this.ctx = ctx;
    this.blatt = ctx.settings?.blatt ?? "franzoesisch";

    this.statusEl = h("p.hinweis.gross.kt-status", { "aria-live": "polite" });
    this.gegnerEls = gegner.map((name) => {
      const anzahl = h("span.kt-anzahl");
      const info = h("span.kt-info");
      const el = h("div.kt-gegner", {}, h("div.kt-faecher", {}, karteElement(null, { verdeckt: true }), karteElement(null, { verdeckt: true })),
        h("div.kt-gegnertext", {}, h("span.kt-name", { text: name }), anzahl, info));
      return { el, anzahl, info, name };
    });
    this.gegnerReihe = h("div.kt-gegnerreihe", {}, this.gegnerEls.map((g) => g.el));

    this.nachziehAnzahl = h("span.kt-stapeltext");
    this.nachziehEl = h("button.kt-nachzieh", { type: "button", "aria-label": "Nachziehstapel", disabled: true },
      karteElement(null, { verdeckt: true }), this.nachziehAnzahl);
    this.ablageEl = h("div.kt-ablage", { "aria-live": "polite" });
    this.zusatzEl = h("div.kt-zusatz");
    this.mitte = h("div.kt-mitte", {}, h("div.kt-stapelplatz", {}, this.nachziehEl), h("div.kt-stapelplatz", {}, this.ablageEl, this.zusatzEl));

    this.handEl = h("div.kt-hand", { role: "group", "aria-label": "Ihre Karten" });
    this.aktionenEl = h("div.knopfreihe.kt-aktionen");
    this.el = h("div.kt-tisch", {}, this.gegnerReihe, this.statusEl, this.mitte, this.handEl, this.aktionenEl);
    ctx.stage.append(this.el);
  }

  status(text) { this.statusEl.textContent = text; }

  /** Gegner-Anzeige aktualisieren. aktiv = gerade am Zug. info = Zusatztext (z. B. "fertig" oder "Platz 2"). */
  setzeGegner(i, anzahl, { aktiv = false, info = "" } = {}) {
    const g = this.gegnerEls[i];
    if (!g) return;
    g.anzahl.textContent = anzahl === 1 ? "1 Karte" : `${anzahl} Karten`;
    g.info.textContent = info;
    g.el.classList.toggle("kt-aktiv", aktiv);
  }

  /** Ablagestapel: oberste Karte + optionaler Zusatz (z. B. gewünschte Farbe als {farbe, text}). */
  setzeAblage(karte, { zusatz = "", zusatzFarbe = null, neu = false } = {}) {
    const k = karteElement(karte);
    if (neu) k.classList.add("neu");
    this.ablageEl.replaceChildren(k);
    this.zusatzEl.replaceChildren();
    if (zusatz) {
      this.zusatzEl.append(h("span.kt-chip" + (zusatzFarbe ? ".stapel." + farbCss(zusatzFarbe, this.blatt) : ""), { text: zusatz }));
    }
  }

  setzeNachzieh(anzahl) {
    this.nachziehAnzahl.textContent = anzahl === 1 ? "1 Karte" : `${anzahl} Karten`;
    this.nachziehEl.classList.toggle("kt-leer", anzahl === 0);
  }

  /** Eigene Hand nur anzeigen (ohne Auswahl), z. B. während die Computer spielen. */
  zeigeHand(hand) {
    this.handEl.classList.remove("kt-waehlbar");
    this.handEl.replaceChildren(...hand.map((k) => karteElement(k)));
    this.aktionenEl.replaceChildren();
    this.nachziehEl.disabled = true;
  }

  /** Statuszeile „… überlegt“ und ~1 s Pause. Gibt false zurück, wenn die Übung abgebrochen wurde. */
  async computerUeberlegt(name, ms = 1000) {
    this.status(`${name} überlegt …`);
    await sleep(ms);
    return this.ctx.alive();
  }

  /**
   * Spieler wählt eine Karte aus der Hand, zieht oder tippt einen Zusatzknopf.
   * opts.hand        Karten (in Anzeige-Reihenfolge)
   * opts.spielbar    (karte) => bool – nur für die Hilfe-Markierung (Regelprüfung macht das Spiel)
   * opts.hilfe       spielbare Karten hervorheben
   * opts.direkt      true: Antippen spielt sofort. false: Antippen markiert, „Ausspielen“ spielt.
   * opts.ziehen      Text für den Zieh-Knopf (auch Nachziehstapel antippbar) oder null
   * opts.knoepfe     weitere Knöpfe [{ id, text, primaer }]
   * @returns {typ:"karte", karte} | {typ:"ziehen"} | {typ:"knopf", id} | null (abgebrochen)
   */
  waehle({ hand, spielbar = () => true, hilfe = false, direkt = false, ziehen = null, knoepfe = [] }) {
    const ctx = this.ctx;
    let gewaehlt = null;
    let ausspielen = null;
    return warteAufEingabe(ctx, (ende) => {
      this.handEl.classList.add("kt-waehlbar");
      const karten = hand.map((k) => {
        const el = karteElement(k, { tag: "button" });
        el.type = "button";
        el.setAttribute("aria-pressed", "false");
        if (hilfe && spielbar(k)) el.classList.add("kt-spielbar");
        el.onclick = debounced(() => {
          if (direkt) return ende({ typ: "karte", karte: k });
          gewaehlt = k;
          karten.forEach(({ el: e, k: kk }) => {
            const an = kk.id === k.id;
            e.classList.toggle("kt-gewaehlt", an);
            e.setAttribute("aria-pressed", String(an));
          });
          ausspielen.disabled = false;
          ausspielen.textContent = `${kartenName(k)} ausspielen`;
        });
        return { el, k };
      });
      this.handEl.replaceChildren(...karten.map((x) => x.el));

      const reihe = [];
      if (!direkt) {
        ausspielen = h("button.knopf.gross.primaer.kt-ausspielen", { type: "button", text: "Karte antippen, dann ausspielen", disabled: true });
        ausspielen.onclick = debounced(() => { if (gewaehlt) ende({ typ: "karte", karte: gewaehlt }); });
        reihe.push(ausspielen);
      }
      if (ziehen) {
        reihe.push(h("button.knopf.gross", { type: "button", text: ziehen, onclick: debounced(() => ende({ typ: "ziehen" })) }));
        this.nachziehEl.disabled = false;
        this.nachziehEl.onclick = debounced(() => ende({ typ: "ziehen" }));
      }
      for (const kn of knoepfe) {
        reihe.push(h("button.knopf.gross" + (kn.primaer ? ".primaer" : ""), { type: "button", text: kn.text, onclick: debounced(() => ende({ typ: "knopf", id: kn.id })) }));
      }
      this.aktionenEl.replaceChildren(...reihe);
    }, () => {
      this.handEl.classList.remove("kt-waehlbar");
      this.handEl.querySelectorAll("button").forEach((b) => { b.onclick = null; b.disabled = true; });
      this.aktionenEl.replaceChildren();
      this.nachziehEl.disabled = true;
      this.nachziehEl.onclick = null;
    });
  }

  /**
   * Große Auswahl-Knöpfe über der Hand (z. B. Farbwunsch). optionen: [{ id, text, klasse }]
   * @returns id oder null (abgebrochen)
   */
  frage(text, optionen) {
    const alterStatus = this.statusEl.textContent;
    this.status(text);
    const box = h("div.kt-frage");
    return warteAufEingabe(this.ctx, (ende) => {
      box.append(...optionen.map((o) => h("button.stapel.kt-wahl" + (o.klasse ? "." + o.klasse : ""), {
        type: "button", text: o.text, onclick: debounced(() => ende(o.id)),
      })));
      this.aktionenEl.replaceChildren(box);
    }, () => { this.aktionenEl.replaceChildren(); this.status(alterStatus); });
  }

  /** Die vier Farben des aktuellen Blatts als Auswahl. @returns Farb-id ("kreuz"|"pik"|"herz"|"karo") oder null */
  farbWahl(text = "Welche Farbe wünschen Sie sich?") {
    const opts = BLAETTER[this.blatt].farben.map((f) => ({ id: f.id, text: f.name, klasse: f.css }));
    return this.frage(text, opts);
  }

  entfernen() { this.el.remove(); }
}
