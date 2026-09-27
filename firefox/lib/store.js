// Settings shared by the background, popup and options pages.
'use strict';

const Store = (() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const DEFAULTS = { mode: 'enable_all', siteOverrides: {}, font: 'vazirmatn', customFontName: '' };
  const KEYS = Object.keys(DEFAULTS);
  const local = api.storage.local;
  const sync = api.storage.sync || local;

  // Everything except the font file roams with the browser account.
  // Local copies win: v3 kept values there when sync was full.
  async function load() {
    const [a, b] = await Promise.all([sync.get(KEYS).catch(() => ({})), local.get(KEYS).catch(() => ({}))]);
    return { ...DEFAULTS, ...a, ...b };
  }

  async function save(patch) {
    const roaming = {};
    const device = {};
    for (const k in patch) (KEYS.includes(k) ? roaming : device)[k] = patch[k];
    if (Object.keys(roaming).length) {
      try {
        await sync.set(roaming);
        if (sync !== local) await local.remove(Object.keys(roaming));
      } catch {
        Object.assign(device, roaming); // over the sync quota
      }
    }
    if (Object.keys(device).length) await local.set(device);
  }

  function cleanHost(h) {
    h = String(h || '').trim().toLowerCase()
      .replace(/^[a-z]+:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(h) ? h : '';
  }

  function hostOf(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) ? cleanHost(u.hostname) : '';
    } catch {
      return '';
    }
  }

  function lookup(map, h) {
    for (let d = h; map && d; ) {
      if (map[d]) return map[d];
      d = d.slice(d.indexOf('.') + 1);
      if (!d.includes('.')) break;
    }
    return null;
  }

  async function pageState(tabId) {
    try {
      return await api.tabs.sendMessage(tabId, { t: 'state' }, { frameId: 0 });
    } catch {
      return null;
    }
  }

  // Flips the site in this tab. A rule that matches the default is dropped
  // instead of stored, so the list only holds real exceptions.
  async function toggle(tab) {
    const host = hostOf(tab?.url);
    if (!host) return null;
    const [s, page] = await Promise.all([load(), pageState(tab.id)]);
    const map = { ...s.siteOverrides };
    const fallback = s.mode !== 'disable_all' && !page?.auto;
    const current = page ? page.on : (lookup(map, host) ?? (fallback ? 'on' : 'off')) === 'on';
    const next = !current;
    delete map[host];
    const without = (lookup(map, host) ?? (fallback ? 'on' : 'off')) === 'on';
    if (next !== without) map[host] = next ? 'on' : 'off';
    await save({ siteOverrides: map });
    return next;
  }

  return { api, DEFAULTS, load, save, cleanHost, hostOf, lookup, pageState, toggle };
})();
