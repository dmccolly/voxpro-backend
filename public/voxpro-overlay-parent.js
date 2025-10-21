/* public/voxpro-overlay-parent.js
   Parent-page overlay for VoxPro "maximize" that supports:
   - Audio (mp3, wav, ogg, m4a, aac, flac) with an animated equalizer
   - Video (mp4, webm, mov, mkv, avi)
   - Images (jpg, jpeg, png, gif, webp, bmp, svg)
   - PDFs (simple <iframe> / viewer)
   - DOCX (via Mammoth.js, loaded on demand)

   This script is idempotent and only affects the parent page (the page
   that contains the <iframe> to voxpro-companion.html).
*/

(function () {
  if (window.__vpOverlayInstalled) return;
  window.__vpOverlayInstalled = true;

  // ---------- Utilities ----------
  function css(target, text) {
    const s = (target || document).createElement('style');
    s.textContent = text;
    (target.head || target.documentElement).appendChild(s);
  }

  function ext(url) {
    try {
      const u = new URL(url, location.href);
      const m = u.pathname.match(/\.([A-Za-z0-9]+)$/);
      return (m && m[1] || '').toLowerCase();
    } catch {
      const m = (url || '').match(/\.([A-Za-z0-9]+)(?:\?|#|$)/);
      return (m && m[1] || '').toLowerCase();
    }
  }

  function removeOverlay() {
    const ex = document.getElementById('voxpro-overlay');
    if (ex) ex.remove();
  }

  // ---------- Overlay Shell ----------
  function buildOverlay(titleText) {
    removeOverlay();

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
    cl.onclick = () => removeOverlay();

    const bd = document.createElement('div');
    bd.className = 'vp-body';

    hd.appendChild(tt);
    hd.appendChild(cl);
    win.appendChild(hd);
    win.appendChild(bd);
    ov.appendChild(win);
    (document.body || document.documentElement).appendChild(ov);

    return { overlay: ov, body: bd };
  }

  // ---------- Renderers ----------
  function renderAudio(container, url) {
    // Equalizer placeholder (CSS animation)
    const holder = document.createElement('div');
    holder.className = 'vp-eq';
    holder.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
    container.appendChild(holder);

    const a = document.createElement('audio');
    a.controls = true;
    a.autoplay = true;
    a.src = url;
    a.style.maxWidth = '100%';
    a.style.marginTop = '16px';
    container.appendChild(a);

    a.play().catch(() => { /* user gesture might be required */ });
  }

  function renderVideo(container, url) {
    const v = document.createElement('video');
    v.controls = true;
    v.autoplay = true;
    v.src = url;
    v.style.width = '100%';
    v.style.maxHeight = '100%';
    container.appendChild(v);
    v.play().catch(() => { /* user gesture might be required */ });
  }

  function renderImage(container, url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Document preview';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    container.appendChild(img);
  }

  function renderPDF(container, url) {
    // simplest cross-browser: iframe to the PDF; many hosts allow this
    const fr = document.createElement('iframe');
    fr.src = url + (url.includes('#') ? '' : '#toolbar=0&navpanes=0');
    fr.style.width = '100%';
    fr.style.height = '100%';
    fr.style.border = '0';
    container.appendChild(fr);
  }

  async function renderDOCX(container, url) {
    // Load Mammoth on demand
    if (!window.mammoth) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // Fetch the file as ArrayBuffer and convert to HTML
    let buf;
    try {
      const resp = await fetch(url, { mode: 'cors' });
      buf = await resp.arrayBuffer();
    } catch (e) {
      // fallback: provide a link
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.textContent = 'Open DOCX';
      a.style.color = '#fff';
      container.appendChild(a);
      return;
    }

    try {
      const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      const scroller = document.createElement('div');
      scroller.style.cssText = 'width:100%;height:100%;overflow:auto;background:#fff;color:#000;padding:18px;border-radius:6px';
      scroller.innerHTML = res.value || '<em>Empty document</em>';
      container.appendChild(scroller);
    } catch (e) {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.textContent = 'Open DOCX';
      a.style.color = '#fff';
      container.appendChild(a);
    }
  }

  async function renderByType(container, url) {
    const e = ext(url);

    if (['mp3','wav','ogg','m4a','aac','flac'].includes(e)) {
      renderAudio(container, url);
    } else if (['mp4','webm','mov','mkv','avi'].includes(e)) {
      renderVideo(container, url);
    } else if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(e)) {
      renderImage(container, url);
    } else if (e === 'pdf') {
      renderPDF(container, url);
    } else if (e === 'docx' || e === 'doc') {
      await renderDOCX(container, url);
    } else {
      // Unknown: provide a link
      const p = document.createElement('div');
      p.style.cssText = 'color:#fff;margin-bottom:10px';
      p.textContent = 'Preview not available. Open file:';
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.textContent = url;
      a.style.color = '#8fb3ff';
      container.appendChild(p);
      container.appendChild(a);
    }
  }

  // ---------- Listen for companion messages ----------
  window.addEventListener('message', async (ev) => {
    const d = ev && ev.data;
    if (!d) return;

    if (d.type === 'VOXPRO_OPEN' && d.payload) {
      const { url, title } = d.payload;

      // Build overlay
      const { body } = buildOverlay(title);

      // Add CSS once
      if (!window.__vpOverlayCss) {
        window.__vpOverlayCss = true;
        css(document,
          `.vp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:2147483647;display:flex;align-items:center;justify-content:center}
           .vp-window{width:90vw;height:90vh;max-width:1200px;max-height:800px;background:#1a2332;border-radius:8px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.5)}
           .vp-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0b1220;border-radius:8px 8px 0 0;border-bottom:1px solid #2a3441}
           .vp-title{color:#fff;font-weight:600}
           .vp-close{background:#667eea;color:#fff;border:0;border-radius:4px;cursor:pointer;width:32px;height:32px;font-size:18px;font-weight:700}
           .vp-body{flex:1;padding:20px;display:flex;align-items:center;justify-content:center;overflow:auto}
           /* Equalizer */
           .vp-eq{display:flex;gap:6px;align-items:flex-end;height:36px}
           .vp-eq span{display:block;width:6px;background:#8fb3ff;animation:vpEQ 1s ease-in-out infinite}
           .vp-eq span:nth-child(2){animation-delay:.1s}
           .vp-eq span:nth-child(3){animation-delay:.2s}
           .vp-eq span:nth-child(4){animation-delay:.3s}
           .vp-eq span:nth-child(5){animation-delay:.4s}
           @keyframes vpEQ{0%,100%{height:8px;opacity:.6}50%{height:28px;opacity:1}}`
        );
      }

      // Render by type
      await renderByType(body, url);
    }

    if (d.type === 'VOXPRO_CLOSE') {
      removeOverlay();
    }
  });
})();
