const CACHE_VERSION = '1.0.7';
const STATIC_CACHE_NAME = `cerberus-pwa-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `cerberus-pwa-dynamic-v${CACHE_VERSION}`;

// Pre-cached assets during installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json',
  '/cerberus-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/splash/splash.png'
];

// Paths that must NEVER be cached (Ajuste 01 & P5)
const EXCLUDED_PATH_PATTERNS = [
  /\/api\//i,
  /\/auth\//i,
  /\/login/i,
  /\/logout/i,
  /\/token/i,
  /\/refresh-token/i,
  /\/me/i,
  /\/profile/i
];

function isExcluded(url) {
  return EXCLUDED_PATH_PATTERNS.some(pattern => pattern.test(url));
}

// 1. Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets...');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Force active service worker to become the active one immediately (controlled by user click later)
  self.skipWaiting();
});

// 2. Activate Event - Cache Clean-up
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event Interception
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = event.request.url;

  // STRICT CACHE EXCLUSION (P5 & Ajuste 01)
  // Never cache API calls, authentication requests, or user profile endpoints.
  if (isExcluded(url)) {
    return; // Pass through to network (Bypass Service Worker caching)
  }

  // Handle same-origin assets
  const requestUrl = new URL(url);
  if (requestUrl.origin === self.location.origin) {
    
    // HTML / Page Navigation: Network-First to ensure latest version is fetched, fallback to precached index.html
    if (event.request.mode === 'navigate' || requestUrl.pathname === '/' || requestUrl.pathname.endsWith('.html')) {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            // Keep the cached root updated
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => {
            // Fallback to cache
            return caches.match('/') || caches.match('/index.html');
          })
      );
      return;
    }

    // Static Assets (JS, CSS, Images, Fonts): Cache-First
    const isStaticAsset = 
      requestUrl.pathname.startsWith('/assets/') ||
      requestUrl.pathname.startsWith('/icons/') ||
      requestUrl.pathname.startsWith('/splash/') ||
      /\.(js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf|eot)$/i.test(requestUrl.pathname);

    if (isStaticAsset) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request).then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          }).catch(() => {
            // Offline fallback for static assets (could be blank image/fallback)
            return new Response('Asset not available offline', { status: 404, statusText: 'Not Found' });
          });
        })
      );
      return;
    }
  }

  // Cross-origin static resources (e.g. fonts from fonts.gstatic.com): Cache-First
  if (/\.(woff2|woff|ttf|css)$/i.test(requestUrl.pathname) || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => new Response('Offline Font Fallback', { status: 404 }));
      })
    );
    return;
  }
});

// 4. Update Message Handling (P4)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skipping waiting and activating immediately.');
    self.skipWaiting();
  }
});
