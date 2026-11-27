// Offline shell. Cache-first: after the first load the app never needs the network.
const VERSION = 'achilles-1.2.0';
const FILES = [
  './',
  './assets/fonts/Jersey15.woff2',
  './assets/fonts/PressStart2P.woff2',
  './assets/sprites/hero1.png',
  './assets/sprites/hero1b.png',
  './assets/sprites/hero2.png',
  './assets/sprites/hero2b.png',
  './assets/sprites/hero3.png',
  './assets/sprites/hero3b.png',
  './assets/sprites/hero4.png',
  './assets/sprites/hero4b.png',
  './assets/sprites/hero5.png',
  './assets/sprites/hero5b.png',
  './assets/sprites/hero6.png',
  './assets/sprites/hero6b.png',
  './assets/sprites/icon-180.png',
  './assets/sprites/icon-192.png',
  './assets/sprites/icon-512.png',
  './css/app.css',
  './index.html',
  './js/app.js',
  './js/dom.js',
  './js/engine/forge.js',
  './js/engine/nutrition.js',
  './js/engine/plates.js',
  './js/engine/progression.js',
  './js/engine/recovery.js',
  './js/engine/schedule.js',
  './js/engine/session.js',
  './js/platform/device.js',
  './js/program.js',
  './js/state.js',
  './js/store/db.js',
  './js/ui/common.js',
  './js/ui/eat.js',
  './js/ui/history.js',
  './js/ui/pillars.js',
  './js/ui/progress.js',
  './js/ui/recovery.js',
  './js/ui/routines.js',
  './js/ui/session.js',
  './js/ui/settings.js',
  './js/ui/today.js',
  './manifest.webmanifest',
  './seed/program.js',
];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : null) || fetch(e.request)));
});
