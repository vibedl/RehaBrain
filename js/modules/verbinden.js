// Visuomotorik: Punkte verbinden – Zahlen (später Zahl und Buchstabe im Wechsel) der Reihe nach antippen oder durchziehen
import { h, feedback, debounced } from "../core/ui.js";
import {
  klemme, stufenwert, tempoGegenBest, merkeBest, leseBest, tippErkennung, warte, warteAuf,
} from "./vm-kern.js";

// ---------- Reine Logik (testbar) ----------

export function verbindenParameter(stufe) {
  const s = klemme(stufe, 1, 20);
  return {
    anzahl: Math.round(stufenwert(s, 6, 22)),
    wechsel: s >= 10,                                   // 1-A-2-B …
    ablenker: s >= 6 ? Math.round(stufenwert(s, 1, 8)) : 0,
    abstandFaktor: stufenwert(s, 3.0, 2.25),           // Mittelpunktabstand in Radien
    hinweisNachMs: 9000,
    durchgaenge: 2,
  };
}

/** Beschriftungen der Reihenfolge: 1,2,3 … oder 1,A,2,B … (ohne J und Q, die leicht verwechselt werden) */
const BUCHSTABEN = "ABCDEFGHIKLMNOPRSTUVWZ";
export function folgeLabels(n, wechsel, ab = 0) {
  const aus = [];
  for (let i = ab; i < ab + n; i++) {
    if (!wechsel) aus.push(String(i + 1));
    else aus.push(i % 2 === 0 ? String(i / 2 + 1) : BUCHSTABEN[(i - 1) / 2 % BUCHSTABEN.length]);
  }
  return aus;
}

/** Punkte ohne Überlappung verteilen; liefert null, wenn es nicht passt */
export function platziere(n, w, h, r, minAbstand, rng = Math.random) {
  const rand = r + 8, pts = [];
  for (let i = 0; i < n; i++) {
    let ok = false;
    for (let v = 0; v < 400 && !ok; v++) {
      const p = { x: rand + rng() * (w - 2 * rand), y: rand + rng() * (h - 2 * rand) };
      if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= minAbstand)) { pts.push(p); ok = true; }
    }
    if (!ok) return null;
  }
  return pts;
}

/** Legt Radius und Abstand so fest, dass alles passt (zuerst Abstand verringern, dann Radius) */
export function layout(anzahl, w, h, p, rng = Math.random) {
  for (let r = 36; r >= 24; r -= 4) {
    for (let f = p.abstandFaktor; f >= 2.15; f -= 0.15) {
      const pts = platziere(anzahl, w, h, r, f * r, rng);
      if (pts) return { r, pts };
    }
  }
  return null;
}

export function verbindenScore({ n, fehler, hinweise, msProPunkt, bestMs }) {
  const genau = klemme(1 - (fehler * 0.5 + hinweise) * 2 / Math.max(1, n));
  const tempo = msProPunkt ? tempoGegenBest(msProPunkt, bestMs) : 1;
  return { genau, tempo, score: klemme(0.75 * genau + 0.25 * tempo) };
}

// ---------- Darstellung ----------

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

export default {
  id: "verbinden",
  bereich: "Visuomotorik",
  titel: "Punkte verbinden",
  icon: "",
  anleitung: (stufe) => verbindenParameter(stufe).wechsel
    ? "Verbinden Sie im Wechsel Zahl und Buchstabe: 1, A, 2, B, 3, C … Tippen Sie die Kreise der Reihe nach an oder ziehen Sie den Finger von Kreis zu Kreis."
    : "Verbinden Sie die Zahlen der Reihe nach: 1, 2, 3 … Tippen Sie die Kreise nacheinander an oder ziehen Sie den Finger von Kreis zu Kreis.",

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = verbindenParameter(stufe);
    const info = h("p.hinweis", { text: "" });
    const rahmen = h("div.vm-rahmen");
    stage.append(info, rahmen);
    const svg = s("svg", { class: "vm-flaeche vm-verb", role: "img", "aria-label": "Spielfeld mit nummerierten Kreisen" });
    rahmen.append(svg);

    const bilanz = { n: 0, fehler: 0, hinweise: 0, zeitMs: 0, schritte: 0 };
    let anzahl = p.anzahl;

    for (let d = 0; d < p.durchgaenge; d++) {
      const rect = svg.getBoundingClientRect();
      const W = Math.max(300, Math.round(rect.width)), H = Math.max(300, Math.round(rect.height));
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.replaceChildren();

      let lay = null;
      while (!(lay = layout(anzahl + p.ablenker, W, H, p)) && anzahl > 4) anzahl--;
      if (!lay) { lay = layout(4, W, H, { abstandFaktor: 2.2 }); anzahl = 4; }
      const labels = folgeLabels(anzahl, p.wechsel);
      const ablenkLabels = folgeLabels(p.ablenker, p.wechsel, anzahl);
      const { r } = lay;
      const punkte = lay.pts.map((pt, i) => ({ ...pt, label: i < anzahl ? labels[i] : ablenkLabels[i - anzahl], index: i < anzahl ? i : -1 }));

      const linien = s("g", { class: "vm-verb-linien" });
      const gummi = s("line", { class: "vm-verb-gummi" });
      gummi.style.display = "none";
      const kreise = s("g");
      svg.append(linien, gummi, kreise);
      for (const pt of punkte) {
        const gr = s("g", { class: "vm-verb-punkt" });
        gr.append(s("circle", { cx: pt.x, cy: pt.y, r }));
        const t = s("text", { x: pt.x, y: pt.y, "text-anchor": "middle", "dominant-baseline": "central" });
        t.textContent = pt.label;
        gr.append(t);
        kreise.append(gr);
        pt.el = gr;
      }
      const ende = labels[labels.length - 1];
      info.textContent = `Durchgang ${d + 1} von ${p.durchgaenge}: von 1 bis ${ende}`;

      const erg = await warteAuf(ctx, (fertig) => {
        let naechster = 0, tStart = null, letzteAktion = performance.now(), hinweisAktiv = false;
        const nachVB = (pt) => {
          const b = svg.getBoundingClientRect();
          const k = Math.min(b.width / W, b.height / H) || 1;
          return { x: (pt.x - (b.width - W * k) / 2) / k, y: (pt.y - (b.height - H * k) / 2) / k };
        };
        const treffe = (pt, faktor) => {
          let best = null, bd = Infinity;
          for (const q of punkte) { const dd = Math.hypot(q.x - pt.x, q.y - pt.y); if (dd < bd) { bd = dd; best = q; } }
          return bd <= r * faktor ? best : null;
        };
        const erledigt = () => {
          const q = punkte[naechster];
          q.el.classList.remove("vm-verb-tipp"); q.el.classList.add("vm-verb-fertig");
          if (naechster > 0) {
            const a = punkte[naechster - 1];
            linien.append(s("line", { x1: a.x, y1: a.y, x2: q.x, y2: q.y }));
          } else tStart = performance.now();
          naechster++; letzteAktion = performance.now(); hinweisAktiv = false;
          if (naechster >= anzahl) fertig({ zeitMs: performance.now() - tStart });
        };
        const falsch = (q) => {
          if (q.index >= 0 && q.index < naechster) return; // schon verbunden – kein Fehler
          bilanz.fehler++;
          letzteAktion = performance.now();
          feedback(stage, `Gesucht ist: ${labels[naechster]}`, "neutral");
        };
        const zieheZu = (pt) => {
          const v = nachVB(pt);
          const a = naechster > 0 ? punkte[naechster - 1] : null;
          if (a) {
            gummi.style.display = "";
            gummi.setAttribute("x1", a.x); gummi.setAttribute("y1", a.y);
            gummi.setAttribute("x2", v.x); gummi.setAttribute("y2", v.y);
          }
          const q = treffe(v, 0.95);
          if (q && q.index === naechster) erledigt();
        };
        const trennen = tippErkennung(svg, {
          ziehSchwelle: 24,
          tipp: (pt) => {
            const q = treffe(nachVB(pt), 1.3);
            if (!q) return;
            if (q.index === naechster) erledigt(); else falsch(q);
          },
          ziehStart: (pt) => { zieheZu(pt); return true; },
          ziehBewegt: zieheZu,
          ziehEnde: (pt) => { zieheZu(pt); gummi.style.display = "none"; },
        });
        const iv = setInterval(() => {
          if (!hinweisAktiv && naechster < anzahl && performance.now() - letzteAktion > p.hinweisNachMs) {
            hinweisAktiv = true; bilanz.hinweise++;
            punkte[naechster].el.classList.add("vm-verb-tipp");
          }
        }, 400);
        return () => { trennen(); clearInterval(iv); };
      });
      if (erg == null || !ctx.alive()) return null;
      bilanz.n += anzahl; bilanz.zeitMs += erg.zeitMs; bilanz.schritte += anzahl - 1;
      feedback(stage, "Geschafft!", "gut");
      if (d + 1 < p.durchgaenge) {
        const knopf = h("button.knopf.gross.primaer", { text: "Nächster Durchgang" });
        const reihe = h("div.knopfreihe", {}, knopf);
        stage.append(reihe);
        const ok = await warteAuf(ctx, (fertig) => { knopf.onclick = debounced(() => fertig(true)); return () => reihe.remove(); });
        if (ok == null) return null;
      } else if (!(await warte(ctx, 900))) return null;
    }
    if (!ctx.alive()) return null;

    const schluessel = p.wechsel ? "msProPunktWechsel" : "msProPunkt";
    const msProPunkt = bilanz.schritte ? bilanz.zeitMs / bilanz.schritte : null;
    const bestMs = leseBest(ctx.bests, "verbinden", schluessel);
    const { score } = verbindenScore({ ...bilanz, msProPunkt, bestMs });
    const neu = merkeBest(ctx.bests, "verbinden", schluessel, msProPunkt, true);
    let text = `${bilanz.n} Punkte verbunden, `;
    text += bilanz.fehler ? `${bilanz.fehler}-mal einen anderen Kreis angetippt` : "ohne Umweg";
    if (bilanz.hinweise) text += `, ${bilanz.hinweise} Hilfe${bilanz.hinweise > 1 ? "n" : ""}`;
    if (msProPunkt) text += `. Im Mittel ${(msProPunkt / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s pro Schritt`;
    text += neu ? " – neue persönliche Bestzeit!" : ".";
    return { score, text };
  },
};
