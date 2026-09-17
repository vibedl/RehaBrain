// Speicherschicht. Heute: localStorage im Gerät. Später austauschbar gegen einen Server-Adapter
// mit derselben Schnittstelle (load/save), ohne dass der Rest der App sich ändert.

const PREFIX = "kopffit:";

export const localAdapter = {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* Speicher voll oder gesperrt – App läuft trotzdem weiter */
    }
  },
};

let adapter = localAdapter;
export const setAdapter = (a) => { adapter = a; };
export const load = (key, fallback) => adapter.load(key, fallback);
export const save = (key, value) => adapter.save(key, value);

// Alle Daten als Datei sichern / wiederherstellen
export function exportAll() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX)) data[k] = localStorage.getItem(k);
    }
  } catch { /* ignoriert */ }
  return JSON.stringify({ app: "kopf-fit", version: 1, exportiert: new Date().toISOString(), data }, null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  if (parsed.app !== "kopf-fit") throw new Error("Keine Kopf-Fit-Sicherung");
  for (const [k, v] of Object.entries(parsed.data)) localStorage.setItem(k, v);
}
