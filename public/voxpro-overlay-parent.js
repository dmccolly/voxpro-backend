<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>VoxPro Parent with Drag/Resize Overlay</title>
  <style>
    :root{
      --bg:#0b1220; --panel:#1a2332; --header:#0b1220;
      --accent:#667eea; --text:#ffffff; --shadow:0 8px 32px rgba(0,0,0,.55);
    }
    body{
      margin:0; background:var(--bg); color:var(--text);
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Helvetica Neue",Arial,sans-serif;
      display:flex; flex-direction:column; align-items:center; padding:16px; gap:12px;
    }
    h1{margin:0; font-size:18px; color:#8fb3ff}
    iframe{
      width:400px; height:920px; border:0; border-radius:8px;
      box-shadow:0 4px 12px rgba(0, 0, 0, .3); background:var(--bg);
    }
    /* Overlay styles */
    #voxpro-overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.92);
      z-index:2147483647; display:flex; align-items:center; justify-content:center;
    }
    .vp-window{
      position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
      width:90vw; height:90vh; max-width:1600px; max-height:90vh;
      min-width:420px; min-height:300px;
      background:var(--panel); border-radius:12px;
      box-shadow:var(--shadow); display:flex; flex-direction:column;
    }
    .vp-header{
      display:flex; align-items:center; justify-content:space-between;
      background:var(--header); padding:12px 16px; border-radius:12px 12px 0 0;
      border-bottom:1px solid #2a3441; cursor:move; user-select:none;
    }
    .vp-title{flex:1; color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
    .vp-close{
      background:var(--accent); color:#fff; border:0; border-radius:6px;
      width:32px; height:32px; cursor:pointer; font-size:18px; font-weight:700;
    }
    .vp-body{flex:1; min-height:0; overflow:auto; display:flex; align-items:center; justify-content:center; padding:0 12px 12px;}
    .vp-resize{
      position:absolute; right:10px; bottom:10px; width:16px; height:16px; cursor:se-resize; opacity:.8;
      background:
        linear-gradient(135deg, transparent 50%, var(--accent) 50%),
        linear-gradient(225deg, transparent 50%, var(--accent) 50%);
      background-size:100% 50%, 50% 100%;
      background-position:0 100%, 100% 0;
      background-repeat:no-repeat;
    }
    .vp-body > img, .vp-body > video, .vp-body > audio{
      max-width:100%; max-height:100%;
    }
  </style>
</head>
<body>
  <h1>VoxPro Companion Player</h1>
  <!-- Embed your existing companion page (server URL, not preview) -->
  <iframe src="https://majestic-beijinho-cd3d75.netlify.app/voxpro-companion.html" title="VoxPro Player"></iframe>

  <script>
  (function(){
    'use strict';
    let winEl, dragging=false, resizing=false;
    let dragStartX=0, dragStartY=0, startLeft=0, startTop=0;
    let resizeStartX=0, resizeStartY=0, startW=0, startH=0;

    // Close overlay and restore scroll
    function removeOverlay(){
      const ex=document.getElementById('voxpro-overlay');
      if(ex) ex.remove();
      document.documentElement.style.overflow='';
      document.body.style.overflow='';
    }

    function buildOverlay(title){
      // remove old
      removeOverlay();
      // lock scroll
      document.documentElement.style.overflow='hidden';
      document.body.style.overflow='hidden';
      // wrapper
      const overlay=document.createElement('div');
      overlay.id='voxpro-overlay';
      // window
      winEl=document.createElement('div');
      winEl.className='vp-window';
      // header
      const header=document.createElement('div');
      header.className='vp-header';
      const ttl=document.createElement('div');
      ttl.className='vp-title';
      ttl.textContent=title || 'VoxPro Player';
      const close=document.createElement('button');
      close.className='vp-close';
      close.textContent='×';
      close.onclick=removeOverlay;
      header.appendChild(ttl);
      header.appendChild(close);
      // body
      const body=document.createElement('div');
      body.className='vp-body';
      // resize grip
      const grip=document.createElement('div');
      grip.className='vp-resize';

      // assemble
      winEl.appendChild(header);
      winEl.appendChild(body);
      winEl.appendChild(grip);
      overlay.appendChild(winEl);
      document.body.appendChild(overlay);

      // drag events
      header.onmousedown=function(e){
        dragging=true;
        dragStartX=e.clientX;
        dragStartY=e.clientY;
        const rect=winEl.getBoundingClientRect();
        startLeft=rect.left;
        startTop=rect.top;
        // disable initial translate
        winEl.style.transform='translate(0,0)';
        e.preventDefault();
      };
      // resize events
      grip.onmousedown=function(e){
        e.stopPropagation();
        resizing=true;
        resizeStartX=e.clientX;
        resizeStartY=e.clientY;
        startW=winEl.offsetWidth;
        startH=winEl.offsetHeight;
        e.preventDefault();
      };
      // global mousemove/mouseup
      window.onmousemove=function(e){
        if(dragging){
          const dx=e.clientX-dragStartX;
          const dy=e.clientY-dragStartY;
          const newL=startLeft+dx;
          const newT=startTop+dy;
          winEl.style.left=Math.max(12, Math.min(window.innerWidth-winEl.offsetWidth-12,newL))+'px';
          winEl.style.top=Math.max(12, Math.min(window.innerHeight-winEl.offsetHeight-12,newT))+'px';
        } else if(resizing){
          const dx=e.clientX-resizeStartX;
          const dy=e.clientY-resizeStartY;
          const newW=Math.min(window.innerWidth-24, Math.max(420,startW+dx));
          const newH=Math.min(window.innerHeight-24, Math.max(300,startH+dy));
          winEl.style.width=newW+'px';
          winEl.style.height=newH+'px';
        }
      };
      window.onmouseup=function(){
        dragging=false;
        resizing=false;
      };

      // ESC and overlay click to close
      document.addEventListener('keydown', function esc(e){if(e.key==='Escape'){removeOverlay();document.removeEventListener('keydown',esc);}}, {once:true});
      overlay.onclick=function(ev){if(ev.target===overlay) removeOverlay();};

      return body;
    }

    // Determine file type and render
    function getExt(u){const m=(u||'').match(/\.([A-Za-z0-9]+)(?:\\?|#|$)/); return (m && m[1] || '').toLowerCase();}
    function renderContent(container, url){
      container.innerHTML='';
      const e=getExt(url);
      if(['jpg','jpeg','png','gif','webp','bmp','svg'].includes(e)){
        const img=document.createElement('img');
        img.src=url;
        img.alt='Image';
        container.appendChild(img);
        return;
      }
      if(['mp3','wav','ogg','m4a','aac','flac'].includes(e)){
        const audio=document.createElement('audio');
        audio.controls=true;
        audio.autoplay=true;
        audio.src=url;
        container.appendChild(audio);
        audio.play().catch(()=>{});
        return;
      }
      if(['mp4','webm','mov','mkv','avi'].includes(e)){
        const video=document.createElement('video');
        video.controls=true;
        video.autoplay=true;
        video.src=url;
        container.appendChild(video);
        video.play().catch(()=>{});
        return;
      }
      // fallback link
      const p=document.createElement('div');
      p.style.color='#fff';
      p.textContent='Preview not available.  Open file:';
      const a=document.createElement('a');
      a.href=url;
      a.target='_blank';
      a.textContent=url;
      a.style.color='#8fb3ff';
      container.appendChild(p);
      container.appendChild(a);
    }

    let popupWindow = null;

    function closePopup(){
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      popupWindow = null;
    }

    function openPopup(url, title, startTime){
      closePopup();
      
      popupWindow = window.open('', 'VoxProWindow', 'width=800,height=600,resizable=yes');
      if (!popupWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
      }
      
      const ext = getExt(url);
      const isImage = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
      const isAudio = ['mp3','wav','ogg','m4a','aac','flac'].includes(ext);
      
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
    body{margin:0;background:#0b1220;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;height:100vh}
    #vpHeader{padding:10px 16px;background:#0b1220;color:#fff;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a3441}
    #vpTitle{font-weight:600;font-size:1rem}
    #vpClose{background:#667eea;color:#fff;border:0;border-radius:4px;cursor:pointer;width:32px;height:32px;font-size:18px;font-weight:700}
    #vpClose:hover{background:#764ba2}
    #vpContent{flex:1;padding:16px;display:flex;align-items:center;justify-content:center;overflow:auto}
  </style>
</head>
<body>
  <div id="vpHeader">
    <span id="vpTitle">${title || 'VoxPro Player'}</span>
    <button id="vpClose">×</button>
  </div>
  <div id="vpContent">${mediaElement}</div>
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
    
    document.getElementById('vpClose').onclick = function() { window.close(); };
    
    window.onbeforeunload = function() {
      if (window.opener) {
        window.opener.postMessage({ type: 'VOXPRO_CLOSE' }, '*');
      }
    };
  <\/script>
</body>
</html>
`);
      popupWindow.document.close();
    }

    // Listen for maximize messages from the companion
    window.addEventListener('message', function(ev){
      const d=ev && ev.data;
      if(!d) return;
      if(d.type==='VOXPRO_OPEN' && d.payload){
        openPopup(d.payload.url, d.payload.title, d.payload.startTime || 0);
      } else if(d.type==='VOXPRO_CLOSE'){
        closePopup();
      }
    });
  })();
  </script>
</body>
</html>
