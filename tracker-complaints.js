/* Complaints Panel */

function getComplaintBadgeStyle(type) {
    if (type === 'NIET KRANT')   return 'background:#e74c3c;color:white;';
    if (type === 'NIET BIJLAGE') return 'background:#e67e22;color:white;';
    if (type.startsWith('VERKEERD')) return 'background:#8e44ad;color:white;';
    return 'background:#7f8c8d;color:white;';
}

function renderComplaints() {
    if (!routeData || !routeData.complaints || routeData.complaints.length === 0) return;

    const sidebar = document.getElementById('sidebar');
    const complaints = routeData.complaints;

    const header = document.createElement('div');
    header.className = 'street-section';
    header.innerHTML = `
        <div class="street-header complaints-header" onclick="toggleComplaintsPanel()" style="background:#2c3e50;color:white;cursor:pointer;">
            <span>⚠️ Klachten (${complaints.length})</span>
            <span id="complaints-chevron">▼</span>
        </div>
        <div id="complaints-panel">
            ${complaints.map((c, i) => `
                <div class="delivery-item complaint-row" onclick="toggleComplaintDetail(${i})" style="flex-direction:column;align-items:flex-start;gap:4px;">
                    <div style="display:flex;align-items:center;gap:8px;width:100%;">
                        <span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;${getComplaintBadgeStyle(c.type)}">${c.type}</span>
                        <span class="house-number" style="flex:1;">${c.address}</span>
                        <span style="width:22px;height:22px;border-radius:50%;background:#f39c12;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">!</span>
                    </div>
                    <div id="complaint-detail-${i}" style="display:none;width:100%;padding:6px 4px 2px 4px;border-top:1px solid #eee;margin-top:2px;">
                        <div style="font-size:12px;color:#555;line-height:1.7;">
                            <div><strong>Product:</strong> ${c.product}</div>
                            <div><strong>Abonnement:</strong> ${c.subscription_type}</div>
                            <div><strong>Datum:</strong> ${c.date}</div>
                            ${c.name ? `<div><strong>Naam:</strong> ${c.name}</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    sidebar.prepend(header);
}

function toggleComplaintsPanel() {
    const panel   = document.getElementById('complaints-panel');
    const chevron = document.getElementById('complaints-chevron');
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display  = isHidden ? 'block' : 'none';
    chevron.textContent  = isHidden ? '▼' : '▶';
}

function toggleComplaintDetail(index) {
    const detail = document.getElementById(`complaint-detail-${index}`);
    if (!detail) return;
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
}
