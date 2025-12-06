const CACHE_NAME = 'sym40n-v1';
const RUNTIME_CACHE = 'sym40n-runtime-v1';
const MUSIC_CACHE = 'sym40n-music-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/features.html',
  '/games.html',
  '/login.html',
  '/signup.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== MUSIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached API response
          return caches.match(request);
        })
    );
    return;
  }

  // Handle music files
  if (url.pathname.startsWith('/music/')) {
    event.respondWith(
      caches.open(MUSIC_CACHE)
        .then((cache) => {
          return cache.match(request)
            .then((response) => {
              if (response) {
                return response;
              }
              return fetch(request)
                .then((fetchResponse) => {
                  if (fetchResponse.ok) {
                    cache.put(request, fetchResponse.clone());
                  }
                  return fetchResponse;
                })
                .catch(() => {
                  // Return offline placeholder if available
                  return new Response('Audio file not available offline', {
                    status: 503,
                    statusText: 'Service Unavailable'
                  });
                });
            });
        })
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then((fetchResponse) => {
            // Cache successful responses
            if (fetchResponse && fetchResponse.status === 200) {
              const cache = caches.open(RUNTIME_CACHE);
              cache.then((c) => c.put(request, fetchResponse.clone()));
            }
            return fetchResponse;
          })
          .catch(() => {
            // Fallback for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            return new Response('Network error happened', {
              status: 408,
              statusText: 'Request Timeout'
            });
          });
      })
  );
});

// Background sync for music playback state
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-music-state') {
    event.waitUntil(
      clients.matchAll().then((matchedClients) => {
        matchedClients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_MUSIC_STATE'
          });
        });
      })
    );
  }
});

self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'Notification', message: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Sym40n Gaming';
  const options = {
    body: data.message || '',
    icon: '/img/logo.png',
    badge: '/img/logo.png',
    vibrate: [200, 100, 200],
    tag: 'sym40n-notification'
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

console.log('Service Worker loaded');
