/* Service Worker Activate Event Handler */

function handleActivate(event) {
    console.log('[ServiceWorker] Activate');
    const cacheWhitelist = [SW_CONFIG.CACHE_NAME];
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
}

self.addEventListener('activate', handleActivate);