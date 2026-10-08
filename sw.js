/* The Metro Game — offline support.
   Code (HTML/JS/CSS): network first, falling back to the cache after 3 s,
   so a deploy shows up on the next load but a dead tunnel still works.
   Everything else (places.json, images, fonts, GSAP): cache first, refreshed
   in the background. */
const CACHE = 'metro-game-v1';
const SHELL = [
  './', 'index.html', 'style.css', 'script.js', 'metro-lines.js', 'metro-map.js', 'trip.js', 'places.js',
  'store.js', 'station-coords.js', 'places.json', 'manifest.webmanifest',
  'images/themetrogame.svg', 'images/coffee.svg', 'images/drinks.svg', 'images/food.svg',
  'images/activity.svg', 'images/shopping.svg', 'images/random.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isCode = req.mode === 'navigate' || (url.origin === location.origin && /\.(js|css|html)$/.test(url.pathname));
  e.respondWith(isCode ? networkFirst(req) : cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  const timeout = new Promise(r => setTimeout(r, 3000));
  try {
    const res = await Promise.race([net, timeout]);
    if (res) return res;
  } catch { /* offline */ }
  return (await cache.match(req, { ignoreSearch: req.mode === 'navigate' })) ?? net;
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit ?? (await net) ?? Response.error();
}
