/* public/assets/voxpro-manager.js
 * VoxPro Manager — unified previews (audio/video/image/PDF/Office) + Cloudinary thumbs
 * Drop-in replacement, no other files required.
 */

/* -----------------------------
 * Minimal utilities
 * --------------------------- */
const VP = {
  qs: (sel, el = document) => el.querySelector(sel),
  qsa: (sel, el = document) => [...el.querySelectorAll(sel)],
  el: (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v);
    });
    children.forEach(c => e.append(c));
    return e;
  },
  sanitizeText: (s) => (typeof s === 'string' ? s.replace(/[<>]/g, '') : ''),
  formatBytes: (b) => {
    if (!Number.isFinite(b)) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return `${(b / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
};

/* -----------------------------
 * Cloudinary helpers
 * --------------------------- */

/**
 * classifyCloudinaryResource
 * Map Cloudinary resource to app-friendly file_type.
 * - image, video: keep as-is
 * - raw: derive document-* subtype by extension
 */
function classifyCloudinaryResource(asset) {
  const ext = (asset.format || '').toLowerCase(); // 'pdf','docx','mp4','jpg', etc.
  let kind = asset.resource_type; // 'image' | 'video' | 'raw'

  if (kind === 'raw') {
    if (ext === 'pdf') kind = 'document-pdf';
    else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'odt', 'csv', 'tsv'].includes(ext)) {
      kind = 'document-office';
    } else {
      kind = 'document';
    }
  }
  return { kind, ext };
}

/**
 * cloudinaryPdfThumb
 * Returns transformed URL rendering page 1 of a PDF as an image thumbnail.
 */
function cloudinaryPdfThumb(secureUrl, size = { w: 60, h: 60 }) {
  if (!secureUrl || !secureUrl.includes('/upload/')) return secureUrl;
  const transform = `/upload/w_${size.w},h_${size.h},c_fill,q_auto,f_auto,pg_1/`;
  return secureUrl.replace('/upload/', transform);
}

/* -----------------------------
 * Data loading (Cloudinary)
 * --------------------------- */

/**
 * loadCloudinaryAssets
 * Fetch your Netlify function (case-sensitive path).
 * Returns unified media objects consumed by the UI.
 */
async function loadCloudinaryAssets(query = '', type = '') {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (type) params.set('type', type);

  const endpoint = `/.netlify/functions/LIst-assets${params.toString() ? `?${params.toString()}` : ''}`;

  const res = await fetch(endpoint, { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Cloudinary list error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  // Map to internal structure with document subtypes
  return (data.resources || []).map(asset => {
    const { kind, ext } = classifyCloudinaryResource(asset);

    return {
      id: asset.public_id,
      title: asset.display_name || asset.filename || asset.public_id,
      media_url: asset.secure_url,
      attachment: asset.secure_url,
      source: 'cloudinary',
      file_type: kind,      // 'image' | 'video' | 'document-pdf' | 'document-office' | 'document'
      file_ext: ext,        // 'jpg','mp4','pdf','docx', etc
      file_size: asset.bytes,
      cloudinary_data: asset
    };
  });
}

/* -----------------------------
 * Thumbnails
 * --------------------------- */

/**
 * getMediaIcon
 * Simple fallback emoji icon (replace with your SVGs if you prefer).
 */
function getMediaIcon(item) {
  const t = item.file_type;
  if (t === 'audio') return '🎧';
  if (t === 'video') return '🎬';
  if (t === 'image') return '🖼️';
  if (t === 'document-pdf') return '📄';
  if (t === 'document-office' || t === 'document') return '📃';
  return '📁';
}

/**
 * getMediaThumbnail
 * Returns HTML string for a 60x60 thumbnail slot.
 * - images: Cloudinary auto format/resize
 * - video: Cloudinary video thumb if available (fallback icon)
 * - PDF: first page thumbnail via pg_1 trans_*
