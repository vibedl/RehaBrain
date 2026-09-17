// Offline-Unterstützung: alle App-Dateien werden beim ersten Besuch gespeichert.
// Bei jeder Änderung an Dateien VERSION erhöhen, damit Geräte die neue Fassung laden.
const VERSION = "kopffit-v9";
const DATEIEN = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "icon.svg",
  "css/auswertung.css",
  "css/gedaechtnis.css",
  "css/karten.css",
  "css/patience.css",
  "css/planen.css",
  "css/romme66.css",
  "css/sehen.css",
  "css/skat.css",
  "js/core/bericht.js",
  "js/core/einstufung.js",
  "js/core/icons.js",
  "js/core/profile.js",
  "js/core/speech.js",
  "js/core/store.js",
  "js/core/ui.js",
  "js/modules/ablauf.js",
  "js/modules/alltag.js",
  "js/modules/blicksprung.js",
  "js/modules/durchstreichen.js",
  "js/modules/einkaufen.js",
  "js/modules/einkaufsliste.js",
  "js/modules/figuren.js",
  "js/modules/gesichter.js",
  "js/modules/geteilt.js",
  "js/modules/reaktion.js",
  "js/modules/regeln.js",
  "js/modules/suchbild.js",
  "js/modules/turm.js",
  "js/modules/wege.js",
  "js/modules/zahlen.js",
  "js/cards/blatt52.js",
  "js/cards/deck.js",
  "js/cards/engine.js",
  "js/cards/hoeher.js",
  "js/cards/maumau.js",
  "js/cards/memory.js",
  "js/cards/patience.js",
  "js/cards/romme.js",
  "js/cards/schnipp.js",
  "js/cards/sechsundsechzig.js",
  "js/cards/siebzehnundvier.js",
  "js/cards/skat.js",
  "js/cards/skatki.js",
  "js/cards/skatregeln.js",
  "js/cards/skatschule.js",
  "js/cards/sortieren.js",
  "js/cards/tisch.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Erst Netz (damit Updates ankommen), bei fehlender Verbindung aus dem Speicher
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const kopie = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, kopie));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
