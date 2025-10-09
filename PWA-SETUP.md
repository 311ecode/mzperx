# PWA Setup Guide

## Quick Fix for Missing Files

Your app is trying to load files that don't exist yet. Here's how to fix it:

### Option 1: Create Required Files (Recommended)

1. **Create `manifest.json`** in your project root (file provided above)

2. **Generate Icons:**
   - Open `generate-icons.html` in your browser
   - Click "Download 192x192" and save as `icon-192.png`
   - Click "Download 512x512" and save as `icon-512.png`
   - Place both files in your project root

### Option 2: Run Without PWA Features

If you don't need PWA features (offline support, install prompt), you can:

1. **Remove service worker registration** from `tracker.js`:
   - Comment out or remove the entire Service Worker registration block (lines 8-38)

2. **Remove PWA links** from `index.html`:
   - Remove the `<link rel="manifest">` line
   - Remove the icon links

3. **Delete `service-worker.js`**

### Option 3: Minimal Working Setup

Create empty placeholder files to stop the errors:

**manifest.json:**
```json
{
  "name": "Bezorglijst Tracker",
  "short_name": "Bezorglijst",
  "start_url": "./",
  "display": "standalone",
  "icons": []
}
```

Then the app will work without icons (but no install prompt).

## File Structure

Your project should have:
```
your-project/
├── index.html          ✅ (provided)
├── tracker.js          ✅ (provided)
├── styles.css          ✅ (provided)
├── service-worker.js   ✅ (provided - fixed version)
├── sample.json         ✅ (your route data)
├── manifest.json       ⚠️  (create this)
├── icon-192.png        ⚠️  (generate this)
├── icon-512.png        ⚠️  (generate this)
└── generate-icons.html ✅ (helper tool)
```

## Testing

After adding the files:

1. **Clear browser cache**: 
   - Chrome: DevTools → Application → Storage → Clear site data
   
2. **Unregister old service worker**:
   - Chrome: DevTools → Application → Service Workers → Unregister

3. **Refresh the page** (Ctrl+F5 or Cmd+Shift+R)

4. **Check console** - should see no more 404 errors

## Troubleshooting

### "Items not showing on map"

This is likely due to geocoding. Check:
- Open browser console (F12)
- Look for geocoding logs
- Addresses need to be geocoded before showing on map
- First load can take time (1 second per address)

### Service Worker Errors

If you still see service worker errors:
1. Unregister the service worker (DevTools → Application → Service Workers)
2. Clear all site data
3. Hard refresh (Ctrl+F5)

### Icons Not Loading

Icons are optional. The app works without them, you just won't get:
- PWA install prompt
- Custom app icon when installed
- Better offline experience

You can safely ignore icon errors if you don't need PWA features.