# Dynamic RTL

> Auto-detects Persian and Arabic text on web pages and inside Obsidian notes, then instantly applies the right direction (RTL) and a comfortable font - before you even see the page.

[![Version](https://img.shields.io/badge/version-2.2-5b6cff)](#release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](#install-on-chrome--edge--brave--arc)
[![Firefox](https://img.shields.io/badge/Firefox-MV3-FF7139?logo=firefox&logoColor=white)](#install-on-firefox)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.4+-7c3aed?logo=obsidian&logoColor=white)](#install-for-obsidian)

Dynamic RTL watches every page and note you open and, the moment it spots Persian or Arabic text - in a paragraph, a chat bubble, a tweet, or even an input field - it switches that element to right-to-left direction and renders it with the **Vazirmatn** variable font.

It is shipped as **three separate builds** that share the same detection logic and default font, but each follows the design language of its host application:

| Build | Target | Manifest |
| --- | --- | --- |
| **`chrome/`** | Chrome, Edge, Brave, Arc, Opera (Chromium) | MV3 |
| **`firefox/`** | Firefox 121 and newer | MV3 |
| **`obsidian/`** | Obsidian 1.4 and newer | Community plugin |

Repository: https://github.com/soroush5/Dynamic-RTL

---

## Table of contents

- [What it does](#what-it-does)
- [Highlights](#highlights)
- [Install](#install)
  - [Install on Chrome / Edge / Brave / Arc](#install-on-chrome--edge--brave--arc)
  - [Install on Firefox](#install-on-firefox)
  - [Install for Obsidian](#install-for-obsidian)
- [Using the browser extensions](#using-the-browser-extensions)
- [Using the Obsidian plugin](#using-the-obsidian-plugin)
- [Custom variable font](#custom-variable-font)
- [Sites we keep an eye on](#sites-we-keep-an-eye-on)
- [Performance](#performance)
- [Privacy](#privacy)
- [Troubleshooting and the log system](#troubleshooting-and-the-log-system)
- [Repository layout](#repository-layout)
- [Building from source](#building-from-source)
- [Credits](#credits)
- [License](#license)

---

## What it does

When a Dynamic RTL build is active:

1. **Browsers** — at `document_start` (before the body is parsed) it injects a stylesheet that registers the bundled Vazirmatn variable font and a CSS class called `.dynrtl-rtl`. As the DOM is parsed and as new content streams in (chat messages, tweets, search results), a `TreeWalker` + `MutationObserver` finds Persian / Arabic text and tags the nearest block ancestor.
2. **Obsidian** — a markdown post-processor decorates rendered paragraphs / headings / list items, and a CodeMirror 6 `ViewPlugin` decorates per-line in the editor.
3. **Inputs / contenteditable** — a capture-phase listener flips `dir="auto"` and `text-align` on `<input>`, `<textarea>` and `[contenteditable]` as you type, even on a single Persian character. The CSS class never sets `direction: rtl !important` on editors, which would break editor frameworks like Slate / Lexical / ProseMirror used by Claude, Notion, X, Gemini, etc.

It supports **Persian (fa)**, **Arabic (ar)** and any script in the Arabic Unicode blocks (`U+0600-U+06FF`, `U+0750-U+077F`, `U+08A0-U+08FF`, `U+FB50-U+FDFF`, `U+FE70-U+FEFF`).

## Highlights

- **No flash**: in browsers, font and base styles are registered before first paint via a `document_start` content script.
- **Native look per host**: each build follows the design language of its host:
  - **Chrome** popup / options use Material 3 (Chrome 130+ tokens): rounded surfaces, sliding switches, pill-shaped chips, primary blue `#0b57d0`, subtle scale + fade entrance.
  - **Firefox** popup / options use Acorn / Proton (Firefox 130+ tokens): tighter 4-8 px radii, thin-bordered cards, outlined switches and radio rings, accent `#0061e0` / `#00ddff`.
  - **Obsidian** plugin uses Obsidian's own CSS variables (`--background-primary`, `--text-normal`, `--text-accent`, …) so it matches whatever theme the user has installed.
- **Per-site control** (browsers): click the toolbar icon to toggle the current site. Choose between two default modes:
  - *Enable on all sites* (default) - sites you turn off are remembered as `domain*off`.
  - *Disable on all sites* - sites you turn on are remembered as `domain*on`.
- **Local font**: Vazirmatn is bundled with every build. No external request, no CDN dependency.
- **Custom variable font**: upload your own `.woff2 / .woff / .ttf / .otf` file from settings. Variable fonts are recommended (one file, every weight, smaller, sharper).
- **Live editor support**: works on inputs, textareas and `contenteditable` editors as you type a single character. Uses the W3C `dir="auto"` attribute, never breaks editor internals.
- **Built for dynamic apps**: ChatGPT, Claude, X.com, Notion, Google services, Gemini - dynamic content gets RTL'd as it streams in.
- **URL-aware bidi**: inline `cite / code / kbd / samp / var / pre` inside RTL blocks keep their own LTR context, so URLs in Google search results no longer read backwards.
- **Shadow DOM aware**: the content script descends into open shadow roots, so Web-Component-based UIs get the same treatment as light DOM.
- **Performance budget**: idle-callback batching, mutation throttling, `WeakSet` deduping and a 30 ms-per-batch ceiling keep everything responsive.
- **Diagnostic logging**: a debug toggle prints labelled traces to DevTools.

## Install

> Pre-built bundles for v2.2 live on the [Releases page](https://github.com/soroush5/Dynamic-RTL/releases) as `dynamic-rtl-chrome-v2.2.zip`, `dynamic-rtl-firefox-v2.2.zip` and `dynamic-rtl-obsidian-v2.2.zip`. They are also checked in under [`resources/`](./resources) for offline access.

### Install on Chrome / Edge / Brave / Arc

1. Download `dynamic-rtl-chrome-v2.2.zip` and extract it (for example to `~/Extensions/dynamic-rtl-chrome`).
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, etc.).
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. The Dynamic RTL icon appears in your toolbar. Pin it for quick access. The icon is colored when active on the current site, grayscale when inactive.

> Updating: download the new zip, replace the folder, click the reload icon on the extension card.

### Install on Firefox

Firefox blocks unsigned extensions on the regular release channel. Three supported paths:

**Path A — temporary install (any Firefox):**

1. Download `dynamic-rtl-firefox-v2.2.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** and select the `manifest.json` file inside the (extracted) zip.
4. The extension stays installed until you restart Firefox.

**Path B — permanent install (Developer Edition / Nightly / ESR):**

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Rename `dynamic-rtl-firefox-v2.2.zip` to `dynamic-rtl-firefox-v2.0.xpi`.
3. Drag the `.xpi` file into Firefox and click **Add**.

**Path C — regular Firefox (recommended once published):** install from `https://addons.mozilla.org/` once the build is signed by Mozilla.

### Install for Obsidian

1. Download `dynamic-rtl-obsidian-v2.2.zip` and extract it.
2. Move the extracted folder to `<your-vault>/.obsidian/plugins/dynamic-rtl/`. The path must contain `manifest.json`, `main.js`, `styles.css` and the `fonts/` folder directly (no extra subfolder).
3. Open Obsidian → **Settings → Community plugins**, click **Reload plugins**, then enable **Dynamic RTL**.

## Using the browser extensions

- Click the toolbar icon to open the popup. The icon is **colored** when Dynamic RTL is active on the current page, and **grayscale** when it isn't.
- The toggle at the top enables / disables RTL on the current site. Each toggle is recorded as an explicit override (`domain*on` or `domain*off`) in the custom site list.
- Use the segmented control to flip between *Enable on all sites* and *Disable on all sites*. This default applies to sites without an explicit entry. Your custom site list is preserved when you switch modes.
- Click **Settings & custom font** to open the full options page. There you can edit the custom site list directly, change fonts, and turn on debug logging.

## Using the Obsidian plugin

Open **Settings → Dynamic RTL** in Obsidian to configure:

- **Enable plugin** — master switch.
- **Apply to editor** — turn off if you only want the reading view to use RTL.
- **Apply to reading view** — turn off if you only want the editor to use RTL.
- **Active font** — *Vazirmatn (default)* or *Custom font*.
- **Upload a custom font** — same accepted formats as the browser builds.
- **Verbose logging** — prints labelled traces to the developer console.
- **Refresh open notes** — re-runs detection on every open editor and reading-view pane.

There is also a "Refresh Dynamic RTL on all open notes" command in the Command Palette and a status-bar pill that shows whether the plugin is currently active.

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

If you hit a site that misbehaves, turn on **Verbose logging** in the options page, reload the page, open DevTools and grab the `[Dynamic RTL]` log lines for the bug report.

## Performance

- Tagging is done by adding a single CSS class — never inline styles — so style recalculation is fast and reversible.
- Every element we touch is recorded in a `WeakSet` so we never re-process it. Garbage collection kicks in as soon as the DOM removes the element.
- Mutation work is queued into a `Set` of "pending roots" and flushed inside `requestIdleCallback`, with a hard 30 ms-per-batch ceiling.
- The text walk uses a `TreeWalker` with `acceptNode` that rejects descendants of `<script>`, `<style>`, `<code>`, `<pre>`, canvas-driven editors and contenteditable subtrees.
- The MutationObserver is rooted at `document.body`; we attach a separate observer per open shadow root we encounter.
- The Obsidian editor extension is rebuilt only when the document changes or the viewport scrolls, never on every keystroke.

## Privacy

Dynamic RTL does not call the network. Ever.

- The Vazirmatn font is bundled inside every build.
- Per-site list, custom font, and other preferences live in `chrome.storage.local` (browsers) or your vault's `data.json` (Obsidian) on your machine.
- There is no telemetry, no analytics, and no remote configuration.

The browser builds request `storage`, `tabs`, `scripting`, `activeTab` and `<all_urls>` host permission. The host permission is required because the extension needs to run a content script on every site you visit to detect Persian / Arabic text.

## Troubleshooting and the log system

Every log line is prefixed with a styled `[Dynamic RTL]` badge, which makes filtering trivial in DevTools.

- **Errors** (failed font load, bad settings, etc.) always print, regardless of settings.
- **Verbose logs** (activation, mutations, batch timings) only print when *Verbose logging* is enabled in the relevant settings page.

Common fixes:

| Symptom | Try |
| --- | --- |
| Font does not change but direction is correct | Make sure the toolbar icon is colored (active). Reload the page once to give the font cache a chance. |
| A specific site looks wrong | Click the toolbar icon to toggle it off. The site is recorded in your custom site list. |
| Custom font does not load | The file must be `.woff2`, `.woff`, `.ttf` or `.otf` and smaller than 8 MB. Variable fonts must include the `wght` axis. |
| Nothing happens at all (browser) | Open the options page, check the default mode and the custom site list. Then enable verbose logging and look for errors in DevTools. |
| Editor in Obsidian does not RTL | Settings → Dynamic RTL → make sure both "Enable plugin" and "Apply to editor" are on. Use the "Refresh open notes" command after toggling. |

## Repository layout

```
.
+-- chrome/                     Chrome MV3 build (use this for Chromium browsers)
|   +-- manifest.json
|   +-- background/service-worker.js
|   +-- content/                early-inject.js, core.js, main.js
|   +-- popup/                  popup.html / popup.css / popup.js  (Material 3)
|   +-- options/                options.html / options.css / options.js
|   +-- fonts/                  Vazirmatn-Variable.woff2
|   +-- icons/                  active + inactive icons (16 / 32 / 48 / 128)
+-- firefox/                    Firefox MV3 build (Acorn / Proton styling)
+-- obsidian/                   Obsidian community plugin
|   +-- manifest.json
|   +-- main.js                 plain JS, no build step
|   +-- styles.css              uses Obsidian theme variables
|   +-- versions.json
|   +-- fonts/                  Vazirmatn-Variable.woff2
|   +-- icons/icon.png
|   +-- README.md
+-- resources/                  Pre-built zip packages for all three builds
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
resources/dynamic-rtl-chrome-v2.2.zip
resources/dynamic-rtl-firefox-v2.2.zip
resources/dynamic-rtl-obsidian-v2.2.zip
```

## Credits

- **Developer:** [soroush5](https://github.com/soroush5)
- **Default font:** [Vazirmatn](https://github.com/rastikerdar/vazirmatn) by Saber Rastikerdar (Open Font License)

## License

Dynamic RTL is released under the [MIT License](LICENSE). The bundled Vazirmatn font is licensed under the SIL Open Font License 1.1.
