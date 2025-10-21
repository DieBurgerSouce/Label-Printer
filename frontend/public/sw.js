/**
 * Service Worker for PWA Support
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'label-printer-v2'; // Updated to clear old cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // IMPORTANT: Never cache API requests - they need to go to the backend directly
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.port === '3001' || url.port === '3002') {
    // Always fetch API requests from network, never cache
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Background sync for offline label creation (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-labels') {
    event.waitUntil(syncLabels());
  }
});

async function syncLabels() {
  // Sync offline-created labels when back online
  console.log('Syncing labels...');
  // Implementation would go here
}
