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

self.addEventListener("install", function() {
  self.skipWaiting();
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
