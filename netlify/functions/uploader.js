// netlify/functions/uploader.js
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};
const json = (code, body) => ({
  statusCode: code,
  headers: { ...CORS, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// Single-line HTML so nothing gets truncated
const PAGE = "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Idaho Broadcasting Media Upload</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:linear-gradient(135deg,#1e3c72,#2a5298)}.wrap{max-width:860px;margin:0 auto;padding:22px}.card{background:#fff;border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.18);overflow:hidden}.head{padding:22px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}.head h1{margin:0;font-weight:800}.head p{margin:6px 0 0}.body{padding:22px}label{font-weight:700;display:block;margin:12px 0 6px}input,select,textarea{width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:10px;background:#f9fafb;font-size:15px}input[type=file]{background:#fff}textarea{min-height:90px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.btn{display:inline-flex;gap:8px;align-items:center;margin-top:14px;padding:12px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:800;cursor:pointer}.btn:disabled{opacity:.6;cursor:not-allowed}.msg{margin-top:14px;border-radius:10px;padding:12px;font-weight:700;display:none}.ok{background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0}.err{background:#fef2f2;color:#7f1d1d;border:1px solid #fecaca}.prog{height:8px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:10px;display:none}.bar{height:100%;width:0;background:linear-gradient(135deg,#667eea,#764ba2);transition:width .2s}small{color:#6b7280}.fileinfo{color:#334155;font-size:13px;margin-top:6px}</style></head><body><div class='wrap'><div class='card'><div class='head'><h1>Idaho Broadcasting Media Upload</h1><p>Upload media files to the VoxPro system</p></div><div class='body'><div id='ok' class='msg ok'></div><div id='err' class='msg err'></div><form id='f'><label>Media file <small>(required; max 250MB)</small></label><input type='file' id='file' required accept='.mp4,.mov,.avi,.mkv,.wmv,.flv,.mp3,.wav,.aac,.m4a,.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx'><div id='fileinfo' class='fileinfo'></div><div class='row'><div><label>Title *</label><input id='title' placeholder='Enter media title' required></div><div><label>Submitted By</label><input id='submittedBy' placeholder='Your name'></div></div><label>Description</label><textarea id='description' placeholder='Enter media description'></textarea><div class='row'><div><label>Category</label><select id='category'><option value=''>Select category</option><option>Audio</option><option>Video</option><option>Photo</option><option>Document</option><option>Other</option></select></div><div><label>Station</label><input id='station' placeholder='Enter station' list='stationList'><datalist id='stationList'></datalist></div></div><div class='row'><div><label>Tags</label><input id='tags' placeholder='Comma separated'></div><div><label>Priority</label><select id='priority'><option>Normal</option><option>High</option><option>Low</option></select></div></div><label>Notes</label><textarea id='notes' placeholder='Additional notes or comments'></textarea><div class='prog' id='prog'><div class='bar' id='bar'></div></div><button class='btn' id='submitBtn' type='submit'>Upload Media</button></form><div style='margin-top:20px;text-align:center'><a href='/voxpro-manager' style='color:#667eea;text-decoration:none;font-weight:600'>← Back to VoxPro Manager</a></div></div></div></div><script>(function(){const MAX=262144000,$=id=>document.getElementById(id),form=$('f'),ok=$('ok'),err=$('err'),file=$('file'),info=$('fileinfo'),bar=$('bar'),prog=$('prog'),btn=$('submitBtn');function okMsg(m){ok.textContent=m;ok.style.display='block';err.style.display='none'}function errMsg(m){err.textContent=m;err.style.display='block';ok.style.display='none'}function reset(){prog.style.display='none';bar.style.width='0'}const loadStations=()=>{const stations=JSON.parse(localStorage.getItem('voxpro_stations')||'[]');const datalist=$('stationList');datalist.innerHTML=stations.map(s=>'<option value=\"'+s+'\">').join('')};loadStations();file.addEventListener('change',()=>{const f=file.files[0];if(!f){info.textContent='';return}if(f.size>MAX){errMsg('File exceeds 250MB limit.');file.value='';info.textContent='';return}info.textContent='Selected: '+f.name+' • '+(f.size/1048576).toFixed(2)+' MB • '+(f.type||'unknown')});form.addEventListener('submit',async(e)=>{e.preventDefault();const f=file.files[0];if(!f){return errMsg('Please select a file.')}if(f.size>MAX){return errMsg('File exceeds 250MB limit.')}const stationVal=$('station').value;if(stationVal){const stations=JSON.parse(localStorage.getItem('voxpro_stations')||'[]');if(!stations.includes(stationVal)){stations.unshift(stationVal);if(stations.length>10)stations.pop();localStorage.setItem('voxpro_stations',JSON.stringify(stations))}}const fd=new FormData();fd.append('attachment',f);fd.append('title',$('title').value||'Untitled');fd.append('description',$('description').value||'');fd.append('submitted_by',$('submittedBy').value||'Anonymous');fd.append('notes',$('notes').value||'');fd.append('tags',$('tags').value||'');fd.append('category',$('category').value||'Other');fd.append('station',$('station').value||'');fd.append('priority',$('priority').value||'Normal');fd.append('file_type',f.type||'unknown');fd.append('file_size',String(f.size));fd.append('filename',f.name);fd.append('is_approved','false');btn.disabled=true;prog.style.display='block';bar.style.width='25%';okMsg('');errMsg('');try{const res=await fetch('/.netlify/functions/uploader',{method:'POST',body:fd});bar.style.width='70%';const text=await res.text();let data;try{data=JSON.parse(text)}catch{data={message:text}}if(res.ok){bar.style.width='100%';okMsg('File uploaded successfully! You can now find it in VoxPro Manager.');form.reset();info.textContent='';reset()}else{errMsg((data.error||data.message||'Upload failed.')+(data.stage?(' ['+data.stage+']'):' '));reset()}}catch(ex){errMsg('Upload failed: '+ex.message);reset()}finally{btn.disabled=false}})})();</script></body></html>";

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // Serve the page on GET
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' }, body: PAGE };
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // Env
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    XANO_API_KEY,
    XANO_API_BASE,
  } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET)
    return json(500, { ok: false, stage: 'env', error: 'Missing Cloudinary env vars' });
  if (!XANO_API_KEY || !XANO_API_BASE)
    return json(500, { ok: false, stage: 'env', error: 'Missing Xano env vars' });

  // Lazy deps for POST only
  let Busboy, cloudinary;
  try {
    Busboy = require('busboy');
    cloudinary = require('cloudinary').v2;
  } catch (e) {
    return json(500, { ok: false, stage: 'deps', error: 'Missing dependency', detail: e.message });
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  // Parse multipart
  const parseMultipart = () =>
    new Promise((resolve, reject) => {
      const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
      if (!/multipart\/form-data/i.test(contentType)) return reject(new Error(`Invalid content-type: ${contentType || 'undefined'}`));
      const bb = Busboy({ headers: { 'content-type': contentType } });
      const fields = {};
      let file = null;
      bb.on('file', (name, stream, info) => {
        const { filename, mimeType } = info;
        const chunks = [];
        stream.on('data', d => chunks.push(d));
        stream.on('end', () => { if (name === 'attachment' || !file) file = { fieldname: name, filename, mimeType, buffer: Buffer.concat(chunks) }; });
      });
      bb.on('field', (n, v) => (fields[n] = v));
      bb.on('error', reject);
      bb.on('finish', () => resolve({ fields, file }));
      const bodyBuf = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
      bb.end(bodyBuf);
    });

  try {
    const { fields, file } = await parseMultipart();
    if (!file) return json(400, { ok: false, stage: 'parse', error: 'No file (field \"attachment\")' });

    // Cloudinary upload
    const cloudRes = await new Promise((resolve, reject) => {
      const up = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      up.end(file.buffer);
    });

    // Xano payload
    const payload = {
      title: fields.title || file.filename || 'Untitled',
      description: fields.description || '',
      submitted_by: fields.submitted_by || 'Anonymous',
      notes: fields.notes || '',
      tags: fields.tags || '',
      category: fields.category || 'Other',
      station: fields.station || '',
      priority: fields.priority || 'Normal',
      file_type: file.mimeType || 'unknown',
      file_size: String(file.buffer.length),
      filename: fields.filename || file.filename || '',
      is_approved: String(fields.is_approved || 'false') === 'true',
      media_url: cloudRes.secure_url,
      thumbnail_url: cloudRes.eager?.[0]?.secure_url || '',
      cloudinary_url: cloudRes.secure_url,
      created_at: Date.now(),
    };

    // POST to Xano
    let xanoUrl;
    try { xanoUrl = new URL(XANO_API_BASE.replace(/\/+$/, '') + '/user_submission'); }
    catch { return json(500, { ok: false, stage: 'env', error: 'Invalid XANO_API_BASE' }); }

    const xanoResp = await new Promise((resolve) => {
      const req = https.request(
        {
          protocol: xanoUrl.protocol,
          hostname: xanoUrl.hostname,
          path: xanoUrl.pathname + xanoUrl.search,
          method: 'POST',
          headers: { Authorization: 'Bearer ' + XANO_API_KEY, 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on('error', (e) => resolve({ status: 500, body: JSON.stringify({ error: e.message }) }));
      req.write(JSON.stringify(payload)); req.end();
    });

    let xanoBody = xanoResp.body; try { xanoBody = JSON.parse(xanoResp.body); } catch {}
    return json(200, { ok: true, cloudinary: cloudRes, xano: { status: xanoResp.status, body: xanoBody } });
  } catch (e) {
    return json(500, { ok: false, stage: 'handler', error: e.message });
  }
};
