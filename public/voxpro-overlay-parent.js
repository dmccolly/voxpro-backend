(function () {
  // Remove any existing overlay
  function removeOverlay() {
    const ex = document.getElementById('voxpro-overlay');
    if (ex) ex.remove();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // Build the big pop-out window
  function buildOverlay(titleText) {
    removeOverlay();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const wrap = document.createElement('div');
    wrap.id = 'voxpro-overlay';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.9);' +
      'z-index:2147483647;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText =
      'width:90vw;height:90vh;max-width:1200px;max-height:800px;' +
      'background:#1a2332;border-radius:12px;padding:16px;display:flex;flex-direction:column;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';

    const ttl = document.createElement('div');
    ttl.textContent = titleText || 'VoxPro Player';
    ttl.style.cssText = 'color:#fff;font-weight:600;font-size:16px;';

    const close = document.createElement('button');
    close.textContent = '×';
    close.style.cssText =
      'background:#667eea;color:#fff;border:0;border-radius:6px;' +
      'width:32px;height:32px;cursor:pointer;font-size:18px;font-weight:700';
    close.onclick = removeOverlay;

    const body = document.createElement('div');
    body.style.cssText =
      'flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;';

    header.appendChild(ttl);
    header.appendChild(close);
    box.appendChild(header);
    box.appendChild(body);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { removeOverlay(); document.removeEventListener('keydown', esc); }
    });

    wrap.addEventListener('click', (e) => { if (e.target === wrap) removeOverlay(); });

    return body;
  }

  // Figure out file type
  function getExt(u) {
    const m = (u || '').match(/\.([A-Za-z0-9]+)(?:\?|#|$)/);
    return (m && m[1] || '').toLowerCase();
  }

  // Renderers
  function renderImage(c, u) {
    const i = document.createElement('img');
    i.src = u; i.alt = 'Image'; i.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
    c.appendChild(i);
  }
  function renderAudio(c, u) {
    const a = document.createElement('audio');
    a.controls = true; a.autoplay = true; a.src = u; a.style.maxWidth = '100%';
    c.appendChild(a); a.play().catch(()=>{});
  }
  function renderVideo(c, u) {
    const v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.src = u; v.style.cssText = 'width:100%;max-height:100%;';
    c.appendChild(v); v.play().catch(()=>{});
  }

  // Display the correct thing
  function renderSmart(c, u) {
    c.innerHTML = '';
    const e = getExt(u);
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(e)) return renderImage(c,u);
    if (['mp3','wav','ogg','m4a','aac','flac'].includes(e))       return renderAudio(c,u);
    if (['mp4','webm','mov','mkv','avi'].includes(e))             return renderVideo(c,u);

    const p = document.createElement('div');
    p.style.color = '#fff';
    p.textContent = 'Preview not available.  Open file:';
    const a = document.createElement('a');
    a.href = u; a.target = '_blank'; a.textContent = u; a.style.color = '#8fb3ff';
    c.appendChild(p); c.appendChild(a);
  }

  // Listen for the maximize message
  window.addEventListener('message', function(ev) {
    const d = ev && ev.data;
    if (!d) return;
    if (d.type === 'VOXPRO_OPEN' && d.payload) {
      const body = buildOverlay(d.payload.title);
      renderSmart(body, d.payload.url);
    }
    if (d.type === 'VOXPRO_CLOSE') removeOverlay();
  });
})();
</script>
