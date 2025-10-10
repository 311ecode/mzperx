/* Main Entry Point - Global State and Initialization */

// Global state variables (accessible by all modules)
let routeData = null;
let map;
let markers = [];
let completedDeliveries = new Set();
let geocodeCache = {};
let isGeocoding = false;
let userLocationMarker = null;
let userLocationCircle = null;
let watchId = null;

// IndexedDB globals
const DB_NAME = 'BezorglijstDB';
const DB_VERSION = 1;
let db;

// Initialize application
async function initializeApp() {
    await loadGeocodeCache();
    await loadProgress();
    await geocodeAllAddresses();
    generateSidebar();
    createMarkers();
    startUserLocationTracking();
}

// Main initialization sequence
initDB().then(() => {
    console.log('IndexedDB initialized');
    initMap();
    loadRouteData();
}).catch(error => {
    console.error('Failed to initialize IndexedDB:', error);
    // Fallback to regular initialization
    initMap();
    loadRouteData();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopUserLocationTracking();
});