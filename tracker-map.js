/* Map Initialization */

// Initialize map
function initMap() {
    map = L.map('map', {
        maxZoom: 19  // Allow zooming to maximum detail
    }).setView([52.3874, 4.6462], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}