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
  optionsBtn: document.getElementById('dr-open-options')
};

const DEFAULTS = {
  mode: 'enable_all',
  siteOverrides: {}
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

document.addEventListener('DOMContentLoaded', refresh);

try {
  const vn = document.getElementById('dr-version');
  if (vn && api.runtime.getManifest) vn.textContent = 'v' + api.runtime.getManifest().version;
} catch (_) {}

applyI18n();
