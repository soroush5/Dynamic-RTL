# Store listings

Copy these into the Chrome Web Store dashboard and addons.mozilla.org. Not shipped in the zips.

## Name

Dynamic RTL

## Short description (132 chars max)

Shows Persian and Arabic text right to left, in the Vazirmatn font, on any site. Light, private, no account.

## Description

```
Persian and Arabic text on most websites shows up left to right: chat replies, tweets, comments, even the box you type in. Dynamic RTL fixes that.

It finds Persian or Arabic text as a page loads and as new messages stream in, and flips just that paragraph to right to left, with the Vazirmatn font. It happens before the page is painted, so there is no flash.

- Works on AI chats (ChatGPT, Claude, Gemini, Copilot, Perplexity and more), X, Instagram, YouTube, Reddit and other big sites
- English words inside a Persian sentence keep the site's own font
- Code blocks and links keep their own direction
- Chat boxes and inputs: each line gets its own direction as you type
- Lists, tables and headings are handled properly
- Sites that are already right to left are left alone
- Turn any site on or off from the toolbar, with Ctrl+Shift+Y or the right-click menu
- Upload your own font if you prefer
- Very light: pages without Persian or Arabic cost almost nothing
- No network requests, no analytics, no account

Source code: https://github.com/soroush5/Dynamic-RTL
```

## Category and language

Accessibility. English, with a full Persian UI.

## Single purpose (Chrome)

Show Persian and Arabic text on web pages right to left, with a suitable font.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Saves the default mode, site list and font choice. |
| `activeTab` | The popup, shortcut and right-click menu need the address of the tab they act on. |
| `contextMenus` | The right-click toggle. |
| Content script on `http://*/*`, `https://*/*` | Finds Persian and Arabic text on the page and marks it. It changes direction and font only, never content, and makes no network requests. |

## Data use

Collects nothing. Privacy policy: https://github.com/soroush5/Dynamic-RTL/blob/main/PRIVACY.md

## Firefox (AMO)

Upload `resources/dynamic-rtl-firefox-v4.0.1.zip`. It has a fixed add-on ID and `data_collection_permissions: none`. The source is plain, unminified JavaScript, so no separate source upload is needed.

## Reviewer notes

1. Load the extension and open https://en.wikipedia.org/wiki/Persian_language. Persian words and quotes use Vazirmatn; the English article is unchanged.
2. Open https://t.me/s/bbcpersian. Posts are right to left.
3. Type Persian into any text box. It aligns right; English lines stay left.
4. Click the toolbar icon to turn the site off. Everything goes back to normal without a reload.

Google Docs, Sheets and Slides draw their documents on a canvas, so the document area itself cannot be changed. Everything around it works.

## Assets

- Icon: `src/icons/on-128.png`
- Screenshots (1280x800): `previews/demo-chat.png`, plus `previews/popup.png` and `previews/options.png` placed on a 1280x800 canvas
- Small promo tile (440x280): `previews/promo-tile-440x280.png`
