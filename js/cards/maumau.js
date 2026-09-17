// Karten Stufe 5: Mau-Mau gegen 1–3 Computer-Gegner
// Regeln (32er-Blatt): Farbe oder Wert bedienen. Sonderkarten werden mit der Stufe schrittweise zugeschaltet:
//   8 = nächster setzt aus, 7 = nächster zieht 2 (später stapelbar), Bube/Unter = Farbe wünschen, Ass = nochmal.
import { sleep, feedback } from "../core/ui.js";
import { neuesDeck, kartenName } from "./deck.js";
import {
  RANG, FARBEN, Kartenstapel, austeilen, sortiereHand, nimmAusHand, naechsterSpieler,
  waehleZug, Gedaechtnis, haeufigsteFarbe, zaehleFarben, mischen, denkpause,
} from "./engine.js";
import { Tisch, farbName } from "./tisch.js";

/* ================================================================ Stufen */

/** Alle stufenabhängigen Einstellungen an einer Stelle. */
export function maumauKonfig(stufe) {
  const s = Math.max(1, Math.min(20, stufe | 0 || 1));
  return {
    gegner: s <= 5 ? 1 : s <= 12 ? 2 : 3,
    staerke: s <= 7 ? 1 : s <= 14 ? 2 : 3,
    handKarten: s >= 10 ? 6 : 5,
    regeln: {
      acht: s >= 4,        // 8 = Aussetzen
      sieben: s >= 6,      // 7 = Zwei ziehen
      bube: s >= 8,        // Bube/Unter = Wünscher
      ass: s >= 10,        // Ass = nochmal
      stapeln: s >= 13,    // 7 auf 7 gibt weiter (4, 6, …)
    },
    hilfe: s <= 6,          // spielbare Karten hervorheben
    direkt: s <= 3,         // Antippen spielt sofort; sonst erst markieren, dann „Ausspielen“
    mauOptional: s >= 17,   // „Mau“ sagen – freiwillig, großzügige Zeit, nie Pflicht
  };
}

/* ================================================================ Spiellogik (ohne DOM) */

export const MAX_ZUEGE = 600; // Sicherung gegen Endlosschleifen (z. B. niemand kann legen, Stapel leer)

/**
 * Neues Spiel anlegen.
 * spieler[0] ist der Mensch (in Simulationen ebenfalls ein Computer).
 */
export function neuesSpiel({ blatt = "franzoesisch", gegner = 1, handKarten = 5, regeln = {}, rng = Math.random, karten = null } = {}) {
  const deck = karten ?? mischen(neuesDeck(blatt).sort((a, b) => (a.id < b.id ? -1 : 1)), rng); // sortiert, damit eine Saat reproduzierbar ist
  const stapel = new Kartenstapel(deck, rng);
  const anzahl = gegner + 1;
  const haende = austeilen(stapel.zieh, anzahl, handKarten);
  stapel.aufdecken(); // Startkarte – ihre Sonderwirkung gilt nicht
  return {
    regeln: { acht: false, sieben: false, bube: false, ass: false, stapeln: false, ...regeln },
    stapel,
    spieler: haende.map((hand, i) => ({ hand, name: i === 0 ? "Sie" : `Computer ${i}`, gedaechtnis: new Gedaechtnis() })),
    aktiv: 0,
    wunsch: null,     // gewünschte Farbe nach Bube
    ziehSumme: 0,     // offene Zieh-Strafe durch Siebenen
    gewinner: null,
    zuege: 0,
    rng,
  };
}

/** Farbe, die gerade bedient werden muss (Wunschfarbe hat Vorrang). */
export const geforderteFarbe = (sp) => sp.wunsch ?? sp.stapel.oben.farbe;

/** Darf `karte` jetzt gelegt werden? */
export function istLegal(sp, karte) {
  const oben = sp.stapel.oben;
  const { regeln } = sp;
  if (sp.ziehSumme > 0) return regeln.stapeln && karte.rang === RANG.SIEBEN;
  const istBube = regeln.bube && karte.rang === RANG.BUBE;
  if (istBube) return oben.rang !== RANG.BUBE; // Bube passt immer – nur nicht auf einen Buben
  if (sp.wunsch) return karte.farbe === sp.wunsch;
  return karte.farbe === oben.farbe || karte.rang === oben.rang;
}

export const legaleKarten = (sp, hand) => hand.filter((k) => istLegal(sp, k));

/** Kurzer Text, was gerade passt – für freundliche Hinweise. */
export function passtText(sp, blatt) {
  if (sp.ziehSumme > 0) return sp.regeln.stapeln
    ? `Legen Sie eine Sieben oder ziehen Sie ${sp.ziehSumme} Karten.`
    : `Sie müssen ${sp.ziehSumme} Karten ziehen.`;
  const oben = sp.stapel.oben;
  if (sp.wunsch) return `Gewünscht ist ${farbName(sp.wunsch, blatt)}.`;
  const wertName = kartenName(oben).split(" ").slice(1).join(" ");
  return `Es passt ${farbName(oben.farbe, blatt)} oder ${wertName}.`;
}

/**
 * Karte legen. Prüft Legalität, wendet Sonderregeln an und setzt den nächsten Spieler.
 * wunschFarbe: nur bei Bube nötig (sonst ignoriert).
 * @returns {ok, grund?, effekt: "aussetzen"|"ziehen"|"wunsch"|"nochmal"|null, fertig: bool}
 */
export function legeKarte(sp, spielerIndex, karte, wunschFarbe = null) {
  if (sp.gewinner != null) return { ok: false, grund: "vorbei" };
  if (spielerIndex !== sp.aktiv) return { ok: false, grund: "nicht dran" };
  const hand = sp.spieler[spielerIndex].hand;
  if (!hand.some((k) => k.id === karte.id)) return { ok: false, grund: "nicht in der Hand" };
  if (!istLegal(sp, karte)) return { ok: false, grund: "passt nicht" };

  nimmAusHand(hand, karte);
  sp.stapel.ablegen(karte);
  sp.spieler.forEach((s) => s.gedaechtnis.merke(karte));
  sp.wunsch = null;
  sp.zuege++;
  const { regeln } = sp;
  const anzahl = sp.spieler.length;
  let effekt = null;

  if (!hand.length) {
    sp.gewinner = spielerIndex;
    return { ok: true, effekt: null, fertig: true };
  }
  if (regeln.sieben && karte.rang === RANG.SIEBEN) {
    sp.ziehSumme += 2; effekt = "ziehen";
    sp.aktiv = naechsterSpieler(spielerIndex, anzahl);
  } else if (regeln.acht && karte.rang === RANG.ACHT) {
    effekt = "aussetzen";
    sp.aktiv = naechsterSpieler(spielerIndex, anzahl, { schritte: 2 });
  } else if (regeln.bube && karte.rang === RANG.BUBE) {
    effekt = "wunsch";
    sp.wunsch = FARBEN.includes(wunschFarbe) ? wunschFarbe : karte.farbe;
    sp.aktiv = naechsterSpieler(spielerIndex, anzahl);
  } else if (regeln.ass && karte.rang === RANG.ASS) {
    effekt = "nochmal"; // aktiv bleibt
  } else {
    sp.aktiv = naechsterSpieler(spielerIndex, anzahl);
  }
  return { ok: true, effekt, fertig: false };
}

/**
 * Ziehen. Bei offener Sieben-Strafe: alle Strafkarten ziehen, danach ist der Nächste dran.
 * Sonst: eine Karte ziehen; der Spieler darf sie danach sofort legen (dann legeKarte) oder passen (passe).
 * @returns {karten: [...], strafe: bool, darfLegen: bool}
 */
export function ziehe(sp, spielerIndex) {
  if (sp.gewinner != null || spielerIndex !== sp.aktiv) return { karten: [], strafe: false, darfLegen: false };
  const hand = sp.spieler[spielerIndex].hand;
  sp.zuege++;
  if (sp.ziehSumme > 0) {
    const karten = sp.stapel.ziehe(sp.ziehSumme);
    hand.push(...karten);
    sp.ziehSumme = 0;
    sp.aktiv = naechsterSpieler(spielerIndex, sp.spieler.length);
    return { karten, strafe: true, darfLegen: false };
  }
  const karten = sp.stapel.ziehe(1);
  hand.push(...karten);
  const darfLegen = karten.length === 1 && istLegal(sp, karten[0]);
  return { karten, strafe: false, darfLegen };
}

/** Nach dem Ziehen nicht legen: der Nächste ist dran. */
export function passe(sp, spielerIndex) {
  if (spielerIndex !== sp.aktiv || sp.gewinner != null) return;
  sp.aktiv = naechsterSpieler(spielerIndex, sp.spieler.length);
}

/** Wunschfarbe für einen Computer: die häufigste eigene Farbe (ohne den gerade gelegten Buben). */
export function computerWunsch(hand, rng = Math.random, staerke = 2, gedaechtnis = null) {
  const ohneBuben = hand.filter((k) => k.rang !== RANG.BUBE);
  if (!ohneBuben.length) return FARBEN[Math.floor(rng() * 4)];
  if (staerke <= 1 && rng() < 0.5) return ohneBuben[Math.floor(rng() * ohneBuben.length)].farbe;
  if (staerke >= 3 && gedaechtnis) {
    // Profi: eigene Menge + wie viele der Farbe schon raus sind (Gegner haben sie seltener)
    const z = zaehleFarben(ohneBuben);
    return FARBEN.reduce((b, f) => (z[f] * 2 + gedaechtnis.gesehenInFarbe(f) * 0.3 > z[b] * 2 + gedaechtnis.gesehenInFarbe(b) * 0.3 ? f : b), FARBEN[0]);
  }
  return haeufigsteFarbe(ohneBuben);
}

/** Heuristik-Bewertung einer legalen Karte (höher = besser) */
export function bewerteKarte(sp, spielerIndex, karte, { gedaechtnis = null } = {}) {
  const hand = sp.spieler[spielerIndex].hand;
  const naechster = naechsterSpieler(spielerIndex, sp.spieler.length);
  const naechsterKarten = sp.spieler[naechster].hand.length;
  const z = zaehleFarben(hand);
  const { regeln } = sp;
  let w = 0;
  // Viele Karten dieser Farbe behalten die Kontrolle
  w += z[karte.farbe] * 1.0;
  // Buben (Wünscher) aufheben, solange es anders geht
  if (regeln.bube && karte.rang === RANG.BUBE) w -= 4;
  // Ass: nochmal ist gut, wenn danach noch etwas passt
  if (regeln.ass && karte.rang === RANG.ASS) w += 1.5;
  // Angriffskarten, wenn der nächste Spieler bald fertig ist
  if (regeln.sieben && karte.rang === RANG.SIEBEN) w += naechsterKarten <= 2 ? 4 : 1;
  if (regeln.acht && karte.rang === RANG.ACHT) w += naechsterKarten <= 2 ? 3.5 : 0.8;
  // Hohe Karten eher loswerden (kein Einfluss aufs Ergebnis, aber natürlich wirkend)
  w += karte.rang * 0.05;
  if (gedaechtnis) {
    // Profi: Farben wählen, von denen schon viele gespielt sind – Gegner können sie schlechter bedienen
    w += gedaechtnis.gesehenInFarbe(karte.farbe) * 0.25;
  }
  return w;
}

/**
 * Kompletter Computer-Zug (auch für Simulationen). Legt, zieht oder passt.
 * @returns Liste der Ereignisse [{typ:"lege", karte, effekt, wunsch}|{typ:"ziehe", anzahl, strafe}|{typ:"passe"}]
 */
export function computerZug(sp, i, staerke = 1) {
  const rng = sp.rng;
  const ereignisse = [];
  const sp_ = sp.spieler[i];
  const waehle = () => waehleZug(legaleKarten(sp, sp_.hand), {
    staerke, rng, gedaechtnis: sp_.gedaechtnis,
    bewerte: (k, info) => bewerteKarte(sp, i, k, info),
  });
  const lege = (karte) => {
    const wunsch = sp.regeln.bube && karte.rang === RANG.BUBE ? computerWunsch(sp_.hand.filter((k) => k.id !== karte.id), rng, staerke, sp_.gedaechtnis) : null;
    const r = legeKarte(sp, i, karte, wunsch);
    ereignisse.push({ typ: "lege", karte, effekt: r.effekt, wunsch: r.effekt === "wunsch" ? sp.wunsch : null });
    return r;
  };

  let karte = waehle();
  if (karte) {
    lege(karte);
    return ereignisse;
  }
  const z = ziehe(sp, i);
  ereignisse.push({ typ: "ziehe", anzahl: z.karten.length, strafe: z.strafe });
  if (z.strafe) return ereignisse;
  if (z.darfLegen) {
    lege(z.karten[0]);
  } else {
    passe(sp, i);
    ereignisse.push({ typ: "passe" });
  }
  return ereignisse;
}

/** Platzierung nach Spielende: Gewinner Platz 1, Rest nach Kartenanzahl (weniger ist besser, Gleichstand teilt den Platz). */
export function platzierung(sp, i) {
  if (sp.gewinner === i) return 1;
  const eigene = sp.spieler[i].hand.length;
  let platz = 1;
  sp.spieler.forEach((s, j) => {
    if (j === i) return;
    if (sp.gewinner === j || s.hand.length < eigene) platz++;
  });
  return platz;
}

/** Score 0..1 aus Platz und Regelfehlern. */
export function maumauScore(platz, spielerAnzahl, fehler) {
  const basis = spielerAnzahl <= 1 ? 1 : 1 - ((platz - 1) / (spielerAnzahl - 1)) * 0.7;
  return Math.round(Math.max(0, Math.min(1, basis - Math.min(0.3, fehler * 0.05))) * 100) / 100;
}

/** Komplette Computer-gegen-Computer-Partie (Test/Simulation). Gibt das Endspiel zurück. */
export function simulierePartie({ rng = Math.random, gegner = 3, handKarten = 5, regeln = {}, staerken = [1, 1, 1, 1] } = {}) {
  const sp = neuesSpiel({ gegner, handKarten, regeln, rng });
  while (sp.gewinner == null && sp.zuege < MAX_ZUEGE) computerZug(sp, sp.aktiv, staerken[sp.aktiv] ?? 1);
  return sp;
}

/* ================================================================ Oberfläche */

export default {
  id: "maumau",
  bereich: "Kartenspiele",
  titel: "Mau-Mau",
  icon: "",
  anleitung: (stufe) => {
    const k = maumauKonfig(stufe);
    const r = k.regeln;
    const sonder = [];
    if (r.sieben) sonder.push(r.stapeln ? "Sieben: der Nächste zieht zwei, außer er legt selbst eine Sieben" : "Sieben: der Nächste zieht zwei");
    if (r.acht) sonder.push("Acht: der Nächste setzt aus");
    if (r.bube) sonder.push("Bube: Sie wünschen sich eine Farbe");
    if (r.ass) sonder.push("Ass: Sie sind nochmal dran");
    return "Legen Sie eine Karte mit gleicher Farbe oder gleichem Wert auf den Stapel. Passt nichts, ziehen Sie eine Karte. Wer zuerst keine Karten mehr hat, gewinnt."
      + (sonder.length ? ` Sonderkarten: ${sonder.join(". ")}.` : "");
  },

  async run(ctx) {
    const { stufe, settings, stage } = ctx;
    const blatt = settings.blatt ?? "franzoesisch";
    const k = maumauKonfig(stufe);
    const sp = neuesSpiel({ blatt, gegner: k.gegner, handKarten: k.handKarten, regeln: k.regeln });
    const tisch = new Tisch(ctx, { gegner: sp.spieler.slice(1).map((s) => s.name) });
    let fehler = 0;
    let mauGesagt = 0;

    const sortiert = () => sortiereHand(sp.spieler[0].hand, { nach: "farbe" });
    const wunschZusatz = () => (sp.wunsch ? { zusatz: `Gewünscht: ${farbName(sp.wunsch, blatt)}`, zusatzFarbe: sp.wunsch } : {});
    const zeichne = ({ neu = false } = {}) => {
      sp.spieler.slice(1).forEach((s, j) => tisch.setzeGegner(j, s.hand.length, { aktiv: sp.aktiv === j + 1 }));
      tisch.setzeNachzieh(sp.stapel.anzahlZieh);
      tisch.setzeAblage(sp.stapel.oben, { ...wunschZusatz(), neu });
    };
    const effektText = (name, effekt, wunsch) => {
      const du = name === "Sie";
      switch (effekt) {
        case "ziehen": return du ? "Der Nächste muss ziehen." : `${name} legt eine Sieben.`;
        case "aussetzen": return du ? "Der Nächste setzt aus." : `${name} legt eine Acht – der Nächste setzt aus.`;
        case "wunsch": return `${du ? "Sie wünschen" : name + " wünscht"} sich ${farbName(wunsch, blatt)}.`;
        case "nochmal": return du ? "Ass – Sie sind nochmal dran." : `${name} legt ein Ass und ist nochmal dran.`;
        default: return "";
      }
    };

    zeichne();
    tisch.zeigeHand(sortiert());

    // Menschlicher Zug: gibt false zurück bei Abbruch
    const menschZug = async () => {
      let gezogen = false;
      while (sp.aktiv === 0 && sp.gewinner == null) {
        zeichne();
        const hand = sortiert();
        const strafe = sp.ziehSumme > 0;
        tisch.status(gezogen ? "Die gezogene Karte passt. Legen oder weiter?" : strafe ? `Sie sind dran. ${passtText(sp, blatt)}` : "Sie sind dran");
        const wahl = await tisch.waehle({
          hand,
          spielbar: (karte) => istLegal(sp, karte),
          hilfe: k.hilfe,
          direkt: k.direkt,
          ziehen: gezogen ? null : strafe ? `${sp.ziehSumme} Karten ziehen` : "Karte ziehen",
          knoepfe: gezogen ? [{ id: "weiter", text: "Nicht legen, weiter" }] : [],
        });
        if (!wahl || !ctx.alive()) return false;

        if (wahl.typ === "knopf") { passe(sp, 0); break; }
        if (wahl.typ === "ziehen") {
          const z = ziehe(sp, 0);
          tisch.zeigeHand(sortiert());
          zeichne();
          if (!z.karten.length) {
            feedback(stage, "Der Stapel ist leer – der Nächste ist dran", "neutral");
            passe(sp, 0);
            await sleep(1100);
            break;
          }
          if (z.strafe) { tisch.status(`Sie ziehen ${z.karten.length} Karten.`); await sleep(1100); break; }
          if (z.darfLegen) {
            gezogen = true;
            tisch.status(`Sie ziehen ${kartenName(z.karten[0])} – die passt!`);
            await sleep(900);
            continue;
          }
          tisch.status(`Sie ziehen ${kartenName(z.karten[0])}.`);
          passe(sp, 0);
          await sleep(1100);
          break;
        }
        // Karte gespielt
        const karte = wahl.karte;
        if (!istLegal(sp, karte)) {
          fehler++;
          feedback(stage, "Diese Karte passt gerade nicht", "neutral");
          tisch.status(passtText(sp, blatt));
          await sleep(1300);
          if (!ctx.alive()) return false;
          continue;
        }
        let wunsch = null;
        if (sp.regeln.bube && karte.rang === RANG.BUBE && sp.spieler[0].hand.length > 1) {
          tisch.zeigeHand(hand);
          wunsch = await tisch.farbWahl();
          if (!wunsch || !ctx.alive()) return false;
        }
        const r = legeKarte(sp, 0, karte, wunsch);
        tisch.zeigeHand(sortiert());
        zeichne({ neu: true });
        const t = effektText("Sie", r.effekt, sp.wunsch);
        if (t) tisch.status(t);

        if (k.mauOptional && sp.spieler[0].hand.length === 1 && !r.fertig) {
          // Freiwillig: kein Zeitdruck-Fehler, nur eine kleine Anerkennung
          const antwort = await tisch.frage("Nur noch eine Karte. Möchten Sie „Mau“ sagen?", [{ id: "mau", text: "Mau!" }, { id: "weiter", text: "Weiter" }]);
          if (!antwort || !ctx.alive()) return false;
          if (antwort === "mau") { mauGesagt++; feedback(stage, "Mau! Nur noch eine Karte", "gut"); }
        }
        await sleep(t ? 1100 : 500);
        if (r.effekt !== "nochmal") break;
        gezogen = false;
      }
      return ctx.alive();
    };

    while (sp.gewinner == null && sp.zuege < MAX_ZUEGE) {
      if (!ctx.alive()) return null;
      zeichne();
      if (sp.aktiv === 0) {
        if (!(await menschZug())) return null;
        continue;
      }
      const i = sp.aktiv;
      const name = sp.spieler[i].name;
      tisch.zeigeHand(sortiert());
      if (!(await tisch.computerUeberlegt(name, denkpause()))) return null;
      const ereignisse = computerZug(sp, i, k.staerke);
      for (const e of ereignisse) {
        if (e.typ === "passe") continue;
        if (e.typ === "ziehe") {
          tisch.status(e.strafe ? `${name} zieht ${e.anzahl} Karten.` : `${name} zieht eine Karte.`);
          zeichne();
        } else {
          zeichne({ neu: true });
          tisch.status(effektText(name, e.effekt, e.wunsch) || `${name} legt ${kartenName(e.karte)}.`);
        }
        tisch.zeigeHand(sortiert());
        await sleep(1000);
        if (!ctx.alive()) return null;
      }
    }
    if (!ctx.alive()) return null;

    zeichne();
    const platz = platzierung(sp, 0);
    const anzahl = sp.spieler.length;
    const gewonnen = sp.gewinner === 0;
    tisch.status(gewonnen ? "Gewonnen – keine Karten mehr!" : sp.gewinner != null ? `${sp.spieler[sp.gewinner].name} hat gewonnen.` : "Die Partie ist beendet.");
    await sleep(1800);
    if (!ctx.alive()) return null;

    const score = maumauScore(platz, anzahl, fehler);
    const platzText = gewonnen ? "Gewonnen!" : `Platz ${platz} von ${anzahl}.`;
    const fehlerText = fehler === 0 ? "Alle Züge regelgerecht." : fehler === 1 ? "Eine Karte passte nicht." : `${fehler} Karten passten nicht.`;
    return { score, text: `${platzText} ${fehlerText}` };
  },
};
