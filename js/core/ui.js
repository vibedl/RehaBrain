// Kleine UI-Helfer, ausgelegt auf Zittern (Tremor) und Einhand-Bedienung
import { debouncedMitVerweildauer } from "./bedienung.js";

const DEBOUNCE_MS = 300;

/**
 * Tipp-/Klick-Handler: löst beim Loslassen aus (native click), ignoriert Mehrfach-Tipps
 * (Sperrzeit) und wartet bei aktivierter Tipp-Verzögerung (Verweildauer) ein Mindesthalten ab
 * (beides in den Einstellungen unter „Bedienung“, Standard: nur die Sperrzeit, wie zuvor).
 * Funktioniert auch mit Enter/Leertaste.
 */
export function onTap(el, fn) {
  const handler = debouncedMitVerweildauer(fn);
  el.addEventListener("pointerdown", handler.pointerdown);
  el.addEventListener("click", handler.click);
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") handler.pointerdown(e); });
  return el;
}

/** Wie onTap, aber als Funktion – für el.onclick = debounced(...), wenn der Handler pro Runde wechselt */
export function debounced(fn) {
  // Sperre gilt je Handler (also je Knopf): Zittern auf DEMSELBEN Ziel wird geschluckt,
  // ein schneller Tipp auf ein ANDERES Ziel (z. B. linke/rechte Fläche) zählt trotzdem.
  // Nutzt dieselbe einstellbare Sperrzeit wie onTap; die Verweildauer (Halten) braucht ein
  // eigenes pointerdown-Ereignis und gilt daher nur für onTap, nicht für diese Kurzform.
  const handler = debouncedMitVerweildauer(fn, { verweildauerMs: 0 });
  return (e) => handler.click(e);
}

/** Element bauen: h("button.gross", { onTap, text }, kinder…) */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "onTap") onTap(el, v);
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[rand(arr.length)];
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Kurze, freundliche Rückmeldung einblenden (nie „Fehler!“ in Rot) */
export function feedback(container, text, kind = "gut") {
  const el = h("div.feedback." + kind, { text, role: "status" });
  container.append(el);
  setTimeout(() => el.remove(), 1100);
}
