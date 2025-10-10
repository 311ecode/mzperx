/* Service Worker Main Entry Point */

// Import all service worker modules
importScripts('sw-config.js');
importScripts('sw-install.js');
importScripts('sw-activate.js');
importScripts('sw-fetch.js');
importScripts('sw-message.js');

console.log('[ServiceWorker] Loaded all modules');