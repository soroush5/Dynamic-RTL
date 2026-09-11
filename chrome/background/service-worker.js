/* Background: toolbar icon, per-site toggle, install migration. Event-driven only. */
'use strict';
const api = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : browser;
const DEF = { mode: 'enable_all', siteOverrides: {}, font: 'vazirmatn', customFontDataUrl: '', customFontName: '', customFontFormat: '', debug: !1 };
const sget = (k) => new Promise((r) => { try { api.storage.local.get(k, (x) => { void api.runtime.lastError; r(x || {}) }) } catch (_) { r({}) } });
const sset = (p) => new Promise((r) => { try { api.storage.local.set(p, () => { void api.runtime.lastError; r() }) } catch (_) { r() } });
const sdel = (k) => new Promise((r) => { try { api.storage.local.remove(k, () => { void api.runtime.lastError; r() }) } catch (_) { r() } });
const tq = (q) => new Promise((r) => { try { api.tabs.query(q, (t) => { void api.runtime.lastError; r(t || []) }) } catch (_) { r([]) } });
function tmsg(tabId, msg) { return new Promise((res) => { try { api.tabs.sendMessage(tabId, msg, { frameId: 0 }, (rp) => { void api.runtime.lastError; res(rp || null) }) } catch (_) { res(null) } }) }
function setIcon(o) { try { const r = api.action.setIcon(o); if (r && r.then) r.catch(() => {}) } catch (_) {} }
const normH = (h) => (h || '').toLowerCase().replace(/^www\./, '');
function findOv(o, h) { if (!o) return null; h = normH(h); if (!h) return null; if (o[h]) return o[h]; const p = h.split('.'); for (let i = 1; i < p.length - 1; i++) { const q = p.slice(i).join('.'); if (o[q]) return o[q] } return null }
function siteOn(s, h) { const o = findOv(s.siteOverrides, h); if (o === 'on') return !0; if (o === 'off') return !1; return s.mode === 'enable_all' }
async function loadS() { return Object.assign({}, DEF, await sget(null)) }
// Hostnames come from the popup (which sees the URL via activeTab) or from
// the page itself. Only shapes like a hostname are accepted.
function cleanHost(h) {
  h = normH(String(h || ''));
  if (!h || h.length > 253 || /[\s/:?#@]/.test(h)) return '';
  return h;
}
async function getState(tabId) { return tmsg(tabId, { type: 'DYNRTL_GET_STATE' }) }
const ICON_ON = { 16: 'icons/icon-active-16.png', 32: 'icons/icon-active-32.png', 48: 'icons/icon-active-48.png', 128: 'icons/icon-active-128.png' };
const ICON_OFF = { 16: 'icons/icon-inactive-16.png', 32: 'icons/icon-inactive-32.png', 48: 'icons/icon-inactive-48.png', 128: 'icons/icon-inactive-128.png' };
// The page itself is the source of truth: it knows about auto-skipped RTL
// sites, which the background cannot see without the tabs permission.
async function paint(tabId) {
  try {
    if (tabId == null) return;
    const st = await getState(tabId);
    const on = !!(st && st.active === true);
    setIcon({ tabId, path: on ? ICON_ON : ICON_OFF });
  } catch (_) {}
}
async function paintAll() {
  try {
    const tabs = await tq({});
    await Promise.all(tabs.map((t) => paint(t && t.id)));
  } catch (_) {}
}
async function toggle(tabId, hostHint) {
  if (tabId == null) return { ok: !1, reason: 'no-tab' };
  let host = cleanHost(hostHint);
  let cur = null;
  const st = await getState(tabId);
  if (st && typeof st.active === 'boolean') cur = st.active;
  if (!host && st && st.host) host = cleanHost(st.host);
  if (!host) return { ok: !1, reason: 'no-host' };
  if (cur === null) cur = siteOn(await loadS(), host);
  const s = await loadS(), ov = Object.assign({}, s.siteOverrides || {});
  const next = cur ? 'off' : 'on';
  ov[normH(host)] = next;
  await sset({ siteOverrides: ov });
  try { api.tabs.sendMessage(tabId, { type: 'DYNRTL_RECONCILE' }, () => void api.runtime.lastError) } catch (_) {}
  await paint(tabId);
  return { ok: !0, host: normH(host), state: next };
}
// Keyboard shortcut path: same toggle, host taken from the page.
async function commandToggle(tabId) {
  if (tabId == null) return { ok: !1, reason: 'no-tab' };
  const st = await getState(tabId);
  if (!st || !st.host) return { ok: !1, reason: 'no-host' };
  return toggle(tabId, st.host);
}
async function migrate() {
  try {
    const st = await sget(null);
    const patch = {};
    let mg = !1;
    if (Array.isArray(st.exceptions) && st.exceptions.length) {
      const ov = Object.assign({}, st.siteOverrides || {});
      const off = (st.mode || DEF.mode) === 'enable_all' ? 'off' : 'on';
      for (const e of st.exceptions) { const h = normH(e); if (h && !ov[h]) ov[h] = off }
      patch.siteOverrides = ov; mg = !0;
    }
    if (mg) await sset(patch);
    const leg = ['exceptions', 'enabled', 'autoDetectInputs'].filter((k) => k in st);
    if (leg.length) await sdel(leg);
  } catch (e) { console.error('[Dynamic RTL] migration error', e) }
}
async function seed() {
  try {
    const st = await loadS();
    const p = {};
    for (const k of Object.keys(DEF)) if (st[k] === undefined) p[k] = DEF[k];
    if (Object.keys(p).length) await sset(p);
  } catch (e) { console.error('[Dynamic RTL] seed error', e) }
}
api.runtime.onInstalled.addListener(async () => { await migrate(); await seed(); paintAll() });
if (api.runtime.onStartup && api.runtime.onStartup.addListener) api.runtime.onStartup.addListener(async () => { await migrate(); paintAll() });
api.tabs.onActivated.addListener(({ tabId }) => { paint(tabId) });
api.tabs.onUpdated.addListener((tabId, ci) => { if (ci.status === 'loading' || ci.url) paint(tabId) });
api.storage.onChanged.addListener((ch, area) => { if (area !== 'local') return; if ('siteOverrides' in ch || 'mode' in ch) paintAll() });
if (api.commands && api.commands.onCommand) api.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'toggle-site' && tab && tab.id != null) commandToggle(tab.id);
});
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'DYNRTL_TOGGLE_CURRENT') {
    const id = msg.tabId || (sender.tab && sender.tab.id);
    if (id == null) { sendResponse({ ok: !1, reason: 'no-tab' }); return !0 }
    toggle(id, msg.host).then(sendResponse).catch((e) => sendResponse({ ok: !1, reason: 'error', error: String(e) }));
    return !0;
  }
  if (msg.type === 'DYNRTL_REFRESH_ICONS') { paintAll().then(() => sendResponse({ ok: !0 })); return !0 }
  if (msg.type === 'DYNRTL_REPORT_STATE') {
    const id = sender.tab && sender.tab.id;
    if (id != null) setIcon({ tabId: id, path: msg.active ? ICON_ON : ICON_OFF });
    sendResponse({ ok: !0 });
    return !0;
  }
});
