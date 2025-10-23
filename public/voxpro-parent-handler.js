/**
 * VoxPro Parent Handler Script
 * 
 * This script should be included in any parent page that embeds the VoxPro Companion Player
 * in an iframe. It listens for messages from the iframe and opens popup windows for maximized
 * media playback.
 * 
 * Usage in Webflow or any parent page:
 * <script src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-parent-handler.js"></script>
 */

(function() {
  'use strict';
  
  if (window.__voxproParentHandler) {
    console.log('VoxPro parent handler already installed');
    return;
  }
  window.__voxproParentHandler = true;
  
  let popupWindow = null;
  
  /**
   * Close the popup window if it's open
   */
  function closePopup() {
    if (popupWindow && !popupWindow.closed) {
      try {
        popupWindow.close();
      } catch (e) {
        console.error('Error closing popup:', e);
      }
    }
    popupWindow = null;
  }
  
  /**
   * Get file extension from URL
   */
  function getExt(url) {
    const match = (url || '').match(/\.([A-Za-z0-9]+)(?:\?|#|$)/);
    return (match && match[1] || '').toLowerCase();
  }
  
  /**
   * Open a popup window with the media player
   */
  function openPopup(url, title, startTime, fileType) {
    closePopup();
    
    popupWindow = window.open('', 'VoxProWindow', 'width=800,height=600,resizable=yes,scrollbars=yes');
    
    if (!popupWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site to use the maximize feature.');
      return;
    }
    
    const ext = getExt(url);
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
    const isVideo = !isImage && !isAudio;
    
    let mediaElement = '';
    if (isImage) {
      mediaElement = '<img id="vpMedia" style="max-width:100%;max-height:100%;object-fit:contain;" />';
    } else if (isAudio) {
      mediaElement = '<audio id="vpMedia" controls autoplay style="width:100%;max-width:600px;"></audio>';
    } else {
      mediaElement = '<video id="vpMedia" controls autoplay style="width:100%;max-width:100%;max-height:100%;"></video>';
    }
    
    popupWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>${title || 'VoxPro Player'}</title>
  <style>
    body {
      margin: 0;
      background: #0b1220;
      color: #fff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: relative;
    }
    #vpHeader {
      padding: 10px 16px;
      background: #0b1220;
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #2a3441;
    }
    #vpTitle {
      font-weight: 600;
      font-size: 1rem;
    }
    #vpResizeHint {
      font-size: 0.75rem;
      color: #b0bec5;
      margin-left: 12px;
      font-weight: 400;
    }
    #vpClose {
      background: #667eea;
      color: #fff;
      border: 0;
      border-radius: 4px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      font-size: 18px;
      font-weight: 700;
    }
    #vpClose:hover {
      background: #764ba2;
    }
    #vpContent {
      flex: 1;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      position: relative;
    }
    #vpResizeHandle {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 40px;
      height: 40px;
      cursor: nwse-resize;
      pointer-events: none;
      z-index: 1000;
    }
    #vpResizeHandle::before {
      content: '';
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border-right: 3px solid #667eea;
      border-bottom: 3px solid #667eea;
      opacity: 0.6;
    }
    #vpResizeHandle::after {
      content: '';
      position: absolute;
      bottom: 10px;
      right: 10px;
      width: 10px;
      height: 10px;
      border-right: 2px solid #667eea;
      border-bottom: 2px solid #667eea;
      opacity: 0.4;
    }
  </style>
</head>
<body>
  <div id="vpHeader">
    <div style="display:flex;align-items:center;flex:1">
      <span id="vpTitle">${title || 'VoxPro Player'}</span>
      <span id="vpResizeHint">⇲ Drag corner to resize</span>
    </div>
    <button id="vpClose">×</button>
  </div>
  <div id="vpContent">${mediaElement}</div>
  <div id="vpResizeHandle"></div>
  <script>
    const url = '${url}';
    const startTime = ${startTime || 0};
    const media = document.getElementById('vpMedia');
    
    if (media) {
      media.src = url;
      if (media.currentTime !== undefined && startTime > 0) {
        media.addEventListener('loadedmetadata', function() {
          media.currentTime = startTime;
        }, { once: true });
      }
    }
    
    document.getElementById('vpClose').onclick = function() {
      window.close();
    };
    
    window.onbeforeunload = function() {
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'VOXPRO_CLOSE' }, '*');
        } catch (e) {
          console.error('Error sending close message:', e);
        }
      }
    };
  <\/script>
</body>
</html>
`);
    popupWindow.document.close();
    
    console.log('VoxPro popup opened:', { url, title, startTime });
  }
  
  /**
   * Listen for messages from the VoxPro Companion iframe
   */
  window.addEventListener('message', function(event) {
    const data = event && event.data;
    if (!data) return;
    
    if (data.type === 'VOXPRO_OPEN' && data.payload) {
      console.log('VoxPro: Opening popup with payload:', data.payload);
      openPopup(
        data.payload.url,
        data.payload.title,
        data.payload.startTime || 0,
        data.payload.fileType || ''
      );
    }
    
    else if (data.type === 'VOXPRO_CLOSE') {
      console.log('VoxPro: Closing popup');
      closePopup();
    }
  });
  
  console.log('VoxPro parent handler installed successfully');
})();
