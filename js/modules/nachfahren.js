// Visuomotorik: Wege nachfahren – Linie, Welle, Schreibbögen („lll“, „uuu“ gegen kleiner werdende Schrift), Spirale
import { h, feedback, debounced } from "../core/ui.js";
import {
  klemme, mittelwert, stufenwert, glaetten, abtasten, naechsterPunkt, tempoGleichmass,
  tempoGegenBest, merkeBest, leseBest, farben, relativ, warte, warteAuf,
} from "./vm-kern.js";

// ---------- Reine Logik (testbar) ----------

/** Formen je Stufe; jede Runde nimmt eine Form aus der Liste */
export function nachfahrenParameter(stufe) {
  const s = klemme(stufe, 1, 20);
  let formen;
  if (s <= 3) formen = [["linie"], ["welle", 0.12, 1.5], ["linie-schraeg"], ["welle", 0.16, 2]];
  else if (s <= 7) formen = [["welle", 0.25, 2], ["lll", 3], ["uuu", 3], ["welle", 0.3, 2.5]];
  else if (s <= 12) formen = [["lll", 4], ["spirale", 2], ["uuu", 4], ["welle", 0.35, 3.5]];
  else formen = [["lll", s >= 17 ? 6 : 5], ["spirale", s >= 17 ? 3 : 2.5], ["uuu", s >= 17 ? 6 : 5], ["spirale", s >= 17 ? 3.5 : 3]];
  return {
    formen,
    halbbreiteAnteil: stufenwert(s, 0.085, 0.028), // halbe Korridorbreite / kürzere Seite
    glaettung: 7,
  };
}

/** Form als Punktliste in Einheiten mit Höhe 1 und Breite ar */
export function formPunkte([art, a, b]) {
  const pts = [];
  const N = 400;
  if (art === "linie") return { ar: 4, pts: [{ x: 0.15, y: 0.5 }, { x: 3.85, y: 0.5 }] };
  if (art === "linie-schraeg") return { ar: 3, pts: [{ x: 0.15, y: 0.8 }, { x: 2.85, y: 0.2 }] };
  if (art === "welle") {
    const amp = a, per = b, ar = 4;
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push({ x: 0.15 + u * 3.7, y: 0.5 - amp * Math.sin(u * per * 2 * Math.PI) }); }
    return { ar, pts };
  }
  if (art === "lll") {
    // gestreckte Zykloide: Schleifen oben wie eine geschriebene Reihe „l“
    const n = a, P = 0.8, r = P / (2 * Math.PI), d = 1.7 * r;
    for (let i = 0; i <= N * n / 3; i++) {
      const t = Math.PI + (i / (N * n / 3)) * 2 * Math.PI * n;
      pts.push({ x: 0.2 + r * (t - Math.PI) - d * Math.sin(t) , y: 0.9 - 0.8 * (1 + Math.cos(t)) / 2 });
    }
    return { ar: n * P + 0.4, pts };
  }
  if (art === "uuu") {
    const n = a, P = 0.75;
    for (let i = 0; i <= N * n / 3; i++) { const u = i / (N * n / 3); pts.push({ x: 0.2 + u * n * P, y: 0.12 + 0.76 * Math.abs(Math.sin(u * n * Math.PI)) }); }
    return { ar: n * P + 0.4, pts };
  }
  if (art === "spirale") {
    const w = a;
    for (let i = 0; i <= N * w; i++) {
      const u = i / (N * w), th = u * w * 2 * Math.PI;
      const rad = 0.05 + 0.41 * u;
      pts.push({ x: 0.5 + rad * Math.cos(th), y: 0.5 + rad * Math.sin(th) });
    }
    return { ar: 1, pts };
  }
  throw new Error("Unbekannte Form " + art);
}

/** Form in eine Fläche w×h einpassen (Seitenverhältnis bleibt) und dicht abtasten */
export function formInFlaeche(form, w, h, rand = 36) {
  const { ar, pts } = formPunkte(form);
  const k = Math.max(10, Math.min((w - 2 * rand) / ar, h - 2 * rand));
  const ox = (w - ar * k) / 2, oy = (h - k) / 2;
  const px = pts.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k }));
  return { linie: abtasten(px, 3), einheit: k, art: form[0] };
}

/** Halbe Korridorbreite in px; bei Spiralen kleiner als der halbe Windungsabstand */
export function halbbreite(p, form, w, h, einheit) {
  let hb = Math.max(12, p.halbbreiteAnteil * Math.min(w, h));
  if (form[0] === "spirale") hb = Math.min(hb, 0.45 * (0.41 / form[1]) * einheit);
  if (form[0] === "lll" || form[0] === "uuu") hb = Math.min(hb, 0.2 * einheit);
  return Math.max(10, hb);
}

/** Anteil im Korridor über mehrere Striche (jeweils geglättet, nach Weg gewichtet) */
export function spurImKorridor(striche, linie, hb, fenster = 7) {
  let drin = 0, alle = 0;
  const geglaettet = [];
  for (const st of striche) {
    if (st.length < 2) continue;
    const g = glaetten(st, fenster);
    geglaettet.push(g);
    for (const q of abtasten(g, 4)) {
      alle++;
      if (naechsterPunkt(q, linie).abstand <= hb) drin++;
    }
  }
  return { anteil: alle ? drin / alle : 0, proben: alle, geglaettet };
}

/** Schriftgröße im Verlauf: Höhe der Spur im letzten Drittel relativ zum ersten (1 = gleich groß) */
export function groessenVerlauf(punkte) {
  if (punkte.length < 12) return 1;
  const xs = punkte.map((p) => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs), b = (x1 - x0) / 3;
  const hoehe = (a, e) => { const ys = punkte.filter((p) => p.x >= a && p.x <= e).map((p) => p.y); return ys.length ? Math.max(...ys) - Math.min(...ys) : 0; };
  const erst = hoehe(x0, x0 + b), letzt = hoehe(x1 - b, x1);
  return erst > 0 ? letzt / erst : 1;
}

/** Wertung einer Runde */
export function wegScore({ abdeckung, anteil, gleichmass, tempo = 1 }) {
  return klemme(abdeckung) * klemme(0.7 * anteil + 0.2 * gleichmass + 0.1 * tempo);
}

// ---------- Darstellung ----------

const FORMNAME = { linie: "Linie", "linie-schraeg": "Linie", welle: "Welle", lll: "Schreibschleifen", uuu: "Schreibbögen", spirale: "Spirale" };

export default {
  id: "nachfahren",
  bereich: "Visuomotorik",
  titel: "Wege nachfahren",
  icon: "",
  anleitung: (stufe) => `Setzen Sie den Finger auf den grünen Punkt und fahren Sie den Weg bis zum Ring nach. Bleiben Sie im breiten Band. ${stufe >= 4 ? "Schreiben Sie ruhig und gleichmäßig groß. " : ""}Absetzen ist erlaubt: dort weitermachen, wo Sie aufgehört haben.`,

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = nachfahrenParameter(stufe);
    const info = h("p.hinweis", { text: "" });
    const rahmen = h("div.vm-rahmen");
    const knopfEnde = h("button.knopf", { text: "Diesen Weg beenden" });
    const knopfWeiter = h("button.knopf.gross.primaer", { text: "Weiter" });
    knopfWeiter.hidden = true;
    stage.append(info, rahmen, h("div.knopfreihe", {}, knopfEnde, knopfWeiter));

    const canvas = h("canvas.vm-flaeche.vm-zeichnen");
    rahmen.append(canvas);
    const g = canvas.getContext("2d");
    let W = 0, H = 0;
    let zustand = null; // { form, linie, hb, L, fortschritt, striche, aktiv, zeigeSpur, auswertung }

    const zeichne = () => {
      const f = farben(rahmen);
      g.clearRect(0, 0, W, H);
      if (!zustand) return;
      const { linie, hb, fortschritt, striche } = zustand;
      const pfad = (von = 0, bis = Infinity) => {
        g.beginPath(); let erst = true;
        for (const q of linie) { if (q.s < von || q.s > bis) continue; if (erst) { g.moveTo(q.x, q.y); erst = false; } else g.lineTo(q.x, q.y); }
      };
      g.lineCap = "round"; g.lineJoin = "round";
      // Korridor
      pfad(); g.strokeStyle = f.lineStrong; g.lineWidth = 2 * hb + 4; g.stroke();
      pfad(); g.strokeStyle = f.alt; g.lineWidth = 2 * hb; g.stroke();
      pfad(); g.strokeStyle = f.muted; g.lineWidth = 2; g.setLineDash([4, 9]); g.stroke(); g.setLineDash([]);
      if (fortschritt > 0 && !zustand.zeigeSpur) { pfad(0, fortschritt); g.strokeStyle = f.sageLight; g.lineWidth = 2 * hb - 6; g.stroke(); }
      // Start und Ziel
      const a = linie[0], e = linie[linie.length - 1];
      g.fillStyle = f.sage; g.beginPath(); g.arc(a.x, a.y, Math.max(14, hb * 0.7), 0, Math.PI * 2); g.fill();
      g.strokeStyle = f.ink; g.lineWidth = 4; g.beginPath(); g.arc(e.x, e.y, Math.max(14, hb * 0.7), 0, Math.PI * 2); g.stroke();
      if (!zustand.zeigeSpur && fortschritt > 0 && !zustand.aktiv) {
        const q = linie.find((x) => x.s >= fortschritt) ?? e;
        g.strokeStyle = f.sage; g.lineWidth = 3; g.setLineDash([5, 5]);
        g.beginPath(); g.arc(q.x, q.y, Math.max(16, hb * 0.8), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
      // Spur
      if (zustand.zeigeSpur) {
        for (const st of zustand.auswertung.geglaettet) {
          for (let i = 1; i < st.length; i++) {
            const drin = naechsterPunkt(st[i], linie).abstand <= hb;
            g.strokeStyle = drin ? f.sage : f.copper; g.lineWidth = 5;
            g.beginPath(); g.moveTo(st[i - 1].x, st[i - 1].y); g.lineTo(st[i].x, st[i].y); g.stroke();
          }
        }
      } else {
        g.strokeStyle = f.ink; g.lineWidth = 4;
        for (const st of striche) {
          if (st.length < 2) continue;
          g.beginPath(); g.moveTo(st[0].x, st[0].y);
          for (let i = 1; i < st.length; i++) g.lineTo(st[i].x, st[i].y);
          g.stroke();
        }
      }
    };
    let angefordert = false;
    const bald = () => { if (angefordert) return; angefordert = true; requestAnimationFrame(() => { angefordert = false; zeichne(); }); };
    const groesse = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    groesse();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { const w0 = W, h0 = H; groesse(); if (w0 !== W || h0 !== H) zeichne(); }) : null;
    ro?.observe(canvas);

    const runden = [];
    const alleGeschw = [];
    try {
      for (let r = 0; r < p.formen.length; r++) {
        const form = p.formen[r];
        const { linie, einheit } = formInFlaeche(form, W, H);
        const hb = halbbreite(p, form, W, H, einheit);
        const L = linie[linie.length - 1].s;
        zustand = { form, linie, hb, L, fortschritt: 0, striche: [], aktiv: null, zeigeSpur: false };
        info.textContent = `Weg ${r + 1} von ${p.formen.length}: ${FORMNAME[form[0]]} – am grünen Punkt beginnen`;
        knopfEnde.hidden = false; knopfWeiter.hidden = true;
        zeichne();

        const zeit = { start: null, ende: null, bewegt: 0 };
        const ok = await warteAuf(ctx, (fertig) => {
          let letzteMeldung = 0, glatt = null;
          const fortschreiten = (pt) => {
            // leichte Echtzeit-Glättung nur für die Fortschrittsanzeige
            glatt = glatt ? { x: glatt.x * 0.6 + pt.x * 0.4, y: glatt.y * 0.6 + pt.y * 0.4 } : { x: pt.x, y: pt.y };
            const n = naechsterPunkt(glatt, linie, zustand.fortschritt - 4 * hb, zustand.fortschritt + 6 * hb);
            if (n && n.abstand <= 2.5 * hb) zustand.fortschritt = Math.max(zustand.fortschritt, n.punkt.s);
            if (zustand.fortschritt >= L - Math.max(2 * hb, 20)) { zustand.fortschritt = L; return true; }
            return false;
          };
          const down = (e) => {
            if (zustand.aktiv || (e.pointerType === "mouse" && e.button !== 0)) return;
            e.preventDefault();
            const pt = relativ(e, canvas);
            const anker = linie.find((x) => x.s >= zustand.fortschritt) ?? linie[0];
            const toleranz = Math.max(40, 2.5 * hb);
            if (Math.hypot(pt.x - anker.x, pt.y - anker.y) > toleranz) {
              if (performance.now() - letzteMeldung > 1200) {
                letzteMeldung = performance.now();
                feedback(stage, zustand.fortschritt > 0 ? "Bitte am gestrichelten Kreis weitermachen" : "Bitte am grünen Punkt beginnen", "neutral");
              }
              return;
            }
            try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
            zustand.aktiv = { id: e.pointerId, punkte: [pt] };
            zustand.striche.push(zustand.aktiv.punkte);
            glatt = null;
            if (zeit.start == null) zeit.start = pt.t;
            bald();
          };
          const move = (e) => {
            const a = zustand.aktiv;
            if (!a || e.pointerId !== a.id) return;
            const liste = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
            let ziel = false;
            for (const ce of (liste.length ? liste : [e])) {
              const pt = relativ(ce, canvas);
              a.punkte.push(pt);
              if (fortschreiten(pt)) ziel = true;
            }
            bald();
            if (ziel) { zustand.aktiv = null; zeit.ende = a.punkte[a.punkte.length - 1].t; fertig(true); }
          };
          const up = (e) => {
            const a = zustand.aktiv;
            if (!a || e.pointerId !== a.id) return;
            zustand.aktiv = null;
            const pt = relativ(e, canvas);
            a.punkte.push(pt);
            zeit.ende = pt.t;
            if (fortschreiten(pt)) return fertig(true);
            bald();
          };
          canvas.addEventListener("pointerdown", down);
          canvas.addEventListener("pointermove", move);
          canvas.addEventListener("pointerup", up);
          canvas.addEventListener("pointercancel", up);
          knopfEnde.onclick = debounced(() => fertig(true));
          return () => {
            canvas.removeEventListener("pointerdown", down);
            canvas.removeEventListener("pointermove", move);
            canvas.removeEventListener("pointerup", up);
            canvas.removeEventListener("pointercancel", up);
            knopfEnde.onclick = null;
          };
        });
        if (ok == null || !ctx.alive()) return null;

        // Auswertung dieser Runde
        const ausw = spurImKorridor(zustand.striche, linie, hb, p.glaettung);
        const abdeckung = zustand.fortschritt / L;
        let gl = 0, gew = 0, tempoSumme = 0;
        for (const st of ausw.geglaettet) {
          const t = tempoGleichmass(st);
          const len = st.length;
          gl += t.gleichmass * len; gew += len; tempoSumme += (t.tempo || 0) * len;
        }
        const gleichmass = gew ? gl / gew : 0;
        const tempoRel = gew ? (tempoSumme / gew) * 1000 / Math.min(W, H) : 0; // kürzere Seiten pro Sekunde
        if (tempoRel > 0) alleGeschw.push(tempoRel);
        const groessenRatio = form[0] === "lll" || form[0] === "uuu" ? groessenVerlauf(ausw.geglaettet.flat()) : null;
        const runde = { form: form[0], abdeckung, anteil: ausw.proben ? ausw.anteil : 0, gleichmass, groesse: groessenRatio };
        runde.score = wegScore({ ...runde, tempo: 1 });
        runden.push(runde);

        zustand.auswertung = ausw; zustand.zeigeSpur = true;
        zeichne();
        let satz = abdeckung < 0.5
          ? "Dieser Weg wurde nur zum Teil gefahren."
          : `${Math.round(runde.anteil * 100)} % Ihrer Spur lagen im Band.`;
        if (groessenRatio != null && groessenRatio < 0.8 && abdeckung >= 0.5) satz += " Zum Ende hin wurde es kleiner – versuchen Sie, groß zu bleiben.";
        info.textContent = satz;
        knopfEnde.hidden = true; knopfWeiter.hidden = false;
        const weiter = await warteAuf(ctx, (fertig) => {
          knopfWeiter.onclick = debounced(() => fertig(true));
          return () => { knopfWeiter.onclick = null; };
        });
        if (weiter == null || !ctx.alive()) return null;
        if (!(await warte(ctx, 150))) return null;
      }
    } finally {
      ro?.disconnect();
    }
    if (!ctx.alive()) return null;

    const tempo = alleGeschw.length ? mittelwert(alleGeschw) : null;
    const best = leseBest(ctx.bests, "nachfahren", "tempo");
    const tempoWert = tempo ? tempoGegenBest(tempo, best, { kleinerBesser: false, spielraum: 1.4 }) : 1;
    if (tempo) merkeBest(ctx.bests, "nachfahren", "tempo", tempo, false);
    const score = klemme(mittelwert(runden.map((x) => wegScore({ ...x, tempo: tempoWert }))));
    const anteil = mittelwert(runden.map((x) => x.anteil));
    const gleich = mittelwert(runden.map((x) => x.gleichmass));
    const fertigeWege = runden.filter((x) => x.abdeckung >= 0.9).length;
    let text = `${fertigeWege} von ${runden.length} Wegen vollständig, ${Math.round(anteil * 100)} % der Spur im Band, Tempo ${gleich >= 0.75 ? "gleichmäßig" : gleich >= 0.45 ? "meist gleichmäßig" : "noch schwankend"}.`;
    const kleiner = runden.filter((x) => x.groesse != null && x.groesse < 0.8).length;
    if (kleiner) text += " Achten Sie beim Schreiben darauf, groß zu bleiben.";
    return { score, text };
  },
};
