// netlify/functions/file-manager-page.js
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Idaho Broadcasting Media Upload</title>
<style>
  :root{--b1:#1e3c72;--b2:#2a5298;--p1:#667eea;--p2:#764ba2}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:linear-gradient(135deg,var(--b1),var(--b2));color:#0f172a}
  .shell{max-width:860px;margin:0 auto;padding:22px}
  .card{background:#fff;border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.18);overflow:hidden}
  .head{padding:24px;background:linear-gradient(135deg,var(--p1),var(--p2));color:#fff}
  .head h1{margin:0;font-weight:800}
  .body{padding:22px}
  label{font-weight:700;display:block;margin:14px 0 6px}
  input,select,textarea{width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;background:#f9fafb}
  textarea{min-height:90px;resize:vertical}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .btn{display:inline-flex;gap:8px;align-items:center;margin-top:14px;padding:12px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,var(--p1),var(--p2));color:#fff;font-weight:800;cursor:pointer}
  .msg{margin-top:14px;border-radius:10px;padding:12px;font-weight:700;display:none}
  .ok{background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0}
  .err{background:#fef2f2;color:#7f1d1d;border:1px solid #fecaca}
  .progress{height:8px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:10px;display:none}
  .bar{height:100%;width:0;background:linear-gradient(135deg,var(--p1),var(--p2));transition:width .2s}
  small{color:#6b7280}
</style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <div class="head">
        <h1>Idaho Broadcasting Media Upload</h1>
        <p>Upload media files to the VoxPro system</p>
      </div>
      <div class="body">
        <div id="ok"  class="msg ok"></div>
        <div id="err" class="msg err"></div>

        <form id="f">
          <label>Media file <small>(required; max 250MB)</small></label>
          <input type="file" id="file" required />

          <div class="row">
            <div>
              <label>Title *</label>
              <input id="title" placeholder="Enter media title" required />
            </div>
            <div>
              <label>Submitted By</label>
              <input id="submittedBy" placeholder="Your name" />
            </div>
          </div>

          <label>Description</label>
          <textarea id="description" placeholder="Enter media description"></textarea>

          <div class="row">
            <div>
              <label>Category</label>
              <select id="category">
                <option value="">Select category</option>
                <option>Audio</option><option>Video</option>
                <option>Photo</option><option>Document</option><option>Other</option>
              </select>
            </div>
            <div>
              <label>Station</label>
              <select id="station">
                <option value="">Select station</option>
                <option>KIVI</option><option>KNIN</option><option>KGEM</option><option>Other</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div>
              <label>Tags</label>
              <input id="tags" placeholder="Comma separated" />
            </div>
            <div>
              <label>Priority</label>
              <select id="priority"><option>Normal</option><option>High</option><option>Low</option></select>
            </div>
          </div>

          <label>Notes</label>
          <textarea id="notes" placeholder="Additional notes or comments"></textarea>

          <div class="progress" id="prog"><div class="bar" id="bar"></div></div>
          <button class="btn" type="submit">Upload Media</button>
        </form>
      </div>
    </div>
  </div>

<script>
(function(){
  const MAX = 250 * 1024 * 1024; // 250MB
  const qs = (id)=>document.getElementById(id);
  const form = qs('f');
  const ok = qs('ok'), err = qs('err'), file = qs('file');
  const bar = qs('bar'), prog = qs('prog');

  function showOk(m){ ok.textContent = m; ok.style.display='block'; err.style.display='none'; }
  function showErr(m){ err.textContent = m; err.style.display='block'; ok.style.display='none'; }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const f = file.files[0];
    if(!f){ return showErr('Please select a file.'); }
    if(f.size > MAX){ return showErr('File exceeds 250MB limit.'); }

    const fd = new FormData();
    fd.append('attachment', f);
    fd.append('title', qs('title').value || 'Untitled');
    fd.append('description', qs('description').value || '');
    fd.append('submitted_by', qs('submittedBy').value || 'Anonymous');
    fd.append('notes', qs('notes').value || '');
    fd.append('tags', qs('tags').value || '');
    fd.append('category', qs('category').value || 'Other');
    fd.append('station', qs('station').value || '');
    fd.append('priority', qs('priority').value || 'Normal');
    fd.append('file_type', f.type || 'unknown');
    fd.append('file_size', String(f.size));
    fd.append('filename', f.name);
    fd.append('is_approved', 'false');

    prog.style.display='block';
    bar.style.width='20%';

    try{
      // ABSOLUTE URL so it works from /file-manager OR /.netlify/functions/file-manager-page
      const res = await fetch('/.netlify/functions/file-manager-upload', { method:'POST', body: fd });
      bar.style.width='80%';

      const text = await res.text();
      let data; try{ data = JSON.parse(text); }catch{ data = { message:text }; }

      if(res.ok){
        bar.style.width='100%';
        showOk('File uploaded successfully! You can now find it in VoxPro Manager.');
        form.reset(); prog.style.display='none'; bar.style.width='0';
      }else{
        showErr(data.error || data.message || 'Upload failed.');
        prog.style.display='none'; bar.style.width='0';
      }
    }catch(ex){
      showErr('Upload failed: ' + ex.message);
      prog.style.display='none'; bar.style.width='0';
    }
  });
})();
</script>
</body>
</html>`;

  return { statusCode: 200, headers, body: html };
};
