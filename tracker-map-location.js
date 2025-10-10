/* User Location Tracking */

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