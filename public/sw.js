self.addEventListener("push", function(event) {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || "Voce tem uma atualizacao no iTatame.",
    icon: data.icon || "/logo.svg",
    badge: data.badge || "/logo.svg",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/perfil",
      dateOfArrival: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "iTatame", options)
  );
});

const SHELL_CACHE = "itatame-shell-v1";

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function(cache) { return cache.addAll(["/", "/icon.svg"]); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match("/").then(function(response) {
        return response || Response.error();
      });
    })
  );
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/perfil";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(url)) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
