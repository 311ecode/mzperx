const CACHE_NAME = 'bezorglijst-v1';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './tracker.js',
    './sample.json',
    './manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[ServiceWorker] Skip waiting');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Cache failed:', error);
            })
    );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch strategy: Cache first, then network
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Skip chrome extension requests
    if (requestUrl.protocol === 'chrome-extension:') {
        return;
    }
    
    // Skip cross-origin requests that aren't in our whitelist
    if (requestUrl.origin !== location.origin && 
        !requestUrl.hostname.includes('unpkg.com') &&
        !requestUrl.hostname.includes('openstreetmap.org') &&
        !requestUrl.hostname.includes('nominatim.openstreetmap.org')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Cache hit - return the cached response
                if (cachedResponse) {
                    console.log('[ServiceWorker] Found in cache:', event.request.url);
                    return cachedResponse;
                }

                // Not in cache - fetch from network
                console.log('[ServiceWorker] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Don't cache:
                        // - Non-GET requests
                        // - Nominatim geocoding API (dynamic data)
                        if (event.request.method !== 'GET' || 
                            requestUrl.hostname.includes('nominatim.openstreetmap.org')) {
                            return response;
                        }

                        // Clone the response (can only be consumed once)
                        const responseToCache = response.clone();

                        // Cache the fetched response for future use
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch((error) => {
                                console.error('[ServiceWorker] Cache put failed:', error);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('[ServiceWorker] Fetch failed:', error);
                        
                        // If fetch fails and we have nothing in cache, return a meaningful error
                        return new Response('Offline - content not available', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
            .catch((error) => {
                console.error('[ServiceWorker] Cache match failed:', error);
                return new Response('Cache error', {
                    status: 500,
                    statusText: 'Internal Server Error'
                });
            })
    );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
    console.log('[ServiceWorker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});