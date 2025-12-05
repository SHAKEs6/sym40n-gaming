self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'Notification', message: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Notification';
  const options = {
    body: data.message || '',
    icon: '/img/logo.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(function(clientList) {
    if (clientList.length > 0) {
      return clientList[0].focus();
    }
    return clients.openWindow('/');
  }));
});
