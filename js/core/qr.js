// Kopf-Fit – minimaler QR-Code-Encoder (ISO/IEC 18004), ohne Bibliotheken, offline.
// Byte-Modus (UTF-8), Fehlerkorrektur L/M/Q/H (Standard M), Versionen 1–40, automatische Maskenauswahl.
// Reine Logik ohne DOM – in Node testbar. qrSVG() liefert einen SVG-String.

// ---------- Tabellen (Norm, Tabelle 9) ----------
// Index = Version (0 unbenutzt). Reihenfolge der Stufen: L, M, Q, H
const EC_STUFEN = { L: 0, M: 1, Q: 2, H: 3 };
/** Formatkennung der Stufe (2 Bit): L=01, M=00, Q=11, H=10 */
const EC_FORMAT = { L: 1, M: 0, Q: 3, H: 2 };

const EC_JE_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOECKE = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

// ---------- Grundgrößen ----------
export const groesse = (version) => version * 4 + 17;

/** Anzahl der Module, die für Daten + Fehlerkorrektur (inkl. Restbits) frei sind */
export function rohModule(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const anz = Math.floor(version / 7) + 2;
    n -= (25 * anz - 10) * anz - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

/** Datencodewörter (ohne Fehlerkorrektur) für Version und Stufe */
export function datenCodewoerter(version, ec = "M") {
  const s = EC_STUFEN[ec];
  return Math.floor(rohModule(version) / 8) - EC_JE_BLOCK[s][version] * BLOECKE[s][version];
}

/** Maximale Anzahl Bytes im Byte-Modus */
export function kapazitaetBytes(version, ec = "M") {
  const bits = datenCodewoerter(version, ec) * 8 - 4 - (version < 10 ? 8 : 16);
  return Math.floor(bits / 8);
}

/** Mittelpunkte der Ausrichtungsmuster (Zeilen- und Spaltenkoordinaten) */
export function ausrichtungsPositionen(version) {
  if (version === 1) return [];
  const anz = Math.floor(version / 7) + 2;
  const schritt = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (anz * 2 - 2)) * 2;
  const pos = [6];
  for (let p = groesse(version) - 7; pos.length < anz; p -= schritt) pos.splice(1, 0, p);
  return pos;
}

// ---------- Reed-Solomon über GF(256), Polynom 0x11D ----------
function gfMal(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Generatorpolynom vom Grad `grad` (ohne führende 1), höchster Koeffizient zuerst */
export function rsGenerator(grad) {
  const r = new Array(grad).fill(0);
  r[grad - 1] = 1;
  let wurzel = 1;
  for (let i = 0; i < grad; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMal(r[j], wurzel);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    wurzel = gfMal(wurzel, 0x02);
  }
  return r;
}

/** Fehlerkorrektur-Codewörter (Rest der Polynomdivision) */
export function rsRest(daten, grad) {
  const gen = rsGenerator(grad);
  const rest = new Array(grad).fill(0);
  for (const b of daten) {
    const faktor = b ^ rest.shift();
    rest.push(0);
    for (let i = 0; i < grad; i++) rest[i] ^= gfMal(gen[i], faktor);
  }
  return rest;
}

// ---------- Format- und Versionsinformation ----------
/** 15 Bit Formatinformation (bereits mit 0x5412 maskiert) */
export function formatBits(ec, maske) {
  const daten = (EC_FORMAT[ec] << 3) | maske;
  let rest = daten;
  for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  return ((daten << 10) | rest) ^ 0x5412;
}

/** 18 Bit Versionsinformation (ab Version 7) */
export function versionBits(version) {
  let rest = version;
  for (let i = 0; i < 12; i++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
  return (version << 12) | rest;
}

// ---------- Kodierung ----------
export function utf8(text) {
  if (typeof TextEncoder !== "undefined") return [...new TextEncoder().encode(text)];
  return [...unescape(encodeURIComponent(text))].map((c) => c.charCodeAt(0));
}

/** Kleinste passende Version für n Bytes oder -1 */
export function waehleVersion(n, ec = "M", min = 1, max = 40) {
  for (let v = min; v <= max; v++) if (n <= kapazitaetBytes(v, ec)) return v;
  return -1;
}

/** Datencodewörter (Modus, Länge, Nutzdaten, Abschluss, Füllbytes) */
export function datenBytes(bytes, version, ec = "M") {
  const bits = [];
  const schreibe = (wert, laenge) => { for (let i = laenge - 1; i >= 0; i--) bits.push((wert >>> i) & 1); };
  schreibe(0b0100, 4);
  schreibe(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) schreibe(b, 8);
  const kap = datenCodewoerter(version, ec) * 8;
  if (bits.length > kap) throw new Error("Daten zu lang für diese Version");
  schreibe(0, Math.min(4, kap - bits.length));
  schreibe(0, (8 - (bits.length % 8)) % 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < kap / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Aufteilen in Blöcke, Fehlerkorrektur anhängen, verschränken */
export function mitFehlerkorrektur(daten, version, ec = "M") {
  const s = EC_STUFEN[ec];
  const anzBloecke = BLOECKE[s][version];
  const ecLaenge = EC_JE_BLOCK[s][version];
  const roh = Math.floor(rohModule(version) / 8);
  const kurze = anzBloecke - (roh % anzBloecke);
  const kurzLaenge = Math.floor(roh / anzBloecke);
  const bloecke = [];
  const ecBloecke = [];
  for (let i = 0, k = 0; i < anzBloecke; i++) {
    const len = kurzLaenge - ecLaenge + (i < kurze ? 0 : 1);
    const b = daten.slice(k, k + len);
    k += len;
    bloecke.push(b);
    ecBloecke.push(rsRest(b, ecLaenge));
  }
  const out = [];
  for (let i = 0; i < bloecke[bloecke.length - 1].length; i++) for (const b of bloecke) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLaenge; i++) for (const b of ecBloecke) out.push(b[i]);
  return out;
}

// ---------- Matrix ----------
const MASKEN = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function grundgeruest(version) {
  const n = groesse(version);
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fest = Array.from({ length: n }, () => new Array(n).fill(false));
  const setze = (x, y, dunkel) => { m[y][x] = dunkel; fest[y][x] = true; };
  // Taktlinien
  for (let i = 0; i < n; i++) { setze(6, i, i % 2 === 0); setze(i, 6, i % 2 === 0); }
  // Suchmuster mit Trennrand
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setze(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  // Ausrichtungsmuster
  const pos = ausrichtungsPositionen(version);
  const letzte = pos.length - 1;
  pos.forEach((py, i) => pos.forEach((px, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === letzte) || (i === letzte && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setze(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // Format-Bereiche reservieren (Inhalt folgt je Maske) + dunkles Modul
  for (let i = 0; i < 9; i++) { fest[8][i] = true; fest[i][8] = true; }
  for (let i = 0; i < 8; i++) { fest[8][n - 1 - i] = true; fest[n - 1 - i][8] = true; }
  setze(8, n - 8, true);
  // Versionsinformation
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      setze(a, b, bit);
      setze(b, a, bit);
    }
  }
  return { n, m, fest };
}

function formatSchreiben(m, n, ec, maske) {
  const bits = formatBits(ec, maske);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
  m[n - 8][8] = true;
}

function datenPlatzieren(m, fest, n, codewoerter) {
  let i = 0;
  const gesamt = codewoerter.length * 8;
  for (let rechts = n - 1; rechts >= 1; rechts -= 2) {
    if (rechts === 6) rechts = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = rechts - j;
        const aufwaerts = ((rechts + 1) & 2) === 0;
        const y = aufwaerts ? n - 1 - vert : vert;
        if (fest[y][x]) continue;
        if (i < gesamt) m[y][x] = ((codewoerter[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++; // Restbits bleiben hell
      }
    }
  }
}

function maskieren(m, fest, n, maske) {
  const f = MASKEN[maske];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fest[y][x] && f(x, y)) m[y][x] = !m[y][x];
}

/** Strafpunkte nach Norm (N1 = 3, N2 = 3, N3 = 40, N4 = 10) */
export function strafpunkte(m) {
  const n = m.length;
  let p = 0;
  const linie = (get) => {
    let farbe = false, lauf = 0, s = 0;
    const hist = [0, 0, 0, 0, 0, 0, 0];
    const merke = (l) => { if (hist[0] === 0) l += n; hist.pop(); hist.unshift(l); };
    const finder = () => {
      const k = hist[1];
      const kern = k > 0 && hist[2] === k && hist[3] === k * 3 && hist[4] === k && hist[5] === k;
      return (kern && hist[0] >= k * 4 && hist[6] >= k ? 1 : 0) + (kern && hist[6] >= k * 4 && hist[0] >= k ? 1 : 0);
    };
    for (let i = 0; i < n; i++) {
      if (get(i) === farbe) {
        lauf++;
        if (lauf === 5) s += 3; else if (lauf > 5) s++;
      } else {
        merke(lauf);
        if (!farbe) s += finder() * 40;
        farbe = get(i);
        lauf = 1;
      }
    }
    if (farbe) { merke(lauf); lauf = 0; }
    merke(lauf + n);
    return s + finder() * 40;
  };
  for (let y = 0; y < n; y++) p += linie((x) => m[y][x]);
  for (let x = 0; x < n; x++) p += linie((y) => m[y][x]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  let dunkel = 0;
  for (const zeile of m) for (const c of zeile) if (c) dunkel++;
  const total = n * n;
  const k = Math.ceil(Math.abs(dunkel * 20 - total * 10) / total) - 1;
  p += Math.max(0, k) * 10;
  return p;
}

/**
 * QR-Matrix erzeugen.
 * @param {string|number[]} inhalt  Text (UTF-8) oder Bytes
 * @param {object} [opt] { ec: "L"|"M"|"Q"|"H" (Standard "M"), minVersion, maxVersion, maske (0–7, sonst automatisch) }
 * @returns {{ version, groesse, maske, ec, module: boolean[][] }}  module[y][x], true = dunkel
 * @throws Error("zu lang"), wenn der Inhalt nicht passt
 */
export function qrMatrix(inhalt, { ec = "M", minVersion = 1, maxVersion = 40, maske = null } = {}) {
  const bytes = typeof inhalt === "string" ? utf8(inhalt) : [...inhalt];
  const version = waehleVersion(bytes.length, ec, minVersion, maxVersion);
  if (version < 0) throw new Error("zu lang");
  const cw = mitFehlerkorrektur(datenBytes(bytes, version, ec), version, ec);
  const basis = grundgeruest(version);
  datenPlatzieren(basis.m, basis.fest, basis.n, cw);
  const probiere = (mk) => {
    const m = basis.m.map((z) => [...z]);
    maskieren(m, basis.fest, basis.n, mk);
    formatSchreiben(m, basis.n, ec, mk);
    return m;
  };
  let beste = null, besteMaske = 0, besteP = Infinity;
  const kandidaten = maske == null ? [0, 1, 2, 3, 4, 5, 6, 7] : [maske];
  for (const mk of kandidaten) {
    const m = probiere(mk);
    const p = kandidaten.length > 1 ? strafpunkte(m) : 0;
    if (p < besteP) { beste = m; besteP = p; besteMaske = mk; }
  }
  return { version, groesse: basis.n, maske: besteMaske, ec, module: beste };
}

/**
 * QR-Code als SVG-String (ein einziger Pfad, schwarz auf weiß – auch im Dunkelmodus gut scannbar).
 * @param {string} text
 * @param {object} [opt] { ec, rand: Ruhezone in Modulen (Standard 4), titel, klasse, modul: Pixel je Modul für width/height (Standard 6) }
 */
export function qrSVG(text, { ec = "M", rand = 4, titel = "QR-Code", klasse = "", modul = 6, ...rest } = {}) {
  const q = qrMatrix(text, { ec, ...rest });
  const gesamt = q.groesse + rand * 2;
  let d = "";
  q.module.forEach((zeile, y) => {
    let x = 0;
    while (x < q.groesse) {
      if (!zeile[x]) { x++; continue; }
      let len = 1;
      while (x + len < q.groesse && zeile[x + len]) len++;
      d += `M${x + rand} ${y + rand}h${len}v1h-${len}z`;
      x += len;
    }
  });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gesamt} ${gesamt}" width="${gesamt * modul}" height="${gesamt * modul}" role="img" aria-label="${esc(titel)}"${klasse ? ` class="${esc(klasse)}"` : ""} shape-rendering="crispEdges"><rect width="${gesamt}" height="${gesamt}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
