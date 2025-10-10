/* Service Worker Fetch Event Handler */

function handleFetch(event) {
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

    // Network-first strategy for sample.json to get latest route data
    if (requestUrl.pathname.endsWith('sample.json')) {
        event.respondWith(
            fetch(event.request, {
                cache: 'no-cache'
            })
                .then((response) => {
                    // Clone and cache the response
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(SW_CONFIG.CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache-first strategy for everything else
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
                        caches.open(SW_CONFIG.CACHE_NAME)
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
}

self.addEventListener('fetch', handleFetch);