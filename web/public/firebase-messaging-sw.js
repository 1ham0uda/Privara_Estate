importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config is injected at build-time by next.config.js via __FIREBASE_CONFIG__,
// or falls back to reading self.__FIREBASE_CONFIG__ injected by the web app.
const config = self.__FIREBASE_CONFIG__ || {};

if (config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    const link = payload.data?.link || '/';

    self.registration.showNotification(title || 'Privara Estate', {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { link },
      requireInteraction: false,
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    }),
  );
});
