// Offline-Unterstützung: alle App-Dateien werden beim ersten Besuch gespeichert.
// Bei jeder Änderung an Dateien VERSION erhöhen, damit Geräte die neue Fassung laden.
const VERSION = "kopffit-v10";
const DATEIEN = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "icon.svg",
  "css/aufmerksamkeit2.css",
  "css/auswertung.css",
  "css/bedienung.css",
  "css/beruf.css",
  "css/gedaechtnis.css",
  "css/karten.css",
  "css/patience.css",
  "css/planen.css",
  "css/profil.css",
  "css/romme66.css",
  "css/sehen.css",
  "css/sehen2.css",
  "css/skat.css",
  "css/therapie.css",
  "css/visuomotorik.css",
  "js/core/bedienung.js",
  "js/core/bericht.js",
  "js/core/einstufung.js",
  "js/core/icons.js",
  "js/core/leistungsprofil.js",
  "js/core/profile.js",
  "js/core/qr.js",
  "js/core/sehabstand.js",
  "js/core/speech.js",
  "js/core/store.js",
  "js/core/therapie.js",
  "js/core/ui.js",
  "js/modules/ablauf.js",
  "js/modules/alltag.js",
  "js/modules/bestellung.js",
  "js/modules/blicksprung.js",
  "js/modules/daten.js",
  "js/modules/durchstreichen.js",
  "js/modules/einkaufen.js",
  "js/modules/einkaufsliste.js",
  "js/modules/figuren.js",
  "js/modules/geschichte.js",
  "js/modules/gesichter.js",
  "js/modules/geteilt.js",
  "js/modules/greifen.js",
  "js/modules/nachfahren.js",
  "js/modules/post.js",
  "js/modules/randsicht.js",
  "js/modules/reaktion.js",
  "js/modules/regeln.js",
  "js/modules/rhythmus.js",
  "js/modules/suchbild.js",
  "js/modules/suchen.js",
  "js/modules/tagesplan.js",
  "js/modules/telefon.js",
  "js/modules/turm.js",
  "js/modules/umschalten.js",
  "js/modules/verbinden.js",
  "js/modules/vm-kern.js",
  "js/modules/wachheit.js",
  "js/modules/wachsam.js",
  "js/modules/wege.js",
  "js/modules/woerter.js",
  "js/modules/zahlen.js",
  "js/modules/zielen.js",
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
