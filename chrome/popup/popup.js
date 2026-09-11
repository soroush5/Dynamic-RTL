/* Dynamic RTL - popup */
'use strict';

const api = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : browser;

const els = {
  status: document.getElementById('dr-status'),
  favicon: document.getElementById('dr-favicon'),
  host: document.getElementById('dr-host'),
  toggle: document.getElementById('dr-site-toggle'),
  modeHint: document.getElementById('dr-mode-hint'),
  modeExplainer: document.getElementById('dr-mode-explainer'),
  modeRadios: document.querySelectorAll('input[name="dr-mode"]'),
  optionsBtn: document.getElementById('dr-open-options'),
  reportBtn: document.getElementById('dr-report')
};

const DEFAULTS = {
  mode: 'enable_all',
  siteOverrides: {}
};
// Sync-backed store, shared shape with the background page: everything but a
// bulky custom font roams via the browser account; local is the fallback.
const SYNCABLE = ['mode', 'siteOverrides', 'font', 'customFontName', 'customFontFormat', 'debug', 'seenVersion'];
const hasSync = !!(api.storage && api.storage.sync);
const rawGet = (area, k) => new Promise((res) => { try { api.storage[area].get(k, (x) => { void api.runtime.lastError; res(x || {}) }) } catch (_) { res({}) } });
const rawSet = (area, p) => new Promise((res) => { try { api.storage[area].set(p, () => { void api.runtime.lastError; res() }) } catch (_) { res() } });
const rawDel = (area, k) => new Promise((res) => { try { api.storage[area].remove(k, () => { void api.runtime.lastError; res() }) } catch (_) { res() } });

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
    let rtl = false;
    try { rtl = /^fa\b/i.test((api.i18n && api.i18n.getUILanguage && api.i18n.getUILanguage()) || ''); } catch (_) {}
    document.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = rtl ? 'fa' : 'en';
  } catch (_) {}
}


function normalizeHost(h) { return (h || '').toLowerCase().replace(/^www\./, ''); }

function findOverride(overrides, host) {
  if (!overrides) return null;
  host = normalizeHost(host);
  if (!host) return null;
  if (overrides[host]) return overrides[host];
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (overrides[parent]) return overrides[parent];
  }
  return null;
}
function isSiteEnabled(settings, host) {
  const override = findOverride(settings.siteOverrides, host);
  if (override === 'on') return true;
  if (override === 'off') return false;
  return settings.mode === 'enable_all';
}

function getCurrentTab() {
  return new Promise(resolve => {
    api.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]));
  });
}

// Ask the top frame for the live state (it knows about auto-skipped RTL pages).
function getTabState(tabId) {
  return new Promise(resolve => {
    try {
      api.tabs.sendMessage(tabId, { type: 'DYNRTL_GET_STATE' }, { frameId: 0 }, resp => {
        void api.runtime.lastError;
        resolve(resp || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function setFavicon(tab) {
  if (!els.favicon) return;
  const url = tab && tab.favIconUrl;
  if (url && /^https?:|^data:/.test(url)) {
    const img = new Image();
    img.alt = '';
    img.onload = () => { els.favicon.textContent = ''; els.favicon.appendChild(img); };
    img.onerror = () => {};
    img.src = url;
  }
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

function setModeUI(mode) {
  for (const r of els.modeRadios) r.checked = (r.value === mode);
  if (mode === 'enable_all') {
    els.modeExplainer.textContent =
      (t('explainerEnable') || 'RTL applies everywhere except the sites listed as off.');
  } else {
    els.modeExplainer.textContent =
      (t('explainerDisable') || 'RTL is off by default. Enable it per-site using the switch above.');
  }
}

async function refresh() {
  const [settings, tab] = await Promise.all([loadSettings(), getCurrentTab()]);
  setModeUI(settings.mode);
  let host = '';
  let supported = false;
  try {
    if (tab && tab.url) {
      const u = new URL(tab.url);
      if (/^https?:/.test(u.protocol)) {
        host = u.hostname;
        supported = !!host;
      }
    }
  } catch (_) {}

  if (!supported) {
    els.host.textContent = t('modeHintUnsupported') || 'Not available on this page';
    els.toggle.checked = false;
    els.toggle.disabled = true;
    els.modeHint.textContent = t('modeHintOpenRegular') || 'Open a regular website to toggle.';
    els.status.classList.remove('is-active');
    els.status.classList.add('is-disabled');
    return;
  }

  setFavicon(tab);
  els.host.textContent = host;
  lastReportHost = host;
  els.toggle.disabled = false;
  els.status.classList.remove('is-disabled');

  // Trust the page when reachable, storage math otherwise.
  const state = tab && tab.id != null ? await getTabState(tab.id) : null;
  let enabled, autoSkipped = false;
  if (state && typeof state.active === 'boolean') {
    enabled = state.active;
    autoSkipped = !!state.autoSkipped;
  } else {
    enabled = isSiteEnabled(settings, host);
  }

  els.toggle.checked = enabled;
  els.status.classList.toggle('is-active', enabled);

  const override = findOverride(settings.siteOverrides, host);
  if (override) {
    els.modeHint.textContent = enabled
      ? (t('modeHintExplicitOn') || 'Active here (you turned it on)')
      : (t('modeHintExplicitOff') || 'Inactive here (you turned it off)');
  } else if (autoSkipped) {
    els.modeHint.textContent = (t('modeHintAutoSkip') || 'Off by default · already a Persian/Arabic site');
  } else {
    els.modeHint.textContent = enabled ? (t('modeHintOn') || 'Active on this page') : (t('modeHintOff') || 'Inactive on this page');
  }
}

els.toggle.addEventListener('change', async () => {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) return;
  let host = '';
  try {
    const u = new URL(tab.url);
    if (/^https?:/.test(u.protocol)) host = u.hostname;
  } catch (_) {}
  // Show the new state right away; refresh confirms it.
  els.status.classList.toggle('is-active', els.toggle.checked);
  api.runtime.sendMessage({ type: 'DYNRTL_TOGGLE_CURRENT', tabId: tab.id, host }, () => {
    refresh();
  });
});

for (const r of els.modeRadios) {
  r.addEventListener('change', async () => {
    if (!r.checked) return;
    await saveSettings({ mode: r.value });
    refresh();
    api.tabs.query({}, tabs => {
      for (const t of tabs) {
        try { api.tabs.sendMessage(t.id, { type: 'DYNRTL_RECONCILE' }, () => void api.runtime.lastError); } catch (_) {}
      }
    });
  });
}

els.optionsBtn.addEventListener('click', () => {
  if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
  else window.open(api.runtime.getURL('options/options.html'));
});

// No server needed: opens a pre-filled GitHub issue with the broken host,
// version and mode already in the body. The user just presses Submit.
let lastReportHost = '';
if (els.reportBtn) els.reportBtn.addEventListener('click', async () => {
  const settings = await loadSettings();
  let version = '';
  try { version = (api.runtime.getManifest() || {}).version || ''; } catch (_) {}
  const title = '[broken-site] ' + (lastReportHost || 'unknown site');
  const body = ['Host: ' + (lastReportHost || '(unknown)'),
    'Version: ' + (version || '(unknown)'),
    'Mode: ' + (settings.mode || '(unknown)'),
    '',
    'What looks wrong:',
    ''].join('\n');
  const url = 'https://github.com/soroush5/Dynamic-RTL/issues/new?title=' +
    encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  try {
    if (api.tabs && api.tabs.create) api.tabs.create({ url });
    else window.open(url, '_blank');
  } catch (_) { window.open(url, '_blank'); }
});

document.addEventListener('DOMContentLoaded', refresh);

try {
  const vn = document.getElementById('dr-version');
  if (vn && api.runtime.getManifest) vn.textContent = 'v' + api.runtime.getManifest().version;
} catch (_) {}

applyI18n();
