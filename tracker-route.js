/* Route Data Management */

// Load route data from sample.json
async function loadRouteData() {
    try {
        // Try to load from IndexedDB first (offline support)
        const cachedRoute = await loadFromIndexedDB('routes', 'current');
        
        // Always try to fetch fresh data if online
        if (navigator.onLine) {
            try {
                console.log('Checking for route data updates...');
                const response = await fetch('sample.json', {
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    const freshData = await response.json();
                    const freshDataStr = JSON.stringify(freshData);
                    const cachedDataStr = cachedRoute ? JSON.stringify(cachedRoute.data) : null;
                    
                    // Check if data has changed
                    if (freshDataStr !== cachedDataStr) {
                        console.log('🔄 Route data updated! Loading new data...');
                        routeData = freshData;
                        
                        // Cache the new data
                        await saveToIndexedDB('routes', { 
                            id: 'current', 
                            data: routeData,
                            timestamp: Date.now()
                        });
                        
                        // Show notification to user
                        showUpdateNotification();
                    } else {
                        console.log('✓ Route data is up to date');
                        routeData = freshData;
                    }
                    
                    updateHeaderInfo();
                    initializeApp();
                    return;
                }
            } catch (fetchError) {
                console.warn('Could not fetch fresh data, using cache:', fetchError);
            }
        }
        
        // Use cached data if available
        if (cachedRoute && cachedRoute.data) {
            routeData = cachedRoute.data;
            console.log('Route data loaded from IndexedDB (offline/fallback mode)');
            updateHeaderInfo();
            initializeApp();
            return;
        }
        
        // No cache and offline - this is an error
        throw new Error('No cached data and unable to fetch from network');
        
    } catch (error) {
        console.error('Failed to load route data:', error);
        alert('Fout: Kon route data niet laden. Zorg ervoor dat sample.json beschikbaar is of dat je eerder online bent geweest.');
    }
}

// Show notification when route data is updated
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #27ae60;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideDown 0.3s ease;
    `;
    notification.innerHTML = '🔄 Nieuwe route data geladen!';
    document.body.appendChild(notification);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateX(-50%) translateY(-100px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Update header with route info
function updateHeaderInfo() {
    const routeInfo = document.getElementById('routeInfo');
    if (routeInfo && routeData && routeData.metadata) {
        const date = new Date(routeData.metadata.distribution_date);
        const dateStr = date.toLocaleDateString('nl-NL', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        routeInfo.textContent = `Route ${routeData.metadata.element_number} • ${dateStr}`;
    }
}