const CACHE_RETRATT = "retratt-shell-v1";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_RETRATT)
      .then(function (cache) { return cache.addAll(["/", "/retratt/icon-512.png"]); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.all([
      caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key.startsWith("itatame-shell-") || (key.startsWith("retratt-shell-") && key !== CACHE_RETRATT);
        }).map(function (key) { return caches.delete(key); }));
      }),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match("/").then(function (response) { return response || Response.error(); });
    })
  );
});

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "Retratt", {
    body: data.body || "Você tem novidades nas suas fotos.",
    icon: data.icon || "/retratt/icon-512.png",
    badge: data.badge || "/retratt/icon-512.png",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";
  event.waitUntil(self.clients.openWindow(url));
});
