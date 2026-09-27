'use strict';

const api = Store.api;
const $ = (id) => document.getElementById(id);
let tab = null;
let page = null;

function show(on) {
  $('toggle').checked = on;
  let key = on ? 'statusOn' : 'statusOff';
  if (!on && page?.auto) key = 'statusAuto';
  if (!page) key = 'statusReload';
  $('status').textContent = t(key);
}

async function init() {
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const host = Store.hostOf(tab?.url);
  if (!host) {
    $('host').textContent = t('unavailable');
    $('status').textContent = t('unavailableHint');
    return;
  }
  $('host').textContent = host;
  let s;
  [s, page] = await Promise.all([Store.load(), Store.pageState(tab.id)]);
  const rule = Store.lookup(s.siteOverrides, host);
  show(page ? page.on : rule ? rule === 'on' : s.mode !== 'disable_all');
  $('toggle').disabled = false;
}

$('toggle').addEventListener('change', async () => {
  // The page picks up the new rule from storage by itself.
  show(await Store.toggle(tab));
});

$('settings').addEventListener('click', () => {
  api.runtime.openOptionsPage();
  window.close();
});

// Opens a prefilled GitHub issue. Nothing is sent until the user submits it.
$('report').addEventListener('click', () => {
  const host = Store.hostOf(tab?.url) || 'unknown';
  const body = `Site: ${host}\nVersion: ${api.runtime.getManifest().version}\nBrowser: ${navigator.userAgent}\n\nWhat looks wrong:\n`;
  const url = 'https://github.com/soroush5/Dynamic-RTL/issues/new?title=' +
    encodeURIComponent(`Broken site: ${host}`) + '&body=' + encodeURIComponent(body);
  api.tabs.create({ url });
  window.close();
});

init();
