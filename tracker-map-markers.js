/* Marker Creation and Management */

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

// Scroll sidebar item into view and highlight it
function highlightSidebarItems(deliveryIds) {
    // Remove any existing highlights first
    document.querySelectorAll('.delivery-item').forEach(item => {
        item.classList.remove('highlight-flash');
    });
    
    // Highlight all delivery items for this address
    deliveryIds.forEach((id, index) => {
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            // Scroll the first one into view
            if (index === 0) {
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
            
            // Add highlight animation to all
            setTimeout(() => {
                element.classList.add('highlight-flash');
                
                // Remove highlight after animation completes
                setTimeout(() => {
                    element.classList.remove('highlight-flash');
                }, 2000);
            }, 300);
        }
    });
}

// Create markers for all deliveries
function createMarkers() {
    if (!routeData) return;
    
    // Clear existing markers
    markers.forEach(({ marker }) => map.removeLayer(marker));
    markers = [];
    
    let bounds = [];
    
    // Group deliveries by address INCLUDING unit/name identifier
    // This ensures 284 RD and 284 ZW are treated as separate addresses
    const addressGroups = new Map();
    
    routeData.delivery_route.forEach((street, streetIndex) => {
        street.deliveries.forEach((delivery, deliveryIndex) => {
            if (delivery.lat && delivery.lon) {
                // Include name/unit in the key to distinguish different units at same building
                const unitIdentifier = delivery.name || '';
                const addressKey = `${street.street}|${delivery.house_number}|${unitIdentifier}`;
                
                if (!addressGroups.has(addressKey)) {
                    addressGroups.set(addressKey, {
                        street: street.street,
                        city: street.city,
                        houseNumber: delivery.house_number,
                        unitName: delivery.name,
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
    
    // Create one marker per address (including unit distinction)
    addressGroups.forEach((addressData) => {
        const { street, city, houseNumber, unitName, lat, lon, deliveries } = addressData;
        
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
        
        // Build popup content with unit identifier if present
        const displayAddress = unitName ? `${street} ${houseNumber} (${unitName})` : `${street} ${houseNumber}`;
        let popupContent = `<div class="popup-house">${displayAddress}</div>`;
        
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
        
        const deliveryIds = deliveries.map(d => d.id);
        
        // Click behavior
        if (deliveries.length === 1) {
            marker.on('click', () => {
                toggleDelivery(deliveries[0].id);
                highlightSidebarItems(deliveryIds);
            });
        } else {
            marker.on('click', () => {
                highlightSidebarItems(deliveryIds);
            });
        }
        
        markers.push({ 
            marker, 
            deliveryIds: deliveryIds,
            addressKey: `${street}|${houseNumber}|${unitName || ''}`
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
        
        const addressData = getAddressDataByIds(deliveryIds);
        if (addressData) {
            const displayAddress = addressData.unitName ? 
                `${addressData.street} ${addressData.houseNumber} (${addressData.unitName})` : 
                `${addressData.street} ${addressData.houseNumber}`;
            let popupContent = `<div class="popup-house">${displayAddress}</div>`;
            
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
        unitName: firstDelivery.name,
        deliveries
    };
}

// Find marker by delivery ID and center map on it
function centerMapOnDelivery(deliveryId) {
    const markerData = markers.find(m => m.deliveryIds.includes(deliveryId));
    if (markerData) {
        const markerLatLng = markerData.marker.getLatLng();
        map.setView(markerLatLng, Math.max(map.getZoom(), 17), {
            animate: true,
            duration: 0.5
        });
        
        markerData.marker.openPopup();
        setTimeout(() => {
            markerData.marker.closePopup();
        }, 2000);
    }
}
