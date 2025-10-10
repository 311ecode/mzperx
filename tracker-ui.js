/* UI Operations and Menu Management */

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

// Update statistics
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