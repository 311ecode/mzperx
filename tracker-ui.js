/* UI Operations and Menu Management */

function generateSidebar() {
    if (!routeData) return;

    // Build lookup first so every delivery row can be checked
    buildComplaintLookup();

    const sidebar = document.getElementById('sidebar');
    let html = '';

    routeData.delivery_route.forEach((street, streetIndex) => {
        html += `<div class="street-section">
            <div class="street-header">${street.street}</div>`;

        street.deliveries.forEach((delivery, deliveryIndex) => {
            const id           = `${streetIndex}-${deliveryIndex}`;
            const isCompleted  = completedDeliveries.has(id);
            const cKey         = getDeliveryComplaintKey(street.street, delivery.house_number);
            const complaints   = getComplaintsByDeliveryKey(cKey);
            const hasComplaint = complaints.length > 0;

            // Build a small inline summary of what went wrong
            const complaintTags = complaints.map(c =>
                `<span style="
                    font-size:10px;font-weight:600;
                    padding:1px 5px;border-radius:3px;
                    margin-left:4px;vertical-align:middle;
                    ${getComplaintBadgeStyle(c.type)}
                ">${c.type}</span>`
            ).join('');

            html += `
                <div class="delivery-item ${isCompleted ? 'completed' : ''}"
                     data-id="${id}"
                     onclick="toggleDelivery('${id}')"
                     style="${hasComplaint ? 'border-left:3px solid #f39c12;' : ''}">
                    <div class="checkbox">✓</div>
                    <div class="delivery-info">
                        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">
                            <span class="house-number">${delivery.house_number}</span>
                            <span class="newspaper">${delivery.newspaper}</span>
                            ${hasComplaint ? `<span style="
                                display:inline-flex;align-items:center;justify-content:center;
                                width:16px;height:16px;border-radius:50%;
                                background:#f39c12;color:white;
                                font-weight:700;font-size:10px;
                                margin-left:4px;flex-shrink:0;
                            ">!</span>` : ''}
                        </div>
                        ${delivery.name ? `<div class="customer-name">${delivery.name}</div>` : ''}
                        ${hasComplaint ? `<div style="margin-top:3px;">${complaintTags}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    sidebar.innerHTML = html;
    renderComplaints();
    updateStats();
}

function updateStats() {
    if (!routeData) return;

    const total      = routeData.delivery_route.reduce((sum, s) => sum + s.deliveries.length, 0);
    const completed  = completedDeliveries.size;
    const remaining  = total - completed;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    document.getElementById('completedCount').textContent = completed;
    document.getElementById('remainingCount').textContent = remaining;
    document.getElementById('totalCount').textContent     = total;
    document.getElementById('progressFill').style.width   = percentage + '%';
}

function toggleMenu() {
    const menu    = document.getElementById('controlsMenu');
    const overlay = document.getElementById('menuOverlay');
    menu.classList.toggle('show');
    overlay.classList.toggle('show');
}

function closeMenu() {
    const menu    = document.getElementById('controlsMenu');
    const overlay = document.getElementById('menuOverlay');
    menu.classList.remove('show');
    overlay.classList.remove('show');
}

document.addEventListener('click', (event) => {
    const menu      = document.getElementById('controlsMenu');
    const hamburger = document.querySelector('.hamburger-btn');
    if (menu && hamburger && !menu.contains(event.target) && !hamburger.contains(event.target)) {
        closeMenu();
    }
});
