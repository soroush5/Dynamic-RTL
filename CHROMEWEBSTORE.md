# Chrome Web Store Listing — Dynamic RTL

> Last Updated: 2026-05-23

This document is the single source of truth for the Chrome Web Store listing of the
Chrome build of Dynamic RTL. Copy each section into the matching field in the Chrome
Developer Dashboard at submission time. Do not ship this file inside the extension
zip — it is excluded by `scripts/build-zips.sh`.

## Store Listing

**Extension Name** [REQUIRED]

Dynamic RTL

**Short Description** [REQUIRED] (≤ 132 chars)

Auto-detects Persian and Arabic text on web pages and applies right-to-left direction with the bundled Vazirmatn font.

**Detailed Description** [REQUIRED]

```
Dynamic RTL fixes the experience of reading Persian and Arabic content in any
website by detecting that script automatically and applying the correct text
direction and font - before the page is even rendered.

FEATURES
- Auto-detects Persian and Arabic text in paragraphs, chat bubbles, tweets, search
  results, comments and any other content on the page.
- Live RTL on inputs, textareas and contenteditable editors as you type a single
  Persian or Arabic character. Works on Notion, Gmail, X composer, Claude, Gemini,
  ChatGPT and similar editors.
- Bundles the Vazirmatn variable font (designed by Saber Rastikerdar). No internet
  call, the font ships inside the extension and works offline.
- Custom font upload: replace Vazirmatn with any .woff2 / .woff / .ttf / .otf you
  prefer (8 MB cap), variable fonts recommended.
- Per-site control from the toolbar icon. Pick a global mode - "enable on all" or
  "disable on all" - and the icon click toggles individual exceptions which are
  remembered across sessions.
- The toolbar icon is colored when Dynamic RTL is active on the current page,
  grayscale when it is not, so the state is always visible.
- URL-aware: Persian URLs in Google search results, breadcrumbs and inline links
  keep their proper bidi flow instead of bleeding direction into neighbours.

HOW TO USE
1. Pin the Dynamic RTL icon to your Chrome toolbar.
2. Browse normally. The extension applies RTL and the Vazirmatn font automatically
   wherever it spots Persian or Arabic text.
3. Click the toolbar icon to toggle Dynamic RTL for the current site - the icon
   becomes grayscale and the site is added to your custom site list.
4. Open Settings -> "Settings & custom font" to edit the per-site list, switch the
   default mode, or upload a custom font.

PRIVACY
Dynamic RTL never makes a network call. The bundled Vazirmatn font and all of the
extension code ship inside the package. Your custom site list, font choice and any
font you upload live exclusively in chrome.storage.local on your own device. There
is no telemetry, no analytics, no third party.

PERMISSIONS
- "Read your browsing history" (tabs): used only to read the URL of the current tab
  so the extension knows which hostname to apply your per-site override to.
- "Read and change all your data on websites you visit" (host permissions for
  http://*/* and https://*/*): used to inject the small detection script that
  finds Persian / Arabic text and applies the RTL CSS class. The extension only
  changes direction and font, never the content.

SUPPORT
Source code, issue tracker and feature requests:
https://github.com/soroush5/Dynamic-RTL

Version 2.0 - first public release. See the GitHub releases page for the changelog.
```

**Category** [REQUIRED]

Accessibility

**Single Purpose** [REQUIRED]

Auto-detects Persian and Arabic text on web pages and applies right-to-left text
direction and the Vazirmatn font.

**Primary Language** [REQUIRED]

English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `chrome/icons/icon-active-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | (capture: a Persian web page rendered with Dynamic RTL on, Vazirmatn applied) |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | (capture: the toolbar popup showing per-site toggle and global mode) |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | (capture: the options page with the custom site list and font picker) |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ Not created | (capture: typing Persian into ChatGPT / Claude with live RTL) |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes

Use a real web page (Wikipedia FA, virgool.io, X.com Persian search) for the
demo screenshots, not a synthetic page. The reviewer should be able to see
both Persian and English content in the same shot to demonstrate the bidi
behaviour.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Persists the user's per-site override list, default mode, font choice and (optionally) an uploaded custom font in `chrome.storage.local`. Required so the extension remembers your preferences across sessions. No data leaves the device. |
| `tabs` | permissions | Reads the URL of the active tab to determine its hostname, which is used to look up the per-site override. Without this permission the toolbar popup cannot show or change the on/off state of the current site. |
| `activeTab` | permissions | Defensive permission so the toolbar action keeps working even if the user uses Chrome's "On click" host-access mode that restricts the broader host permissions. |
| `http://*/*`, `https://*/*` | host_permissions | Required to inject the content script that detects Persian / Arabic text on web pages. The script is the entire reason the extension exists - it walks the page DOM, tags blocks containing Persian / Arabic with a CSS class, and updates `dir` on inputs as you type. The script makes no network calls and only changes direction and font. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | n/a | No |
| Health info | No | No | n/a | No |
| Financial info | No | No | n/a | No |
| Authentication info | No | No | n/a | No |
| Personal communications | No | No | n/a | No |
| Location | No | No | n/a | No |
| Web history | No | No | n/a | No |
| User activity | No | No | n/a | No |
| Website content | No | No | n/a | No |

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

https://github.com/soroush5/Dynamic-RTL/blob/main/PRIVACY.md

The full text of the policy is also stored at the project root in `PRIVACY.md`.

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]

soroush5

**Contact Email** [REQUIRED]

(fill in the publisher email at submission time)

**Support URL** [RECOMMENDED]

https://github.com/soroush5/Dynamic-RTL/issues

**Homepage URL**

https://github.com/soroush5/Dynamic-RTL

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 2.0 | 2026-05-23 | First public release. Chrome MV3 + Firefox MV3 + Obsidian plugin. Auto-detect Persian / Arabic text, RTL direction, bundled Vazirmatn variable font, per-site toggle, custom font upload, native Material 3 / Acorn UI per browser. | Draft |

## Review Notes

### Known Issues / Limitations

- Google Docs / Sheets / Slides render their document area to a `<canvas>` element.
  The extension intentionally skips those canvas regions (RTL via DOM cannot affect
  canvas pixels). Sidebars, comments and menus around the canvas are still styled.
- On Firefox, the build relies on Manifest V3 (Firefox 121+).
- `chrome.storage.local` has a ~10 MB ceiling. The custom-font upload is capped at
  8 MB to stay safely below this.

### Rejection History

(none yet)
