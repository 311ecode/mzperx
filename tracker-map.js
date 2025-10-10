/* Map and Marker Management */

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