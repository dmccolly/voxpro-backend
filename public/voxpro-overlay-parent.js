/* public/voxpro-overlay-parent.js
   Parent-page overlay for VoxPro "maximize" with robust type detection:
   - Images (JPG/PNG/GIF/WEBP/BMP/SVG)
   - Audio (MP3/WAV/OGG/M4A/AAC/FLAC) + animated EQ placeholder
   - Video (MP4/WEBM/MOV/MKV/AVI)
   - PDF (iframe viewer)
   - DOCX (via Mammoth.js on-demand)
   Unknown URLs are probed as image first, then audio, then video, else fallback link.
*/

(function () {
  if (window.__vpOverlayInstalled) return;
  window.__vpOverlayInstalled = true;

  // ---------- CSS ----------
  function injectCss() {
    if (window.__vpOverlayCss) return;
    window.__vpOverlayCss = true;
    const s = document.createElement('style');
    s.textContent = `
      .vp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:2147483647;display:flex;align-items:center;justify-content:center}
      .vp-window{width:90vw;height:90vh;max-width:1200px;max-height:800px;background:#1a2332;border-radius:8px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.5)}
      .vp-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0b1220;border-radius:8px 8px 0 0;border-bottom:1px solid #2a3441}
      .vp-title{color:#fff;font-weight:600}
      .vp-close{background:#667eea;color:#fff;border:0;border-radius:4px;cursor:pointer;width:32px;height:32px;font-size:18px;font-weight:700}
      .vp-body{flex:1;padding:20px;display:flex;align-items:center;justify-content:center;overflow:auto}
      .vp-body > img, .vp-body > video, .vp-body > iframe{max-width:100%;max-height:100%}
      .vp-eq{display:flex;gap:6px;align-items:flex-end;height:36px}
      .vp-eq span{display:block;width:6px;background:#8fb3ff;animation:vpEQ 1s ease-in-out infinite}
      .vp-eq span:nth-child(2){animation-delay:.1s}
      .vp-eq span:nth-child(3){animation-delay:.2s}
      .vp-eq span:nth-child(4){animation-delay:.3s}
      .vp-eq span:nth-child(5){animation-delay:.4s}
      @keyframes vpEQ{0%,100%{height:8px;opacity:.6}50%{height:28px;opacity:1}}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------- Helpers ----------
  function removeOverlay() {
    const ex = document.getElementById('voxpro-overlay');
    if (ex) ex.remove();
  }

  function buildOverlay(titleText) {
    removeOverlay();
    injectCss();

    const ov = document.createElement('div');
    ov.id = 'voxpro-overlay';
    ov.className = 'vp-overlay';

    const win = document.createElement('div');
    win.className = 'vp-window';

    const hd = document.createElement('div');
    hd.className = 'vp-header';

    const tt = document.createElement('div');
    tt.className = 'vp-title';
    tt.textContent = titleText || 'VoxPro Player';

    const cl = document.createElement('button');
    cl.className = 'vp-close';
    cl.textContent = '×';
    cl.onclick = removeOverlay;

    const bd = document.createElement('div');
    bd.className = 'vp-body';

    hd.appendChild(tt);
    hd.appendChild(cl);
    win.appendChild(hd);
    win.appendChild(bd);
    ov.appendChild(win);
    (document.body || document.documentElement).appendChild(ov);

    document.addEventListener('keydown', escCloseOnce, { once: true });
    function escCloseOnce(e){ if(e.key==='Escape') removeOverlay(); }

    return { body: bd };
  }

  // Parse extension if present
  function getExt(url) {
    try{
      const u = new URL(url, location.href);
      const m = u.pathname.match(/\.([A-Za-z0-9]+)$/);
      return (m && m[1] || '').toLowerCase();
    }catch{
      const m = (url||'').match(/\.([A-Za-z0-9]+)(?:\?|#|$)/);
      return (m && m[1] || '').toLowerCase();
    }
  }

  // ---------- Renderers ----------
  function renderAudio(container, url) {
    const holder = document.createElement('div');
    holder.className = 'vp-eq';
    holder.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
    container.appendChild(holder);

    const a = document.createElement('audio');
    a.controls = true; a.autoplay = true; a.src = url; a.style.marginTop = '16px'; a.style.maxWidth = '100%';
    container.appendChild(a);
    a.play().catch(()=>{});
  }

  function renderVideo(container, url) {
    const v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.src = url; v.style.width='100%'; v.style.maxHeight='100%';
    container.appendChild(v);
    v.play().catch(()=>{});
  }

  function renderImage(container, url) {
    const img = document.createElement('img');
    img.src = url; img.alt = 'Image'; img.style.objectFit='contain';
    container.appendChild(img);
  }

  function renderPDF(container, url) {
    const fr = document.createElement('iframe');
    fr.src = url + (url.includes('#') ? '' : '#toolbar=0&navpanes=0');
    fr.style.width='100%'; fr.style.height='100%'; fr.style.border='0';
    container.appendChild(fr);
  }

  async function ensureMammoth() {
    if (window.mammoth) return;
    await new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
      s.onload = resolve; s.onerror = reject; (document.head||document.documentElement).appendChild(s);
    });
  }

  async function renderDOCX(container, url) {
    try{
      await ensureMammoth();
      const resp = await fetch(url, { mode:'cors' });
      const buf = await resp.arrayBuffer();
      const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      const box = document.createElement('div');
      box.style.cssText='width:100%;height:100%;overflow:auto;background:#fff;color:#000;padding:18px;border-radius:6px';
      box.innerHTML = res.value || '<em>Empty document</em>';
      container.appendChild(box);
    }catch(e){
      // fallback: open link
      const a = document.createElement('a'); a.href=url; a.target='_blank'; a.textContent='Open DOCX';
      a.style.color='#8fb3ff'; container.appendChild(a);
    }
  }

  // ---------- Probing logic for unknown URLs ----------
  function probeImage(url, timeout=1200) {
    return new Promise(resolve=>{
      const img = new Image();
      let done=false, t=setTimeout(()=>{ if(!done){done=true; img.src=''; resolve(false);} }, timeout);
      img.onload = ()=>{ if(done) return; done=true; clearTimeout(t); resolve(true); };
      img.onerror= ()=>{ if(done) return; done=true; clearTimeout(t); resolve(false); };
      img.src = url;
    });
  }

  function probeAudio(url, timeout=1500) {
    return new Promise(resolve=>{
      const a = document.createElement('audio');
      let done=false, t=setTimeout(()=>{ if(!done){done=true; resolve(false);} }, timeout);
      const ok = ()=>{ if(done) return; done=true; clearTimeout(t); resolve(true); };
      a.onloadedmetadata = ok; a.oncanplay = ok; a.onerror = ()=>{ if(done) return; done=true; clearTimeout(t); resolve(false); };
      a.src = url; // don’t attach to DOM; just probe
    });
  }

  function probeVideo(url, timeout=1500) {
    return new Promise(resolve=>{
      const v = document.createElement('video');
      let done=false, t=setTimeout(()=>{ if(!done){done=true; resolve(false);} }, timeout);
      const ok = ()=>{ if(done) return; done=true; clearTimeout(t); resolve(true); };
      v.onloadedmetadata = ok; v.oncanplay = ok; v.onerror = ()=>{ if(done) return; done=true; clearTimeout(t); resolve(false); };
      v.src = url;
    });
  }

  // ---------- Decide and render ----------
  async function renderSmart(container, url, title) {
    const e = getExt(url);

    // Known mappings via extension first
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(e)) return renderImage(container, url);
    if (['mp3','wav','ogg','m4a','aac','flac'].includes(e))       return renderAudio(container, url);
    if (['mp4','webm','mov','mkv','avi'].includes(e))             return renderVideo(container, url);
    if (e === 'pdf')                                              return renderPDF(container, url);
    if (e === 'docx' || e === 'doc')                              return renderDOCX(container, url);

    // Extension missing/unknown — probe in order that matches your use:
    // 1) image, 2) audio, 3) video
    try {
      if (await probeImage(url)) return renderImage(container, url);
      if (await probeAudio(url)) return renderAudio(container, url);
      if (await probeVideo(url)) return renderVideo(container, url);
    } catch(_) {}

    // Last fallback — link out
    const p = document.createElement('div'); p.style.cssText='color:#fff;margin-bottom:10px'; p.textContent='Preview not available. Open file:';
    const a = document.createElement('a'); a.href=url; a.target='_blank'; a.textContent=url; a.style.color='#8fb3ff';
    container.appendChild(p); container.appendChild(a);
  }

  // ---------- Message handling from the companion iframe ----------
  window.addEventListener('message', async (ev) => {
    const d = ev && ev.data;
    if (!d) return;

    if (d.type === 'VOXPRO_OPEN' && d.payload) {
      const { url, title } = d.payload;
      const { body } = buildOverlay(title);
      await renderSmart(body, url, title);
    }

    if (d.type === 'VOXPRO_CLOSE') {
      removeOverlay();
    }
  });
})();
