let routeData = null;
let map;
let markers = [];
let completedDeliveries = new Set();
let geocodeCache = {};
let isGeocoding = false;

// IndexedDB for persistent storage
const DB_NAME = 'BezorglijstDB';
const DB_VERSION = 1;
let db;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Store for delivery progress
            if (!db.objectStoreNames.contains('progress')) {
                db.createObjectStore('progress', { keyPath: 'id' });
            }
            
            // Store for geocode cache
            if (!db.objectStoreNames.contains('geocache')) {
                db.createObjectStore('geocache', { keyPath: 'key' });
            }
            
            // Store for route data
            if (!db.objectStoreNames.contains('routes')) {
                db.createObjectStore('routes', { keyPath: 'id' });
            }
        };
    });
}

// Save to IndexedDB
function saveToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Load from IndexedDB
function loadFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get all from IndexedDB store
function getAllFromIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Load route data from sample.json
async function loadRouteData() {
    try {
        // Try to load from IndexedDB first (offline support)
        const cachedRoute = await loadFromIndexedDB('routes', 'current');
        if (cachedRoute && cachedRoute.data) {
            routeData = cachedRoute.data;
            console.log('Route data loaded from IndexedDB (offline mode)');
            updateHeaderInfo();
            initializeApp();
            return;
        }
        
        // If not in cache, fetch from network
        const response = await fetch('sample.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        routeData = await response.json();
        console.log('Route data loaded from network');
        
        // Cache the route data
        await saveToIndexedDB('routes', { id: 'current', data: routeData });
        
        updateHeaderInfo();
        initializeApp();
    } catch (error) {
        console.error('Failed to load route data:', error);
        
        // Try to load from IndexedDB as fallback
        try {
            const cachedRoute = await loadFromIndexedDB('routes', 'current');
            if (cachedRoute && cachedRoute.data) {
                routeData = cachedRoute.data;
                console.log('Route data loaded from IndexedDB (fallback)');
                updateHeaderInfo();
                initializeApp();
                return;
            }
        } catch (dbError) {
            console.error('Failed to load from IndexedDB:', dbError);
        }
        
        alert('Fout: Kon route data niet laden. Zorg ervoor dat sample.json beschikbaar is of dat je eerder online bent geweest.');
    }
}

// Update header with route info
function updateHeaderInfo() {
    const routeInfo = document.getElementById('routeInfo');
    if (routeInfo && routeData && routeData.metadata) {
        const date = new Date(routeData.metadata.distribution_date);
        const dateStr = date.toLocaleDateString('nl-NL', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        routeInfo.textContent = `Route ${routeData.metadata.element_number} • ${dateStr}`;
    }
}

// Initialize the app after data is loaded
async function initializeApp() {
    await loadGeocodeCache();
    await loadProgress();
    await geocodeAllAddresses();
    generateSidebar();
    createMarkers();
}

// Load geocode cache from IndexedDB
async function loadGeocodeCache() {
    try {
        const allCache = await getAllFromIndexedDB('geocache');
        geocodeCache = {};
        allCache.forEach(item => {
            geocodeCache[item.key] = item.value;
        });
        console.log('Loaded geocode cache with', Object.keys(geocodeCache).length, 'addresses');
    } catch (e) {
        console.error('Failed to load geocode cache:', e);
        geocodeCache = {};
    }
}

// Save geocode cache to IndexedDB
async function saveGeocodeCache(key, value) {
    try {
        await saveToIndexedDB('geocache', { key, value });
    } catch (e) {
        console.error('Failed to save geocode cache:', e);
    }
}

// Generate cache key for an address
function getCacheKey(street, houseNumber, city) {
    return `${street}|${houseNumber}|${city}`.toUpperCase();
}

// Geocode an address using Nominatim (OpenStreetMap)
async function geocodeAddress(street, houseNumber, city) {
    const cacheKey = getCacheKey(street, houseNumber, city);
    
    // Check cache first
    if (geocodeCache[cacheKey]) {
        console.log('Cache hit for:', cacheKey);
        return geocodeCache[cacheKey];
    }
    
    // Check if online
    if (!navigator.onLine) {
        console.log('Offline - cannot geocode:', cacheKey);
        return null;
    }
    
    // Rate limiting: wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const query = `${houseNumber} ${street}, ${city}, Netherlands`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    try {
        console.log('Geocoding:', query);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Bezorglijst-Tracker/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
            
            // Cache the result
            geocodeCache[cacheKey] = result;
            await saveGeocodeCache(cacheKey, result);
            
            return result;
        } else {
            console.warn('No results for:', query);
            return null;
        }
    } catch (error) {
        console.error('Geocoding error for', query, ':', error);
        return null;
    }
}

// Geocode all addresses in the route
async function geocodeAllAddresses() {
    if (isGeocoding || !routeData) return;
    isGeocoding = true;
    
    let geocodedCount = 0;
    let cachedCount = 0;
    let failedCount = 0;
    
    for (const street of routeData.delivery_route) {
        for (const delivery of street.deliveries) {
            // Skip if already has coordinates
            if (delivery.lat && delivery.lon) continue;
            
            const cacheKey = getCacheKey(street.street, delivery.house_number, street.city);
            
            if (geocodeCache[cacheKey]) {
                delivery.lat = geocodeCache[cacheKey].lat;
                delivery.lon = geocodeCache[cacheKey].lon;
                cachedCount++;
            } else if (navigator.onLine) {
                const coords = await geocodeAddress(street.street, delivery.house_number, street.city);
                if (coords) {
                    delivery.lat = coords.lat;
                    delivery.lon = coords.lon;
                    geocodedCount++;
                } else {
                    failedCount++;
                }
            } else {
                failedCount++;
            }
        }
    }
    
    console.log(`Geocoding complete: ${geocodedCount} new, ${cachedCount} cached, ${failedCount} failed`);
    isGeocoding = false;
    
    // Refresh markers after geocoding
    createMarkers();
}

// Initialize map
function initMap() {
    map = L.map('map').setView([52.3874, 4.6462], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Create custom icons
function getMarkerIcon(isCompleted) {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${isCompleted ? '#27ae60' : '#e74c3c'};
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            border: 3px solid white;
            transform: rotate(-45deg);
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "><div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: 16px;
        ">${isCompleted ? '✓' : '📰'}</div></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });
}

// Create markers for all deliveries
function createMarkers() {
    if (!routeData) return;
    
    // Clear existing markers
    markers.forEach(({ marker }) => map.removeLayer(marker));
    markers = [];
    
    let bounds = [];
    
    routeData.delivery_route.forEach((street, streetIndex) => {
        street.deliveries.forEach((delivery, deliveryIndex) => {
            if (delivery.lat && delivery.lon) {
                const id = `${streetIndex}-${deliveryIndex}`;
                const isCompleted = completedDeliveries.has(id);
                
                const marker = L.marker([delivery.lat, delivery.lon], {
                    icon: getMarkerIcon(isCompleted)
                }).addTo(map);
                
                marker.bindPopup(`
                    <div class="popup-house">${street.street} ${delivery.house_number}</div>
                    <div><strong>Krant:</strong> ${delivery.newspaper}</div>
                    ${delivery.name ? `<div><strong>Naam:</strong> ${delivery.name}</div>` : ''}
                    <div style="margin-top: 8px;">
                        <strong>Status:</strong> ${isCompleted ? '✅ Bezorgd' : '📦 Te bezorgen'}
                    </div>
                `);
                
                marker.on('click', () => {
                    toggleDelivery(id);
                });
                
                markers.push({ marker, id });
                bounds.push([delivery.lat, delivery.lon]);
            }
        });
    });
    
    // Fit map to show all markers
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Update marker colors
function updateMarkers() {
    markers.forEach(({ marker, id }) => {
        const isCompleted = completedDeliveries.has(id);
        marker.setIcon(getMarkerIcon(isCompleted));
        
        // Update popup content
        const delivery = getDeliveryById(id);
        if (delivery) {
            marker.setPopupContent(`
                <div class="popup-house">${delivery.street} ${delivery.house_number}</div>
                <div><strong>Krant:</strong> ${delivery.newspaper}</div>
                ${delivery.name ? `<div><strong>Naam:</strong> ${delivery.name}</div>` : ''}
                <div style="margin-top: 8px;">
                    <strong>Status:</strong> ${isCompleted ? '✅ Bezorgd' : '📦 Te bezorgen'}
                </div>
            `);
        }
    });
}

// Get delivery by ID
function getDeliveryById(id) {
    if (!routeData) return null;
    
    const [streetIndex, deliveryIndex] = id.split('-').map(Number);
    const street = routeData.delivery_route[streetIndex];
    if (!street) return null;
    
    const delivery = street.deliveries[deliveryIndex];
    if (!delivery) return null;
    
    return {
        ...delivery,
        street: street.street
    };
}

// Generate sidebar
function generateSidebar() {
    if (!routeData) return;
    
    const sidebar = document.getElementById('sidebar');
    let html = '';

    routeData.delivery_route.forEach((street, streetIndex) => {
        html += `<div class="street-section">
            <div class="street-header">${street.street}</div>`;
        
        street.deliveries.forEach((delivery, deliveryIndex) => {
            const id = `${streetIndex}-${deliveryIndex}`;
            const isCompleted = completedDeliveries.has(id);
            html += `
                <div class="delivery-item ${isCompleted ? 'completed' : ''}" data-id="${id}" onclick="toggleDelivery('${id}')">
                    <div class="checkbox">✓</div>
                    <div class="delivery-info">
                        <div>
                            <span class="house-number">${delivery.house_number}</span>
                            <span class="newspaper">${delivery.newspaper}</span>
                        </div>
                        ${delivery.name ? `<div class="customer-name">${delivery.name}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });

    sidebar.innerHTML = html;
    updateStats();
}

async function toggleDelivery(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    
    if (completedDeliveries.has(id)) {
        completedDeliveries.delete(id);
        element.classList.remove('completed');
    } else {
        completedDeliveries.add(id);
        element.classList.add('completed');
    }
    
    updateStats();
    updateMarkers();
    await saveProgress();
}

function updateStats() {
    if (!routeData) return;
    
    const total = routeData.delivery_route.reduce((sum, street) => 
        sum + street.deliveries.length, 0);
    const completed = completedDeliveries.size;
    const remaining = total - completed;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    document.getElementById('completedCount').textContent = completed;
    document.getElementById('remainingCount').textContent = remaining;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('progressFill').style.width = percentage + '%';
}

function centerMap() {
    if (markers.length > 0) {
        const bounds = markers.map(({ marker }) => marker.getLatLng());
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        map.setView([52.3874, 4.6462], 14);
    }
}

async function resetProgress() {
    if (confirm('Weet je zeker dat je alle voortgang wilt resetten?')) {
        completedDeliveries.clear();
        document.querySelectorAll('.delivery-item').forEach(item => {
            item.classList.remove('completed');
        });
        updateStats();
        updateMarkers();
        
        // Clear all progress from IndexedDB
        if (db) {
            const transaction = db.transaction(['progress'], 'readwrite');
            const store = transaction.objectStore('progress');
            store.clear();
        }
    }
}

async function saveProgress() {
    const progressArray = Array.from(completedDeliveries);
    for (const id of progressArray) {
        await saveToIndexedDB('progress', { id, completed: true });
    }
    console.log('Progress saved to IndexedDB');
}

async function loadProgress() {
    try {
        const allProgress = await getAllFromIndexedDB('progress');
        completedDeliveries = new Set(allProgress.map(item => item.id));
        console.log('Loaded progress:', completedDeliveries.size, 'completed deliveries');
    } catch (e) {
        console.error('Failed to load progress:', e);
        completedDeliveries = new Set();
    }
}

// Initialize - Initialize DB first, then load route data, then initialize map
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