// Add this to the end of voxpro-manager.js or include as a separate file

// Create a debug UI element
function createDebugPanel() {
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debugPanel';
  debugPanel.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    max-width: 400px;
    max-height: 300px;
    overflow: auto;
    display: none;
  `;
  
  const debugTitle = document.createElement('div');
  debugTitle.textContent = 'Debug Panel';
  debugTitle.style.cssText = `
    font-weight: bold;
    margin-bottom: 5px;
    padding-bottom: 5px;
    border-bottom: 1px solid #444;
    display: flex;
    justify-content: space-between;
  `;
  
  const closeButton = document.createElement('span');
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    cursor: pointer;
    color: #ff5555;
  `;
  closeButton.onclick = () => {
    debugPanel.style.display = 'none';
  };
  
  const debugContent = document.createElement('div');
  debugContent.id = 'debugContent';
  
  const debugControls = document.createElement('div');
  debugControls.style.cssText = `
    margin-top: 10px;
    padding-top: 5px;
    border-top: 1px solid #444;
  `;
  
  const clearButton = document.createElement('button');
  clearButton.textContent = 'Clear';
  clearButton.style.cssText = `
    background: #333;
    color: white;
    border: none;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    margin-right: 5px;
  `;
  clearButton.onclick = () => {
    debugContent.innerHTML = '';
  };
  
  const testModalButton = document.createElement('button');
  testModalButton.textContent = 'Test Modal';
  testModalButton.style.cssText = `
    background: #335599;
    color: white;
    border: none;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    margin-right: 5px;
  `;
  testModalButton.onclick = () => {
    window.voxProDebug.testModal();
  };
  
  const pingXanoButton = document.createElement('button');
  pingXanoButton.textContent = 'Ping Xano';
  pingXanoButton.style.cssText = `
    background: #553399;
    color: white;
    border: none;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
  `;
  pingXanoButton.onclick = () => {
    window.voxProDebug.testConnection().then(result => {
      addDebugMessage('Ping result: ' + JSON.stringify(result));
    });
  };
  
  debugTitle.appendChild(closeButton);
  debugPanel.appendChild(debugTitle);
  debugPanel.appendChild(debugContent);
  debugControls.appendChild(clearButton);
  debugControls.appendChild(testModalButton);
  debugControls.appendChild(pingXanoButton);
  debugPanel.appendChild(debugControls);
  
  document.body.appendChild(debugPanel);
  
  return {
    panel: debugPanel,
    content: debugContent
  };
}

// Function to add message to debug panel
function addDebugMessage(message) {
  if (!window.debugPanelInitialized) {
    const elements = createDebugPanel();
    window.debugPanel = elements.panel;
    window.debugContent = elements.content;
    window.debugPanelInitialized = true;
  }
  
  const msgElement = document.createElement('div');
  msgElement.style.cssText = `
    margin-bottom: 5px;
    border-bottom: 1px dotted #333;
    padding-bottom: 3px;
    word-break: break-all;
  `;
  
  // Add timestamp
  const time = new Date().toLocaleTimeString();
  const timeSpan = document.createElement('span');
  timeSpan.textContent = `[${time}] `;
  timeSpan.style.color = '#aaaaaa';
  
  msgElement.appendChild(timeSpan);
  
  // Handle objects
  if (typeof message === 'object') {
    try {
      const textNode = document.createTextNode(
        JSON.stringify(message, null, 2)
      );
      msgElement.appendChild(textNode);
    } catch (e) {
      msgElement.appendChild(document.createTextNode('[Object]'));
    }
  } else {
    msgElement.appendChild(document.createTextNode(message));
  }
  
  window.debugContent.appendChild(msgElement);
  window.debugContent.scrollTop = window.debugContent.scrollHeight;
  window.debugPanel.style.display = 'block';
}

// Override console.log to also output to debug panel when in debug mode
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function() {
  originalConsoleLog.apply(console, arguments);
  if (window.debugMode) {
    const args = Array.from(arguments);
    addDebugMessage(args.join(' '));
  }
};

console.error = function() {
  originalConsoleError.apply(console, arguments);
  if (window.debugMode) {
    const args = Array.from(arguments);
    const msgElement = document.createElement('div');
    msgElement.style.color = '#ff5555';
    msgElement.textContent = args.join(' ');
    addDebugMessage(msgElement.outerHTML);
  }
};

console.warn = function() {
  originalConsoleWarn.apply(console, arguments);
  if (window.debugMode) {
    const args = Array.from(arguments);
    const msgElement = document.createElement('div');
    msgElement.style.color = '#ffaa55';
    msgElement.textContent = args.join(' ');
    addDebugMessage(msgElement.outerHTML);
  }
};

// Add keyboard shortcut to toggle debug panel (Ctrl+Shift+D)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    if (!window.debugPanelInitialized) {
      const elements = createDebugPanel();
      window.debugPanel = elements.panel;
      window.debugContent = elements.content;
      window.debugPanelInitialized = true;
    }
    
    window.debugPanel.style.display = 
      window.debugPanel.style.display === 'none' ? 'block' : 'none';
  }
});

// Add a global helper for the debug panel
window.voxProDebug = window.voxProDebug || {};
window.voxProDebug.showDebugPanel = function() {
  if (!window.debugPanelInitialized) {
    const elements = createDebugPanel();
    window.debugPanel = elements.panel;
    window.debugContent = elements.content;
    window.debugPanelInitialized = true;
  }
  window.debugPanel.style.display = 'block';
};

window.voxProDebug.hideDebugPanel = function() {
  if (window.debugPanel) {
    window.debugPanel.style.display = 'none';
  }
};

window.voxProDebug.log = function(message) {
  console.log(message);
};

// Initialize debug mode to true
window.debugMode = true;

// Add to initialization
document.addEventListener('DOMContentLoaded', function() {
  // Add a debug button to the header
  const header = document.querySelector('.header');
  if (header) {
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug';
    debugButton.style.cssText = `
      background: #3498db;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 10px;
    `;
    debugButton.onclick = window.voxProDebug.showDebugPanel;
    
    const status = document.querySelector('.status');
    if (status) {
      status.appendChild(debugButton);
    } else {
      header.appendChild(debugButton);
    }
  }
  
  // Add debug info about the page load
  console.log('Page loaded at ' + new Date().toLocaleTimeString());
  console.log('VoxPro Manager debugging initialized');
});

// Add a function to inspect the Xano API structure
window.voxProDebug.inspectXanoApi = async function() {
  try {
    const endpoints = [
      '/auth/ping',
      '/assignments/get',
      '/media/search?q=test'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`Testing endpoint: ${endpoint}`);
      const response = await fetch(`${XANO_PROXY_BASE}${endpoint}`);
      const data = await response.json();
      console.log(`Response from ${endpoint}:`, data);
    }
  } catch (error) {
    console.error('API inspection error:', error);
  }
};

// Add to debug menu
window.voxProDebug.inspectXanoEndpoints = function() {
  window.voxProDebug.inspectXanoApi();
};
