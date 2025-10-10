/* Control Functions */

// Center map to show all markers
function centerMap() {
    if (markers.length > 0) {
        const bounds = markers.map(({ marker }) => marker.getLatLng());
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        map.setView([52.3874, 4.6462], 14);
    }
}

// Reset all progress
async function resetProgress() {
    if (confirm('Weet je zeker dat je alle voortgang wilt resetten?')) {
        completedDeliveries.clear();
        document.querySelectorAll('.delivery-item').forEach(item => {
            item.classList.remove('completed');
        });
        updateStats();
        updateMarkers();
        
        // Clear all progress from IndexedDB
        if (db) {
            const transaction = db.transaction(['progress'], 'readwrite');
            const store = transaction.objectStore('progress');
            store.clear();
        }
    }
}

// Refresh all route data
async function refreshRouteData() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '🔄 Laden...';
    btn.disabled = true;
    
    try {
        console.log('Refreshing all app resources (CSS, JS, Service Worker, Route Data)...');
        
        // Force reload with cache bypass - this will get fresh versions of everything
        window.location.reload(true);
        
    } catch (error) {
        console.error('Failed to refresh:', error);
        alert('Fout bij het verversen van de applicatie.');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}