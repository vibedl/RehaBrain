// Profile, Einstellungen, Stufen und Verlauf
import { load, save } from "./store.js";

export const DEFAULT_SETTINGS = {
  schrift: "gross",      // normal | gross | extra
  blatt: "franzoesisch", // franzoesisch | deutsch
  vorlesen: true,
  kontrast: false,
  ruhig: false,          // Animationen reduzieren
};

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

export function listProfiles() {
  return load("profiles", []);
}

export function createProfile(name) {
  const profiles = listProfiles();
  const p = {
    id: Date.now().toString(36),
    name: name.trim(),
    settings: { ...DEFAULT_SETTINGS },
    levels: {},       // modulId -> Stufe
    bests: {},        // modulId -> persönliche Bestwerte (z. B. Reaktionszeit)
    history: [],      // { t, modul, stufe, score, neueStufe }
    schlechterTag: null, // Datum (YYYY-MM-DD), an dem der Tag als „schlecht“ markiert wurde
    schwereTage: [],     // alle als „schwer“ markierten Tage (für Verlauf und Bericht)
  };
  profiles.push(p);
  save("profiles", profiles);
  return p;
}

export function updateProfile(p) {
  const profiles = listProfiles().map((x) => (x.id === p.id ? p : x));
  save("profiles", profiles);
}

export function deleteProfile(id) {
  save("profiles", listProfiles().filter((x) => x.id !== id));
}

export const today = () => new Date().toISOString().slice(0, 10);
export const isBadDay = (p) => p.schlechterTag === today();

/** „Heute geht es mir nicht so gut“ an- oder ausschalten – bleibt dauerhaft im Verlauf gespeichert */
export function toggleBadDay(p) {
  const tag = today();
  p.schwereTage = (p.schwereTage ?? []).filter((d) => d !== tag);
  if (isBadDay(p)) p.schlechterTag = null;
  else { p.schlechterTag = tag; p.schwereTage.push(tag); }
  updateProfile(p);
}

export function levelOf(p, modulId) {
  return p.levels[modulId] ?? 1;
}

/**
 * Anpassung der Stufe nach einem Block.
 * score: 0..1  →  ≥ 0.8 eine Stufe hoch, < 0.5 eine runter.
 * An einem als „schlecht“ markierten Tag (z. B. Parkinson-Off-Phase) wird nie herabgestuft.
 */
export function adapt(p, modulId, score) {
  const alt = levelOf(p, modulId);
  let neu = alt;
  if (score >= 0.8) neu = Math.min(MAX_LEVEL, alt + 1);
  else if (score < 0.5 && !isBadDay(p)) neu = Math.max(MIN_LEVEL, alt - 1);
  p.levels[modulId] = neu;
  p.history.push({ t: Date.now(), modul: modulId, stufe: alt, score: Math.round(score * 100) / 100, neueStufe: neu });
  if (p.history.length > 2000) p.history.splice(0, p.history.length - 2000);
  updateProfile(p);
  return { alt, neu };
}
