/* Delivery Management and Progress Tracking */

// Toggle delivery completion
async function toggleDelivery(id) {
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
    await saveProgress();
}

// Save progress to IndexedDB
async function saveProgress() {
    const progressArray = Array.from(completedDeliveries);
    for (const id of progressArray) {
        await saveToIndexedDB('progress', { id, completed: true });
    }
    console.log('Progress saved to IndexedDB');
}

// Load progress from IndexedDB
async function loadProgress() {
    try {
        const allProgress = await getAllFromIndexedDB('progress');
        completedDeliveries = new Set(allProgress.map(item => item.id));
        console.log('Loaded progress:', completedDeliveries.size, 'completed deliveries');
    } catch (e) {
        console.error('Failed to load progress:', e);
        completedDeliveries = new Set();
    }
}

// Get delivery by ID
function getDeliveryById(id) {
    if (!routeData) return null;
    
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