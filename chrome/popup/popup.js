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

// Ask the page's content script (top frame) for the real state. It knows
// whether the page is an already-RTL Persian/Arabic site we auto-skip.
// Resolves null when no content script is reachable.
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
      'RTL applies everywhere except the sites listed as off.';
  } else {
    els.modeExplainer.textContent =
      'RTL is off by default. Enable it per-site using the switch above.';
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
      if (/^https?:|^file:|^ftp:/.test(u.protocol)) {
        host = u.hostname;
        supported = !!host;
      }
    }
  } catch (_) {}

  if (!supported) {
    els.host.textContent = 'Not available on this page';
    els.toggle.checked = false;
    els.toggle.disabled = true;
    els.modeHint.textContent = 'Open a regular website to toggle.';
    els.status.classList.remove('is-active');
    els.status.classList.add('is-disabled');
    return;
  }

  setFavicon(tab);
  els.host.textContent = host;
  els.toggle.disabled = false;
  els.status.classList.remove('is-disabled');

  // Prefer the content script's real state (covers Persian/Arabic
  // auto-skip); fall back to the storage-only computation.
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
      ? 'Active here (you turned it on)'
      : 'Inactive here (you turned it off)';
  } else if (autoSkipped) {
    els.modeHint.textContent = 'Off by default · already a Persian/Arabic site';
  } else {
    els.modeHint.textContent = enabled ? 'Active on this page' : 'Inactive on this page';
  }
}

els.toggle.addEventListener('change', async () => {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) return;
  // Optimistic: reflect the new state on the hero card immediately.
  els.status.classList.toggle('is-active', els.toggle.checked);
  api.runtime.sendMessage({ type: 'DYNRTL_TOGGLE_CURRENT', tabId: tab.id }, () => {
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
