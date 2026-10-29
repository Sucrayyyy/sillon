// Hors-ligne : réseau d'abord, cache en secours.
const CACHE = 'sillon-v1';
const FILES = ['./', 'index.html', 'css/style.css?v=1', 'js/util.js?v=1', 'js/audio.js?v=1', 'js/music.js?v=1', 'js/disc.js?v=1', 'js/main.js?v=1', 'js/scenes.js?v=1', 'js/meta.js?v=1', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
