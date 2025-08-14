console.log('[VoxPro] ping.js loaded');
(function(){
  const b = document.createElement('div');
  b.id = 'js-ping-banner';
  b.textContent = '✅ JS is executing (ping.js)';
  b.style.cssText = 'position:fixed;right:12px;bottom:12px;padding:8px 12px;font:600 13px/1.2 system-ui;background:#00ff88;color:#111;border-radius:8px;z-index:999999';
  document.body.appendChild(b);
  setTimeout(()=> b.remove(), 6000);
})();
