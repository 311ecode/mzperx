/* Geocoding Operations */

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