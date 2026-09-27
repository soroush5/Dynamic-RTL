'use strict';

const api = Store.api;
const $ = (id) => document.getElementById(id);
const MAX_FONT = 8 * 1024 * 1024;
let settings = Store.DEFAULTS;
let previewFace = null;

async function render() {
  settings = await Store.load();
  $('mode').checked = settings.mode !== 'disable_all';

  const custom = settings.font === 'custom' && settings.customFontName;
  $('font-name').textContent = custom ? settings.customFontName : 'Vazirmatn';
  $('font-reset').hidden = !custom;
  renderPreview(custom);
  renderList();
}

async function renderPreview(custom) {
  let src = `url("${api.runtime.getURL('fonts/vazirmatn.woff2')}")`;
  if (custom) {
    const { customFontDataUrl: url } = await api.storage.local.get('customFontDataUrl');
    if (url) src = `url("${url}")`;
  }
  const face = new FontFace('Preview', src, { weight: '100 900' });
  if (previewFace) document.fonts.delete(previewFace);
  document.fonts.add(face);
  previewFace = face;
}

// Sites

function renderList() {
  const map = settings.siteOverrides || {};
  const query = Store.cleanHost($('site').value) || $('site').value.trim().toLowerCase();
  const hosts = Object.keys(map).sort();
  const shown = hosts.filter((h) => !query || h.includes(query));
  const list = $('list');
  list.replaceChildren(...shown.map((h) => row(h, map[h])));
  $('empty').hidden = shown.length > 0;
  $('empty').textContent = t(hosts.length ? 'sitesNoMatch' : 'sitesEmpty');
}

function row(host, state) {
  const li = document.createElement('li');
  const name = document.createElement('span');
  name.className = 'host';
  name.textContent = host;

  const pill = document.createElement('button');
  pill.className = 'state' + (state === 'on' ? ' on' : '');
  pill.textContent = t(state === 'on' ? 'on' : 'off');
  pill.title = t('flip');
  pill.addEventListener('click', () => setSite(host, state === 'on' ? 'off' : 'on'));

  const remove = document.createElement('button');
  remove.className = 'remove';
  remove.textContent = '×';
  remove.title = t('remove');
  remove.setAttribute('aria-label', `${t('remove')} ${host}`);
  remove.addEventListener('click', () => setSite(host, null));

  li.append(name, pill, remove);
  return li;
}

async function setSite(host, state) {
  const map = { ...(await Store.load()).siteOverrides };
  if (state) map[host] = state;
  else delete map[host];
  await Store.save({ siteOverrides: map });
}

function showError(key) {
  $('site-error').textContent = key ? t(key) : '';
  $('site-error').hidden = !key;
}

$('add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const host = Store.cleanHost($('site').value);
  if (!host || !host.includes('.')) return showError('invalidSite');
  showError(null);
  // A new rule is the opposite of the default, otherwise it would do nothing.
  await setSite(host, settings.mode === 'disable_all' ? 'on' : 'off');
  $('site').value = '';
});

$('site').addEventListener('input', () => {
  showError(null);
  renderList();
});

$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(settings.siteOverrides || {}, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dynamic-rtl-sites.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('import').addEventListener('click', () => $('import-file').click());

// Takes the exported JSON, or plain lines like "example.com on" / "example.com*off".
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const text = await file.text();
  let entries;
  try {
    entries = Object.entries(JSON.parse(text));
  } catch {
    entries = text.split(/\r?\n/).map((line) => line.trim().split(/[\s*=:,]+/));
  }
  const map = { ...(await Store.load()).siteOverrides };
  let count = 0;
  for (const [h, v] of entries) {
    const host = Store.cleanHost(h);
    const state = String(v).toLowerCase();
    if (host && (state === 'on' || state === 'off')) {
      map[host] = state;
      count++;
    }
  }
  await Store.save({ siteOverrides: map });
  alert(t('imported', [String(count)]));
});

$('clear').addEventListener('click', async () => {
  if (confirm(t('clearConfirm'))) await Store.save({ siteOverrides: {} });
});

// General

$('mode').addEventListener('change', (e) => {
  Store.save({ mode: e.target.checked ? 'enable_all' : 'disable_all' });
});

async function showShortcut() {
  const commands = await api.commands.getAll();
  const cmd = commands.find((c) => c.name === 'toggle-site');
  $('shortcut').textContent = cmd?.shortcut || t('shortcutNone');
  const scheme = location.protocol;
  const hint = scheme === 'moz-extension:' ? 'shortcutFirefox'
    : scheme === 'safari-web-extension:' ? 'shortcutSafari' : 'shortcutChrome';
  $('shortcut-hint').textContent = t(hint);
}

// Font

$('font-pick').addEventListener('click', () => $('font-file').click());

$('font-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > MAX_FONT) return fontMessage('fontTooBig');
  if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) return fontMessage('fontBad');
  const url = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve('');
    r.readAsDataURL(file);
  });
  try {
    await new FontFace('Check', `url("${url}")`).load();
  } catch {
    return fontMessage('fontBad');
  }
  await api.storage.local.set({ customFontDataUrl: url });
  await Store.save({ font: 'custom', customFontName: file.name });
  fontMessage(null);
});

$('font-reset').addEventListener('click', async () => {
  await api.storage.local.remove(['customFontDataUrl', 'customFontFormat']);
  await Store.save({ font: 'vazirmatn', customFontName: '' });
});

function fontMessage(key) {
  $('font-hint').textContent = t(key || 'fontHint');
  $('font-hint').classList.toggle('error', !!key);
}

api.storage.onChanged.addListener(render);
render();
showShortcut();
