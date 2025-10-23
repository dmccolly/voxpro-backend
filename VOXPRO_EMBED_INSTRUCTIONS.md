# VoxPro Companion Player - Embedding Instructions

## Overview

The VoxPro Companion Player can be embedded in any website using an iframe. To enable the **pop-out window feature** (maximize button), the parent page must include a special handler script.

## Quick Start

### 1. Embed the VoxPro Companion Player

Add this iframe code to your page (e.g., in Webflow):

```html
<iframe
  src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-companion.html"
  width="400"
  height="920"
  frameborder="0"
  style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
</iframe>
```

### 2. Include the Parent Handler Script

**IMPORTANT:** Add this script tag to your page **BEFORE** the closing `</body>` tag:

```html
<script src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-parent-handler.js"></script>
```

## How It Works

### Without the Parent Handler Script

- ❌ The maximize button will not work properly
- ❌ Media will appear to "break" when you click maximize
- ❌ No popup window will open

### With the Parent Handler Script

- ✅ The maximize button opens a resizable popup window
- ✅ Media continues playing from the same position
- ✅ The popup window can be resized and moved
- ✅ Closing the popup returns to the inline player

## Webflow-Specific Instructions

### Option 1: Add to Custom Code (Recommended)

1. In Webflow, go to **Project Settings** → **Custom Code**
2. In the **Footer Code** section, add:

```html
<script src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-parent-handler.js"></script>
```

3. Click **Save Changes**
4. Publish your site

### Option 2: Add to Page Settings

1. Open the page where you embedded the VoxPro player
2. Click the **Settings** icon (gear) in the top toolbar
3. Go to the **Custom Code** tab
4. In the **Before </body> tag** section, add:

```html
<script src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-parent-handler.js"></script>
```

5. Click **Save**
6. Publish your page

### Option 3: Embed Widget

1. Drag an **Embed** element onto your page
2. Paste this code:

```html
<iframe
  src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-companion.html"
  width="400"
  height="920"
  frameborder="0"
  style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
</iframe>

<script src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-parent-handler.js"></script>
```

3. Click **Save & Close**
4. Publish your page

## Testing the Feature

After adding the script, test the maximize feature:

1. Open your page with the embedded VoxPro player
2. Click any key (1-5) to play media
3. Click the **maximize button** (□) in the player header
4. A resizable popup window should open with the media
5. The media should continue from the same position
6. Close the popup to return to the inline player

## Troubleshooting

### Popup is blocked by browser

**Solution:** Allow popups for your site in your browser settings.

- **Chrome:** Click the popup blocked icon in the address bar → "Always allow pop-ups from [your-site]"
- **Firefox:** Click the popup blocked icon → "Allow pop-ups for [your-site]"
- **Safari:** Safari → Preferences → Websites → Pop-up Windows → Allow for your site

### Maximize button still doesn't work

**Check these items:**

1. ✅ The parent handler script is included on the page
2. ✅ The script is loaded **after** the iframe (or in the footer)
3. ✅ Your browser allows popups for the site
4. ✅ You've published the changes in Webflow
5. ✅ You've cleared your browser cache (Ctrl+Shift+R or Cmd+Shift+R)

### Console errors

Open your browser's Developer Tools (F12) and check the Console tab for errors. Common issues:

- **"Pop-up blocked"** → Enable popups for your site
- **"VoxPro parent handler already installed"** → Script is loaded multiple times (this is OK, it won't break anything)
- **No errors but maximize doesn't work** → Make sure the script is loaded on the same page as the iframe

## Technical Details

### How the Communication Works

1. User clicks the maximize button in the iframe
2. The iframe sends a `postMessage` to the parent window with type `VOXPRO_OPEN`
3. The parent handler script receives the message
4. The script opens a popup window with the media
5. When the popup closes, it sends a `VOXPRO_CLOSE` message back
6. The parent handler notifies the iframe to reset

### Security Considerations

- The script uses `postMessage` for secure cross-origin communication
- Popups are opened with `window.open()` which requires user interaction
- No sensitive data is transmitted between windows
- The script only responds to VoxPro-specific message types

## Support

If you continue to have issues after following these instructions, please contact support with:

1. The URL of your page with the embedded player
2. Screenshots of any console errors
3. Your browser name and version
4. Whether popups are enabled for your site
