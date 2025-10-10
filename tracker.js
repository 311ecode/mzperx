let routeData = null;
let map;
let markers = [];
let completedDeliveries = new Set();
let geocodeCache = {};
let isGeocoding = false;
let userLocationMarker = null;
let userLocationCircle = null;
let watchId = null;

// IndexedDB for persistent storage
const DB_NAME = 'BezorglijstDB';
const DB_VERSION = 1;
let db;

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered successfully:', registration.scope);
                
                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60000); // Check every minute
                
                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, reload to activate
                            if (confirm('Er is een nieuwe versie beschikbaar. Pagina herladen?')) {
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
    
    // Handle controller change (new service worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New service worker activated, reloading page...');
        window.location.reload();
    });
}

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
        
        // Always try to fetch fresh data if online
        if (navigator.onLine) {
            try {
                console.log('Checking for route data updates...');
                const response = await fetch('sample.json', {
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    const freshData = await response.json();
                    const freshDataStr = JSON.stringify(freshData);
                    const cachedDataStr = cachedRoute ? JSON.stringify(cachedRoute.data) : null;
                    
                    // Check if data has changed
                    if (freshDataStr !== cachedDataStr) {
                        console.log('🔄 Route data updated! Loading new data...');
                        routeData = freshData;
                        
                        // Cache the new data
                        await saveToIndexedDB('routes', { 
                            id: 'current', 
                            data: routeData,
                            timestamp: Date.now()
                        });
                        
                        // Show notification to user
                        showUpdateNotification();
                    } else {
                        console.log('✓ Route data is up to date');
                        routeData = freshData;
                    }
                    
                    updateHeaderInfo();
                    initializeApp();
                    return;
                }
            } catch (fetchError) {
                console.warn('Could not fetch fresh data, using cache:', fetchError);
            }
        }
        
        // Use cached data if available
        if (cachedRoute && cachedRoute.data) {
            routeData = cachedRoute.data;
            console.log('Route data loaded from IndexedDB (offline/fallback mode)');
            updateHeaderInfo();
            initializeApp();
            return;
        }
        
        // No cache and offline - this is an error
        throw new Error('No cached data and unable to fetch from network');
        
    } catch (error) {
        console.error('Failed to load route data:', error);
        alert('Fout: Kon route data niet laden. Zorg ervoor dat sample.json beschikbaar is of dat je eerder online bent geweest.');
    }
}

// Show notification when route data is updated
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #27ae60;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideDown 0.3s ease;
    `;
    notification.innerHTML = '🔄 Nieuwe route data geladen!';
    document.body.appendChild(notification);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateX(-50%) translateY(-100px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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
    startUserLocationTracking();
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

// Start tracking user location
function startUserLocationTracking() {
    if (!('geolocation' in navigator)) {
        console.warn('Geolocation is not supported by this browser');
        return;
    }
    
    // Request location permission and start watching
    watchId = navigator.geolocation.watchPosition(
        updateUserLocation,
        handleLocationError,
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    );
}

// Update user location on map
function updateUserLocation(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    console.log('User location updated:', lat, lon, 'accuracy:', accuracy);
    
    // Remove existing user location marker
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
    }
    
    // Create user location icon
    const userIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: #27ae60;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            position: relative;
        ">
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 8px;
                height: 8px;
                background-color: white;
                border-radius: 50%;
            "></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    // Add marker for user location
    userLocationMarker = L.marker([lat, lon], {
        icon: userIcon,
        zIndexOffset: 1000
    }).addTo(map);
    
    userLocationMarker.bindPopup(`
        <div style="text-align: center;">
            <strong>📍 Uw locatie</strong><br>
            <small>Nauwkeurigheid: ${Math.round(accuracy)}m</small>
        </div>
    `);
    
    // Add accuracy circle
    userLocationCircle = L.circle([lat, lon], {
        radius: accuracy,
        color: '#27ae60',
        fillColor: '#27ae60',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);
}

// Handle location errors
function handleLocationError(error) {
    console.error('Location error:', error);
    
    let message = 'Kon uw locatie niet bepalen';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Locatietoegang geweigerd. Schakel locatieservices in om uw positie te zien.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Locatie-informatie niet beschikbaar';
            break;
        case error.TIMEOUT:
            message = 'Locatie opvragen duurde te lang';
            break;
    }
    
    console.warn(message);
}

// Stop tracking user location
function stopUserLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    
    if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
        userLocationCircle = null;
    }
}

// Create custom icons
function getMarkerIcon(completionStatus) {
    let backgroundColor;
    let icon;
    
    switch (completionStatus) {
        case 'all':
            backgroundColor = '#27ae60'; // Green
            icon = '✓';
            break;
        case 'partial':
            backgroundColor = '#f39c12'; // Orange
            icon = '◐';
            break;
        case 'none':
        default:
            backgroundColor = '#e74c3c'; // Red
            icon = '📰';
            break;
    }
    
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${backgroundColor};
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
        ">${icon}</div></div>`,
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
    
    // Group deliveries by address (street + house number)
    const addressGroups = new Map();
    
    routeData.delivery_route.forEach((street, streetIndex) => {
        street.deliveries.forEach((delivery, deliveryIndex) => {
            if (delivery.lat && delivery.lon) {
                const addressKey = `${street.street}|${delivery.house_number}`;
                
                if (!addressGroups.has(addressKey)) {
                    addressGroups.set(addressKey, {
                        street: street.street,
                        city: street.city,
                        houseNumber: delivery.house_number,
                        lat: delivery.lat,
                        lon: delivery.lon,
                        deliveries: []
                    });
                }
                
                addressGroups.get(addressKey).deliveries.push({
                    id: `${streetIndex}-${deliveryIndex}`,
                    newspaper: delivery.newspaper,
                    name: delivery.name
                });
            }
        });
    });
    
    // Create one marker per address
    addressGroups.forEach((addressData) => {
        const { street, city, houseNumber, lat, lon, deliveries } = addressData;
        
        // Calculate completion status
        const completedCount = deliveries.filter(d => completedDeliveries.has(d.id)).length;
        const totalCount = deliveries.length;
        
        let completionStatus;
        if (completedCount === 0) {
            completionStatus = 'none';
        } else if (completedCount === totalCount) {
            completionStatus = 'all';
        } else {
            completionStatus = 'partial';
        }
        
        const marker = L.marker([lat, lon], {
            icon: getMarkerIcon(completionStatus)
        }).addTo(map);
        
        // Build popup content
        let popupContent = `<div class="popup-house">${street} ${houseNumber}</div>`;
        
        deliveries.forEach(delivery => {
            const isCompleted = completedDeliveries.has(delivery.id);
            popupContent += `
                <div style="margin-top: 8px; padding: 4px 0; border-top: 1px solid #eee;">
                    <div><strong>📰 ${delivery.newspaper}</strong>${delivery.name ? ` - ${delivery.name}` : ''}</div>
                    <div style="font-size: 12px; color: ${isCompleted ? '#27ae60' : '#e74c3c'};">
                        <strong>Status:</strong> ${isCompleted ? '✅ Bezorgd' : '📦 Te bezorgen'}
                    </div>
                </div>
            `;
        });
        
        marker.bindPopup(popupContent);
        
        // Click behavior
        if (deliveries.length === 1) {
            // Single delivery: toggle on click
            marker.on('click', () => {
                toggleDelivery(deliveries[0].id);
            });
        }
        // Multiple deliveries: just show popup (default behavior, no handler needed)
        
        markers.push({ 
            marker, 
            deliveryIds: deliveries.map(d => d.id),
            addressKey: `${street}|${houseNumber}`
        });
        
        bounds.push([lat, lon]);
    });
    
    // Fit map to show all markers
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Update marker colors
function updateMarkers() {
    markers.forEach(({ marker, deliveryIds }) => {
        // Calculate completion status for this address
        const completedCount = deliveryIds.filter(id => completedDeliveries.has(id)).length;
        const totalCount = deliveryIds.length;
        
        let completionStatus;
        if (completedCount === 0) {
            completionStatus = 'none';
        } else if (completedCount === totalCount) {
            completionStatus = 'all';
        } else {
            completionStatus = 'partial';
        }
        
        marker.setIcon(getMarkerIcon(completionStatus));
        
        // Update popup content
        const addressData = getAddressDataByIds(deliveryIds);
        if (addressData) {
            let popupContent = `<div class="popup-house">${addressData.street} ${addressData.houseNumber}</div>`;
            
            addressData.deliveries.forEach(delivery => {
                const isCompleted = completedDeliveries.has(delivery.id);
                popupContent += `
                    <div style="margin-top: 8px; padding: 4px 0; border-top: 1px solid #eee;">
                        <div><strong>📰 ${delivery.newspaper}</strong>${delivery.name ? ` - ${delivery.name}` : ''}</div>
                        <div style="font-size: 12px; color: ${isCompleted ? '#27ae60' : '#e74c3c'};">
                            <strong>Status:</strong> ${isCompleted ? '✅ Bezorgd' : '📦 Te bezorgen'}
                        </div>
                    </div>
                `;
            });
            
            marker.setPopupContent(popupContent);
        }
    });
}

// Get address data by delivery IDs
function getAddressDataByIds(deliveryIds) {
    if (!routeData || deliveryIds.length === 0) return null;
    
    const firstId = deliveryIds[0];
    const [streetIndex, deliveryIndex] = firstId.split('-').map(Number);
    const street = routeData.delivery_route[streetIndex];
    if (!street) return null;
    
    const firstDelivery = street.deliveries[deliveryIndex];
    if (!firstDelivery) return null;
    
    // Get all deliveries for this address
    const deliveries = deliveryIds.map(id => {
        const [sIdx, dIdx] = id.split('-').map(Number);
        const s = routeData.delivery_route[sIdx];
        const d = s.deliveries[dIdx];
        return {
            id,
            newspaper: d.newspaper,
            name: d.name
        };
    });
    
    return {
        street: street.street,
        houseNumber: firstDelivery.house_number,
        deliveries
    };
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

async function refreshRouteData() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '🔄 Laden...';
    btn.disabled = true;
    
    try {
        console.log('Refreshing all app resources (CSS, JS, Service Worker, Route Data)...');
        
        // Force reload with cache bypass - this will get fresh versions of everything
        window.location.reload(true);
        
    } catch (error) {
        console.error('Failed to refresh:', error);
        alert('Fout bij het verversen van de applicatie.');
        btn.innerHTML = originalText;
        btn.disabled = false;
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

// Toggle hamburger menu
function toggleMenu() {
    const menu = document.getElementById('controlsMenu');
    const overlay = document.getElementById('menuOverlay');
    
    menu.classList.toggle('show');
    overlay.classList.toggle('show');
}

// Close menu
function closeMenu() {
    const menu = document.getElementById('controlsMenu');
    const overlay = document.getElementById('menuOverlay');
    
    menu.classList.remove('show');
    overlay.classList.remove('show');
}

// Close menu when clicking outside
document.addEventListener('click', (event) => {
    const menu = document.getElementById('controlsMenu');
    const hamburger = document.querySelector('.hamburger-btn');
    
    if (menu && hamburger && !menu.contains(event.target) && !hamburger.contains(event.target)) {
        closeMenu();
    }
});

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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopUserLocationTracking();
});