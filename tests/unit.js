#!/usr/bin/env node
// Dynamic RTL - zero-dependency unit harness.
// Runs the real chrome/content/main.js against a fake DOM. Usage: node tests/unit.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'chrome', 'content', 'main.js'), 'utf8');

function makeEnv(storageData, opts = {}) {
  const NF = { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
  function el(tag) {
    const e = { nodeType: 1, tagName: tag, children: [], parentElement: null, parentNode: null,
      isConnected: true, isContentEditable: false, shadowRoot: null, __d: 0, __di: 0, __ds: 0,
      attrs: {}, classes: new Set(),
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
      setAttribute(k, v) { this.attrs[k] = String(v) }, hasAttribute(k) { return k in this.attrs },
      matches(sel) { return false }, appendChild(c) { c.parentElement = e; c.parentNode = e; this.children.push(c); return c } };
    e.classList = { add: (c) => e.classes.add(c), remove: (c) => e.classes.delete(c), contains: (c) => e.classes.has(c) };
    return e;
  }
  function T(parent, v) { const t = { nodeType: 3, nodeValue: v, parentElement: parent, parentNode: parent }; parent.children.push(t); return t; }

  const html = el('HTML'), head = el('HEAD'), body = el('BODY');
  if (opts.lang) html.attrs.lang = opts.lang;
  if (opts.dir) html.attrs.dir = opts.dir;
  html.appendChild(head); html.appendChild(body);
  const p1 = el('P'), p2 = el('P'), wrap = el('DIV'), code = el('CODE'), main = el('MAIN'), p3 = el('P');
  const inp = el('INPUT');
  body.appendChild(p1); T(p1, 'سلام دنیا'); body.appendChild(p2); T(p2, 'hello world');
  body.appendChild(wrap); wrap.appendChild(code); T(code, 'سلام داخل کد');
  body.appendChild(main); main.appendChild(p3); T(p3, 'تست فارسی'); body.appendChild(inp);

  const docListeners = {};
  const doc = {
    readyState: 'complete', documentElement: html, body, head,
    getElementById: () => null,
    createElement: () => ({ textContent: '', id: '' }),
    querySelectorAll: (sel) => {
      const classes = String(sel).split(',').map((s) => s.trim().replace(/^\./, ''));
      const out = [];
      (function dfs(n) {
        if (!n || n.nodeType !== 1) return;
        if (classes.some((c) => n.classes.has(c))) out.push(n);
        (n.children || []).forEach(dfs);
      })(body);
      return out;
    },
    addEventListener: (t, f) => { docListeners[t] = f; },
    removeEventListener: (t) => { delete docListeners[t]; },
    createTreeWalker(root, what, filter) {
      const list = [];
      (function dfs(kids) {
        for (const n of kids) {
          const r = filter.acceptNode(n);
          if (r === NF.FILTER_REJECT) continue;
          if (r === NF.FILTER_ACCEPT) list.push(n);
          if (n.nodeType === 1 && n.children) dfs(n.children);
        }
      })(root.children || []);
      let i = 0;
      return { nextNode() { return i < list.length ? list[i++] : null } };
    },
  };
  const win = { top: null, requestIdleCallback: (cb) => cb(), addEventListener: () => {} };
  win.top = win;
  const chrome = { runtime: { lastError: null,
      sendMessage: (m, cb) => { if (cb) cb(); },
      onMessage: { addListener: () => {} } },
    storage: { local: { get: (k, cb) => cb(Object.assign({}, storageData)) },
      onChanged: { addListener: () => {} } } };
  const sandbox = { window: win, document: doc, chrome, location: { hostname: 'example.com' },
    performance: { now: () => Date.now() }, MutationObserver: class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} },
    NodeFilter: NF, setTimeout: (cb) => { cb(); return 0; }, clearTimeout: () => {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'main.js' });
  return { p1, p2, wrap, code, p3, main, inp, docListeners };
}

let fail = 0;
function check(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) fail++; }

(async () => {
  const tick = () => new Promise((r) => setImmediate(r));
  {
    const t = makeEnv({});
    await tick(); await tick();
    check('fa-paragraph-tagged', t.p1.classes.has('dynrtl-rtl'));
    check('en-paragraph-untagged', !t.p2.classes.has('dynrtl-rtl'));
    check('code-block-untagged', !t.code.classes.has('dynrtl-rtl') && !t.wrap.classes.has('dynrtl-rtl'));
    check('landmark-child-tagged', t.p3.classes.has('dynrtl-rtl'));
    check('landmark-itself-untagged', !t.main.classes.has('dynrtl-rtl'));
    check('input-untouched-before-focus', !t.inp.classes.has('dynrtl-rtl-input'));
    t.docListeners.focusin({ target: t.inp });
    check('input-dir-auto-on-focus', t.inp.attrs.dir === 'auto' && t.inp.classes.has('dynrtl-rtl-input'));
  }
  {
    const t = makeEnv({ mode: 'enable_all', siteOverrides: { 'example.com': 'off' } });
    await tick(); await tick();
    check('override-off-no-tag', !t.p1.classes.has('dynrtl-rtl') && !t.p3.classes.has('dynrtl-rtl'));
  }
  {
    const t = makeEnv({}, { lang: 'fa' });
    await tick(); await tick();
    check('fa-page-auto-skipped', !t.p1.classes.has('dynrtl-rtl'));
  }
  {
    const t = makeEnv({}, { dir: 'rtl' });
    await tick(); await tick();
    check('rtl-page-auto-skipped', !t.p1.classes.has('dynrtl-rtl'));
  }
  console.log(fail ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  process.exit(fail ? 1 : 0);
})();
