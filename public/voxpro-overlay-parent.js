<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>VoxPro Overlay Parent</title>
  <style>
    :root{
      --bg:#0b1220; --panel:#1a2332; --accent:#667eea; --accent2:#2a3441;
      --text:#ffffff; --muted:#b0bec5; --shadow:0 8px 32px rgba(0,0,0,.55);
    }
    *{box-sizing:border-box}
    body{
      margin:0; background:var(--bg); color:var(--text);
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Helvetica Neue",Arial,sans-serif;
      display:flex; flex-direction:column; align-items:center; padding:16px; gap:12px;
    }
    h1{margin:0; font-size:18px; color:#8fb3ff}
    iframe{
      width:400px; height:920px; border:0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,.3);
      background:#0b1220;
    }

    /* Overlay + window + header */
    #voxpro-overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.92);
      z-index:2147483647; display:flex; align-items:center; justify-content:center;
    }
    .vp-window{
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:90vw; height:90vh; max-width:1600px; max-height:90vh; min-width:420px; min-height:300px;
      background:var(--panel); border-radius:12px; display:flex; flex-direction:column; box-shadow:var(--shadow);
    }
    .vp-header{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:12px 16px; background:#0b1220; border-radius:12px 12px 0 0; border-bottom:1px solid #2a3441;
      cursor:move; user-select:none;
    }
    .vp-title{color:#fff; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
    .vp-close{
      background:var(--accent); color:#fff; border:0; border-radius:6px; width:32px; height:32px;
      cursor:pointer; font-size:18px; font-weight:700
    }
    .vp-body{
      flex:1; min-height:0; overflow:auto; display:flex; align-items:center; justify-content:center; padding:0 10px 10px 10px;
    }
    .vp-body > img, .vp-body > video, .vp-body > audio{
      max-width:100%; max-height:100%;
    }
    .vp-resize{
      position:absolute; right:10px; bottom:10px; width:16px; height:16px; cursor:se-resize; opacity:.8;
      background:
        linear-gradient(135deg, transparent 50%, #667eea 50%),
        linear-gradient(225deg, transparent 50%, #667eea 50%);
      background-size:100% 50%, 50% 100%;
      background-position:0 100%, 100% 0;
      background-repeat:no-repeat;
    }
  </style>
</head>
<body>
  <h1>VoxPro Companion Player</h1>

  <!-- Your companion iframe (server name; not streamofdan, not preview) -->
  <iframe
    id="voxproFrame"
    title="VoxPro Player"
    src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-companion.html">
  </iframe>

  <script>
  (function(){
    'use strict';

    // ===== Overlay helpers =====
    function removeOverlay(){
      var ex = document.getElementById('voxpro-overlay');
      if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', escHandler);
      window.removeEventListener('mousemove', dragMove);
      window.removeEventListener('mouseup',   dragEnd);
      window.removeEventListener('mousemove', resizeMove);
      window.removeEventListener('mouseup',   resizeEnd);
    }

    function escHandler(e){ if(e.key==='Escape') removeOverlay(); }

    // Drag logic
    var dragging = false, dragStartX=0, dragStartY=0, winStartLeft=0, winStartTop=0, winEl=null;
    function dragStart(e){
      dragging = true; dragStartX=e.clientX; dragStartY=e.clientY;
      var r = winEl.getBoundingClientRect();
      winStartLeft = r.left; winStartTop = r.top;
      window.addEventListener('mousemove', dragMove);
      window.addEventListener('mouseup',   dragEnd);
      // cancel center translate on first drag
      winEl.style.transform='translate(0,0)';
    }
    function dragMove(e){
      if(!dragging) return;
      var nl = winStartLeft + (e.clientX-dragStartX);
      var nt = winStartTop  + (e.clientY-dragStartY);
      var maxL = window.innerWidth  - winEl.offsetWidth  - 12;
      var maxT = window.innerHeight - winEl.offsetHeight - 12;
      nl = Math.max(12, Math.min(maxL, nl));
      nt = Math.max(12, Math.min(maxT, nt));
      winEl.style.left = nl + 'px';
      winEl.style.top  = nt + 'px';
    }
    function dragEnd(){ dragging=false; window.removeEventListener('mousemove',dragMove); window.removeEventListener('mouseup',dragEnd); }

    // Resize logic
    var resizing=false, rsX=0, rsY=0, rsW=0, rsH=0;
    function resizeStart(e){
      e.stopPropagation(); resizing=true; rsX=e.clientX; rsY=e.clientY;
      rsW=winEl.offsetWidth; rsH=winEl.offsetHeight;
      window.addEventListener('mousemove', resizeMove);
      window.addEventListener('mouseup',   resizeEnd);
    }
    function resizeMove(e){
      if(!resizing) return;
      var nw = Math.max(420, rsW + (e.clientX - rsX));
      var nh = Math.max(300, rsH + (e.clientY - rsY));
      nw = Math.min(window.innerWidth  - 24, nw);
      nh = Math.min(window.innerHeight - 24, nh);
      winEl.style.width  = nw + 'px';
      winEl.style.height = nh + 'px';
    }
    function resizeEnd(){ resizing=false; window.removeEventListener('mousemove',resizeMove); window.removeEventListener('mouseup',resizeEnd); }

    // file type helpers
    function getExt(u){
      try{
        var a=document.createElement('a'); a.href=u;
        var m=(a.pathname||'').match(/\.([A-Za-z0-9]+)$/);
        return (m&&m[1]||'').toLowerCase();
      }catch(e){
        var m2=(u||'').match(/\.([A-Za-z0-9]+)(?:\?|#|$)/);
        return (m2&&m2[1]||'').toLowerCase();
      }
    }

    // Basic renderers (safe subset)
    function renderImage(c,u){
      var img=document.createElement('img');
      img.src=u; img.alt='Image';
      img.style.maxWidth='100%'; img.style.maxHeight='100%'; img.style.objectFit='contain';
      c.appendChild(img);
    }
    function renderAudio(c,u){
      var a=document.createElement('audio');
      a.controls=true; a.autoplay=true; a.src=u; a.style.maxWidth='100%';
      c.appendChild(a); a.play().catch(function(){});
    }
    function renderVideo(c,u){
      var v=document.createElement('video');
      v.controls=true; v.autoplay=true; v.src=u; v.style.width='100%'; v.style.maxHeight='100%';
      c.appendChild(v); v.play().catch(function(){});
    }

    function renderSmart(c,u){
      c.innerHTML='';
      var e = getExt(u);
      if (['jpg','jpeg','png','gif','webp','bmp','svg'].indexOf(e)>=0) { renderImage(c,u); return; }
      if (['mp3','wav','ogg','m4a','aac','flac'].indexOf(e)>=0)       { renderAudio(c,u); return; }
      if (['mp4','webm','mov','mkv','avi'].indexOf(e)>=0)             { renderVideo(c,u); return; }
      // fallback link
      var p=document.createElement('div'); p.style.cssText='color:#fff;margin-bottom:10px'; p.textContent='Preview not available. Open file:';
      var a=document.createElement('a'); a.href=u; a.target='_blank'; a.textContent=u; a.style.color='#8fb3ff';
      c.appendChild(p); c.appendChild(a);
    }

    function buildOverlay(titleText){
      // Backdrop
      var overlay=document.createElement('div');
      overlay.id='voxpro-overlay';
      overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:2147483647;';
      document.body.appendChild(overlay);

      // Window
      winEl=document.createElement('div');
      winEl.className='vp-window';
      overlay.appendChild(winEl);

      // Header
      var header=document.createElement('div'); header.className='vp-header';
      var ttl=document.createElement('div'); ttl.className='vp-title'; ttl.textContent=titleText||'VoxPro Player';
      var close=document.createElement('button'); close.className='vp-close'; close.textContent='×';
      close.onclick=removeOverlay;
      header.appendChild(ttl); header.appendChild(close);
      winEl.appendChild(header);

      // Body
      var body=document.createElement('div'); body.className='vp-body';
      winEl.appendChild(body);

      // Resize grip
      var grip=document.createElement('div'); grip.className='vp-resize'; winEl.appendChild(grip);

      // Activate drag + resize
      header.addEventListener('mousedown', dragStart);
      grip.addEventListener('mousedown', resizeStart);

      // ESC & backdrop close
      document.addEventListener('keydown', escHandler);
      overlay.addEventListener('click', function(e){ if(e.target===overlay) removeOverlay(); });

      return body;
    }

    // ===== Message handler from companion iframe =====
    window.addEventListener('message', function(ev){
      var d = ev && ev.data; if(!d) return;

      if (d.type === 'VOXPRO_OPEN' && d.payload) {
        // Build movable/resizable window
        var body = buildOverlay(d.payload.title || 'VoxPro Player');
        // Render the media smartly
        renderSmart(body, d.payload.url);
        // Stop background scroll
        document.documentElement.style.overflow='hidden';
        document.body.style.overflow='hidden';
        return;
      }
      if (d.type === 'VOXPRO_CLOSE') {
        removeOverlay();
        return;
      }
    });

    // Hook drag functions into current window element
    function dragStart(e){
      dragging=true; dragStartX=e.clientX; dragStartY=e.clientY;
      var r=winEl.getBoundingClientRect(); winStartLeft=r.left; winStartTop=r.top;
      // cancel center transform on first drag
      winEl.style.transform='translate(0,0)';
      window.addEventListener('mousemove', dragMove);
      window.addEventListener('mouseup',   dragEnd);
    }

    function resizeStart(e){
      e.stopPropagation();
      resizing=true; rsX=e.clientX; rsY=e.clientY; rsW=winEl.offsetWidth; rsH=winEl.offsetHeight;
      window.addEventListener('mousemove', resizeMove);
      window.addEventListener('mouseup',   resizeEnd);
    }

  })();
  </script>
</body>
</html>
