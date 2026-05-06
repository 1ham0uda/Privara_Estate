importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// The Firebase SDK registers this service worker with ?config={encodedJSON} in
// the URL.  self.__FIREBASE_CONFIG__ is only available in the main window scope,
// not in the SW scope, so we read from the URL query param first.
function getFirebaseConfig() {
  try {
    const params = new URLSearchParams(self.location.search);
    const encoded = params.get('config');
    if (encoded) return JSON.parse(decodeURIComponent(encoded));
  } catch (_) {}
  return self.__FIREBASE_CONFIG__ || null;
}

const config = getFirebaseConfig();

if (config && config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    const link = payload.data?.link || '/';

    self.registration.showNotification(title || 'Privara Estate', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
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
