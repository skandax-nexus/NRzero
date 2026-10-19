/* AFTERZERO service worker: the game keeps working offline after the first visit.
 *
 * Local files
 *   release build (VERSION stamped by `npm run build:web`): every game file is precached at install
 *   and served cache-first; a new build gets a new VERSION, a new cache, and the old one is deleted.
 *   unbuilt checkout (VERSION 'afterzero-dev'): network-first with a cache fallback, so a deployed
 *   repo folder never serves stale code; everything fetched while online is kept for offline play.
 * Google Fonts
 *   network-first, cached copy when offline, and an empty stylesheet as the last resort
 *   (the CSS font stacks then fall back to system fonts).
 *
 * main.js registers this only on real http(s) origins, top-level (never in iframes or native shells).
 */
/* global self, caches, fetch, Request, Response, URL */
const VERSION = 'afterzero-dev';
// @precache-begin: list rewritten by scripts/build-www.mjs
const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'src/main.js',
  'vendor/three.module.min.js',
];
// @precache-end
const RELEASE = VERSION !== 'afterzero-dev';
const FONTS = 'afterzero-fonts';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // one missing file must not fail the whole install
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('afterzero-') && k !== VERSION && k !== FONTS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(RELEASE ? cacheFirst(req, url) : networkFirst(req, url));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(fonts(req));
});

const keyOf = url => url.origin + url.pathname;   // index.html?m=2 is index.html
// complete same-origin 200s only: no redirects (Safari refuses them for navigations), no partial (206) bodies
const cacheable = res => res.status === 200 && res.type === 'basic' && !res.redirected;

async function cacheFirst(req, url) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(keyOf(url));
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(keyOf(url), res.clone());
    return res;
  } catch (err) {
    return (req.mode === 'navigate' && await cache.match(new URL('index.html', self.registration.scope).href)) || Promise.reject(err);
  }
}

async function networkFirst(req, url) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(keyOf(url), res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(keyOf(url)) || (req.mode === 'navigate' && await cache.match(new URL('index.html', self.registration.scope).href));
    return hit || Promise.reject(err);
  }
}

async function fonts(req) {
  const cache = await caches.open(FONTS);
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    return req.destination === 'style' || /fonts\.googleapis\.com/.test(req.url)
      ? new Response('/* offline: system fonts */', { headers: { 'Content-Type': 'text/css' } })
      : Response.error();
  }
}
