/* Service Worker: macht die Web-Version offline nutzbar (nur bei Aufruf über http/https). */
const CACHE = 'novachat-v3';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/markdown.js', './js/models.js', './js/local-ai.js', './js/speech.js', './js/offline.js',
  './js/providers.js', './js/ui.js', './js/app.js', './js/panels.js', './js/office.js', './js/work.js',
  './icons/icon.svg', './icons/icon-512.png', './manifest.webmanifest'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Große Modelldateien nicht zwischenspeichern (liegen im App-Speicher der Offline-KI)
  if (url.pathname.includes('/models/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
