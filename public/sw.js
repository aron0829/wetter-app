// Service Worker: hält die App-Hülle offline bereit.
// Eigene Dateien: sofort aus dem Cache, im Hintergrund aktualisieren (wirkt beim nächsten Start).
// Wetterdaten, Radar und Kartenkacheln laufen unverändert übers Netz.

const VERSION = 'v2';
const SHELL = `wetter-shell-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/api.js',
  'js/astro.js',
  'js/cache.js',
  'js/geo.js',
  'js/icons.js',
  'js/model.js',
  'js/places.js',
  'js/scene.js',
  'js/time.js',
  'js/weathercodes.js',
  'js/ui/chart.js',
  'js/ui/html.js',
  'js/ui/page.js',
  'js/ui/pager.js',
  'js/ui/places-sheet.js',
  'js/ui/radar.js',
  'js/ui/sky.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  'fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('wetter-shell-') && k !== SHELL).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const key = request.mode === 'navigate' ? 'index.html' : request;
    const cached = await cache.match(key, { ignoreSearch: true });

    const update = fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok && response.type === 'basic') cache.put(key, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(update);
      return cached;
    }
    const fresh = await update;
    return fresh || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
