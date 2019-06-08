self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
    const payload = event.data ? event.data.json() : null;

    // if converse is open, it'll create notifications automatically
    event.waitUntil(
        self.clients.matchAll().then(function(clientList) {
            if (!clientList.length) {
                self.registration.showNotification("Converse XMPP notification", {
                    body: "body",
                    tag: "tag",
                    requireInteraction: true,
                    data: {
                        a: "b"
                    }
                });
            }
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    return self.clients.openWindow('/');
});
