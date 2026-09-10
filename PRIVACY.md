# Privacy Policy for Dynamic RTL

> Last updated: 2026-05-23

Dynamic RTL is a browser extension and Obsidian plugin that auto-detects
Persian and Arabic text on web pages or in your notes and applies right-to-left
direction with the bundled Vazirmatn font.

## What Data We Collect

Dynamic RTL collects **no personal data**. Specifically, it does not record:

- Browsing history or URLs you visit
- Page content (it only reads text on the current page in order to apply RTL
  direction; the text is never copied, stored, or transmitted)
- Form data or anything you type into inputs (the live RTL on inputs operates
  on the value transiently — nothing is persisted)
- IP address, device identifiers or other identifiers
- Analytics or telemetry of any kind

## What We Store Locally

The extension stores the following on **your own device only**, in
`chrome.storage.local` (browser builds) or your Obsidian vault's plugin data
folder (Obsidian build). None of it leaves the device.

| Stored item | Why |
|-------------|-----|
| Default mode (`enable_all` / `disable_all`) | Remembers whether RTL applies on every site by default or only on the sites you opted in. |
| Custom site list | Per-host overrides you toggled from the toolbar (`google.com -> on`, `gmail.com -> off`, etc.). |
| Font choice and the optional uploaded font file | When you upload a custom font from the options page, the file's bytes are stored locally so the extension can `@font-face` it. The file is never uploaded anywhere. |
| Verbose-logging flag | Off by default. When on, prints labelled traces to the page DevTools console. |

## What Leaves Your Device

**Nothing.** The extension never makes a network call. The Vazirmatn font
ships inside the extension package and is loaded from disk. There is no
analytics endpoint, no remote config, no third-party SDK, no crash reporter.

## Permissions Used

- **`storage`**: stores your preferences locally (see the table above).
- **`tabs`**: reads the URL of the active tab so the toolbar popup knows which
  hostname to toggle. The URL is used in-memory and not stored.
- **`activeTab`**: enables the toolbar action under Chrome's "On click" host
  access mode.
- **Host permissions** for `http://*/*` and `https://*/*`: required to inject
  the content script that detects Persian / Arabic text and applies the RTL
  CSS class. The script never reads form inputs, cookies, local storage, or
  any other site data.

## Third-Party Services

Dynamic RTL does not use any third-party services, SDKs, analytics or APIs.

## Data Sharing

Dynamic RTL does not share any data with anyone, because it does not collect
any data in the first place. The "user-private" data you create (custom site
list, uploaded font) stays in your browser profile / vault.

## Data Retention and Deletion

- Per-site list, font choice and the optional custom font live in your
  browser profile or Obsidian vault. Removing the extension or the plugin
  removes them with it.
- You can also clear the custom site list and remove the uploaded font from
  the extension's Options page (or the Obsidian Settings tab) at any time.

## Children's Privacy

Dynamic RTL is not directed at children under 13 and does not knowingly
collect any data from anyone, including children.

## Changes to This Policy

If the privacy practices ever change (for example, if a future version adds
a feature that requires a network call), this document will be updated and
the change will be noted in the Chrome Web Store version history. The
"Last updated" date at the top of this document will be bumped accordingly.

## Contact

Issues, questions, or privacy reports: please open an issue at
https://github.com/so-roush/Dynamic-RTL/issues
