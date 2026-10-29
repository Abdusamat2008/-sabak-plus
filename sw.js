// Service Worker: оболочка приложения кэшируется, поэтому SABAK+ открывается без интернета.
const CACHE = 'sabak-shell-v7';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/css/paper.jpg',
  '/js/app.js', '/js/store.js', '/js/calc.js', '/js/ai.js', '/js/i18n.js', '/js/ky.js', '/js/privacy.js', '/js/tour.js', '/js/common.js', '/js/auth.js', '/js/people.js', '/js/admin.js', '/js/analytics.js', '/js/export.js', '/js/face.js', '/js/docs.js', '/js/api.js', '/js/net.js', '/js/config.js',
  '/fonts/oswald-700.woff2', '/fonts/inter-400.woff2', '/fonts/inter-700.woff2',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/hb') return; // API — всегда в сеть
  // Навигация: сеть → кэш (чтобы обновления приходили), офлайн → закэшированная страница
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('/index.html', c)); return r; }).catch(() => caches.match('/index.html')));
    return;
  }
  // Остальное: кэш, затем сеть (и обновляем кэш в фоне)
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
