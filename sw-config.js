/* Service Worker Configuration */
const SW_CONFIG = {
    CACHE_NAME: 'bezorglijst-v1',
    URLS_TO_CACHE: [
        './',
        './index.html',
        './styles-base.css',
        './styles-header.css',
        './styles-map.css',
        './styles-sidebar.css',
        './styles-controls.css',
        './styles-responsive.css',
        './tracker.js',
        './sample.json',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    ]
};