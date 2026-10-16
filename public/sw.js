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

self.addEventListener("install", function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(function() {
      // Uma tela operacional não pode virar uma cópia antiga da página inicial.
      return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexão interrompida · iTatame</title><body style="background:#050505;color:white;font:18px sans-serif;padding:32px"><h1>Conexão interrompida</h1><p>Não foi possível abrir esta tela. Confira a internet e tente novamente.</p><button onclick="location.reload()" style="padding:16px;font:inherit">Tentar novamente</button></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
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
