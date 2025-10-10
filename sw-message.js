/* Service Worker Message Event Handler */

function handleMessage(event) {
    console.log('[ServiceWorker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}

self.addEventListener('message', handleMessage);