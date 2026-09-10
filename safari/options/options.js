/* Dynamic RTL - Options page logic */
'use strict';

const api = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : browser;

const DEFAULTS = {
  mode: 'enable_all',
  siteOverrides: {},
  font: 'vazirmatn',
  customFontDataUrl: '',
  customFontName: '',
  customFontFormat: '',
  debug: false
};

const $ = (id) => document.getElementById(id);

const els = {
  modeRadios: document.querySelectorAll('input[name="do-mode"]'),
  fontRadios: document.querySelectorAll('input[name="do-font"]'),
  fontFile: $('do-font-file'),
  fontStatus: $('do-font-status'),
  clearFont: $('do-clear-font'),
  preview: $('do-preview'),
  debug: $('do-debug'),
  list: $('do-list'),
  listEmpty: $('do-list-empty'),
  listStatus: $('do-list-status'),
  addDomain: $('do-add-domain'),
  addState: $('do-add-state'),
  addBtn: $('do-add-btn'),
  listExport: $('do-list-export'),
  listImport: $('do-list-import'),
  listImportFile: $('do-list-import-file'),
  listClear: $('do-list-clear')
};

function loadSettings() {
  return new Promise(resolve => {
    api.storage.local.get(null, stored => {
      resolve(Object.assign({}, DEFAULTS, stored || {}));
    });
  });
}
function saveSettings(patch) {
  return new Promise(resolve => api.storage.local.set(patch, resolve));
}

function flash(el, msg, ok = true) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '' : '#d93025';
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3500);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
function inferFontFormat(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.woff2')) return 'woff2-variations';
  if (name.endsWith('.woff')) return 'woff';
  if (name.endsWith('.ttf')) return 'truetype-variations';
  if (name.endsWith('.otf')) return 'opentype';
  return 'woff2-variations';
}

function applyPreviewFont(settings) {
  let style = document.getElementById('do-preview-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'do-preview-style';
    document.head.appendChild(style);
  }
  if (settings.font === 'custom' && settings.customFontDataUrl) {
    const fmt = settings.customFontFormat || 'woff2-variations';
    style.textContent = `
      @font-face {
        font-family: 'DynRTLPreview';
        src: url("${settings.customFontDataUrl}") format("${fmt}"),
             url("${settings.customFontDataUrl}");
        font-weight: 100 900;
        font-display: swap;
      }
    `;
    document.documentElement.style.setProperty('--do-preview-font',
      "'DynRTLPreview', 'Vazirmatn DynRTL', 'Vazirmatn', 'Tahoma', sans-serif");
  } else {
    style.textContent = `
      @font-face {
        font-family: 'DynRTLPreview';
        src: url("${api.runtime.getURL('fonts/Vazirmatn-Variable.woff2')}") format('woff2-variations'),
             url("${api.runtime.getURL('fonts/Vazirmatn-Variable.woff2')}") format('woff2');
        font-weight: 100 900;
        font-display: swap;
      }
    `;
    document.documentElement.style.setProperty('--do-preview-font',
      "'DynRTLPreview', 'Tahoma', sans-serif");
  }
}

function explainCustomFontStatus(settings) {
  if (settings.font === 'custom' && settings.customFontDataUrl) {
    return 'Using custom font: ' + (settings.customFontName || 'unnamed');
  }
  if (settings.customFontDataUrl) {
    return 'Custom font loaded but not active (selection set to Vazirmatn).';
  }
  return 'No custom font uploaded.';
}

function normalizeHost(h) {
  return (h || '').toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

// Site list

function renderList(overrides) {
  const entries = Object.entries(overrides || {})
    .filter(([host]) => !!host)
    .sort(([a], [b]) => a.localeCompare(b));
  // Clear existing rows but keep the empty placeholder.
  Array.from(els.list.querySelectorAll('.do-row-item')).forEach(n => n.remove());
  if (!entries.length) {
    els.listEmpty.style.display = '';
    return;
  }
  els.listEmpty.style.display = 'none';
  const frag = document.createDocumentFragment();
  for (const [host, state] of entries) {
    frag.appendChild(buildRow(host, state));
  }
  els.list.appendChild(frag);
}

function buildRow(host, state) {
  const row = document.createElement('div');
  row.className = 'do-row-item';
  row.dataset.host = host;

  const text = document.createElement('span');
  text.className = 'do-row-text';
  text.textContent = host + '*';
  row.appendChild(text);

  const stateEl = document.createElement('button');
  stateEl.type = 'button';
  stateEl.className = 'do-row-state do-row-state-' + state;
  stateEl.dataset.host = host;
  stateEl.dataset.state = state;
  stateEl.textContent = state;
  stateEl.title = 'Click to flip on/off';
  stateEl.addEventListener('click', () => toggleEntry(host));
  row.appendChild(stateEl);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'do-row-del';
  del.title = 'Remove from list';
  del.setAttribute('aria-label', 'Remove ' + host);
  del.textContent = '\u00D7';
  del.addEventListener('click', () => deleteEntry(host));
  row.appendChild(del);

  return row;
}

async function toggleEntry(host) {
  const settings = await loadSettings();
  const overrides = Object.assign({}, settings.siteOverrides || {});
  if (!overrides[host]) return;
  overrides[host] = overrides[host] === 'on' ? 'off' : 'on';
  await saveSettings({ siteOverrides: overrides });
}

async function deleteEntry(host) {
  const settings = await loadSettings();
  const overrides = Object.assign({}, settings.siteOverrides || {});
  delete overrides[host];
  await saveSettings({ siteOverrides: overrides });
}

async function addEntry() {
  const host = normalizeHost(els.addDomain.value);
  const state = els.addState.value === 'off' ? 'off' : 'on';
  if (!host) {
    flash(els.listStatus, 'Enter a domain first.', false);
    return;
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    flash(els.listStatus, 'That doesn\'t look like a valid domain.', false);
    return;
  }
  const settings = await loadSettings();
  const overrides = Object.assign({}, settings.siteOverrides || {});
  overrides[host] = state;
  await saveSettings({ siteOverrides: overrides });
  els.addDomain.value = '';
  flash(els.listStatus, `Added ${host}*${state}.`);
}

// Init

async function refresh() {
  const settings = await loadSettings();
  for (const r of els.modeRadios) r.checked = (r.value === settings.mode);
  for (const r of els.fontRadios) r.checked = (r.value === settings.font);
  els.debug.checked = !!settings.debug;
  els.fontStatus.textContent = explainCustomFontStatus(settings);
  applyPreviewFont(settings);
  renderList(settings.siteOverrides || {});
}

for (const r of els.modeRadios) {
  r.addEventListener('change', () => { if (r.checked) saveSettings({ mode: r.value }); });
}

for (const r of els.fontRadios) {
  r.addEventListener('change', async () => {
    if (!r.checked) return;
    await saveSettings({ font: r.value });
  });
}

els.fontFile.addEventListener('change', async () => {
  const f = els.fontFile.files && els.fontFile.files[0];
  if (!f) return;
  const MAX = 8 * 1024 * 1024;
  if (f.size > MAX) {
    flash(els.fontStatus, `Font is too large (${(f.size/1024/1024).toFixed(1)} MB > 8 MB).`, false);
    els.fontFile.value = '';
    return;
  }
  try {
    flash(els.fontStatus, 'Reading font...');
    const dataUrl = await fileToDataUrl(f);
    await saveSettings({
      customFontDataUrl: dataUrl,
      customFontName: f.name,
      customFontFormat: inferFontFormat(f),
      font: 'custom'
    });
    els.fontFile.value = '';
    flash(els.fontStatus, `Loaded ${f.name} (${(f.size/1024).toFixed(0)} KB).`);
  } catch (e) {
    flash(els.fontStatus, 'Failed to read font: ' + (e && e.message || e), false);
  }
});

els.clearFont.addEventListener('click', async () => {
  await saveSettings({
    customFontDataUrl: '',
    customFontName: '',
    customFontFormat: '',
    font: 'vazirmatn'
  });
  flash(els.fontStatus, 'Custom font removed.');
});

els.debug.addEventListener('change', () => saveSettings({ debug: els.debug.checked }));

els.addBtn.addEventListener('click', addEntry);
els.addDomain.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addEntry(); }
});

els.listExport.addEventListener('click', async () => {
  const { siteOverrides = {} } = await loadSettings();
  const blob = new Blob([JSON.stringify(siteOverrides, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dynamic-rtl-sites.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  flash(els.listStatus, 'List exported.');
});

els.listImport.addEventListener('click', () => els.listImportFile.click());

els.listImportFile.addEventListener('change', async () => {
  const f = els.listImportFile.files && els.listImportFile.files[0];
  if (!f) return;
  try {
    const text = await f.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Fallback: plain text "domain*on" / "domain*off" lines, one per line.
      parsed = {};
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        const m = t.match(/^([a-z0-9.-]+)\s*\*\s*(on|off)$/i);
        if (m) parsed[normalizeHost(m[1])] = m[2].toLowerCase();
      }
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file format');
    const settings = await loadSettings();
    const overrides = Object.assign({}, settings.siteOverrides || {});
    let count = 0;
    for (const [k, v] of Object.entries(parsed)) {
      const h = normalizeHost(k);
      if (!h) continue;
      if (v !== 'on' && v !== 'off') continue;
      overrides[h] = v;
      count++;
    }
    await saveSettings({ siteOverrides: overrides });
    flash(els.listStatus, `Imported ${count} entr${count === 1 ? 'y' : 'ies'}.`);
  } catch (e) {
    flash(els.listStatus, 'Import failed: ' + (e && e.message || e), false);
  } finally {
    els.listImportFile.value = '';
  }
});

els.listClear.addEventListener('click', async () => {
  if (!confirm('Clear the entire list?')) return;
  await saveSettings({ siteOverrides: {} });
  flash(els.listStatus, 'List cleared.');
});

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') refresh();
});

document.addEventListener('DOMContentLoaded', refresh);
