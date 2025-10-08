// Sample route data with coordinates
const routeData = {
    metadata: {
        distribution_date: "2025-10-08",
        route_code: "10024207",
        area: "HAARLEM NOORD"
    },
    delivery_route: [
        { street: "VONDELWEG", city: "HAARLEM", deliveries: [
            { house_number: "252", newspaper: "HD", name: "ZWAR", lat: 52.3890, lon: 4.6420 },
            { house_number: "284", newspaper: "VK", name: "RD", lat: 52.3895, lon: 4.6425 }
        ]},
        { street: "NACHTEGAALSTRAAT", city: "HAARLEM", deliveries: [
            { house_number: "73", newspaper: "HD", lat: 52.3870, lon: 4.6450 },
            { house_number: "95", newspaper: "HD", lat: 52.3875, lon: 4.6455 },
            { house_number: "113", newspaper: "TEL", lat: 52.3880, lon: 4.6460 }
        ]}
    ]
};

let map;
let markers = [];
let completedDeliveries = new Set();

// Initialize map
function initMap() {
    map = L.map('map').setView([52.3874, 4.6462], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Create markers for all deliveries
    createMarkers();
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
    // Clear existing markers
    markers.forEach(({ marker }) => map.removeLayer(marker));
    markers = [];
    
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
            }
        });
    });
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
    map.setView([52.3874, 4.6462], 14);
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

// Initialize
initMap();
generateSidebar();
loadProgress();