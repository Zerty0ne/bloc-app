/* Service worker — cache-first, précache complet pour usage offline */
const CACHE = "bloc-v5";
const FICHIERS = [
  "./",
  "./assets/exercices/farmer-carry-1.jpg",
  "./assets/exercices/farmer-carry-2.jpg",
  "./assets/exercices/goblet-squat-1.jpg",
  "./assets/exercices/goblet-squat-2.jpg",
  "./assets/exercices/mollets-marche-1.jpg",
  "./assets/exercices/mollets-marche-2.jpg",
  "./assets/exercices/planche-1.jpg",
  "./assets/exercices/planche-2.jpg",
  "./assets/exercices/planche-laterale-1.jpg",
  "./assets/exercices/planche-laterale-2.jpg",
  "./assets/exercices/rdl-2kb-1.jpg",
  "./assets/exercices/rdl-2kb-2.jpg",
  "./assets/exercices/rowing-1-bras-1.jpg",
  "./assets/exercices/rowing-1-bras-2.jpg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./blocs/bloc-1.json",
  "./config.json",
  "./css/style.css",
  "./exercices/bear-crawl.json",
  "./exercices/boxe-deplacement.json",
  "./exercices/decompression-vertebrale.json",
  "./exercices/farmer-carry.json",
  "./exercices/fentes-alternees.json",
  "./exercices/goblet-squat.json",
  "./exercices/kb-swing.json",
  "./exercices/mollets-marche.json",
  "./exercices/planche-laterale.json",
  "./exercices/planche.json",
  "./exercices/pompes-militaires.json",
  "./exercices/rdl-2kb.json",
  "./exercices/repos.json",
  "./exercices/rowing-1-bras.json",
  "./exercices/shadowboxing-explosif.json",
  "./exercices/shadowboxing-leger.json",
  "./exercices/shot.json",
  "./exercices/shrimping.json",
  "./exercices/sprawl.json",
  "./exercices/squats-legers.json",
  "./exercices/squats-profonds.json",
  "./exercices/technical-stand-up.json",
  "./exercices/tibetain-1-toupie.json",
  "./exercices/tibetain-2-table.json",
  "./exercices/tibetain-3-demilune.json",
  "./exercices/tibetain-4-pont.json",
  "./exercices/tibetain-5-triangle.json",
  "./exercices/turkish-get-up.json",
  "./index.html",
  "./js/app.js",
  "./manifest.json",
  "./seances/libres/combat-flow.json",
  "./seances/libres/tibetains-matin.json",
  "./seances/renfo-reprise.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))
  );
});
