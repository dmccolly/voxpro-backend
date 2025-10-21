/* public/voxpro-overlay-parent.js
   VoxPro parent overlay with MOVABLE + RESIZABLE window and IMAGE ZOOM.
   - Images: fit/zoom/pan, double-click toggles fit↔100%, wheel zoom (+/- with Ctrl/Cmd)
   - Audio: plays with controls
   - Video: plays with controls
   Keeps prior message protocol: { type:'VOXPRO_OPEN', payload:{ url, title } }
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
      .vp-window{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:90vw;height:90vh;max-width:1600px;max-height:90vh;background:#1a2332;border-radius:12px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.55)}
      .vp-header{cursor:move;user-select:none;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0b1220;border-radius:12px 12px 0 0;border-bottom:1px solid #2a3441}
      .vp-title{color:#fff;font-weight:600}
      .vp-close{background:#667eea;color:#fff;border:0;border-radius:6px;cursor:pointer;width:32px;height:32px;font-size:18px;font-weight:700}
      .vp-body{flex:1;min-height:0;padding:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .vp-toolbar{display:flex;gap:8px;padding:8px 12px;background:#0b1220;color:#b0bec5;border-top:1px solid #2a3441;border-radius:0 0 12px 12px}
      .vp-btn{background:#2a3441;color:#b0bec5;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
      .vp-btn:hover{background:#3a4553}
      .vp-img-wrap{position:relative;width:100%;height:100%;overflow:auto;cursor:grab}
      .vp-img-wrap.grabbing{cursor:grabbing}
      .vp-img{transform-origin:0 0;image-rendering:auto;max-width:unset;max-height:unset}
      .vp-resize{position:absolute;right:10px;bottom:10px;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg, transparent 50%, #667eea 50%),linear-gradient(225deg, transparent 50%, #667eea 50%);background-size:100% 50%,50% 100%;background-position:0 100%,100% 0;background-repeat:no-repeat;opacity:.75}
      .vp-body > img, .vp-body > video, .vp-body > audio{max-width:100%;max-height:100%}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------- Helpers ----------
  function removeOverlay() {
    const ex = document.getElementById('voxpro-overlay');
    if (ex) ex.remove();
  }

  function getExt(u) {
    try {
      const url = new URL(u, location.href);
      const m = url.pathname.match(/\.([A-Za-z0-9]+)$/);
      return (m && m[1] || '').toLowerCase();
    } catch {
      const m = (u || '').match(/\.([A-Za-z0-9]+)(?:\?|#|$)/);
      return (m && m[1] || '').toLowerCase();
    }
  }

  // ---------- Build the overlay shell ----------
  function buildOverlay(titleText) {
    removeOverlay(); injectCss();

    const ov = document.createElement('div');
    ov.id = 'voxpro-overlay'; ov.className = 'vp-overlay';

    const win = document.createElement('div');
    win.className = 'vp-window';

    // Dragging
    let dragging = false, dx = 0, dy = 0, startX = 0, startY = 0;
    function onMouseMove(e){
      if(!dragging) return;
      const rect = win.getBoundingClientRect();
      const newLeft = rect.left + (e.clientX - startX);
      const newTop  = rect.top  + (e.clientY - startY);
      startX = e.clientX; startY = e.clientY;
      win.style.left = Math.max(12, Math.min(window.innerWidth - rect.width - 12, newLeft)) + 'px';
      win.style.top  = Math.max(12, Math.min(window.innerHeight - rect.height - 12, newTop)) + 'px';
      win.style.transform = 'translate(0,0)'; // cancel center transform on drag
    }
    function onMouseUp(){ dragging=false; document.removeEventListener('mousemove',onMouseMove); document.removeEventListener('mouseup',onMouseUp); }

    const hd = document.createElement('div');
    hd.className = 'vp-header';
    const tt = document.createElement('div');
    tt.className = 'vp-title'; tt.textContent = titleText || 'VoxPro Player';
    const cl = document.createElement('button');
    cl.className = 'vp-close'; cl.textContent = '×'; cl.onclick = removeOverlay;

    hd.onmousedown = (e)=>{ dragging=true; startX=e.clientX; startY=e.clientY; document.addEventListener('mousemove',onMouseMove); document.addEventListener('mouseup',onMouseUp); };

    const body = document.createElement('div'); body.className = 'vp-body';

    const tb = document.createElement('div'); tb.className = 'vp-toolbar';
    const fitBtn  = document.createElement('button'); fitBtn.className='vp-btn'; fitBtn.textContent='Fit';
    const zoom1Btn= document.createElement('button'); zoom1Btn.className='vp-btn'; zoom1Btn.textContent='100%';
    const plusBtn = document.createElement('button'); plusBtn.className='vp-btn'; plusBtn.textContent='+';
    const minusBtn= document.createElement('button'); minusBtn.className='vp-btn'; minusBtn.textContent='–';

    tb.appendChild(fitBtn); tb.appendChild(zoom1Btn); tb.appendChild(plusBtn); tb.appendChild(minusBtn);

    const grip = document.createElement('div'); grip.className='vp-resize';
    let resizing=false, rsX=0, rsY=0, rsW=0, rsH=0;
    function onResizeMove(e){
      if(!resizing) return;
      const dx = e.clientX - rsX, dy = e.clientY - rsY;
      win.style.width  = Math.min(window.innerWidth-24,  Math.max(420, rsW + dx)) + 'px';
      win.style.height = Math.min(window.innerHeight-24, Math.max(300, rsH + dy)) + 'px';
    }
    function onResizeUp(){ resizing=false; document.removeEventListener('mousemove',onResizeMove); document.removeEventListener('mouseup',onResizeUp); }
    grip.onmousedown = (e)=>{ e.stopPropagation(); const r=win.getBoundingClientRect(); resizing=true; rsX=e.clientX; rsY=e.clientY; rsW=r.width; rsH=r.height; document.addEventListener('mousemove',onResizeMove); document.addEventListener('mouseup',onResizeUp); };

    hd.appendChild(tt); hd.appendChild(cl);
    win.appendChild(hd);
    win.appendChild(body);
    win.appendChild(tb);
    win.appendChild(grip);
    ov.appendChild(win);
    (document.body || document.documentElement).appendChild(ov);

    // ESC closes overlay
    function esc(e){ if(e.key==='Escape') removeOverlay(); }
    document.addEventListener('keydown', esc, { once:true });

    return { body, controls:{fitBtn, zoom1Btn, plusBtn, minusBtn}, imageApi:null, windowEl: win };
  }

  // ---------- Image zoom/pan ----------
  function mountZoomableImage(container, url, controls) {
    const wrap = document.createElement('div'); wrap.className='vp-img-wrap';
    const img  = document.createElement('img'); img.className='vp-img'; img.src=url;

    // Fit to container by default
    let scale = 1, fitMode = true, originX=0, originY=0, dragging=false, lastX=0, lastY=0;

    function apply() {
      if (fitMode) {
        // compute fit scale
        const cw = container.clientWidth, ch = container.clientHeight;
        // natural size might not be loaded yet—fallback to 1000x1000 notionally
        const iw = img.naturalWidth || 1000, ih = img.naturalHeight || 1000;
        scale = Math.min(cw/iw, ch/ih) || 1;
        originX = 0; originY = 0;
      }
      img.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    }

    img.addEventListener('load', apply);
    wrap.addEventListener('dblclick', ()=>{ fitMode = !fitMode; if(!fitMode) scale=1; apply(); });

    wrap.addEventListener('mousedown', (e)=>{ if (fitMode) return; dragging=true; wrap.classList.add('grabbing'); lastX=e.clientX; lastY=e.clientY; });
    window.addEventListener('mouseup', ()=>{ dragging=false; wrap.classList.remove('grabbing'); });
    window.addEventListener('mousemove', (e)=>{ if(!dragging) return; originX += e.clientX-lastX; originY += e.clientY-lastY; lastX=e.clientX; lastY=e.clientY; apply(); });

    // Wheel zoom (Ctrl/Cmd + wheel)
    wrap.addEventListener('wheel', (e)=>{ if(!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const d = e.deltaY>0 ? 0.9 : 1.1; fitMode=false; scale = Math.max(0.1, Math.min(8, scale*d)); apply(); }, { passive:false });

    // Toolbar hooks
    controls.fitBtn.onclick   = ()=>{ fitMode=true; apply(); };
    controls.zoom1Btn.onclick = ()=>{ fitMode=false; scale=1; originX=0; originY=0; apply(); };
    controls.plusBtn.onclick  = ()=>{ fitMode=false; scale=Math.min(8, scale*1.1); apply(); };
    controls.minusBtn.onclick = ()=>{ fitMode=false; scale=Math.max(0.1, scale/1.1); apply(); };

    wrap.appendChild(img);
    container.appendChild(wrap);

    return { apply };
  }

  // ---------- Renderers ----------
  function renderAudio(container, url) {
    const a = document.createElement('audio');
    a.controls = true; a.autoplay = true; a.src = url; a.style.maxWidth='100%';
    container.appendChild(a); a.play().catch(()=>{});
  }

  function renderVideo(container, url) {
    const v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.src = url; v.style.width='100%'; v.style.maxHeight='100%';
    container.appendChild(v); v.play().catch(()=>{});
  }

  function renderImage(container, url, controls) {
    return mountZoomableImage(container, url, controls);
  }

  // Unknown extension fallback
  function getExt(url){ try{ const u=new URL(url,location.href), m=u.pathname.match(/\.([A-Za-z0-9]+)$/); return (m&&m[1]||'').toLowerCase(); }catch{ const m=(url||'').match(/\.([A-Za-z0-9]+)(?:\\?|#|$)/); return (m&&m[1]||'').toLowerCase(); } }

  function probeImage(u, timeout=1200) {
    return new Promise(res => {
      const img = new Image(); let done=false; const t=setTimeout(()=>{ if(!done){done=true; img.src=''; res(false);} }, timeout);
      img.onload = ()=>{ if(done) return; clearTimeout(t); done=true; res(true); };
      img.onerror= ()=>{ if(done) return; clearTimeout(t); done=true; res(false); };
      img.src = u;
    });
  }
  function probe(tag,u,timeout=1500){ return new Promise(res=>{ const el=document.createElement(tag); let done=false; const t=setTimeout(()=>{ if(!done){done=true; res(false);} },timeout); const ok=()=>{ if(done) return; clearTimeout(t); done=true; res(true); }; el.onloadedmetadata=ok; el.oncanplay=ok; el.onerror=()=>{ if(done) return; clearTimeout(t); done=true; res(false); }; el.src=u; }); }

  async function renderSmart(container, url, controls) {
    const e = getExt(url);
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(e)) return renderImage(container, url, controls);
    if (['mp3','wav','ogg','m4a','aac','flac'].includes(e))       return renderAudio(container, url);
    if (['mp4','webm','mov','mkv','avi'].includes(e))             return renderVideo(container, url);

    // Unknown → probe
    try {
      if (await probeImage(url))            return renderImage(container, url, controls);
      if (await probe('audio', url))        return renderAudio(container, url);
      if (await probe('video', url))        return renderVideo(container, url);
    } catch(_) {}

    // Fallback link
    const p = document.createElement('div'); p.style.cssText='color:#fff;margin-bottom:10px'; p.textContent='Preview not available. Open file:';
    const a = document.createElement('a'); a.href=url; a.target='_blank'; a.textContent=url; a.style.color='#8fb3ff';
    container.appendChild(p); container.appendChild(a);
  }

  // ---------- Message handling ----------
  window.addEventListener('message', async (ev) => {
    const d = ev && ev.data; if (!d) return;

    if (d.type === 'VOXPRO_OPEN' && d.payload) {
      const { url, title } = d.payload;
      const { body, controls } = (function(){
        const built = buildOverlay(title);
        // Return controls for image zoom
        return { body: built.body, controls: (function(){
          const toolbar = document.querySelector('.vp-toolbar'); // old versions
          // create a tiny toolbar only if image uses it (lazy bound inside mountZoomableImage)
          return {
            fitBtn:   document.createElement('button'),
            zoom1Btn: document.createElement('button'),
            plusBtn:  document.createElement('button'),
            minusBtn: document.createElement('button')
          };
        })()};
      })();

      // Build a visible toolbar for image zoom/pan
      const windowEl = document.querySelector('.vp-window');
      let tb = document.createElement('div'); tb.className='vp-toolbar';
      const fitBtn  = document.createElement('button'); fitBtn.className='vp-btn'; fitBtn.textContent='Fit';
      const zoom1   = document.createElement('button'); zoom1.className='vp-btn'; zoom1.textContent='100%';
      const plus    = document.createElement('button'); plus.className='vp-btn'; plus.textContent='+';
      const minus   = document.createElement('button'); minus.className='vp-btn'; minus.textContent='–';
      tb.appendChild(fitBtn); tb.appendChild(zoom1); tb.appendChild(plus); tb.appendChild(minus);
      windowEl.appendChild(tb);

      // Pass actual controls to image mount
      const controls = { fitBtn:fitBtn, zoom1Btn:zoom1, plusBtn:plus, minusBtn:minus };

      await renderSmart(body, url, controls);
    }

    if (d.type === 'VOXPRO_CLOSE') removeOverlay();
  });
})();
