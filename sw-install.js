/* Service Worker Install Event Handler */

function handleInstall(event) {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(SW_CONFIG.CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching app shell');
                // Cache files individually to handle failures gracefully
                return Promise.all(
                    SW_CONFIG.URLS_TO_CACHE.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn('[ServiceWorker] Failed to cache:', url, err);
                        });
                    })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Skip waiting');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Cache failed:', error);
            })
    );
}

self.addEventListener('install', handleInstall);