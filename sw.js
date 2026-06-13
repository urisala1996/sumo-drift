// DRIFT·SUMO service worker — caches the static app shell so the game loads
// instantly on repeat visits and can be installed to the home screen.
// Online play still needs connectivity; we deliberately never intercept
// Firebase realtime/analytics traffic (see the host guard in fetch).
//
// Bump CACHE when shipping new assets so old caches are purged on activate.
const CACHE = "driftsumo-v4";

const SHELL = [
  "./", "./index.html", "./css/style.css",
  "./favicon.svg", "./manifest.json", "./og-image.png",
  "./js/main.js", "./js/physics.js", "./js/cars.js", "./js/ai.js",
  "./js/scene.js", "./js/maps.js", "./js/rounds.js", "./js/hud.js",
  "./js/input.js", "./js/menu.js", "./js/lobby.js", "./js/net.js",
  "./js/config.js", "./js/state.js", "./js/firebase-config.js",
  "./js/analytics.js", "./js/audio.js", "./js/pickups.js", "./js/gauntlet.js",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll is atomic; if one URL 404s nothing caches. Cache best-effort instead.
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never touch Firebase realtime DB, analytics or telemetry — let them hit the
  // network directly so online play and metrics are never served from cache.
  if (/firebaseio|firebasedatabase|google-analytics|googletagmanager|analytics\.google/.test(url.hostname)) return;

  // Same-origin app shell: cache-first, fall back to network, then to index.html
  // for navigations (so a refresh while offline still boots the menu).
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(() => req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
    );
    return;
  }

  // Cross-origin CDN (three.js, firebase libs): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
