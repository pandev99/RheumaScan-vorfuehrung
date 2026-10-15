// RheumaScan installable app: works offline after the first visit.
// App files: served from cache, refreshed in the background (new version shows on the next start).
// Product lookups: network first, cached answer when offline. Libraries (scanner, text recognition): cached once used.
const PREFIX = "rheumascan-show-";
const VERSION = PREFIX + "202610151237";
const APP = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION && k !== PREFIX + "data" && k !== VERSION + "-lib").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
}

function networkFirst(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cache.match(req).then((hit) => hit || Response.error()))
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Only this app's own folder. Sub-folders (e.g. another app in /meine-app/) are left alone.
    const scopePath = new URL(self.registration.scope).pathname;
    const rest = url.pathname.startsWith(scopePath) ? url.pathname.slice(scopePath.length) : null;
    if (rest === null || rest.includes("/")) return;
    // Opening the app: always answer from cache so it starts without internet.
    if (req.mode === "navigate") { e.respondWith(staleWhileRevalidate(new Request("index.html"), VERSION)); return; }
    e.respondWith(staleWhileRevalidate(req, VERSION));
    return;
  }
  if (url.hostname === "world.openfoodfacts.org") {
    e.respondWith(networkFirst(req, PREFIX + "data"));
    return;
  }
  if (/(^|\.)(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req, VERSION + "-lib"));
  }
});
