# Bezorglijst Tracker - PWA Version

A Progressive Web App for tracking newspaper delivery routes with offline support.

## Features

- ✅ **Offline Support**: Works completely offline after first visit
- 💾 **Persistent Storage**: Uses IndexedDB to preserve checked deliveries
- 📍 **Interactive Map**: Visual route tracking with Leaflet
- 📱 **Installable**: Can be installed as a standalone app on mobile and desktop
- 🔄 **Auto-sync**: Syncs data when coming back online

## Setup Instructions

### 1. Create App Icons

You need to create two icon files for the PWA:

#### Option A: Using an online tool (easiest)
1. Visit https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 image (can be your logo or a newspaper icon)
3. Download the generated icons
4. Save as `icon-192.png` and `icon-512.png` in the project root

#### Option B: Using ImageMagick (command line)
```bash
# Create a simple icon with ImageMagick
convert -size 512x512 xc:white \
  -gravity center \
  -pointsize 200 \
  -font Arial-Bold \
  -fill "#2c3e50" \
  -annotate +0+0 "📰" \
  icon-512.png

# Create 192x192 version
convert icon-512.png -resize 192x192 icon-192.png
```

#### Option C: Manual creation
Create two PNG files:
- `icon-192.png` - 192x192 pixels
- `icon-512.png` - 512x512 pixels

Use any image editor. Recommended: Simple newspaper icon or your company logo with a newspaper theme.

### 2. File Structure

Ensure your project has these files:

```
project/
├── index.html
├── tracker.js
├── styles.css
├── sample.json
├── manifest.json
├── service-worker.js
├── icon-192.png
├── icon-512.png
└── serve-local.sh
```

### 3. Serving the App

The app **must** be served over HTTPS (or localhost for testing) for PWA features to work.

#### For local testing:
```bash
# Make the script executable
chmod +x serve-local.sh

# Start the server
./serve-local.sh
```

Then visit: `http://localhost:8000`

#### For production:
Deploy to any web server with HTTPS enabled (GitHub Pages, Netlify, Vercel, etc.)

### 4. Installing the App

#### On Desktop (Chrome/Edge):
1. Visit the site
2. Look for the install icon in the address bar
3. Click "Install"

#### On Mobile (iOS):
1. Open in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

#### On Mobile (Android):
1. Open in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen"
Or use the install prompt that appears automatically

## Usage

### First Visit (Online)
1. The app loads route data from `sample.json`
2. Addresses are geocoded and cached
3. All data is stored in IndexedDB

### Subsequent Visits (Can be Offline)
1. App loads instantly from cache
2. Route data and progress are loaded from IndexedDB
3. All checked deliveries persist across sessions
4. Map tiles are cached for offline viewing

### Tracking Deliveries
- Click any delivery in the sidebar to mark as completed
- Click markers on the map to toggle completion
- Progress is saved automatically
- Use "Reset" button to clear all progress

## Technical Details

### Storage

- **IndexedDB Stores**:
  - `routes`: Cached route data
  - `progress`: Delivery completion status
  - `geocache`: Address coordinates cache

### Caching Strategy

- **Cache-first** for app shell (HTML, CSS, JS)
- **Network-first with fallback** for route data
- **Cache-only** for geocoded addresses

### Offline Capabilities

✅ View route and map
✅ Mark deliveries as completed
✅ View progress statistics
✅ Browse cached map tiles
❌ Geocode new addresses (requires internet)

## Troubleshooting

### App not installing
- Ensure you're using HTTPS or localhost
- Check that `manifest.json` is accessible
- Verify icon files exist

### Offline mode not working
- Visit the site while online at least once
- Check browser console for Service Worker errors
- Clear cache and reload if needed

### Progress not saving
- Check IndexedDB is enabled in browser
- Ensure browser has storage permission
- Try clearing site data and starting fresh

### Map tiles not loading offline
- Map tiles are cached as you view them
- Pan around the route while online to cache tiles
- Some zoom levels may not be cached

## Browser Support

- ✅ Chrome 45+
- ✅ Firefox 44+
- ✅ Safari 11.1+
- ✅ Edge 17+
- ✅ Opera 32+

## License

Free to use and modify for personal and commercial use.