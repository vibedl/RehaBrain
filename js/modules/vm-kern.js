// Visuomotorik: gemeinsame Helfer für die fünf Hand-Auge-Übungen (kein eigenes Modul)
// Reine Rechenfunktionen oben (in Node testbar), DOM-Helfer unten (brauchen den Browser erst beim Aufruf).

// ---------- Reine Logik ----------

export const klemme = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mittelwert = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
export function standardabweichung(arr) {
  if (arr.length < 2) return 0;
  const m = mittelwert(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}
/** Variationskoeffizient (Streuung relativ zum Mittel) – Maß für Gleichmäßigkeit */
export const variationskoeffizient = (arr) => { const m = mittelwert(arr); return m ? standardabweichung(arr) / m : 0; };
export function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y), k = Math.floor(a.length / 2);
  return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
}
/** Lineare Interpolation einer Stufe 1..20 zwischen zwei Werten */
export const stufenwert = (stufe, bei1, bei20) => bei1 + (bei20 - bei1) * (klemme(stufe, 1, 20) - 1) / 19;

/**
 * Gleitender Mittelwert über Punkte {x,y,t}: dämpft Tremor-Ausschläge.
 * fenster = Anzahl Punkte (ungerade sinnvoll), zentriert, an den Rändern verkürzt.
 */
export function glaetten(punkte, fenster = 5) {
  const n = punkte.length, k = Math.max(0, Math.floor(fenster / 2));
  if (k === 0 || n < 3) return punkte.map((p) => ({ ...p }));
  return punkte.map((p, i) => {
    const a = Math.max(0, i - k), b = Math.min(n - 1, i + k);
    let sx = 0, sy = 0;
    for (let j = a; j <= b; j++) { sx += punkte[j].x; sy += punkte[j].y; }
    const c = b - a + 1;
    return { ...p, x: sx / c, y: sy / c };
  });
}

/** Fitts-Schwierigkeitsindex (Shannon-Form) in Bit */
export const fittsIndex = (abstand, breite) => Math.log2(abstand / Math.max(1, breite) + 1);

/** Polylinie in gleichmäßigen Abständen neu abtasten; liefert Punkte mit Bogenlänge s */
export function abtasten(poly, schritt = 4) {
  const aus = [];
  if (!poly.length) return aus;
  let s = 0;
  aus.push({ x: poly[0].x, y: poly[0].y, s: 0 });
  let rest = schritt;
  for (let i = 1; i < poly.length; i++) {
    let ax = poly[i - 1].x, ay = poly[i - 1].y;
    const bx = poly[i].x, by = poly[i].y;
    let seg = Math.hypot(bx - ax, by - ay);
    while (seg >= rest) {
      const f = rest / seg;
      ax += (bx - ax) * f; ay += (by - ay) * f;
      s += rest; seg -= rest; rest = schritt;
      aus.push({ x: ax, y: ay, s });
    }
    rest -= seg; s += seg;
  }
  const l = poly[poly.length - 1];
  if (Math.hypot(l.x - aus[aus.length - 1].x, l.y - aus[aus.length - 1].y) > 0.01) aus.push({ x: l.x, y: l.y, s });
  return aus;
}

/** Nächster Punkt einer (dicht abgetasteten) Linie, optional nur im Bogenlängen-Fenster [sMin, sMax] */
export function naechsterPunkt(p, linie, sMin = -Infinity, sMax = Infinity) {
  let best = null, bd = Infinity;
  for (const q of linie) {
    if (q.s < sMin || q.s > sMax) continue;
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  return best ? { punkt: best, abstand: Math.sqrt(bd) } : null;
}

/**
 * Anteil der Spur, der im Korridor (Abstand ≤ halbbreite) liegt.
 * Die Spur wird vorher nach Weg neu abgetastet, damit Stillstand (viele Punkte an einer Stelle) nicht mitzählt.
 */
export function korridorAnteil(spur, linie, halbbreite, schritt = 4) {
  if (spur.length < 2 || !linie.length) return 0;
  const proben = abtasten(spur, schritt);
  if (proben.length < 2) return 0;
  let drin = 0;
  for (const p of proben) if (naechsterPunkt(p, linie).abstand <= halbbreite) drin++;
  return drin / proben.length;
}

/** Tempo-Gleichmäßigkeit einer Spur {x,y,t}: Geschwindigkeiten in Zeitfenstern, 1 = völlig gleichmäßig */
export function tempoGleichmass(spur, fensterMs = 150) {
  const v = [];
  let a = 0;
  for (let i = 1; i < spur.length; i++) {
    if (spur[i].t - spur[a].t >= fensterMs) {
      let weg = 0;
      for (let j = a + 1; j <= i; j++) weg += Math.hypot(spur[j].x - spur[j - 1].x, spur[j].y - spur[j - 1].y);
      v.push(weg / (spur[i].t - spur[a].t));
      a = i;
    }
  }
  const bewegt = v.filter((x) => x > 0.01); // kurze Pausen (Absetzen) zählen nicht als Ungleichmaß
  if (bewegt.length < 3) return { gleichmass: 1, cv: 0, tempo: mittelwert(bewegt) };
  const cv = variationskoeffizient(bewegt);
  // Handschrift hat natürlicherweise CV ≈ 0,3–0,5; erst darüber wird abgezogen
  return { gleichmass: klemme(1 - (cv - 0.35) / 0.9), cv, tempo: mittelwert(bewegt) };
}

/** Tempo relativ zur persönlichen Bestleistung: 1 bei Bestwert (mit Spielraum), sinkt sanft */
export function tempoGegenBest(wert, best, { kleinerBesser = true, spielraum = 1.25 } = {}) {
  if (!best || !wert) return 1;
  const q = kleinerBesser ? best * spielraum / wert : wert * spielraum / best;
  return klemme(q);
}

/** Bestwert in ctx.bests[modul][schluessel] eintragen; liefert true bei neuer Bestleistung */
export function merkeBest(bests, modul, schluessel, wert, kleinerBesser = true) {
  if (!bests || wert == null || !isFinite(wert)) return false;
  const b = (bests[modul] && typeof bests[modul] === "object") ? bests[modul] : (bests[modul] = {});
  const alt = b[schluessel];
  if (alt == null || (kleinerBesser ? wert < alt : wert > alt)) { b[schluessel] = Math.round(wert * 1000) / 1000; return alt != null; }
  return false;
}
export const leseBest = (bests, modul, schluessel) => bests?.[modul]?.[schluessel] ?? null;

// ---------- Browser-Helfer ----------

/** Farben aus den CSS-Variablen lesen (hell/dunkel automatisch) */
export function farben(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    ink: v("--ink", "#1C1917"), muted: v("--muted", "#665F55"), card: v("--card", "#fff"),
    alt: v("--canvas-alt", "#F1ECE6"), line: v("--line", "rgba(0,0,0,.08)"), lineStrong: v("--line-strong", "rgba(0,0,0,.16)"),
    copper: v("--copper", "#C2673F"), copperSubtle: v("--copper-subtle", "rgba(194,103,63,.1)"),
    sage: v("--sage", "#4E7057"), sageLight: v("--sage-light", "#E7EFE9"), blau: v("--blau", "#3F6390"),
    ocker: v("--ocker", "#9A7420"), pflaume: v("--pflaume", "#7A4E6E"), weiss: v("--kartenweiss", "#FFFDF9"),
  };
}

/**
 * Hochauflösende Zeichenfläche (Canvas) mit devicePixelRatio.
 * zeichne(g, w, h) wird bei Größenänderung aufgerufen. Liefert {canvas, g, w, h, neu(), weg()}.
 */
export function zeichenflaeche(parent, zeichne, klasse = "vm-flaeche") {
  const canvas = document.createElement("canvas");
  canvas.className = klasse;
  parent.append(canvas);
  const g = canvas.getContext("2d");
  const obj = { canvas, g, w: 0, h: 0 };
  obj.neu = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== obj.w || h !== obj.h || canvas.width !== Math.round(w * dpr)) {
      obj.w = w; obj.h = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    zeichne?.(g, obj.w, obj.h);
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => obj.neu()) : null;
  ro?.observe(canvas);
  obj.weg = () => ro?.disconnect();
  obj.neu();
  return obj;
}

/** Punkt relativ zu einem Element (CSS-Pixel) */
export function relativ(e, el) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() };
}

/**
 * Tipp-Erkennung für Tremor: Kontakt vom Aufsetzen bis Loslassen; die Position ist der Mittelwert aller
 * Kontaktpunkte (Zittern mittelt sich heraus). Bewegt sich der Finger weiter als ziehSchwelle, gilt es als Ziehen.
 * Mehrfach-Tipps innerhalb sperreMs werden ignoriert. Callbacks: tipp(pos, info), zieh*(pos).
 */
export function tippErkennung(el, { tipp, ziehStart, ziehBewegt, ziehEnde, ziehSchwelle = 28, sperreMs = 300 } = {}) {
  let aktiv = null, letzterTipp = -Infinity;
  const down = (e) => {
    if (aktiv || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const p = relativ(e, el);
    aktiv = { id: e.pointerId, start: p, punkte: [p], zieht: false, t0: performance.now() };
  };
  const move = (e) => {
    if (!aktiv || e.pointerId !== aktiv.id) return;
    const liste = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of (liste.length ? liste : [e])) aktiv.punkte.push(relativ(ce, el));
    const p = aktiv.punkte[aktiv.punkte.length - 1];
    if (!aktiv.zieht && ziehStart && Math.hypot(p.x - aktiv.start.x, p.y - aktiv.start.y) > ziehSchwelle) {
      aktiv.zieht = ziehStart(aktiv.start) !== false;
    }
    if (aktiv.zieht) ziehBewegt?.(p);
  };
  const up = (e) => {
    if (!aktiv || e.pointerId !== aktiv.id) return;
    const a = aktiv; aktiv = null;
    const p = relativ(e, el);
    if (a.zieht) { ziehEnde?.(p); return; }
    if (e.type === "pointercancel") return;
    const jetzt = performance.now();
    if (jetzt - letzterTipp < sperreMs) return;
    letzterTipp = jetzt;
    a.punkte.push(p);
    const mx = mittelwert(a.punkte.map((q) => q.x)), my = mittelwert(a.punkte.map((q) => q.y));
    tipp?.({ x: mx, y: my, t: a.start.t }, { dauer: jetzt - a.t0, start: a.start });
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
}

/** Wartet ms, bricht bei Abbruch früh ab (liefert false) */
export async function warte(ctx, ms) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) {
    if (!ctx.alive()) return false;
    await new Promise((r) => setTimeout(r, Math.min(60, Math.max(0, ende - performance.now()))));
  }
  return ctx.alive();
}

/** Promise, das per fertig(wert) gelöst wird oder bei Abbruch mit null */
export function warteAuf(ctx, setup) {
  return new Promise((resolve) => {
    let erledigt = false;
    const fertig = (v) => { if (erledigt) return; erledigt = true; clearInterval(iv); aufraeumen?.(); resolve(v); };
    const iv = setInterval(() => { if (!ctx.alive()) fertig(null); }, 250);
    const aufraeumen = setup(fertig);
  });
}

/** Leiser, kurzer Ton (nur Zusatz; Aufrufer entscheidet, ob er erlaubt ist) */
export function ton(audio, freq = 660, dauer = 0.09, lautst = 0.08) {
  if (!audio) return;
  try {
    const o = audio.createOscillator(), gn = audio.createGain();
    o.frequency.value = freq;
    const t = audio.currentTime;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(lautst, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(gn).connect(audio.destination);
    o.start(t); o.stop(t + dauer + 0.02);
  } catch { /* Ton ist nur Zusatz */ }
}
