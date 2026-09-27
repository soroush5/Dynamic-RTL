# Privacy Policy

Last updated: 2026-09-27

Dynamic RTL shows Persian and Arabic text right to left on web pages. It collects no data and makes no network requests.

## What it reads

The content script reads the text of the page you are on to find Persian or Arabic script, and the text you type into inputs to decide their direction. This happens inside your browser only. Nothing is copied, stored or sent anywhere.

## What it stores

| Item | Where |
| --- | --- |
| On for all sites or only chosen ones | Browser sync storage |
| Your site list (for example `example.com: off`) | Browser sync storage |
| Font choice and the name of an uploaded font | Browser sync storage |
| The uploaded font file itself | Local storage on this device |

Sync storage is handled by your browser and only syncs if you have browser sync turned on. The extension has no server.

## Permissions

- `storage`: saves the settings above.
- `activeTab`: lets the popup, shortcut and right-click menu see the address of the tab you use them on.
- `contextMenus`: adds the right-click toggle.
- Access to `http` and `https` pages: needed to run the content script that finds Persian and Arabic text.

## Removing data

Uninstalling the extension removes everything. You can also clear the site list and remove an uploaded font from the settings page.

## Contact

https://github.com/soroush5/Dynamic-RTL/issues
