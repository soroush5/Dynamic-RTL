# Dynamic RTL for Obsidian

Auto-detects Persian and Arabic text in your notes and applies right-to-left direction with the bundled **Vazirmatn** variable font. Works in both reading view and the CodeMirror 6 editor (live preview / source).

This is the Obsidian companion to the Dynamic RTL browser extensions. The browser builds and the Obsidian plugin share the same detection, default font, and design philosophy.

## Features

- Per-line direction detection in the editor — only lines containing Persian or Arabic characters get `dir="rtl"`, everything else stays LTR. No more global toggle for mixed-language notes.
- Reading view post-processor tags paragraphs, headings, list items, table cells, callouts and definition list items.
- Bundled **Vazirmatn** variable font — no internet calls, looks crisp at every weight.
- Custom font upload (`.woff2` / `.woff` / `.ttf` / `.otf`, 8 MB cap).
- Native Obsidian look — settings tab built with the standard `Setting` API, all colors come from your active theme via Obsidian's CSS variables (`--background-primary`, `--text-normal`, `--text-accent`, …).
- Inline code, kbd and similar tokens stay LTR even inside an RTL paragraph (URLs no longer read backwards).
- Status-bar pill showing whether the plugin is currently active.

## Install

### Manual install (community plugins not yet listed)

1. Download `dynamic-rtl-obsidian-v2.0.zip` from the [Releases page](https://github.com/so-roush/Dynamic-RTL/releases).
2. Extract the contents into `<your-vault>/.obsidian/plugins/dynamic-rtl/` so that `manifest.json`, `main.js`, `styles.css` and the `fonts/` folder all sit at that path.
3. Open Obsidian → Settings → Community plugins → enable **Dynamic RTL**.

### From source

The plugin is plain JavaScript - no build step needed.

```text
.obsidian/
└── plugins/
    └── dynamic-rtl/
        ├── manifest.json
        ├── main.js
        ├── styles.css
        ├── versions.json
        └── fonts/
            └── Vazirmatn-Variable.woff2
```

## Settings

- **Enable plugin** — master switch.
- **Apply to editor** — turn off if you only want the reading view to use RTL.
- **Apply to reading view** — turn off if you only want the editor to use RTL.
- **Font** — *Vazirmatn (default)* or *Custom font*.
- **Upload a custom font** — accepts `.woff2 / .woff / .ttf / .otf` up to 8 MB. Variable fonts (with the `wght` axis) are recommended.
- **Verbose logging** — prints labelled traces to the developer console (`Cmd/Ctrl + Shift + I` opens DevTools).
- **Refresh open notes** — re-runs detection on every open editor and reading-view pane.

## How it works

- **Reading view:** the plugin registers a markdown post-processor that walks the rendered HTML and sets `dir="rtl"` + a `.dynrtl-line` class on any block element whose text contains Persian or Arabic characters.
- **Editor view:** the plugin registers a CodeMirror 6 `ViewPlugin` that emits a `Decoration.line(...)` for every visible line containing Persian or Arabic characters. This is far cheaper than walking the DOM on every keystroke and stays smooth on huge notes.
- **Font:** Vazirmatn ships next to `main.js`. The plugin registers a `@font-face` once at load time, pointing at the file via `app.vault.adapter.getResourcePath(...)` so it works on every platform.

## Compatibility

- Minimum Obsidian version: **1.4.0** (CodeMirror 6).
- Desktop and mobile both supported.
- Works alongside the official RTL Support plugin (`obsidian-rtl`) but you only need one of them. Dynamic RTL focuses on the per-line auto-detection use case for mixed-language notes.

## Credits

- Plugin: [so-roush](https://github.com/so-roush) — see the main repo at https://github.com/so-roush/Dynamic-RTL
- Default font: [Vazirmatn](https://github.com/rastikerdar/vazirmatn) by Saber Rastikerdar (SIL OFL 1.1)
