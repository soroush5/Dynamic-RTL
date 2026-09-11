# Chrome Web Store listing — Dynamic RTL (draft for the dashboard)

Fill these into https://chrome.google.com/webstore/devconsole (one-time $5 developer
registration). Nothing here ships inside the extension.

## Title
Dynamic RTL — Persian & Arabic auto direction

## Short description (132 chars max)
Auto-detects Persian and Arabic text on any page and flips it right-to-left with the Vazirmatn font. No signup, no network calls.

## Category
Accessibility

## Language
English (UI also speaks Persian automatically via chrome.i18n)

## Detailed description
Reading Persian or Arabic on the modern web is broken: chat apps, feeds and
docs render your language left-to-right, editors jump around, and mixed
English/Persian lines come out backwards.

Dynamic RTL watches every page you open. The moment it spots Persian or Arabic
text — a paragraph, a chat bubble, a tweet, even the box you type in — it
switches that block to right-to-left and renders it in the bundled Vazirmatn
variable font. Before you even notice.

- Zero flash: styles register before first paint, tagging runs while parsing.
- Safe for editors: inputs use native dir="auto", never fights Notion, ChatGPT, Claude or X composers.
- Code stays LTR: code/pre/kbd blocks and URLs keep their own direction.
- Per-site toggle from the toolbar, global enable/disable modes, custom site list with import/export.
- Upload your own variable font, or keep Vazirmatn.
- Shadow-DOM aware, capped 10 ms work batches, zero cost on English-only pages (font never downloads).
- No account, no network calls, no telemetry. Settings sync across your devices via the browser account (custom font stays on-device).

## Privacy tab
- Single purpose: "Apply right-to-left direction and Persian/Arabic font to detected text."
- Data usage: stores site overrides, mode, font choice and optional uploaded font
  via storage.sync (roams with the browser account) except the uploaded font,
  which stays local. No personal data collected, nothing transmitted.
- Host permission justification: content script must run on http/https pages to
  detect Persian/Arabic text. activeTab just lets the popup read the current
  tab's URL for the per-site toggle.

## Reviewer test instructions
1. Load the zip unpacked, pin the toolbar icon.
2. Open any page with Persian text (e.g. https://fa.wikipedia.org) — paragraphs
   flip RTL with Vazirmatn; English pages are untouched.
3. Click the icon: toggle the site off/on, switch global mode, open Settings,
   upload a font, add a site row manually.

## Assets checklist
- [x] Store icon 128 (icons/icon-active-128.png)
- [x] Screenshots 1280x800 (previews/demo-fa-rtl.png) + popup/options shots
- [x] Small promo tile 440x280 (previews/promo-tile-440x280.png)
- [ ] Marquee promo 1400x560 (optional)
