let routeData = null;
let map;
let markers = [];
let completedDeliveries = new Set();
let geocodeCache = {};
let isGeocoding = false;

// Load route data from sample.json
async function loadRouteData() {
    try {
        const response = await fetch('sample.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        routeData = await response.json();
        console.log('Route data loaded successfully');
        
        // Update header with route info
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo && routeData.metadata) {
            const date = new Date(routeData.metadata.distribution_date);
            const dateStr = date.toLocaleDateString('nl-NL', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            routeInfo.textContent = `Route ${routeData.metadata.element_number} • ${dateStr}`;
        }
        
        // Initialize the app after data is loaded
        initializeApp();
    } catch (error) {
        console.error('Failed to load route data:', error);
        alert('Fout: Kon sample.json niet laden. Zorg ervoor dat het bestand in dezelfde map staat als index.html');
    }
}

// Initialize the app after data is loaded
function initializeApp() {
    loadGeocodeCache();
    geocodeAllAddresses().then(() => {
        generateSidebar();
        loadProgress();
        createMarkers();
    });
}

// Load geocode cache from localStorage
function loadGeocodeCache() {
    const cached = localStorage.getItem('geocodeCache');
    if (cached) {
        try {
            geocodeCache = JSON.parse(cached);
            console.log('Loaded geocode cache with', Object.keys(geocodeCache).length, 'addresses');
        } catch (e) {
            console.error('Failed to load geocode cache:', e);
            geocodeCache = {};
        }
    }
}

// Save geocode cache to localStorage
function saveGeocodeCache() {
    try {
        localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache));
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
            saveGeocodeCache();
            
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
            } else {
                const coords = await geocodeAddress(street.street, delivery.house_number, street.city);
                if (coords) {
                    delivery.lat = coords.lat;
                    delivery.lon = coords.lon;
                    geocodedCount++;
                } else {
                    failedCount++;
                }
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
            html += `
                <div class="delivery-item" data-id="${id}" onclick="toggleDelivery('${id}')">
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

function toggleDelivery(id) {
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
    saveProgress();
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

function resetProgress() {
    if (confirm('Weet je zeker dat je alle voortgang wilt resetten?')) {
        completedDeliveries.clear();
        document.querySelectorAll('.delivery-item').forEach(item => {
            item.classList.remove('completed');
        });
        updateStats();
        updateMarkers();
        localStorage.removeItem('deliveryProgress');
    }
}

function saveProgress() {
    localStorage.setItem('deliveryProgress', JSON.stringify([...completedDeliveries]));
}

function loadProgress() {
    const saved = localStorage.getItem('deliveryProgress');
    if (saved) {
        completedDeliveries = new Set(JSON.parse(saved));
        completedDeliveries.forEach(id => {
            const element = document.querySelector(`[data-id="${id}"]`);
            if (element) element.classList.add('completed');
        });
        updateStats();
        updateMarkers();
    }
}

// Initialize - load route data first, then initialize map
initMap();
loadRouteData();