// Keeps the app usable offline; always tries the network first so updates show up right away.
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = "sourcepick-__VERSION__";
const FILES = ["./", "index.html", "style.css", "lenses.js", "core.js", "store.js", "i18n.js", "config.js", "redirect.js", "app.js", "icons/icon.svg", "manifest.webmanifest"];
sw.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); sw.skipWaiting(); });
sw.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  sw.clients.claim();
});
sw.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && !url.search) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }) as Promise<Response>) // no cached copy: the request fails
  );
});
