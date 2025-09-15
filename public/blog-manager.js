/* Minimal frontend for Blog Manager (Webflow v2).
   Expects Netlify redirects to /api/* → /.netlify/functions/*
   Functions used:
     - /api/blog-posts-list        (GET)
     - /api/blog-posts-create      (POST, ?publish=true optional)
     - /api/blog-posts-update      (PATCH, ?publish=true optional)
*/

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    title: $('#title'),
    slug: $('#slug'),
    summary: $('#summary'),
    state: $('#state'),
    bodyId: 'post-body',
    composeMsg: $('#compose-msg'),
    listMsg: $('#list-msg'),
    tableBody: $('#posts-table tbody'),
    btnRefresh: $('#btn-refresh'),
    btnPublish: $('#btn-publish'),
    btnDraftServer: $('#btn-save-draft-server'),
    btnPreview: $('#btn-generate-preview'),
    btnClear: $('#btn-clear'),
  };

  const api = {
    async getJSON(url, opts) {
      const res = await fetch(url, opts);
      const text = await res.text();
      try { return { ok: res.ok, status: res.status, json: JSON.parse(text) }; }
      catch { return { ok: res.ok, status: res.status, json: { raw: text } }; }
    },
    list: () => api.getJSON('/api/blog-posts-list'),
    create: (payload, publish=false) =>
      api.getJSON(`/api/blog-posts-create?publish=${publish}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
    update: (payload, publish=false) =>
      api.getJSON(`/api/blog-posts-update?publish=${publish}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
  };

  function setMsg(node, text, type='note') {
    node.textContent = text;
    node.className = `msg ${type}`;
  }

  function slugify(s) {
    return (s || '')
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '-');
  }

  function getEditorHTML() {
    const ed = window.tinymce?.get(els.bodyId);
    return ed ? ed.getContent() : $('#'+els.bodyId)?.value || '';
  }

  function setEditorHTML(html) {
    const ed = window.tinymce?.get(els.bodyId);
    if (ed) ed.setContent(html || '');
    else $('#'+els.bodyId).value = html || '';
  }

  async function refreshList() {
    setMsg(els.listMsg, 'Loading posts...', 'note');
    const r = await api.list();
    if (!r.ok) {
      setMsg(els.listMsg, `List failed (${r.status})`, 'bad');
      els.tableBody.innerHTML = '';
      return;
    }
    const items = Array.isArray(r.json) ? r.json : (r.json.items || []);
    els.tableBody.innerHTML = items.map(rowHTML).join('');
    setMsg(els.listMsg, `Loaded ${items.length} posts`, 'ok');
    wireRowButtons(items);
  }

  function rowHTML(p) {
    const updated = p.updated_at ? new Date(p.updated_at).toLocaleString() : '';
    const status = p.status || 'published';
    return `
      <tr data-id="${p.id || ''}">
        <td>${escapeHTML(p.title || '')}</td>
        <td>${escapeHTML(status)}</td>
        <td>${escapeHTML(updated)}</td>
        <td>
          <button class="row-edit">Edit</button>
          <button class="row-publish primary">Publish</button>
        </td>
      </tr>
    `;
  }

  function wireRowButtons(items) {
    $$('.row-edit').forEach((btn, idx) => {
      btn.addEventListener('click', () => loadIntoComposer(items[idx]));
    });
    $$('.row-publish').forEach((btn, idx) => {
      btn.addEventListener('click', () => doUpdate(items[idx]?.id, true));
    });
  }

  function loadIntoComposer(p={}) {
    els.title.value = p.title || '';
    els.slug.value = p.slug || '';
    els.summary.value = p.summary || '';
    els.state.value = p.status || 'published';
    setEditorHTML(p.body || '');
    setMsg(els.composeMsg, `Loaded "${p.title || ''}" into editor.`, 'ok');
  }

  function collectFieldData() {
    const name = els.title.value.trim();
    const slug = (els.slug.value.trim() || slugify(name));
    const summary = els.summary.value.trim();
    const body = getEditorHTML();
    const isDraft = els.state.value === 'draft';
    const isArchived = els.state.value === 'archived';

    return {
      fieldData: {
        // IMPORTANT: keys must match your Webflow Blog field API slugs.
        // Adjust these three if your slugs differ:
        name,          // required by Webflow
        slug,          // auto-generated above if blank
        summary,       // change if your field slug differs
        body           // change to 'post-body' or your rich text slug if needed
      },
      isDraft,
      isArchived
    };
  }

  async function doCreate(publish=false) {
    const payload = collectFieldData();
    if (!payload.fieldData.name) {
      setMsg(els.composeMsg, 'Title (name) is required', 'bad');
      return;
    }
    setMsg(els.composeMsg, publish ? 'Publishing…' : 'Saving draft…', 'note');
    const r = await api.create(payload, publish);
    if (!r.ok) {
      const hint = r.json?.body_preview ? ` — ${String(r.json.body_preview).slice(0,180)}` : '';
      setMsg(els.composeMsg, `Create failed (${r.status})${hint}`, 'bad');
      return;
    }
    setMsg(els.composeMsg, publish ? 'Published ✅' : 'Draft saved ✅', 'ok');
    refreshList();
  }

  async function doUpdate(id, publish=false) {
    if (!id) { setMsg(els.composeMsg, 'Missing item id (select a row then Edit)', 'bad'); return; }
    const payload = collectFieldData();
    payload.id = id;
    setMsg(els.composeMsg, publish ? 'Updating + publishing…' : 'Updating…', 'note');
    const r = await api.update(payload, publish);
    if (!r.ok) {
      const hint = r.json?.body_preview ? ` — ${String(r.json.body_preview).slice(0,180)}` : '';
      setMsg(els.composeMsg, `Update failed (${r.status})${hint}`, 'bad');
      return;
    }
    setMsg(els.composeMsg, publish ? 'Updated + published ✅' : 'Updated ✅', 'ok');
    refreshList();
  }

  function clearCompose() {
    els.title.value = '';
    els.slug.value = '';
    els.summary.value = '';
    els.state.value = 'published';
    setEditorHTML('');
    setMsg(els.composeMsg, 'Cleared.', 'note');
  }

  function escapeHTML(s='') {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]));
  }

  // Wire buttons
  els.btnRefresh.addEventListener('click', refreshList);
  els.btnPublish.addEventListener('click', () => doCreate(true));
  els.btnDraftServer.addEventListener('click', () => doCreate(false));
  els.btnPreview.addEventListener('click', () => {
    setMsg(els.composeMsg, 'Preview generated (local).', 'ok');
  });
  els.btnClear.addEventListener('click', clearCompose);

  // Initial load
  refreshList();
})();
