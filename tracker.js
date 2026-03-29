/* Main Entry Point - Global State and Initialization */

let routeData      = null;
let map;
let markers        = [];
let completedDeliveries = new Set();
let geocodeCache   = {};
let isGeocoding    = false;
let userLocationMarker = null;
let userLocationCircle = null;
let watchId        = null;

const DB_NAME    = 'BezorglijstDB';
const DB_VERSION = 1;
let db;

async function initializeApp() {
    await loadGeocodeCache();
    await loadProgress();
    await geocodeAllAddresses();
    generateSidebar();
    createMarkers();
    await createComplaintMarkers();
    startUserLocationTracking();
}

initDB().then(() => {
    console.log('IndexedDB initialized');
    initMap();
    loadRouteData();
}).catch(error => {
    console.error('Failed to initialize IndexedDB:', error);
    initMap();
    loadRouteData();
});

window.addEventListener('beforeunload', () => {
    stopUserLocationTracking();
});
