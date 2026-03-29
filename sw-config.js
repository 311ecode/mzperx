/* Service Worker Configuration */
const SW_CONFIG = {
    CACHE_NAME: 'bezorglijst-v2',
    URLS_TO_CACHE: [
        './',
        './index.html',
        './styles-base.css',
        './styles-header.css',
        './styles-map.css',
        './styles-sidebar.css',
        './styles-controls.css',
        './styles-responsive.css',
        './tracker-service-worker.js',
        './tracker-db.js',
        './tracker-route.js',
        './tracker-geocode.js',
        './tracker-map.js',
        './tracker-map-location.js',
        './tracker-map-markers.js',
        './tracker-delivery.js',
        './tracker-complaints.js',
        './tracker-ui.js',
        './tracker-controls.js',
        './tracker.js',
        './sample.json',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    ]
};
