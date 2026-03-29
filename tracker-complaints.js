/* Complaints Panel, Sidebar Flagging, and Map Markers */

let complaintMarkers = [];
let complaintLookup  = new Map();

// "P.C. Hooftstraat 2, HAARLEM" -> "PC HOOFTSTRAAT|2"
// "Vinkenstraat 13, HAARLEM"    -> "VINKENSTRAAT|13"
function normalizeStreetName(raw) {
    return raw
        .toUpperCase()
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseComplaintAddress(address) {
    // Split off city: "Vinkenstraat 13, HAARLEM" -> "Vinkenstraat 13"
    const withoutCity = address.split(',')[0].trim();
    const city        = (address.split(',')[1] || 'HAARLEM').trim().toUpperCase();

    // Split trailing house number from street name
    // Handles: "Vinkenstraat 13", "P.C. Hooftstraat 2", "Vergierdeweg 18"
    const m = withoutCity.match(/^(.+?)\s+(\d+\S*)$/);
    if (!m) return null;

    return {
        street:      normalizeStreetName(m[1]),
        houseNumber: m[2].trim(),
        city,
    };
}

function buildComplaintLookup() {
    complaintLookup = new Map();
    if (!routeData || !routeData.complaints) return;

    routeData.complaints.forEach((c, i) => {
        const parsed = parseComplaintAddress(c.address);
        if (!parsed) return;

        const key = `${parsed.street}|${parsed.houseNumber}`;
        if (!complaintLookup.has(key)) complaintLookup.set(key, []);
        complaintLookup.get(key).push(i);
    });

    console.log('Complaint lookup built:', [...complaintLookup.keys()]);
}

// Called from tracker-ui.js per delivery row
function getDeliveryComplaintKey(street, houseNumber) {
    return `${normalizeStreetName(street)}|${houseNumber.toString().trim()}`;
}

function getComplaintsByDeliveryKey(key) {
    const indices = complaintLookup.get(key) || [];
    return indices.map(i => routeData.complaints[i]);
}

function getComplaintBadgeStyle(type) {
    if (type === 'NIET KRANT')       return 'background:#e74c3c;color:white;';
    if (type === 'NIET BIJLAGE')     return 'background:#e67e22;color:white;';
    if (type.startsWith('VERKEERD')) return 'background:#8e44ad;color:white;';
    return 'background:#7f8c8d;color:white;';
}

function getComplaintMarkerIcon() {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color:#f39c12;
            width:30px;height:30px;
            border-radius:50% 50% 50% 0;
            border:3px solid white;
            transform:rotate(-45deg);
            box-shadow:0 2px 5px rgba(0,0,0,0.3);
        "><div style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%) rotate(45deg);
            color:white;font-weight:700;font-size:16px;
        ">!</div></div>`,
        iconSize:    [30, 30],
        iconAnchor:  [15, 30],
    });
}

async function createComplaintMarkers() {
    if (!routeData || !routeData.complaints) return;

    complaintMarkers.forEach(m => map.removeLayer(m));
    complaintMarkers = [];

    for (const c of routeData.complaints) {
        const parsed = parseComplaintAddress(c.address);
        if (!parsed) continue;

        const coords = await geocodeAddress(parsed.street, parsed.houseNumber, parsed.city);
        if (!coords) continue;

        const marker = L.marker([coords.lat, coords.lon], {
            icon:         getComplaintMarkerIcon(),
            zIndexOffset: 500,
        }).addTo(map);

        marker.bindPopup(`
            <div class="popup-house">⚠️ ${parsed.street} ${parsed.houseNumber}</div>
            <div style="margin-top:8px;font-size:12px;line-height:1.7;">
                <div><span style="padding:1px 6px;border-radius:3px;font-weight:600;${getComplaintBadgeStyle(c.type)}">${c.type}</span></div>
                <div style="margin-top:6px;"><strong>Product:</strong> ${c.product}</div>
                <div><strong>Abonnement:</strong> ${c.subscription_type}</div>
                <div><strong>Datum:</strong> ${c.date}</div>
                ${c.name ? `<div><strong>Naam:</strong> ${c.name}</div>` : ''}
            </div>
        `);

        complaintMarkers.push(marker);
    }
}

function renderComplaints() {
    if (!routeData || !routeData.complaints || routeData.complaints.length === 0) return;

    const sidebar    = document.getElementById('sidebar');
    const complaints = routeData.complaints;

    const header = document.createElement('div');
    header.className = 'street-section';
    header.innerHTML = `
        <div class="street-header complaints-header"
             onclick="toggleComplaintsPanel()"
             style="background:#2c3e50;color:white;cursor:pointer;">
            <span>⚠️ Klachten (${complaints.length})</span>
            <span id="complaints-chevron">▼</span>
        </div>
        <div id="complaints-panel">
            ${complaints.map((c, i) => `
                <div class="delivery-item complaint-row"
                     onclick="toggleComplaintDetail(${i})"
                     style="flex-direction:column;align-items:flex-start;gap:4px;">
                    <div style="display:flex;align-items:center;gap:8px;width:100%;">
                        <span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;${getComplaintBadgeStyle(c.type)}">${c.type}</span>
                        <span class="house-number" style="flex:1;">${c.address}</span>
                        <span style="width:22px;height:22px;border-radius:50%;background:#f39c12;color:white;
                                     display:flex;align-items:center;justify-content:center;
                                     font-weight:700;font-size:13px;flex-shrink:0;">!</span>
                    </div>
                    <div id="complaint-detail-${i}"
                         style="display:none;width:100%;padding:6px 4px 2px 4px;border-top:1px solid #eee;margin-top:2px;">
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
    const isHidden      = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    chevron.textContent = isHidden ? '▼' : '▶';
}

function toggleComplaintDetail(index) {
    const detail = document.getElementById(`complaint-detail-${index}`);
    if (!detail) return;
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
}
