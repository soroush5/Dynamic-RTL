/* Dynamic RTL - Obsidian plugin
 * Auto-detects Persian and Arabic text in markdown notes and applies the
 * right-to-left direction with the bundled Vazirmatn variable font.
 *
 * - Reading view : a markdown post-processor adds dir="rtl" + .dynrtl-line
 *                  to block elements containing Persian/Arabic text.
 * - Editor view  : a CodeMirror 6 view plugin scans visible lines and
 *                  emits per-line decorations with dir="rtl" + .dynrtl-line.
 * - Settings tab : Obsidian-native, uses the built-in Setting class so
 *                  visuals match the rest of the app on every theme.
 */
'use strict';

const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

let cmView, cmState;
try { cmView  = require('@codemirror/view'); }  catch (_) {}
try { cmState = require('@codemirror/state'); } catch (_) {}

/* ----- Constants ---------------------------------------------------- */

const PLUGIN_ID = 'dynamic-rtl';

/* Persian / Arabic detection - same Unicode coverage as the browser
 * extension companion (Arabic + Supplement + Extended-A + Presentation
 * Forms-A and -B). */
const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const DEFAULT_SETTINGS = {
  enabled: true,            // master switch
  font: 'vazirmatn',        // 'vazirmatn' | 'custom'
  customFontDataUrl: '',
  customFontName: '',
  customFontFormat: '',
  applyToReadingView: true,
  applyToEditorView: true,
  debug: false
};

/* ----- CodeMirror 6 line decorator -----------------------------------
 * Builds line decorations across every visible viewport range. We rebuild
 * decorations on viewport / doc changes only, never on every keystroke,
 * which keeps the editor smooth even on huge notes. */

function buildEditorExtension(getEnabled) {
  if (!cmView || !cmState) return null;
  const { ViewPlugin, Decoration } = cmView;
  const { RangeSetBuilder } = cmState;

  const lineDeco = Decoration.line({
    attributes: { dir: 'rtl', class: 'dynrtl-line' }
  });

  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = this.compute(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.compute(update.view);
      }
    }
    compute(view) {
      const builder = new RangeSetBuilder();
      if (!getEnabled()) return builder.finish();
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = view.state.doc.lineAt(pos);
          if (RTL_REGEX.test(line.text)) {
            builder.add(line.from, line.from, lineDeco);
          }
          if (line.to >= to) break;
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  }, {
    decorations: v => v.decorations
  });
}

/* ----- Logger -------------------------------------------------------- */

function makeLogger(getDebug) {
  const tag = '%c[Dynamic RTL]';
  const style = 'color:#fff;background:#5b6cff;border-radius:3px;padding:1px 4px;font-weight:bold';
  return {
    log:   (...a) => { if (getDebug()) console.log(tag, style, ...a); },
    warn:  (...a) => { if (getDebug()) console.warn(tag, style, ...a); },
    error: (...a) => console.error(tag, style, ...a)
  };
}

/* ----- Plugin class -------------------------------------------------- */

module.exports = class DynamicRtlPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.log = makeLogger(() => !!this.settings.debug);

    // Inject the font + base CSS so Vazirmatn (or a custom font) is
    // available everywhere the plugin paints.
    await this.applyFontStyles();

    // Reading view (rendered markdown).
    this.registerMarkdownPostProcessor((root) => {
      if (!this.settings.enabled || !this.settings.applyToReadingView) return;
      this.processReadingViewBlocks(root);
    });

    // Editor view (CodeMirror 6 / live preview / source mode).
    if (cmView && cmState) {
      const ext = buildEditorExtension(() =>
        this.settings.enabled && this.settings.applyToEditorView
      );
      if (ext) this.registerEditorExtension(ext);
    } else {
      this.log.warn('CodeMirror modules not available - editor RTL disabled.');
    }

    // Command: rebuild every open editor (handy after settings change).
    this.addCommand({
      id: 'dynamic-rtl-refresh',
      name: 'Refresh Dynamic RTL on all open notes',
      callback: () => this.refreshAllEditors()
    });

    // Settings tab.
    this.addSettingTab(new DynRtlSettingTab(this.app, this));

    // Status bar pill telling you what state the plugin is in.
    this.statusEl = this.addStatusBarItem();
    this.updateStatusBar();

    this.log.log('loaded', this.settings);
  }

  onunload() {
    // Clean up our injected style elements.
    for (const id of ['dynrtl-base-style', 'dynrtl-custom-font-style']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }

  /* --- Settings --- */

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    await this.applyFontStyles();
    this.updateStatusBar();
    this.refreshAllEditors();
  }

  updateStatusBar() {
    if (!this.statusEl) return;
    const on = this.settings.enabled;
    this.statusEl.setText(on ? 'RTL: on' : 'RTL: off');
    this.statusEl.title = on
      ? 'Dynamic RTL is active. Click status bar entry > Settings to disable.'
      : 'Dynamic RTL is disabled. Open settings to re-enable.';
  }

  /* --- Reading view --- */

  processReadingViewBlocks(root) {
    if (!root || !root.querySelectorAll) return;
    const blocks = root.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, .callout-content, .callout-title-inner, dt, dd'
    );
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const text = block.textContent;
      if (!text) continue;
      if (!RTL_REGEX.test(text)) continue;
      block.setAttribute('dir', 'rtl');
      block.classList.add('dynrtl-line');
    }
  }

  /* --- Refresh open editors after settings change --- */

  refreshAllEditors() {
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view && view.previewMode && view.previewMode.rerender) {
        try { view.previewMode.rerender(true); } catch (_) {}
      }
      if (view && view.editor && view.editor.cm && view.editor.cm.dispatch) {
        // Prod the CM6 viewport so our ViewPlugin recomputes.
        try { view.editor.cm.dispatch({}); } catch (_) {}
      }
    }
  }

  /* --- Font CSS (base + optional custom) --- */

  async applyFontStyles() {
    const baseId = 'dynrtl-base-style';
    const customId = 'dynrtl-custom-font-style';

    const fontUrl = this.app.vault.adapter.getResourcePath(
      `${this.app.vault.configDir}/plugins/${PLUGIN_ID}/fonts/Vazirmatn-Variable.woff2`
    );

    const baseCss = `
@font-face {
  font-family: 'Vazirmatn DynRTL';
  src: url("${fontUrl}") format('woff2-variations'),
       url("${fontUrl}") format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --dynrtl-font-stack: 'Vazirmatn DynRTL', 'Vazirmatn',
                       var(--font-text), var(--default-font),
                       'Tahoma', sans-serif;
}

.dynrtl-line {
  font-family: var(--dynrtl-font-stack) !important;
}

[dir="rtl"].dynrtl-line,
.dynrtl-line[dir="rtl"] {
  text-align: right !important;
}

/* Code-like inline tokens are by convention always LTR. */
.dynrtl-line code,
.dynrtl-line tt,
.dynrtl-line samp,
.dynrtl-line kbd,
.dynrtl-line var,
.dynrtl-line pre {
  direction: ltr !important;
  unicode-bidi: isolate !important;
  text-align: initial !important;
}

/* Links and citations get plaintext bidi: each one auto-detects its own
   direction from its first strong character. This keeps an English URL
   inside a Persian paragraph flowing LTR while a fully-Persian link
   still renders RTL correctly. */
.dynrtl-line a,
.dynrtl-line cite {
  unicode-bidi: plaintext !important;
  text-align: initial !important;
}
`;

    let baseEl = document.getElementById(baseId);
    if (!baseEl) {
      baseEl = document.createElement('style');
      baseEl.id = baseId;
      document.head.appendChild(baseEl);
    }
    baseEl.textContent = baseCss;

    // Custom font (if any).
    let customEl = document.getElementById(customId);
    if (this.settings.font === 'custom' && this.settings.customFontDataUrl) {
      const fmt = this.settings.customFontFormat || 'woff2-variations';
      const customCss = `
@font-face {
  font-family: 'DynRTL Custom';
  src: url("${this.settings.customFontDataUrl}") format("${fmt}"),
       url("${this.settings.customFontDataUrl}");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
:root { --dynrtl-font-stack: 'DynRTL Custom', 'Vazirmatn DynRTL', 'Vazirmatn', var(--font-text), 'Tahoma', sans-serif; }
`;
      if (!customEl) {
        customEl = document.createElement('style');
        customEl.id = customId;
        document.head.appendChild(customEl);
      }
      customEl.textContent = customCss;
    } else if (customEl) {
      customEl.remove();
    }
  }
};

/* ----- Settings tab -------------------------------------------------- */

class DynRtlSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('dynrtl-settings');

    /* Header */
    const header = containerEl.createEl('div', { cls: 'dynrtl-settings-header' });
    const headerText = header.createEl('div');
    headerText.createEl('h2', { text: 'Dynamic RTL' });
    headerText.createEl('p', {
      text:
        'Auto-detects Persian and Arabic text in your notes and applies right-to-left ' +
        'direction with the Vazirmatn font. Works in both reading and editor views.',
      cls: 'setting-item-description'
    });

    /* General */
    new Setting(containerEl)
      .setName('Enable plugin')
      .setDesc(
        'Master switch. When off, no note is touched. ' +
        'You can also turn the apply-to-editor and apply-to-reading-view ' +
        'switches off independently.'
      )
      .addToggle(t => t
        .setValue(!!this.plugin.settings.enabled)
        .onChange(async (v) => {
          this.plugin.settings.enabled = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Apply to editor (live preview / source)')
      .setDesc(
        'Decorate lines containing Persian or Arabic text inside the CodeMirror editor.'
      )
      .addToggle(t => t
        .setValue(!!this.plugin.settings.applyToEditorView)
        .onChange(async (v) => {
          this.plugin.settings.applyToEditorView = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Apply to reading view')
      .setDesc(
        'Apply right-to-left direction and Vazirmatn to rendered paragraphs, ' +
        'headings, list items and table cells in reading view.'
      )
      .addToggle(t => t
        .setValue(!!this.plugin.settings.applyToReadingView)
        .onChange(async (v) => {
          this.plugin.settings.applyToReadingView = v;
          await this.plugin.saveSettings();
        })
      );

    /* Font */
    containerEl.createEl('h3', { text: 'Font' });

    new Setting(containerEl)
      .setName('Active font')
      .setDesc(
        'Vazirmatn (variable, designed by Saber Rastikerdar) is bundled with the plugin. ' +
        'You can switch to a custom font you upload below.'
      )
      .addDropdown(d => d
        .addOption('vazirmatn', 'Vazirmatn (default)')
        .addOption('custom', 'Custom font')
        .setValue(this.plugin.settings.font || 'vazirmatn')
        .onChange(async (v) => {
          this.plugin.settings.font = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    /* Custom font upload row */
    const customRow = new Setting(containerEl)
      .setName('Upload a custom font')
      .setDesc(
        'Variable fonts (.woff2 with weight axis) are recommended. ' +
        'A single file covers every weight, looks crisp at every size, and uses less memory.'
      );

    const fontInfo = containerEl.createEl('p', { cls: 'setting-item-description' });
    if (this.plugin.settings.customFontDataUrl) {
      fontInfo.setText(
        `Loaded: ${this.plugin.settings.customFontName || 'unnamed'}  ` +
        `(active: ${this.plugin.settings.font === 'custom' ? 'yes' : 'no'})`
      );
    } else {
      fontInfo.setText('No custom font uploaded.');
    }

    customRow.addButton(b => b
      .setButtonText('Upload font...')
      .onClick(() => {
        const input = createEl('input', {
          type: 'file',
          attr: { accept: '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf' }
        });
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', async () => {
          const f = input.files && input.files[0];
          input.remove();
          if (!f) return;
          // Cap at ~8MB, mirror the browser-extension policy.
          if (f.size > 8 * 1024 * 1024) {
            new Notice('Font too large (>8 MB).');
            return;
          }
          try {
            const dataUrl = await readAsDataUrl(f);
            this.plugin.settings.customFontDataUrl = dataUrl;
            this.plugin.settings.customFontName = f.name;
            this.plugin.settings.customFontFormat = inferFontFormat(f.name);
            this.plugin.settings.font = 'custom';
            await this.plugin.saveSettings();
            new Notice(`Loaded ${f.name} (${(f.size / 1024).toFixed(0)} KB).`);
            this.display();
          } catch (e) {
            new Notice('Failed to read font: ' + (e && e.message || e));
          }
        });
        input.click();
      })
    );

    if (this.plugin.settings.customFontDataUrl) {
      customRow.addButton(b => b
        .setButtonText('Remove custom font')
        .setWarning()
        .onClick(async () => {
          this.plugin.settings.customFontDataUrl = '';
          this.plugin.settings.customFontName = '';
          this.plugin.settings.customFontFormat = '';
          this.plugin.settings.font = 'vazirmatn';
          await this.plugin.saveSettings();
          new Notice('Custom font removed.');
          this.display();
        })
      );
    }

    /* Live preview of the active font */
    const preview = containerEl.createEl('div', { cls: 'dynrtl-settings-preview' });
    preview.setAttribute('dir', 'rtl');
    preview.setText(
      'نمونه متن فارسی - این یک پیش‌نمایش از فونت انتخاب‌شده است. ' +
      'The quick brown fox jumps over the lazy dog. ١٢٣٤٥٦٧٨٩٠'
    );

    /* Diagnostics */
    containerEl.createEl('h3', { text: 'Diagnostics' });

    new Setting(containerEl)
      .setName('Verbose logging')
      .setDesc(
        'Print labelled traces to the developer console. Errors are always reported regardless.'
      )
      .addToggle(t => t
        .setValue(!!this.plugin.settings.debug)
        .onChange(async (v) => {
          this.plugin.settings.debug = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Refresh open notes')
      .setDesc('Re-runs detection on every open editor and reading-view pane.')
      .addButton(b => b
        .setButtonText('Refresh now')
        .onClick(() => {
          this.plugin.refreshAllEditors();
          new Notice('Dynamic RTL refreshed all open notes.');
        })
      );

    /* Credits */
    const footer = containerEl.createEl('div', { cls: 'dynrtl-settings-footer' });
    footer.createEl('p', {
      text: 'Default font: Vazirmatn by Saber Rastikerdar (SIL OFL 1.1).',
      cls: 'setting-item-description'
    });
    const repoP = footer.createEl('p', { cls: 'setting-item-description' });
    repoP.appendText('Developer: soroush5  -  ');
    repoP.createEl('a', {
      text: 'github.com/soroush5/Dynamic-RTL',
      href: 'https://github.com/soroush5/Dynamic-RTL'
    });
  }
}

/* ----- Helpers ------------------------------------------------------- */

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function inferFontFormat(name) {
  name = (name || '').toLowerCase();
  if (name.endsWith('.woff2')) return 'woff2-variations';
  if (name.endsWith('.woff'))  return 'woff';
  if (name.endsWith('.ttf'))   return 'truetype-variations';
  if (name.endsWith('.otf'))   return 'opentype';
  return 'woff2-variations';
}
