/* Dynamic RTL - Options page logic */
'use strict';

const api = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : browser;

const SYNCABLE = ['mode', 'siteOverrides', 'font', 'customFontName', 'customFontFormat', 'debug', 'seenVersion'];
const hasSync = !!(api.storage && api.storage.sync);
const rawGet = (area, k) => new Promise((resolve) => { try { api.storage[area].get(k, (x) => { void api.runtime.lastError; resolve(x || {}) }) } catch (_) { resolve({}) } });
const rawSet = (area, p) => new Promise((resolve) => { try { api.storage[area].set(p, () => { void api.runtime.lastError; resolve() }) } catch (_) { resolve() } });
const rawDel = (area, k) => new Promise((resolve) => { try { api.storage[area].remove(k, () => { void api.runtime.lastError; resolve() }) } catch (_) { resolve() } });

const DEFAULTS = {
  mode: 'enable_all',
  siteOverrides: {},
  font: 'vazirmatn',
  customFontDataUrl: '',
  customFontName: '',
  customFontFormat: '',
  debug: false
};

function t(key, subs) {
  try {
    const m = api.i18n ? api.i18n.getMessage(key, subs) : '';
    if (m) return m;
  } catch (_) {}
  return '';
}
// Static English stays in the HTML as fallback; this swaps in the UI locale
// and mirrors the page when the browser speaks a RTL language.
function applyI18n() {
  try {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const m = t(el.getAttribute('data-i18n'));
      if (m) el.textContent = m;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const m = t(el.getAttribute('data-i18n-html'));
      if (m) el.innerHTML = m;
    });
    let rtl = false;
    try { rtl = /^fa\b/i.test((api.i18n && api.i18n.getUILanguage && api.i18n.getUILanguage()) || ''); } catch (_) {}
    document.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = rtl ? 'fa' : 'en';
  } catch (_) {}
}


const $ = (id) => document.getElementById(id);

const els = {
  modeRadios: document.querySelectorAll('input[name="do-mode"]'),
  fontRadios: document.querySelectorAll('input[name="do-font"]'),
  fontFile: $('do-font-file'),
  fontStatus: $('do-font-status'),
  clearFont: $('do-clear-font'),
  preview: $('do-preview'),
  list: $('do-list'),
  listEmpty: $('do-list-empty'),
  listStatus: $('do-list-status'),
  addDomain: $('do-add-domain'),
  addState: $('do-add-state'),
  addBtn: $('do-add-btn'),
  listExport: $('do-list-export'),
  listImport: $('do-list-import'),
  listImportFile: $('do-list-import-file'),
  listClear: $('do-list-clear'),
  version: $('do-version'),
  search: $('do-search'),
  listNoMatch: $('do-list-nomatch'),
  whatsnew: $('do-whatsnew'),
  whatsnewDismiss: $('do-whatsnew-dismiss'),
  shortcut: $('do-shortcut'),
  shortcutHint: $('do-shortcut-hint')
};

function setVersion() {
  try {
    const v = api.runtime.getManifest().version;
    if (v && els.version) els.version.textContent = v;
  } catch (_) {}
}

async function loadSettings() {
  if (!hasSync) {
    const stored = await rawGet('local', null);
    return Object.assign({}, DEFAULTS, stored || {});
  }
  const [sy, lo] = await Promise.all([rawGet('sync', null), rawGet('local', null)]);
  return Object.assign({}, DEFAULTS, sy || {}, lo || {});
}
async function saveSettings(patch) {
  const s = {}, l = {};
  for (const k of Object.keys(patch || {})) (SYNCABLE.includes(k) ? s : l)[k] = patch[k];
  if (!hasSync) { await rawSet('local', patch); return; }
  if (Object.keys(s).length) {
    if (JSON.stringify(s).length > 80000) Object.assign(l, s);
    else { await rawSet('sync', s); await rawDel('local', Object.keys(s)); }
  }
  if (Object.keys(l).length) await rawSet('local', l);
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
    return t('fontStatusUsing', [settings.customFontName || 'unnamed']) || ('Using custom font: ' + (settings.customFontName || 'unnamed'));
  }
  if (settings.customFontDataUrl) {
    return t('fontStatusIdle') || 'Custom font loaded but not active (selection set to Vazirmatn).';
  }
  return t('fontStatusNone') || 'No custom font uploaded.';
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
  applyFilter();
}

// Live search over the rendered rows.
function applyFilter() {
  if (!els.search) return;
  const q = (els.search.value || '').trim().toLowerCase();
  const rows = Array.from(els.list.querySelectorAll('.do-row-item'));
  let visible = 0;
  for (const row of rows) {
    const hit = !q || (row.dataset.host || '').toLowerCase().includes(q);
    row.style.display = hit ? '' : 'none';
    if (hit) visible++;
  }
  const hasRows = rows.length > 0;
  if (els.listNoMatch) els.listNoMatch.hidden = !(hasRows && visible === 0);
  if (els.listEmpty && hasRows) els.listEmpty.style.display = 'none';
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
  stateEl.title = t('flipTitle') || 'Click to flip on/off';
  stateEl.addEventListener('click', () => toggleEntry(host));
  row.appendChild(stateEl);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'do-row-del';
  del.title = t('delTitle') || 'Remove from list';
  del.setAttribute('aria-label', (t('delTitle') || 'Remove from list') + ' ' + host);
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
    flash(els.listStatus, t('msgEnterDomain') || 'Enter a domain first.', false);
    return;
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    flash(els.listStatus, t('msgInvalidDomain') || 'That doesn\'t look like a valid domain.', false);
    return;
  }
  const settings = await loadSettings();
  const overrides = Object.assign({}, settings.siteOverrides || {});
  overrides[host] = state;
  await saveSettings({ siteOverrides: overrides });
  els.addDomain.value = '';
  flash(els.listStatus, t('msgAdded', [host, state]) || `Added ${host}*${state}.`);
}

// Init

async function refresh() {
  setVersion();
  const settings = await loadSettings();
  for (const r of els.modeRadios) r.checked = (r.value === settings.mode);
  for (const r of els.fontRadios) r.checked = (r.value === settings.font);
  els.fontStatus.textContent = explainCustomFontStatus(settings);
  applyPreviewFont(settings);
  renderList(settings.siteOverrides || {});
  if (els.search) els.search.placeholder = t('searchPlaceholder') || 'Search sites...';
  await refreshWhatsnew(settings);
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
    flash(els.fontStatus, t('msgFontTooLarge', [(f.size/1024/1024).toFixed(1)]) || `Font is too large (${(f.size/1024/1024).toFixed(1)} MB > 8 MB).`, false);
    els.fontFile.value = '';
    return;
  }
  try {
    flash(els.fontStatus, t('msgReadingFont') || 'Reading font...');
    const dataUrl = await fileToDataUrl(f);
    await saveSettings({
      customFontDataUrl: dataUrl,
      customFontName: f.name,
      customFontFormat: inferFontFormat(f),
      font: 'custom'
    });
    els.fontFile.value = '';
    flash(els.fontStatus, t('msgFontLoaded', [f.name, (f.size/1024).toFixed(0)]) || `Loaded ${f.name} (${(f.size/1024).toFixed(0)} KB).`);
  } catch (e) {
    flash(els.fontStatus, (t('msgFontReadFail') || 'Failed to read font') + ': ' + (e && e.message || e), false);
  }
});

els.clearFont.addEventListener('click', async () => {
  await saveSettings({
    customFontDataUrl: '',
    customFontName: '',
    customFontFormat: '',
    font: 'vazirmatn'
  });
  flash(els.fontStatus, t('msgFontRemoved') || 'Custom font removed.');
});


els.addBtn.addEventListener('click', addEntry);
els.addDomain.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addEntry(); }
});
if (els.search) els.search.addEventListener('input', applyFilter);
if (els.whatsnewDismiss) els.whatsnewDismiss.addEventListener('click', async () => {
  let cur = '';
  try { cur = (api.runtime.getManifest() || {}).version || ''; } catch (_) {}
  if (cur) await saveSettings({ seenVersion: cur });
  if (els.whatsnew) els.whatsnew.hidden = true;
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
  flash(els.listStatus, t('msgExported') || 'List exported.');
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
    flash(els.listStatus, count === 1 ? (t('msgImportedOne') || 'Imported 1 entry.') : (t('msgImportedMany', [String(count)]) || `Imported ${count} entries.`));
  } catch (e) {
    flash(els.listStatus, (t('msgImportFail') || 'Import failed') + ': ' + (e && e.message || e), false);
  } finally {
    els.listImportFile.value = '';
  }
});

els.listClear.addEventListener('click', async () => {
  if (!confirm(t('msgConfirmClear') || 'Clear the entire list?')) return;
  await saveSettings({ siteOverrides: {} });
  flash(els.listStatus, t('msgCleared') || 'List cleared.');
});

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' || area === 'sync') refresh();
});

document.addEventListener('DOMContentLoaded', refresh);

applyI18n();
