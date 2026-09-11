# AMO submit — Dynamic RTL Firefox build (free, no paid account needed)

Sign in at https://addons.mozilla.org/developers/ with a Firefox Account,
then Submit a New Add-on → "On this site" (listed, gets auto-updates).

## Package
Upload `resources/dynamic-rtl-firefox-vX.zip` as-is. It already contains:
- `browser_specific_settings.gecko.id` (stable update identity)
- `data_collection_permissions` empty (we collect nothing)
- human-readable source, no bundler, no minification, no remote code

`web-ext lint` result: **0 errors**. Two warnings, both benign:
- `UNSAFE_VAR_ASSIGNMENT` (innerHTML): only used to render the extension's own
  bundled `_locales` strings into four static help paragraphs. No user input,
  page content or storage data ever reaches innerHTML (lists use textContent).
- `MISSING_DATA_COLLECTION_PERMISSIONS`: resolved, key present and empty.

## Version notes for the reviewer
- Permissions: `storage` (settings), `activeTab` (read current tab URL for the
  per-site toggle). No `tabs`, no cookies/history access, no remote hosts.
- Content scripts match http/https only, `all_frames: false`, `document_start`.
- No network calls anywhere (content, popup, options, background).

## Test instructions for the reviewer
1. Install, pin the toolbar icon.
2. Open any Persian page (e.g. https://fa.wikipedia.org): paragraphs flip RTL
   with Vazirmatn; English pages are untouched.
3. Toolbar icon → toggle the site, switch global mode, open Settings, upload
   a font, add/remove a site row. Set the browser UI to Persian to see the
   fully translated fa UI (chrome.i18n).
