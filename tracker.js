// Sample route data
const routeData = {
    metadata: {
        distribution_date: "2025-10-08",
        route_code: "10024207",
        area: "HAARLEM NOORD"
    },
    delivery_route: [
        { street: "VONDELWEG", city: "HAARLEM", deliveries: [
            { house_number: "252", newspaper: "HD", name: "ZWAR" },
            { house_number: "284", newspaper: "VK", name: "RD" }
        ]},
        { street: "NACHTEGAALSTRAAT", city: "HAARLEM", deliveries: [
            { house_number: "73", newspaper: "HD" },
            { house_number: "95", newspaper: "HD" },
            { house_number: "113", newspaper: "TEL" }
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
    }
}

// Initialize
initMap();
generateSidebar();
loadProgress();