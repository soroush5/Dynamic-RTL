# Dynamic RTL

> Auto-detects Persian and Arabic text on web pages, then instantly applies the right direction (RTL) and a comfortable font - before you even see the page.

[![Version](https://img.shields.io/badge/version-2.3-5b6cff)](#release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](#install-on-chrome--edge--brave--arc)
[![Firefox](https://img.shields.io/badge/Firefox-MV3-FF7139?logo=firefox&logoColor=white)](#install-on-firefox)


Dynamic RTL watches every page you open and, the moment it spots Persian or Arabic text - in a paragraph, a chat bubble, a tweet, or even an input field - it switches that element to right-to-left direction and renders it with the **Vazirmatn** variable font.

It is shipped as **two separate builds** that share the same detection logic and default font, but each follows the design language of its host application:

| Build | Target | Manifest |
| --- | --- | --- |
| **`chrome/`** | Chrome, Edge, Brave, Arc, Opera (Chromium) | MV3 |
| **`firefox/`** | Firefox 121 and newer | MV3 |

Repository: https://github.com/soroush5/Dynamic-RTL

---

## Table of contents

- [What it does](#what-it-does)
- [Highlights](#highlights)
- [Install](#install)
  - [Install on Chrome / Edge / Brave / Arc](#install-on-chrome--edge--brave--arc)
  - [Install on Firefox](#install-on-firefox)
- [Using the browser extensions](#using-the-browser-extensions)
- [Custom variable font](#custom-variable-font)
- [Sites we keep an eye on](#sites-we-keep-an-eye-on)
- [Performance](#performance)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Repository layout](#repository-layout)
- [Building from source](#building-from-source)
- [Credits](#credits)
- [License](#license)

---

## What it does

When a Dynamic RTL build is active:

1. **Pages** — at `document_start` (before the body is parsed) it injects a stylesheet that registers the bundled Vazirmatn variable font and a CSS class called `.dynrtl-rtl`. As the DOM is parsed and as new content streams in (chat messages, tweets, search results), a `TreeWalker` + `MutationObserver` finds Persian / Arabic text and tags the nearest block ancestor.
2. **Inputs / contenteditable** — a capture-phase listener flips `dir="auto"` and `text-align` on `<input>`, `<textarea>` and `[contenteditable]` as you type, even on a single Persian character. The CSS class never sets `direction: rtl !important` on editors, which would break editor frameworks like Slate / Lexical / ProseMirror used by Claude, Notion, X, Gemini, etc.

It supports **Persian (fa)**, **Arabic (ar)** and any script in the Arabic Unicode blocks (`U+0600-U+06FF`, `U+0750-U+077F`, `U+08A0-U+08FF`, `U+FB50-U+FDFF`, `U+FE70-U+FEFF`).

## Highlights

- **No flash**: in browsers, font and base styles are registered before first paint via a `document_start` content script.
- **Native look per host**: each build follows the design language of its host:
  - **Chrome** popup / options use Material 3 (Chrome 130+ tokens): rounded surfaces, sliding switches, pill-shaped chips, primary blue `#0b57d0`, subtle scale + fade entrance.
  - **Firefox** popup / options use Acorn / Proton (Firefox 130+ tokens): tighter 4-8 px radii, thin-bordered cards, outlined switches and radio rings, accent `#0061e0` / `#00ddff`.

- **Per-site control**: click the toolbar icon to toggle the current site. Choose between two default modes:
  - *Enable on all sites* (default) - sites you turn off are remembered as `domain*off`.
  - *Disable on all sites* - sites you turn on are remembered as `domain*on`.
- **Local font**: Vazirmatn is bundled with every build. No external request, no CDN dependency.
- **Custom variable font**: upload your own `.woff2 / .woff / .ttf / .otf` file from settings. Variable fonts are recommended (one file, every weight, smaller, sharper).
- **Live editor support**: works on inputs, textareas and `contenteditable` editors as you type a single character. Uses the W3C `dir="auto"` attribute, never breaks editor internals.
- **Built for dynamic apps**: ChatGPT, Claude, X.com, Notion, Google services, Gemini - dynamic content gets RTL'd as it streams in.
- **URL-aware bidi**: inline `cite / code / kbd / samp / var / pre` inside RTL blocks keep their own LTR context, so URLs in Google search results no longer read backwards.
- **Shadow DOM aware**: the content script descends into open shadow roots, so Web-Component-based UIs get the same treatment as light DOM.
- **Performance budget**: observer only queues, a debounced flush walks with a 10 ms / 1000-node ceiling, expando flags replace WeakSets, and `all_frames` stays off — tagging never blocks the page.
- **Diagnostic logging**: a debug toggle prints labelled traces to DevTools.

## Install

> Pre-built bundles for v2.3 live on the [Releases page](https://github.com/soroush5/Dynamic-RTL/releases) as `dynamic-rtl-chrome-v2.3.zip` and `dynamic-rtl-firefox-v2.3.zip`. They are also checked in under [`resources/`](./resources) for offline access.

### Install on Chrome / Edge / Brave / Arc

1. Download `dynamic-rtl-chrome-v2.3.zip` and extract it (for example to `~/Extensions/dynamic-rtl-chrome`).
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, etc.).
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. The Dynamic RTL icon appears in your toolbar. Pin it for quick access. The icon is colored when active on the current site, grayscale when inactive.

> Updating: download the new zip, replace the folder, click the reload icon on the extension card.

### Install on Firefox

Firefox blocks unsigned extensions on the regular release channel. Three supported paths:

**Path A — temporary install (any Firefox):**

1. Download `dynamic-rtl-firefox-v2.3.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** and select the `manifest.json` file inside the (extracted) zip.
4. The extension stays installed until you restart Firefox.

**Path B — permanent install (Developer Edition / Nightly / ESR):**

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
Rename `dynamic-rtl-firefox-v2.3.zip` to `dynamic-rtl-firefox-v2.3.xpi`.
3. Drag the `.xpi` file into Firefox and click **Add**.

**Path C — regular Firefox (recommended once published):** install from `https://addons.mozilla.org/` once the build is signed by Mozilla.

## Using the browser extensions

- Click the toolbar icon to open the popup. The icon is **colored** when Dynamic RTL is active on the current page, and **grayscale** when it isn't.
- The toggle at the top enables / disables RTL on the current site. Each toggle is recorded as an explicit override (`domain*on` or `domain*off`) in the custom site list.
- Use the segmented control to flip between *Enable on all sites* and *Disable on all sites*. This default applies to sites without an explicit entry. Your custom site list is preserved when you switch modes.
- Click **Settings & custom font** to open the full options page. There you can edit the custom site list directly, change fonts, and turn on debug logging.

## Custom variable font

Every build ships with **Vazirmatn** — the variable cut, with a continuous `wght` axis from 100 to 900. To replace it, use the **Font** section of the settings page in your build of choice and upload a `.woff2 / .woff / .ttf / .otf` file (up to 8 MB).

> **Why variable fonts?** A single variable font file covers every weight, looks crisp at every size, and uses less memory than shipping nine static cuts.

## Sites we keep an eye on

Special care has been taken to make Dynamic RTL behave on heavy SPAs:

- **ChatGPT** (`chat.openai.com`, `chatgpt.com`) — streamed message tokens, ProseMirror composer.
- **Claude** (`claude.ai`) — streamed conversations, prompt editor.
- **Gemini** (`gemini.google.com`) — composer + streamed responses.
- **X / Twitter** (`x.com`, `twitter.com`) — virtualised timelines, replies, the composer.
- **Notion** — per-block contenteditable, slash menu.
- **Google services** — Gmail composer (contenteditable), Calendar, Search, YouTube comments. URL / breadcrumb fragments inside RTL search results stay in LTR via `unicode-bidi: isolate`.
- **Google Docs / Sheets / Slides** — the canvas-rendered document area is intentionally skipped; comments, sidebars and menus are styled normally.
- **Telegram Web, WhatsApp Web, Discord, Slack, Reddit, Stack Overflow, GitHub, app.kiro.dev** — covered by the generic mutation observer + shadow-DOM walker.

If you hit a site that misbehaves, reload the page, open DevTools and check the console for errors for the bug report.

## Performance

- Tagging is done by adding a single CSS class — never inline styles — so style recalculation is fast and reversible.
- Touched elements carry a tiny expando flag, so already-tagged subtrees bail out in a few pointer hops with zero GC pressure.
- The observer callback only queues dirty roots; a debounced flush walks them with a 10 ms / 1000-node budget, then yields the thread.
- While the page is still parsing, the first flush runs pre-paint (no idle wait), so pages render with RTL already applied; idle scheduling only applies after load.
- The text walk is a single `TreeWalker` pass that also discovers open shadow roots and rejects `<script>`, `<style>`, `<code>`, `<pre>`, canvas editors and contenteditable subtrees.
- `all_frames` is off, so ads and iframes cost nothing.
- The font uses a `unicode-range` limited to Arabic-script blocks, so English-only pages never download it.

## Privacy

Dynamic RTL does not call the network. Ever.

- The Vazirmatn font is bundled inside every build.
- Per-site list, custom font, and other preferences live in `chrome.storage.local` on your machine.
- There is no telemetry, no analytics, and no remote configuration.

The browser builds request `storage`, `tabs` and `activeTab` permission, plus host permission for `http://*/*` and `https://*/*`. The host permission is required because the extension needs to run a content script on every site you visit to detect Persian / Arabic text.

## Troubleshooting

The content script stays silent by design. If something looks wrong, work through these:

Common fixes:

| Symptom | Try |
| --- | --- |
| Font does not change but direction is correct | Make sure the toolbar icon is colored (active). Reload the page once to give the font cache a chance. |
| A specific site looks wrong | Click the toolbar icon to toggle it off. The site is recorded in your custom site list. |
| Custom font does not load | The file must be `.woff2`, `.woff`, `.ttf` or `.otf` and smaller than 8 MB. Variable fonts must include the `wght` axis. |
| Nothing happens at all | Open the options page, check the default mode and the custom site list. Then open DevTools and look for errors. |


## Repository layout

```
.
+-- chrome/                     Chrome MV3 build (use this for Chromium browsers)
|   +-- manifest.json
|   +-- background/service-worker.js
|   +-- content/                early-inject.js, main.js
|   +-- popup/                  popup.html / popup.css / popup.js  (Material 3)
|   +-- options/                options.html / options.css / options.js
|   +-- fonts/                  Vazirmatn-Variable.woff2
|   +-- icons/                  active + inactive icons (16 / 32 / 48 / 128)
+-- firefox/                    Firefox MV3 build (Acorn / Proton styling)
+-- safari/                     Safari MV3 build (same code as chrome/, load as Temporary Extension)
+-- resources/                  Pre-built zip packages for both builds
+-- scripts/build-zips.sh       Re-create the release packages
+-- LICENSE
+-- README.md
```

## Building from source

You do not need a build step. To recreate the release zips:

```bash
./scripts/build-zips.sh
```

This produces:

```text
resources/dynamic-rtl-chrome-v2.3.zip
resources/dynamic-rtl-firefox-v2.3.zip
```

## Credits

- **Developer:** [soroush5](https://github.com/soroush5)
- **Default font:** [Vazirmatn](https://github.com/rastikerdar/vazirmatn) by Saber Rastikerdar (Open Font License)

## License

Dynamic RTL is released under the [MIT License](LICENSE). The bundled Vazirmatn font is licensed under the SIL Open Font License 1.1.
