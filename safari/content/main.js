// Dynamic RTL content script.
// Finds Persian/Arabic text, marks its block as RTL and gives it the font.
(() => {
  'use strict';
  if (globalThis.__dynrtl || !/html/.test(document.contentType || 'text/html')) return;
  globalThis.__dynrtl = true;

  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const FAMILY = 'Vazirmatn DynRTL';
  const RANGE = 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF';
  const AR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const ATTR = 'data-dynrtl';
  const IN = 'data-dynrtl-in';
  const SKIP = 'head,script,style,noscript,template,textarea,select,option,code,pre,kbd,samp,var,tt,xmp,svg,math,' +
    '[data-dynrtl-skip],.CodeMirror,.cm-editor,.monaco-editor,.ace_editor,.kix-appview-editor,.waffle,.punch-viewer-container';
  // Too broad to flip. Text sitting directly in these only gets the font.
  const WIDE = new Set(['html', 'body', 'main', 'nav', 'header', 'footer', 'aside', 'section', 'article', 'dialog', 'form']);
  const RTL_LANGS = new Set(['fa', 'ar', 'ur', 'ps', 'ckb', 'sd', 'ug', 'he', 'yi']);
  const OBSERVE = { childList: true, subtree: true, characterData: true };
  const host = location.hostname.replace(/^www\./, '');
  const defaultFont = `url("${api.runtime.getURL('fonts/vazirmatn.woff2')}") format("woff2")`;

  let S = null;             // settings, null until loaded
  let on = false;
  let auto = false;         // page is RTL already, left alone by default
  let decided = false;
  let reported;             // last state sent for the toolbar icon
  let face = null;
  let customFace = false;
  let customLoading = false;
  let full = true;          // next run walks the whole document
  let walker = null;        // a full walk that ran out of time
  let parser = null;        // follows the HTML parser while the page loads
  let frame = 0;
  let pause = 0;
  let spent = 0;
  let windowStart = 0;
  let sheet = null;
  let sheetText = null;
  // Per text parent: its block, null (none), or SKIPPED. Keeps streamed
  // tokens from reading styles again and again.
  const SKIPPED = {};
  let parents = new WeakMap();
  let fontDone = new WeakSet();
  const queue = new Set();
  const roots = new Set();
  const styled = new WeakSet();
  const stats = { runs: 0, ms: 0, observerMs: 0, marked: 0, errors: 0 };
  const mo = new MutationObserver(onMutations);

  // Font

  function setFace(src) {
    try {
      const f = new FontFace(FAMILY, src, { weight: '100 900', unicodeRange: RANGE, display: 'fallback' });
      if (face) document.fonts.delete(face);
      document.fonts.add(f);
      face = f;
    } catch {}
  }

  // Start loading as soon as Arabic script shows up, so it is ready by first paint.
  function warm(text) {
    if (!face || face.status !== 'unloaded' || !AR.test(text)) return;
    if (S?.font === 'custom') loadCustomFont();
    else face.load().catch(() => {});
  }

  async function loadCustomFont() {
    if (customFace || customLoading) return;
    customLoading = true;
    try {
      const { customFontDataUrl: url } = await api.storage.local.get('customFontDataUrl');
      if (url && S?.font === 'custom') {
        const bin = atob(url.slice(url.indexOf(',') + 1));
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        setFace(buf.buffer);
        customFace = true;
      }
    } catch {}
    customLoading = false;
  }

  function syncFont() {
    if (S.font === 'custom') {
      customFace = false;
      if (document.querySelector(`[${ATTR}],[${IN}]`)) loadCustomFont();
    } else if (customFace) {
      customFace = false;
      setFace(defaultFont);
    }
  }

  // Settings

  async function loadSettings() {
    const keys = ['mode', 'siteOverrides', 'font'];
    const get = (area) => {
      try { return area ? area.get(keys).catch(() => ({})) : {}; } catch { return {}; }
    };
    // Local wins: v3 kept values there when sync was full.
    const [a, b] = await Promise.all([get(api.storage.sync), get(api.storage.local)]);
    S = { mode: 'enable_all', siteOverrides: {}, font: 'vazirmatn', ...a, ...b };
  }

  // Rules on a parent domain cover its subdomains too.
  function lookup(map, h) {
    for (let d = h; map && d; ) {
      if (map[d]) return map[d];
      d = d.slice(d.indexOf('.') + 1);
      if (!d.includes('.')) break;
    }
    return null;
  }

  function pageIsRtl() {
    const d = document.documentElement;
    const lang = String(d.lang || '').toLowerCase().split(/[-_]/)[0];
    return RTL_LANGS.has(lang) || String(d.dir).toLowerCase() === 'rtl' ||
      String(document.body?.dir).toLowerCase() === 'rtl';
  }

  function decide(force) {
    if (!S || !document.documentElement) return;
    decided = true;
    const rule = lookup(S.siteOverrides, host);
    auto = !rule && S.mode !== 'disable_all' && pageIsRtl();
    const want = rule ? rule === 'on' : S.mode !== 'disable_all' && !auto;
    if (want !== on) {
      on = want;
      if (on) start();
      else stop();
    }
    report(force);
  }

  // The toolbar icon defaults to the global mode; only differences are sent.
  function report(force) {
    if (reported === on && !force) return;
    const first = reported === undefined;
    reported = on;
    if (first && !force && on === (S.mode !== 'disable_all')) return;
    try { api.runtime.sendMessage({ t: 'icon', on }).catch(() => {}); } catch {}
  }

  // Watching

  function hostsPass() {
    if (on) findHosts(document.documentElement);
  }

  function start() {
    mo.observe(document, OBSERVE);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('input', onInput, true);
    full = true;
    schedule();
  }

  function stop() {
    mo.disconnect();
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('input', onInput, true);
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(pause);
    frame = pause = 0;
    walker = null;
    queue.clear();
    parents = new WeakMap();
    fontDone = new WeakSet();
    for (const root of [document, ...roots]) {
      for (const el of root.querySelectorAll(`[${ATTR}],[${IN}]`)) unmark(el);
    }
    roots.clear();
  }

  function onMutations(list) {
    if (S && !on) return;
    // While the page parses, nodes arrive in document order and one walker
    // follows them. Reading every record here would cost more than the scan.
    if (document.readyState === 'loading') {
      if (S && !decided) decide();
      schedule();
      return;
    }
    const t0 = performance.now();
    // A huge batch (a big page parsed in one go): one native scan is cheaper.
    if (list.length > 400) {
      queue.clear();
      walker = null;
      full = true;
    }
    const collect = !full || walker;
    const cold = face?.status === 'unloaded';
    for (let i = 0; collect && i < list.length; i++) {
      const m = list[i];
      if (m.type === 'characterData') {
        if (collect) queue.add(m.target);
        if (cold) warm(m.target.data);
        continue;
      }
      const added = m.addedNodes;
      for (let j = 0; j < added.length; j++) {
        const n = added[j];
        if (collect) queue.add(n);
        if (cold && n.nodeType === 3) warm(n.data);
      }
    }
    // Hidden tabs get no frames. Don't let the queue grow without limit.
    if (queue.size > 5000) {
      queue.clear();
      walker = null;
      full = true;
    }
    stats.observerMs += performance.now() - t0;
    if (!S) return;
    if (!decided) decide();
    schedule();
  }

  function watchRoot(root) {
    if (roots.has(root)) return;
    roots.add(root);
    mo.observe(root, OBSERVE);
    queue.add(root);
  }

  // Shadow hosts are custom elements, or plain containers with no light DOM.
  // Both lookups run natively instead of visiting every node from script.
  const EMPTY = 'div:empty,span:empty';

  function findHosts(root) {
    try {
      const r = document.evaluate('.//*[contains(local-name(), "-")]', root, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < r.snapshotLength; i++) {
        const sr = r.snapshotItem(i).shadowRoot;
        if (sr) watchRoot(sr);
      }
      for (const el of root.querySelectorAll(EMPTY)) if (el.shadowRoot) watchRoot(el.shadowRoot);
    } catch {}
  }

  function schedule() {
    if (on && !frame && !pause) frame = requestAnimationFrame(run);
  }

  // Runs right before paint, so new text shows up already marked.
  function run() {
    frame = 0;
    if (!on) return;
    try {
      step();
    } catch (e) {
      stats.errors++;
      stats.lastError = String(e);
    }
  }

  function step() {
    const t0 = performance.now();
    if (t0 - windowStart > 1000) {
      windowStart = t0;
      spent = 0;
    }
    const deadline = t0 + 6;
    const texts = [];
    const rechecks = new Set();
    let more = false;

    if (document.readyState === 'loading') {
      parser ??= document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
      if (!parser.currentNode.isConnected) parser.currentNode = document;
      more = walk(parser, texts, deadline);
    } else {
      if (parser) {
        // Parsing is done. One pass catches anything scripts added out of order.
        parser = null;
        full = true;
      }
      if (full && !walker) {
        full = false;
        queue.clear();
        const root = document.documentElement;
        findHosts(root);
        if (AR.test(root.textContent)) walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      }
      if (walker) {
        if (!walker.currentNode.isConnected) walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
        if (!walk(walker, texts, deadline)) walker = null;
      }
      if (!walker && queue.size) {
        const items = [...queue];
        let i = 0;
        while (i < items.length) {
          const n = items[i++];
          // Nodes whose parent is queued too get covered by the parent's scan.
          if (!queue.has(n.parentNode)) scan(n, texts, rechecks);
          if ((i & 31) === 0 && performance.now() > deadline) break;
        }
        for (let j = 0; j < i; j++) queue.delete(items[j]);
      }
    }
    apply(texts, rechecks);

    const dt = performance.now() - t0;
    spent += dt;
    stats.runs++;
    stats.ms += dt;
    if (more || walker || queue.size) {
      // Busy page: stay under roughly 12% of one core.
      if (spent > 120) {
        pause = setTimeout(() => {
          pause = 0;
          spent = 0;
          windowStart = performance.now();
          schedule();
        }, 300);
      } else {
        schedule();
      }
    }
  }

  // Text under an element that is already marked is skipped here; changes
  // to it come in through the observer.
  function walk(w, texts, deadline) {
    let i = 0;
    for (let n; (n = w.nextNode());) {
      if (AR.test(n.data)) {
        const p = n.parentElement;
        if (p && !p.hasAttribute(ATTR) && !p.parentElement?.hasAttribute(ATTR)) texts.push(n);
      }
      if ((++i & 255) === 0 && performance.now() > deadline) return true;
    }
    return false;
  }

  function scan(n, texts, rechecks) {
    if (n.nodeType === 3) {
      if (AR.test(n.data)) texts.push(n);
      else if (n.parentElement) recheck(n.parentElement, rechecks);
      return;
    }
    if ((n.nodeType !== 1 && n.nodeType !== 11) || !n.isConnected) return;
    if (n.shadowRoot) watchRoot(n.shadowRoot);
    if (n.firstElementChild) findHosts(n);
    if (AR.test(n.textContent)) {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      for (let c; (c = w.nextNode());) if (AR.test(c.data)) texts.push(c);
    } else if (n.parentElement) {
      recheck(n.parentElement, rechecks);
    }
  }

  // A marked block whose text changed may need a different mark now.
  function recheck(el, rechecks) {
    if (!stats.marked) return;
    const b = el.closest(`[${ATTR}=r],[${ATTR}=c]`);
    if (b) rechecks.add(b);
  }

  // Marking. All style reads happen before any write, so style is computed once per frame.

  function classify(p, editors) {
    if (p.closest(SKIP)) return SKIPPED;
    if (p.isContentEditable) {
      const h = editorHost(p);
      if (h && !h.hasAttribute(IN)) editors.add(h);
      return SKIPPED;
    }
    return blockOf(p);
  }

  function apply(texts, rechecks) {
    if (!texts.length && !rechecks.size) return;
    if (face?.status === 'unloaded') warm('\u0633');
    const blocks = new Map();   // block -> has text directly inside
    const inline = new Map();   // inline text parent -> its block
    const editors = new Set();
    const seen = new Set();

    for (const t of texts) {
      const p = t.parentElement;
      if (!p || seen.has(p)) continue;
      seen.add(p);
      let b = parents.get(p);
      if (b === undefined || (b && b !== SKIPPED && !b.contains(p))) {
        b = classify(p, editors);
        parents.set(p, b);
      }
      if (b === SKIPPED) continue;
      if (b) {
        const flag = b.getAttribute(ATTR);
        if (flag === 'r' || flag === 'c') rechecks.add(b);
        else blocks.set(b, blocks.get(b) || b === p);
      }
      if (b !== p && !fontDone.has(p)) inline.set(p, b);
    }

    const ops = [];
    // Already RTL: only the text can change the answer, no style reads needed.
    for (const b of rechecks) {
      const text = b.textContent;
      ops.push([b, !AR.test(text) ? null : isRtl(text) ? b.getAttribute(ATTR) : 'f']);
    }
    for (const [b, direct] of blocks) {
      const text = b.textContent;
      let flag = null;
      if (AR.test(text)) {
        const cs = getComputedStyle(b);
        if (b.childElementCount > 40 || (direct && b.firstElementChild && /flex|grid/.test(cs.display))) {
          flag = 'f';
        } else if (isRtl(text)) {
          flag = cs.textAlign.includes('center') ? 'c' : 'r';
          const list = listOf(b);
          if (list) {
            const ls = getComputedStyle(list);
            ops.push([list, 'l', ls.paddingLeft, ls.paddingRight]);
          }
        } else {
          flag = 'f';
        }
        ops.push([b, flag, cs.fontFamily]);
      } else {
        ops.push([b, null]);
      }
    }
    const fields = [];
    for (const h of editors) {
      const cs = getComputedStyle(h);
      fields.push([h, cs.textAlign.includes('center') ? 'c' : '', cs.fontFamily]);
    }

    for (const [el, flag, a, b] of ops) mark(el, flag, a, b);
    for (const [el, align, ff] of fields) markField(el, align, ff);

    // A span can set its own font (YouTube comments do) and ignore the block's.
    // Only after marking can we tell inherited from explicit, so check once more.
    const own = [];
    for (const p of inline.keys()) {
      fontDone.add(p);
      if (p.hasAttribute(ATTR) || blocks.has(p) || !p.isConnected) continue;
      const ff = getComputedStyle(p).fontFamily;
      if (!ff.includes(FAMILY)) own.push([p, ff]);
    }
    for (const [p, ff] of own) mark(p, 'f', ff);
    if (S.font === 'custom' && !customFace && (ops.length || fields.length || own.length)) loadCustomFont();
  }

  function blockOf(el) {
    for (let i = 0; el && i < 12; i++, el = el.parentElement) {
      if (WIDE.has(el.localName)) return null;
      const d = getComputedStyle(el).display;
      if (d !== 'inline' && d !== 'contents') return el;
    }
    return null;
  }

  function listOf(b) {
    const li = b.localName === 'li' ? b : b.parentElement?.localName === 'li' ? b.parentElement : null;
    const list = li?.parentElement;
    if (!list || (list.localName !== 'ul' && list.localName !== 'ol') || list.hasAttribute(ATTR)) return null;
    return list;
  }

  function editorHost(el) {
    let h = null;
    for (; el && el.isContentEditable; el = el.parentElement) h = el;
    return h;
  }

  // Counts strong letters. Mostly Arabic script (or starts with it) means RTL.
  function isRtl(s) {
    let r = 0;
    let l = 0;
    let first = 0;
    const n = Math.min(s.length, 4000);
    for (let i = 0; i < n; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x41) continue;
      if (c < 0x7b ? c < 0x5b || c > 0x60
        : c < 0x250 ? c >= 0xc0 && c !== 0xd7 && c !== 0xf7
          : c >= 0x370 && c < 0x530) {
        l++;
        first ||= 2;
      } else if ((c >= 0x5d0 && c <= 0x5f2) || (c >= 0x620 && c <= 0x64a) || (c >= 0x66e && c <= 0x6d3) ||
        (c >= 0x6fa && c <= 0x8ff) || (c >= 0xfb1d && c <= 0xfefc)) {
        r++;
        first ||= 1;
      }
    }
    return r > 0 && (first === 1 ? r * 3 >= l : r >= l);
  }

  function mark(el, flag, a, b) {
    const cur = el.getAttribute(ATTR);
    if (cur === flag) return;
    if (!flag) {
      unmark(el);
      return;
    }
    if (cur === null) {
      stats.marked++;
      if (flag === 'l') {
        el.style.setProperty('--dynrtl-ps', a);
        el.style.setProperty('--dynrtl-pe', b);
      } else if (a && !a.includes(FAMILY)) {
        el.style.setProperty('--dynrtl-f', a);
      }
      styleRoot(el);
    }
    el.setAttribute(ATTR, flag);
  }

  function markField(el, align, ff) {
    if (!ff.includes(FAMILY)) el.style.setProperty('--dynrtl-f', ff);
    el.setAttribute(IN, align);
    stats.marked++;
    styleRoot(el);
  }

  function unmark(el) {
    el.removeAttribute(ATTR);
    el.removeAttribute(IN);
    el.style.removeProperty('--dynrtl-f');
    el.style.removeProperty('--dynrtl-ps');
    el.style.removeProperty('--dynrtl-pe');
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  }

  // The page stylesheet does not reach into shadow roots, so copy it in.
  function styleRoot(el) {
    const root = el.getRootNode();
    if (root === document || !root.host || styled.has(root)) return;
    styled.add(root);
    sheetText ??= fetch(api.runtime.getURL('content/main.css')).then((r) => r.text());
    sheetText.then((css) => {
      try {
        if (!sheet) {
          sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
        }
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      } catch {
        const s = document.createElement('style');
        s.textContent = css;
        root.append(s);
      }
    }).catch(() => {});
  }

  // Inputs and editors

  function field(t) {
    if (t?.nodeType !== 1) return null;
    if (t.localName === 'textarea' || (t.localName === 'input' && (t.type === 'text' || t.type === 'search'))) return t;
    return t.isContentEditable ? editorHost(t) : null;
  }

  function checkField(f, data) {
    if (!f || f.hasAttribute(IN)) return;
    if (data ? AR.test(data) : AR.test(f.value ?? f.textContent)) {
      const cs = getComputedStyle(f);
      markField(f, cs.textAlign.includes('center') ? 'c' : '', cs.fontFamily);
      if (S.font === 'custom' && !customFace) loadCustomFont();
    }
  }

  // composedPath() sees through open shadow roots.
  function onInput(e) {
    try {
      checkField(field(e.composedPath()[0]), e.data);
    } catch (err) {
      stats.errors++;
      stats.lastError = String(err);
    }
  }

  function onFocus(e) {
    try {
      checkField(field(e.composedPath()[0]));
    } catch (err) {
      stats.errors++;
      stats.lastError = String(err);
    }
  }

  // Startup

  api.runtime.onMessage.addListener((m, _sender, reply) => {
    if (m?.t === 'state') reply({ host, on, auto });
    else if (m?.t === 'stats') reply({ ...stats, on, url: location.href, roots: roots.size, font: face?.status });
  });

  api.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync' && area !== 'local') return;
    if (!('mode' in ch || 'siteOverrides' in ch || 'font' in ch || 'customFontDataUrl' in ch)) return;
    const fontChanged = 'font' in ch || 'customFontDataUrl' in ch;
    loadSettings().then(() => {
      if (fontChanged) syncFont();
      decide(true);
    });
  });

  setFace(defaultFont);
  mo.observe(document, OBSERVE);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  addEventListener('load', hostsPass, { once: true });
  loadSettings().then(() => decide());
})();
