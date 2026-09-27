// Background: toolbar icon, keyboard shortcut and right-click toggle.
// Stays asleep unless one of these events fires.
'use strict';

if (typeof importScripts === 'function') importScripts('lib/store.js');

const api = Store.api;
const icons = (state) => Object.fromEntries([16, 32, 48, 128].map((s) => [s, `icons/${state}-${s}.png`]));
const ICON_ON = icons('on');
const ICON_OFF = icons('off');

// The default icon follows the global mode. Pages only report when they differ.
async function paintDefault() {
  const { mode } = await Store.load();
  api.action.setIcon({ path: mode === 'disable_all' ? ICON_OFF : ICON_ON }).catch(() => {});
}

function paintTab(tabId, on) {
  api.action.setIcon({ tabId, path: on ? ICON_ON : ICON_OFF }).catch(() => {});
}

async function setupMenu() {
  await api.contextMenus.removeAll();
  api.contextMenus.create({ id: 'toggle', title: api.i18n.getMessage('menuToggle'), contexts: ['page'] });
}

api.runtime.onInstalled.addListener(({ reason }) => {
  setupMenu();
  paintDefault();
  if (reason === 'install') api.tabs.create({ url: api.runtime.getURL('welcome/welcome.html') });
});

api.runtime.onStartup.addListener(paintDefault);

api.storage.onChanged.addListener((ch) => {
  if ('mode' in ch) paintDefault();
});

api.runtime.onMessage.addListener((m, sender) => {
  if (m?.t === 'icon' && sender.tab?.id != null) paintTab(sender.tab.id, m.on);
});

api.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'toggle-site' && tab) Store.toggle(tab);
});

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggle' && tab) Store.toggle(tab);
});
