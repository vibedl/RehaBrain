// Skat gegen zwei Computer – nach Deutscher Skatordnung / ISkO, mit Ramsch, Bock und Kontra (einstellbar).
// Stufe 1–6: „Offener Skat“ mit Hilfen (gespielte Karten sichtbar, Tipp, Zug zurücknehmen, gültige Karten markiert)
// Stufe 7–13: weniger Hilfen · Stufe 14–20: echter Skat ohne Hilfen, stärkere Gegner.
import { h, sleep, feedback, debounced } from "../core/ui.js";
import { karteElement, kartenName, BLAETTER, farbSymbol } from "./deck.js";
import { denkpause } from "./engine.js";
import { Tisch, warteAufEingabe, farbCss } from "./tisch.js";
import {
  neuesSkatSpiel, reizFrage, reizAntwort, reizErgebnis, nimmSkat, druecke, sageAn, starteRamsch, schiebeRamsch,
  spieleKarte, gueltigeKarten, spielErgebnis, sortiereSkatHand, spielName, farbNameSkat, neuesSpielObjekt,
  spitzen, spielwert, nullWert, istBube, augenSumme, bedienFarbe, neueBockliste, istBock, bockSpielBeendet,
  BOCK_AUSLOESER, kartenStaerke, istTrumpf,
} from "./skatregeln.js";
import { kiReizAntwort, kiHandSpiel, kiDrueckenUndAnsagen, kiKarte, kiKontra, kiRe, kiSchieben, reizLimit, spielKandidaten } from "./skatki.js";
import { skatStyles, bubenWort } from "./skatschule.js";

export const SKAT_DEFAULTS = { ramsch: true, schieberamsch: false, bock: true, kontra: false };

/** Alle stufenabhängigen Einstellungen. */
export function skatKonfig(stufe) {
  const s = Math.max(1, Math.min(20, stufe | 0 || 1));
  return {
    spiele: s <= 6 ? 2 : 3,
    staerken: s <= 4 ? [1, 1] : s <= 13 ? [2, 2] : s <= 16 ? [2, 3] : [3, 3],
    hilfe: s <= 10,          // gültige Karten hervorheben
    gespielt: s <= 6,        // alle gespielten Karten sichtbar
    tipp: s <= 6,            // Tipp-Knopf
    zurueck: s <= 6,         // Zug zurücknehmen
    letzterStich: s <= 13,
    augenLive: s <= 13,
    reizHilfe: s <= 9,
    ansagen: s >= 7,         // Schneider/Schwarz/Ouvert ansagen
    direkt: s <= 3,          // Antippen spielt sofort
  };
}

/** Score 0..1 aus Listenpunkten, Gegenspiel-Erfolgen, Regelfehlern und Entscheidungsqualität. */
export function skatScore({ eigene = 0, gegner = [0, 0], alleinGewonnen = 0, gegenspielGewonnen = 0, fehler = 0, ueberreizt = 0, riskant = 0 }) {
  const diff = eigene - (gegner[0] + gegner[1]) / 2;
  let s = 0.62 + Math.max(-0.35, Math.min(0.2, diff / 200));
  s += Math.min(0.2, alleinGewonnen * 0.1) + Math.min(0.2, gegenspielGewonnen * 0.1);
  s -= Math.min(0.25, fehler * 0.04) + ueberreizt * 0.15 + riskant * 0.05;
  return Math.round(Math.max(0, Math.min(1, s)) * 100) / 100;
}

const NAMEN = ["Sie", "Computer 1", "Computer 2"];

export default {
  id: "skat",
  bereich: "Kartenspiele",
  titel: "Skat",
  icon: "",
  anleitung: (stufe) => {
    const k = skatKonfig(stufe);
    return `Skat gegen zwei Computer, ${k.spiele} Spiele. Erst wird gereizt, wer am höchsten reizt, spielt allein und braucht mindestens 61 Augen.`
      + (k.tipp ? " Mit „Tipp“ bekommen Sie einen Vorschlag, und Sie können einen Zug zurücknehmen." : "")
      + (stufe >= 14 ? " Jetzt ohne Hilfen." : "");
  },

  async run(ctx) {
    const { stage, stufe, settings } = ctx;
    const blatt = settings?.blatt ?? "franzoesisch";
    const regeln = { ...SKAT_DEFAULTS, ...(settings?.skat ?? {}) };
    const k = skatKonfig(stufe);
    skatStyles();
    const staerke = (p) => (p === 0 ? 3 : k.staerken[p - 1]);

    const tisch = new Tisch(ctx, { gegner: [NAMEN[1], NAMEN[2]] });
    tisch.el.classList.add("sk-tisch");
    const infoEl = h("p.sk-info", { "aria-live": "polite" });
    const hilfeEl = h("p.sk-hilfe");
    const slots = [0, 1, 2].map((p) => {
      const karte = h("div.sk-slotkarte");
      const name = h("span.sk-slotname", { text: NAMEN[p] });
      return { el: h(`div.sk-slot.sk-p${p}`, {}, karte, name), karte, name };
    });
    const stichEl = h("div.sk-stich", {}, slots.map((s) => s.el));
    const letzterEl = h("p.sk-letzter");
    const gespieltEl = h("div.sk-gespielt");
    const offenEl = h("div.sk-offen");
    const mitte = h("div.sk-mitte", {}, infoEl, stichEl, letzterEl, hilfeEl, gespieltEl, offenEl);
    tisch.mitte.replaceWith(mitte);

    const bock = neueBockliste(3, regeln.bock ? BOCK_AUSLOESER : null);
    const liste = [];
    const stat = { fehler: 0, ueberreizt: 0, riskant: 0, alleinGewonnen: 0, gegenspielGewonnen: 0 };
    let geber = Math.floor(Math.random() * 3);
    let sp = null;
    let undoStand = null;
    let bockJetzt = false;

    /* ---------------- Anzeige */
    const wertNamen = BLAETTER[blatt].werte;
    const kurz = (kk) => wertNamen[kk.rang];
    const rolle = (p) => {
      if (!sp) return "";
      if (sp.spiel?.art === "ramsch") return "Ramsch";
      if (sp.alleinspieler == null) return p === sp.geber ? "gibt" : "";
      return p === sp.alleinspieler ? "Alleinspieler" : "Gegenspieler";
    };
    const augenText = () => {
      if (!sp?.spiel || !k.augenLive) return "";
      if (sp.spiel.art === "ramsch") return `Ihre Augen: ${sp.augen[0]}`;
      if (sp.spiel.art === "null") return "";
      const a = sp.alleinspieler;
      const eigen = a === 0 ? sp.augen[0] : sp.augen[0] + sp.augen[a === 1 ? 2 : 1];
      const fremd = a === 0 ? sp.augen[1] + sp.augen[2] : sp.augen[a];
      return `Augen – Ihre Seite: ${eigen}, andere Seite: ${fremd}`;
    };
    const zeichneSlots = (karten = sp.stich.karten, spieler = sp.stich.spieler, neuId = null) => {
      slots.forEach((s, p) => {
        const idx = spieler.indexOf(p);
        if (idx >= 0) {
          const el = karteElement(karten[idx]);
          if (karten[idx].id === neuId) el.classList.add("neu");
          s.karte.replaceChildren(el);
        } else s.karte.replaceChildren(h("div.sk-leer"));
        s.el.classList.toggle("sk-amzug", sp.amZug === p && !sp.fertig);
      });
    };
    const zeichne = (neuId = null) => {
      [1, 2].forEach((p) => tisch.setzeGegner(p - 1, sp.haende[p].length, { aktiv: sp.amZug === p || reizDran === p, info: rolle(p) }));
      const teile = [];
      if (sp.spiel) {
        teile.push(sp.spiel.art === "ramsch" ? "Ramsch" : `${NAMEN[sp.alleinspieler]} ${sp.alleinspieler === 0 ? "spielen" : "spielt"} ${spielName(sp.spiel, blatt)}`);
        if (sp.reizwert) teile.push(`gereizt bis ${sp.reizwert}`);
        if (sp.kontra) teile.push(sp.re ? "Kontra und Re" : "Kontra");
      } else if (sp.reizung.wert) teile.push(`gereizt bis ${sp.reizung.wert}`);
      if (bockJetzt) teile.push("Bock: zählt doppelt");
      const at = augenText();
      infoEl.textContent = [teile.join(" · "), at].filter(Boolean).join(" — ");
      zeichneSlots(undefined, undefined, neuId);
      const letzter = sp.stiche.at(-1);
      letzterEl.textContent = k.letzterStich && letzter
        ? `Letzter Stich: ${letzter.karten.map(kartenName).join(", ")} – ${letzter.sieger === 0 ? "den haben Sie bekommen" : `bekommen hat ihn ${NAMEN[letzter.sieger]}`}`
        : "";
      if (k.gespielt && sp.stiche.length) {
        const alle = sp.stiche.flatMap((s) => s.karten);
        const zeilen = [];
        const buben = alle.filter(istBube);
        if (sp.spiel && sp.spiel.art !== "null" && buben.length) zeilen.push(h("span.sk-gzeile", {}, h("b", { text: `${bubenWort(blatt)}:` }), buben.map((b) => farbNameSkat(b.farbe, blatt)).join(", ")));
        for (const f of BLAETTER[blatt].farben) {
          const ks = alle.filter((x) => x.farbe === f.id && (sp.spiel?.art === "null" || !istBube(x)))
            .sort((a, b) => kartenStaerke(b, sp.spiel) - kartenStaerke(a, sp.spiel));
          if (ks.length) zeilen.push(h(`span.sk-gzeile.${f.css}`, {}, farbSymbol(f), h("b", { text: `${f.name}:` }), ks.map(kurz).join(" ")));
        }
        gespieltEl.replaceChildren(h("span.sk-glabel", { text: "Schon gespielt:" }), ...zeilen);
      } else gespieltEl.replaceChildren();
      if (sp.spiel?.ouvert && sp.alleinspieler > 0) {
        offenEl.replaceChildren(h("span.sk-glabel", { text: `Offene Karten von ${NAMEN[sp.alleinspieler]}:` }),
          h("div.sk-offenkarten", {}, sortiereSkatHand(sp.haende[sp.alleinspieler], sp.spiel).map((x) => karteElement(x))));
      } else offenEl.replaceChildren();
    };
    let reizDran = null;
    const handAnzeige = () => sortiereSkatHand(sp.haende[0], sp.spiel);

    /* ---------------- Eingaben */
    const frage = (text, optionen) => tisch.frage(text, optionen);

    /** Zwei Karten auswählen (Drücken / Schieben). pruefe(karten) => Fehlertext oder null. tippFn() => [id,id] */
    const waehleZwei = (hand, { text, knopf, pruefe = () => null, tippFn = null }) => {
      tisch.status(text);
      let gew = [];
      let tipp = new Set();
      return warteAufEingabe(ctx, (ende) => {
        const los = h("button.knopf.gross.primaer", { type: "button", text: knopf, disabled: true });
        const render = () => {
          tisch.handEl.classList.add("kt-waehlbar");
          tisch.handEl.replaceChildren(...hand.map((kk) => {
            const el = karteElement(kk, { tag: "button" });
            el.type = "button";
            const an = gew.some((g) => g.id === kk.id);
            el.classList.toggle("kt-gewaehlt", an);
            el.classList.toggle("kt-spielbar", tipp.has(kk.id));
            el.setAttribute("aria-pressed", String(an));
            el.onclick = debounced(() => {
              if (an) gew = gew.filter((g) => g.id !== kk.id);
              else { gew.push(kk); if (gew.length > 2) gew.shift(); }
              los.disabled = gew.length !== 2;
              render();
            });
            return el;
          }));
        };
        los.onclick = debounced(() => {
          if (gew.length !== 2) return;
          const f = pruefe(gew);
          if (f) { feedback(stage, f, "neutral"); return; }
          ende(gew);
        });
        const reihe = [los];
        if (tippFn) reihe.push(h("button.knopf.gross", { type: "button", text: "Tipp", onclick: debounced(() => { tipp = new Set(tippFn()); render(); }) }));
        tisch.aktionenEl.replaceChildren(...reihe);
        render();
      }, () => {
        tisch.handEl.classList.remove("kt-waehlbar");
        tisch.handEl.querySelectorAll("button").forEach((b) => { b.onclick = null; b.disabled = true; });
        tisch.aktionenEl.replaceChildren();
      });
    };

    const pause = async (ms) => { await sleep(ms); return ctx.alive(); };

    /* ---------------- Reizen */
    const reizen = async () => {
      while (reizFrage(sp.reizung)) {
        const f = reizFrage(sp.reizung);
        reizDran = f.spieler;
        zeichne();
        tisch.zeigeHand(handAnzeige());
        if (f.spieler === 0) {
          if (k.reizHilfe) {
            const lim = reizLimit(sp.haende[0], 3);
            hilfeEl.textContent = lim ? `Hilfe: Ihr Blatt reicht etwa bis ${lim}.` : "Hilfe: Ihr Blatt ist eher schwach – Passen ist in Ordnung.";
          }
          let text, ja;
          if (f.art === "sagen") { text = `Möchten Sie ${f.wert} sagen?`; ja = `${f.wert} sagen`; }
          else if (f.art === "hoeren") { text = `${NAMEN[sp.reizung.sager]} sagt ${f.wert}. Gehen Sie mit?`; ja = `Ja, ${f.wert}`; }
          else { text = "Die anderen haben gepasst. Möchten Sie selbst spielen?"; ja = "Ja, ich spiele"; }
          const a = await frage(text, [{ id: "ja", text: ja }, { id: "passe", text: "Passe" }]);
          hilfeEl.textContent = "";
          if (!a || !ctx.alive()) return false;
          reizAntwort(sp.reizung, a === "ja");
          tisch.status(a === "ja" ? (f.art === "hoeren" ? "Sie sagen: Ja." : `Sie sagen ${f.wert}.`) : "Sie passen.");
          if (!(await pause(700))) return false;
        } else {
          if (!(await tisch.computerUeberlegt(NAMEN[f.spieler], denkpause(Math.random, 800)))) return false;
          const ja = kiReizAntwort(sp, f.spieler, staerke(f.spieler));
          reizAntwort(sp.reizung, ja);
          const name = NAMEN[f.spieler];
          tisch.status(!ja ? `${name}: „Passe“` : f.art === "hoeren" ? `${name}: „Ja“` : f.art === "vorhand" ? `${name} spielt selbst.` : `${name}: „${f.wert}“`);
          zeichne();
          if (!(await pause(1100))) return false;
        }
      }
      reizDran = null;
      return true;
    };

    /* ---------------- Alleinspieler: Mensch */
    const menschAnsage = async (wert) => {
      const kartenMitSkat = [...sp.urHaende[0], ...sp.urSkat];
      const a = await frage(`Sie spielen, gereizt bis ${wert}. Nehmen Sie den Skat auf?`, [{ id: "skat", text: "Skat aufnehmen" }, { id: "hand", text: "Hand spielen" }]);
      if (!a || !ctx.alive()) return false;
      const hand = a === "hand";
      if (!hand) {
        const skatKarten = [...sp.skat];
        nimmSkat(sp, 0);
        slots.forEach((s) => s.karte.replaceChildren());
        slots[0].karte.replaceChildren(h("div.sk-skatzeige", {}, skatKarten.map((x) => karteElement(x))));
        tisch.status(`Im Skat lagen: ${skatKarten.map(kartenName).join(" und ")}.`);
        tisch.zeigeHand(sortiereSkatHand(sp.haende[0], null));
        if (!(await pause(2200))) return false;
        const zwei = await waehleZwei(sortiereSkatHand(sp.haende[0], null), {
          text: "Tippen Sie zwei Karten an, die Sie in den Skat legen (drücken).",
          knopf: "Diese zwei drücken",
          tippFn: k.tipp ? () => kiDrueckenUndAnsagen(sp.haende[0], wert, 3).druecken.map((x) => x.id) : null,
        });
        if (!zwei || !ctx.alive()) return false;
        druecke(sp, 0, zwei);
        zeichneSlots([], []);
      }
      tisch.zeigeHand(sortiereSkatHand(sp.haende[0], null));

      while (true) {
        if (k.reizHilfe) {
          const kand = spielKandidaten(sp.haende[0], kartenMitSkat).filter((c) => c.wert >= wert || c.spiel.art === "null").sort((x, y) => y.marge - x.marge)[0];
          hilfeEl.textContent = kand ? `Hilfe: ${spielName(kand.spiel, blatt)} passt gut zu Ihren Karten.` : "";
        }
        const farben = BLAETTER[blatt].farben.map((f) => ({ id: f.id, text: f.name, klasse: f.css }));
        const art = await frage("Welches Spiel möchten Sie spielen?", [...farben, { id: "grand", text: "Grand" }, { id: "null", text: "Null" }]);
        hilfeEl.textContent = "";
        if (!art || !ctx.alive()) return false;
        let spiel = art === "grand" || art === "null" ? neuesSpielObjekt(art, { hand }) : neuesSpielObjekt("farbe", { trumpf: art, hand });
        if (k.ansagen) {
          if (art === "null") {
            const o = await frage("Möchten Sie den Null offen (ouvert) spielen? Dann sehen alle Ihre Karten.", [{ id: "nein", text: "Nein, verdeckt" }, { id: "ja", text: "Ja, ouvert" }]);
            if (!o || !ctx.alive()) return false;
            if (o === "ja") spiel = neuesSpielObjekt("null", { hand, ouvert: true });
          } else if (hand) {
            const o = await frage("Möchten Sie etwas ansagen?", [
              { id: "nichts", text: "Nichts ansagen" }, { id: "schneider", text: "Schneider ansagen" },
              { id: "schwarz", text: "Schwarz ansagen" }, { id: "ouvert", text: "Offen (ouvert)" }]);
            if (!o || !ctx.alive()) return false;
            spiel = neuesSpielObjekt(spiel.art, { ...spiel, schneiderAngesagt: o === "schneider", schwarzAngesagt: o === "schwarz", ouvert: o === "ouvert" });
          }
        }
        const sicher = spiel.art === "null" ? nullWert(spiel) : spielwert(spiel, { spitzenAnzahl: spitzen(kartenMitSkat, spiel).anzahl }).wert;
        const maximal = spiel.art === "null" ? sicher : spielwert(spiel, { spitzenAnzahl: spitzen(kartenMitSkat, spiel).anzahl, schneider: true, schwarz: true }).wert;
        if (sicher < wert) {
          const zusatz = maximal >= wert ? " Das reicht nur, wenn Sie Schneider oder Schwarz schaffen." : " Das reicht nicht – Sie wären überreizt.";
          const w = await frage(`Vorsicht: ${spielName(spiel, blatt)} ist ${sicher} wert, gereizt sind ${wert}.${zusatz}`, [{ id: "anders", text: "Anderes Spiel wählen" }, { id: "trotzdem", text: "Trotzdem spielen" }]);
          if (!w || !ctx.alive()) return false;
          if (w === "anders") continue;
          stat.riskant++;
        }
        sageAn(sp, 0, wert, spiel);
        return true;
      }
    };

    /* ---------------- Kontra / Re */
    const kontraRunde = async () => {
      if (!regeln.kontra || sp.spiel.art === "ramsch" || sp.spiel.art === "null") return true;
      const a = sp.alleinspieler;
      for (let p = 0; p < 3; p++) {
        if (p === a || sp.kontra) continue;
        if (p === 0) {
          const x = await frage(`${NAMEN[a]} spielt ${spielName(sp.spiel, blatt)}. Möchten Sie Kontra geben? Dann zählt das Spiel doppelt.`, [{ id: "nein", text: "Kein Kontra" }, { id: "kontra", text: "Kontra" }]);
          if (!x || !ctx.alive()) return false;
          sp.kontra = x === "kontra";
        } else if (kiKontra(sp, p, staerke(p))) {
          sp.kontra = true;
          tisch.status(`${NAMEN[p]}: „Kontra!“`);
          if (!(await pause(1400))) return false;
        }
      }
      if (sp.kontra) {
        if (a === 0) {
          const x = await frage("Kontra! Möchten Sie Re sagen? Dann zählt es noch einmal doppelt.", [{ id: "nein", text: "Kein Re" }, { id: "re", text: "Re" }]);
          if (!x || !ctx.alive()) return false;
          sp.re = x === "re";
        } else if (kiRe(sp, a, staerke(a))) {
          sp.re = true;
          tisch.status(`${NAMEN[a]}: „Re!“`);
          if (!(await pause(1400))) return false;
        }
      }
      return true;
    };

    /* ---------------- Schieberamsch */
    const schieben = async () => {
      for (let n = 0; n < 3; n++) {
        const p = (sp.vorhand + n) % 3;
        if (p === 0) {
          tisch.zeigeHand(handAnzeige());
          const a = await frage(`Schieberamsch: Möchten Sie den Skat aufnehmen und zwei Karten weitergeben? Jedes Aufnehmen verdoppelt.`, [{ id: "schieben", text: "Weiterschieben" }, { id: "nehmen", text: "Skat aufnehmen" }]);
          if (!a || !ctx.alive()) return false;
          if (a === "nehmen") {
            const hand12 = sortiereSkatHand([...sp.haende[0], ...sp.skat], { art: "ramsch" });
            const zwei = await waehleZwei(hand12, { text: `Tippen Sie zwei Karten an, die Sie weitergeben (keine ${bubenWort(blatt)}).`, knopf: "Diese zwei weitergeben",
              pruefe: (ks) => (ks.some(istBube) ? `${bubenWort(blatt)} dürfen nicht weitergegeben werden` : null) });
            if (!zwei || !ctx.alive()) return false;
            schiebeRamsch(sp, 0, true, zwei);
          }
          tisch.status(a === "nehmen" ? "Sie geben zwei Karten weiter." : "Sie schieben weiter.");
        } else {
          if (!(await tisch.computerUeberlegt(NAMEN[p], denkpause(Math.random, 800)))) return false;
          const zurueck = kiSchieben(sp.haende[p], sp.skat, staerke(p));
          schiebeRamsch(sp, p, !!zurueck, zurueck);
          tisch.status(zurueck ? `${NAMEN[p]} nimmt den Skat und gibt zwei Karten weiter.` : `${NAMEN[p]} schiebt weiter.`);
        }
        tisch.zeigeHand(handAnzeige());
        if (!(await pause(1000))) return false;
      }
      return true;
    };

    /* ---------------- Kartenspiel */
    const menschZug = async () => {
      let tippId = null;
      while (true) {
        zeichne();
        const hand = handAnzeige();
        const legal = gueltigeKarten(sp, 0);
        const istLegal = (kk) => legal.some((x) => x.id === kk.id);
        const knoepfe = [];
        if (k.tipp) knoepfe.push({ id: "tipp", text: "Tipp" });
        if (k.zurueck && undoStand) knoepfe.push({ id: "zurueck", text: "Zug zurücknehmen" });
        if (!tippId) {
          if (!sp.stich.karten.length) tisch.status("Sie spielen aus.");
          else {
            const gef = bedienFarbe(sp.stich.karten[0], sp.spiel);
            tisch.status(k.hilfe ? `Sie sind dran. Gefordert: ${gef === "trumpf" ? "Trumpf" : farbNameSkat(gef, blatt)}.` : "Sie sind dran.");
          }
        }
        const wahl = await tisch.waehle({
          hand, direkt: k.direkt, knoepfe,
          spielbar: tippId ? (kk) => kk.id === tippId : istLegal,
          hilfe: k.hilfe || !!tippId,
        });
        if (!wahl || !ctx.alive()) return false;
        if (wahl.typ === "knopf" && wahl.id === "tipp") {
          tisch.status("Einen Moment …");
          await sleep(50);
          const t = kiKarte(sp, 0, 3, { maxMs: 250 });
          tippId = t?.id ?? null;
          if (t) tisch.status(`Tipp: ${kartenName(t)}`);
          continue;
        }
        if (wahl.typ === "knopf" && wahl.id === "zurueck") {
          sp = structuredClone(undoStand);
          undoStand = null;
          tippId = null;
          tisch.status("Ihr letzter Zug wurde zurückgenommen.");
          if (!(await pause(900))) return false;
          continue;
        }
        if (wahl.typ !== "karte") continue;
        const karte = wahl.karte;
        if (!istLegal(karte)) {
          stat.fehler++;
          const gef = bedienFarbe(sp.stich.karten[0], sp.spiel);
          feedback(stage, `Bitte ${gef === "trumpf" ? "Trumpf" : farbNameSkat(gef, blatt)} bedienen`, "neutral");
          tisch.status(gef === "trumpf" ? "Sie haben noch Trumpf – den müssen Sie zugeben." : `Sie haben noch ${farbNameSkat(gef, blatt)} – die müssen Sie zugeben${sp.spiel.art !== "null" ? ` (${bubenWort(blatt)} zählen als Trumpf)` : ""}.`);
          if (!(await pause(1500))) return false;
          continue;
        }
        undoStand = k.zurueck ? structuredClone(sp) : null;
        return nachKarte(0, karte);
      }
    };

    /** Karte spielen und anzeigen; bei fertigem Stich kurz stehen lassen. */
    const nachKarte = async (p, karte) => {
      const r = spieleKarte(sp, p, karte);
      if (!r.ok) throw new Error("Skat: ungültiger Zug " + r.grund);
      tisch.zeigeHand(handAnzeige());
      if (!r.stichFertig) {
        zeichne(karte.id);
        if (p !== 0) tisch.status(`${NAMEN[p]} ${p === 0 ? "spielen" : "spielt"} ${kartenName(karte)}.`);
        return pause(p === 0 ? 400 : 900);
      }
      const st = sp.stiche.at(-1);
      zeichne();
      zeichneSlots(st.karten, st.spieler, karte.id);
      slots.forEach((s, q) => s.el.classList.toggle("sk-sieger", q === st.sieger));
      const au = augenSumme(st.karten);
      tisch.status(st.sieger === 0 ? `Sie bekommen den Stich (${au} Augen).` : `${NAMEN[st.sieger]} bekommt den Stich (${au} Augen).`);
      const ok = await pause(k.gespielt ? 2000 : 1600);
      slots.forEach((s) => s.el.classList.remove("sk-sieger"));
      return ok;
    };

    /* ---------------- Ein Spiel */
    const einSpiel = async (nr) => {
      sp = neuesSkatSpiel({ geber, blatt });
      undoStand = null;
      bockJetzt = istBock(bock);
      tisch.status(`Spiel ${nr}: ${geber === 0 ? "Sie geben" : `${NAMEN[geber]} gibt`}.${bockJetzt ? " Bockrunde – alles zählt doppelt." : ""}`);
      zeichne();
      tisch.zeigeHand(handAnzeige());
      if (!(await pause(1500))) return null;

      if (!(await reizen())) return null;
      const rz = reizErgebnis(sp.reizung);
      if (rz.alleGepasst) {
        if (!regeln.ramsch) {
          tisch.status("Alle haben gepasst. Die Karten werden neu gegeben.");
          if (!(await pause(2200))) return null;
          return { eingepasst: true };
        }
        tisch.status("Alle haben gepasst – jetzt wird Ramsch gespielt. Wer die meisten Augen sammelt, verliert.");
        if (!(await pause(2600))) return null;
        if (regeln.schieberamsch && !(await schieben())) return null;
        starteRamsch(sp);
      } else {
        const a = rz.alleinspieler;
        if (a === 0) {
          if (!(await menschAnsage(rz.wert))) return null;
        } else {
          if (!(await tisch.computerUeberlegt(NAMEN[a], 1200))) return null;
          const hs = kiHandSpiel(sp.haende[a], rz.wert, staerke(a));
          if (hs) sageAn(sp, a, rz.wert, hs);
          else {
            nimmSkat(sp, a);
            const d = kiDrueckenUndAnsagen(sp.haende[a], rz.wert, staerke(a));
            druecke(sp, a, d.druecken);
            sageAn(sp, a, rz.wert, d.spiel);
          }
          tisch.status(`${NAMEN[a]} spielt ${spielName(sp.spiel, blatt)}.`);
          zeichne();
          if (!(await pause(2000))) return null;
        }
        if (!(await kontraRunde())) return null;
      }
      undoStand = null;

      while (!sp.fertig) {
        if (!ctx.alive()) return null;
        const p = sp.amZug;
        zeichne();
        if (p === 0) {
          if (!(await menschZug())) return null;
        } else {
          tisch.zeigeHand(handAnzeige());
          if (!(await tisch.computerUeberlegt(NAMEN[p], denkpause(Math.random, k.gespielt ? 1000 : 800)))) return null;
          const karte = kiKarte(sp, p, staerke(p));
          if (!(await nachKarte(p, karte))) return null;
        }
      }
      undoStand = null;
      zeichne();
      tisch.zeigeHand(handAnzeige());

      const e = spielErgebnis(sp, { bock: bockJetzt });
      const b = bockSpielBeendet(bock, { ...e, kontra: sp.kontra });
      let text;
      if (e.ramsch) {
        if (e.durchmarsch != null) text = `Durchmarsch! ${NAMEN[e.durchmarsch]} ${e.durchmarsch === 0 ? "haben" : "hat"} alle Stiche: +${e.punkte[e.durchmarsch]}.`;
        else {
          const v = e.verlierer.map((q) => NAMEN[q]).join(" und ");
          text = `Ramsch: ${v} ${e.verlierer.length > 1 || e.verlierer[0] === 0 ? "haben" : "hat"} die meisten Augen (${Math.max(...e.augen)}) – ${e.punkte[e.verlierer[0]]} Punkte.`;
          if (e.jungfrauen.length) text += ` Jungfrau: ${e.jungfrauen.map((q) => NAMEN[q]).join(", ")} ohne Stich – zählt doppelt.`;
        }
      } else {
        const a = e.alleinspieler;
        const wer = a === 0 ? "Sie" : NAMEN[a];
        const verb = e.gewonnen ? (a === 0 ? "gewinnen" : "gewinnt") : (a === 0 ? "verlieren" : "verliert");
        const detail = sp.spiel.art === "null" ? (e.gewonnen ? "ohne einen Stich" : "") : `mit ${e.augenAllein} Augen`;
        text = `${wer} ${verb} ${spielName(sp.spiel, blatt)} ${detail}`.trim() + ".";
        if (e.ueberreizt) text += " Überreizt!";
        if (e.schwarz && sp.spiel.art !== "null") text += " Schwarz!";
        else if (e.schneider && sp.spiel.art !== "null") text += " Schneider!";
        text += ` ${e.listenwert > 0 ? "+" : ""}${e.listenwert} Punkte.`;
        if (a === 0) { if (e.gewonnen) stat.alleinGewonnen++; if (e.ueberreizt) stat.ueberreizt++; }
        else if (!e.gewonnen) stat.gegenspielGewonnen++;
        if (sp.spiel.art !== "null" && sp.spiel.art !== "ramsch") {
          const sk = sp.skat.map(kartenName).join(" und ");
          if (sk) text += ` Im Skat: ${sk}.`;
        }
      }
      if (b.ausgeloest) text += ` Bockrunde (${b.grund}): die nächsten drei Spiele zählen doppelt.`;
      tisch.status(text);
      if (!(await pause(4200))) return null;
      return {
        nr, ramsch: !!e.ramsch, bock: bockJetzt, punkte: e.punkte,
        spiel: e.ramsch ? "Ramsch" : `${spielName(sp.spiel, blatt)}${sp.kontra ? (sp.re ? ", Kontra, Re" : ", Kontra") : ""}`,
        alleinspieler: e.ramsch ? null : e.alleinspieler, gewonnen: e.gewonnen,
      };
    };

    /* ---------------- Punkteliste */
    const zeigeListe = async (letzte) => {
      const summe = [0, 0, 0];
      const zeilen = liste.map((z) => {
        z.punkte.forEach((x, i) => (summe[i] += x));
        const marken = [];
        if (z.ramsch) marken.push(h("span.sk-marke.sk-marke-ramsch", { text: "Ramsch" }));
        if (z.bock) marken.push(h("span.sk-marke.sk-marke-bock", { text: "Bock" }));
        const wer = z.alleinspieler == null ? "" : `${NAMEN[z.alleinspieler]}: `;
        return h(`tr${z.bock ? ".sk-zeile-bock" : ""}${z.ramsch ? ".sk-zeile-ramsch" : ""}`, {},
          h("td", { text: String(z.nr) }),
          h("td", {}, `${wer}${z.spiel}`, marken),
          ...z.punkte.map((x) => h("td.sk-zahl", { text: x ? (x > 0 ? `+${x}` : String(x)) : "–" })));
      });
      const tabelle = h("table.sk-liste", {},
        h("thead", {}, h("tr", {}, h("th", { text: "Nr." }), h("th", { text: "Spiel" }), ...NAMEN.map((n) => h("th.sk-zahl", { text: n })))),
        h("tbody", {}, zeilen),
        h("tfoot", {}, h("tr", {}, h("td"), h("td", { text: "Summe" }), ...summe.map((x) => h("td.sk-zahl", { text: String(x) })))));
      const bockHinweis = istBock(bock) ? h("p.hinweis", { text: `Noch ${bock.offen} Bock-${bock.offen === 1 ? "Spiel" : "Spiele"} offen.` }) : null;
      const knopf = h("button.knopf.gross.primaer", { type: "button", text: letzte ? "Zur Auswertung" : "Nächstes Spiel" });
      const ansicht = h("div.sk-listeansicht", {}, h("h2.sk-titel", { text: "Punkteliste" }), h("div.sk-tabellenrahmen", {}, tabelle), bockHinweis, h("div.knopfreihe", {}, knopf));
      tisch.el.hidden = true;
      stage.append(ansicht);
      const ok = await warteAufEingabe(ctx, (ende) => { knopf.onclick = debounced(() => ende(true)); }, () => { ansicht.remove(); tisch.el.hidden = false; });
      return ok ? summe : null;
    };

    /* ---------------- Ablauf */
    let gespielt = 0, gegeben = 0;
    let summe = [0, 0, 0];
    while (gespielt < k.spiele && gegeben < k.spiele + 4) {
      gegeben++;
      const r = await einSpiel(gespielt + 1);
      if (!r || !ctx.alive()) return null;
      geber = (geber + 1) % 3;
      if (r.eingepasst) continue;
      gespielt++;
      liste.push(r);
      summe = await zeigeListe(gespielt >= k.spiele);
      if (!summe) return null;
    }
    if (!ctx.alive()) return null;
    const score = skatScore({ eigene: summe[0], gegner: [summe[1], summe[2]], ...stat });
    const platz = 1 + [summe[1], summe[2]].filter((x) => x > summe[0]).length;
    const teile = [`${summe[0] > 0 ? "+" : ""}${summe[0]} Punkte, Platz ${platz} von 3.`];
    if (stat.alleinGewonnen) teile.push(stat.alleinGewonnen === 1 ? "Ein Spiel gewonnen." : `${stat.alleinGewonnen} Spiele gewonnen.`);
    if (stat.gegenspielGewonnen) teile.push("Gut verteidigt.");
    if (stat.fehler) teile.push(stat.fehler === 1 ? "Einmal nicht bedient." : `${stat.fehler}-mal nicht bedient.`);
    return { score, text: teile.join(" ") };
  },
};
