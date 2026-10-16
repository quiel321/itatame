self.addEventListener("push", function(event) {
  let data = {};
  try {
    const recebido = event.data ? event.data.json() : {};
    if (recebido && typeof recebido === "object" && !Array.isArray(recebido)) data = recebido;
  } catch (_) {
    // Uma mensagem malformada não pode impedir o navegador de exibir o aviso.
    data = { body: "Você recebeu um aviso do iTatame. Abra o sistema para conferir." };
  }
  const titulo = typeof data.title === "string" && data.title ? data.title : "iTatame";
  const corpo = typeof data.body === "string" && data.body ? data.body : "Você tem uma atualização no iTatame.";
  const tag = typeof data.tag === "string" && data.tag ? data.tag : undefined;
  let url = "/perfil";
  try {
    const destino = new URL(data.url || "/perfil", self.location.origin);
    if (destino.origin === self.location.origin) url = destino.pathname + destino.search + destino.hash;
  } catch (_) { /* Abre o perfil se o destino não for válido. */ }
  const options = {
    tag,
    renotify: false,
    body: corpo,
    // PNG já disponível no site, para exibição consistente no Android.
    icon: "/apple-icon",
    vibrate: [200, 100, 200],
    data: {
      url,
      dateOfArrival: Date.now()
    }
  };

  event.waitUntil(
    Promise.resolve().then(function() {
      return self.registration.showNotification(titulo, options);
    }).catch(function() {
      // Se opções/imagem falharem, ainda tenta exibir o conteúdo essencial.
      return self.registration.showNotification(titulo, { body: corpo, tag, renotify: false, data: options.data });
    })
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
