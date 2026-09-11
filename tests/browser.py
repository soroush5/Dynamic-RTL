#!/usr/bin/env python3
# Dynamic RTL - browser test suite (needs: python playwright + a Chromium/Chrome-for-Testing binary).
# Run from the repo root:  python3 tests/browser.py
# Loads the unpacked chrome/ build with a clean profile and checks behavior.
import json, shutil, subprocess, threading, time, sys, urllib.request, glob, os
import http.server

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
from playwright.sync_api import sync_playwright

EXT = os.path.join(REPO, "chrome")
PROFILE = "/tmp/dynrtl-profile"
PORT = 9345
BASE = "http://127.0.0.1:8931/"
cand = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))
CR = cand[-1] if cand else None

FA_HTML = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>FA</title></head><body>
<main><p id="fa1">سلام دنیا! این یک پاراگراف فارسی است.</p>
<p id="en1">Hello world, this is an English paragraph.</p>
<p id="fa2">قیمت امروز دلار <a id="u1" href="https://example.com/search?q=test">https://example.com/search?q=test</a> اعلام شد.</p>
<pre id="pre1">سلام داخل کد نباید راست‌چین شود</pre>
<p>کد داخل متن <code id="c1">سلام کد</code> باید چپ‌چین بماند.</p></main>
<input id="in1" type="text" placeholder="چیزی بنویس…">
<textarea id="ta1"></textarea>
<div id="ed1" contenteditable="true"></div>
<div id="sh"></div>
<script>document.getElementById('sh').attachShadow({mode:'open'}).innerHTML='<p id="shfa">متن فارسی داخل شدو</p><p id="shen">english in shadow</p>';</script>
<iframe id="fr1" src="/fa-inner.html" width="300" height="100"></iframe>
</body></html>"""

EN_HTML = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>EN</title></head><body>
<main><p>Hello world.</p><p>Another English paragraph with numbers 123 and symbols.</p></main>
</body></html>"""

FA_LANG_HTML = """<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>FA site</title></head><body>
<p id="n1">این سایت خودش فارسی است و نباید دست بخورد.</p>
</body></html>"""

FA_INNER_HTML = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><p id="innerfa">فارسی داخل آی‌فریم</p></body></html>"""

def build_heavy():
    parts = ['<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>H</title></head><body><main>']
    for i in range(5000):
        parts.append(f'<p class="en">English line number {i} lorem ipsum dolor sit amet.</p>')
    for i in range(500):
        parts.append(f'<p class="fa">پاراگراف فارسی شماره {i} برای تست سرعت پردازش.</p>')
    parts.append('</main></body></html>')
    return ''.join(parts)

PAGES = {"fa.html": FA_HTML, "en.html": EN_HTML, "fa-lang.html": FA_LANG_HTML,
         "fa-inner.html": FA_INNER_HTML, "heavy.html": build_heavy()}

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        name = self.path.split("?")[0].lstrip("/")
        if name in PAGES:
            body = PAGES[name].encode("utf-8")
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, format, *args): pass

results = []
def check(name, cond, extra=""):
    results.append({"test": name, "pass": bool(cond), "extra": extra})
    print(("PASS " if cond else "FAIL ") + name + (f" [{extra}]" if extra else ""), flush=True)

def launch_browser(headless):
    shutil.rmtree(PROFILE, ignore_errors=True)
    args = [CR, "--no-first-run", "--no-default-browser-check", "--no-proxy-server",
            f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
            f"--user-data-dir={PROFILE}", f"--load-extension={EXT}", "about:blank"]
    if headless:
        args[1:1] = ["--headless=new", "--disable-gpu"]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2)
            return proc
        except Exception:
            if proc.poll() is not None:
                return proc
            time.sleep(1)
    return proc

def our_workers(ctx):
    return [w for w in ctx.service_workers if w.url.endswith("/background/service-worker.js")]

def get_worker(ctx, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        ours = our_workers(ctx)
        if ours:
            return ours[0]
        time.sleep(0.5)
    return None

def find_tab_by_host(worker):
    return worker.evaluate("""async () => {
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        const st = await new Promise(res => { try { chrome.tabs.sendMessage(t.id, {type:'DYNRTL_GET_STATE'}, {frameId:0}, x => res(x||null)); } catch(e) { res(null); } });
        if (st && st.host === '127.0.0.1') return t.id;
      }
      return null;
    }""")

def main():
    if not CR:
        print("FATAL: no Chrome-for-Testing binary found (playwright install chromium)"); sys.exit(2)
    print("using browser:", CR, flush=True)
    srv = http.server.HTTPServer(("127.0.0.1", 8931), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    headed_mode = "headless"
    proc = None
    with sync_playwright() as p:
        proc = launch_browser(True)
        try:
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}", timeout=30000)
        except Exception as e:
            print(f"headless connect failed ({e}), retrying HEADED", flush=True)
            proc.terminate()
            headed_mode = "HEADED"
            proc = launch_browser(False)
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}", timeout=30000)
        ctx = browser.contexts[0]
        page = ctx.new_page()
        page.goto(BASE + "en.html")
        worker = get_worker(ctx)
        if not worker and headed_mode == "headless":
            print("headless: extension SW not loaded, retrying HEADED", flush=True)
            browser.close()
            proc.terminate()
            headed_mode = "HEADED"
            proc = launch_browser(False)
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}", timeout=30000)
            ctx = browser.contexts[0]
            page = ctx.new_page()
            page.goto(BASE + "en.html")
            worker = get_worker(ctx, 25)
        if not worker:
            print("FATAL: service worker never loaded")
            try: browser.close()
            except Exception: pass
            try: proc.terminate()
            except Exception: pass
            sys.exit(2)
        ext_id = worker.url.split("/")[2]
        print(f"extension loaded: id={ext_id} mode={headed_mode}", flush=True)
        check("sw-single-worker", len(our_workers(ctx)) == 1, f"count={len(our_workers(ctx))}")

        errors = []
        reqs = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("request", lambda r: reqs.append(r.url))

        page.goto(BASE + "fa.html")
        t0 = time.time()
        page.wait_for_function("document.querySelectorAll('.dynrtl-rtl').length>=2", timeout=5000)
        dtf = time.time() - t0
        check("fast-first-tags", dtf < 2.0, f"{dtf:.2f}s after load")
        page.wait_for_timeout(1500)
        check("fa-tagged", page.eval_on_selector("#fa1", "e=>e.classList.contains('dynrtl-rtl')"))
        check("fa-computed-rtl", page.eval_on_selector("#fa1", "e=>getComputedStyle(e).direction") == "rtl")
        check("fa-font", "Vazirmatn" in page.eval_on_selector("#fa1", "e=>getComputedStyle(e).fontFamily"))
        check("en-untagged", page.eval_on_selector("#en1", "e=>!e.classList.contains('dynrtl-rtl')"))
        check("pre-untagged", page.eval_on_selector("#pre1", "e=>!e.classList.contains('dynrtl-rtl')"))
        check("code-kept-ltr-in-rtl-block", page.eval_on_selector("#c1", "e=>getComputedStyle(e).direction") == "ltr" and page.evaluate("!!document.getElementById('c1').closest('.dynrtl-rtl')"))
        check("link-plaintext", page.eval_on_selector("#u1", "e=>getComputedStyle(e).unicodeBidi") == "plaintext")
        check("shadow-tagged", page.evaluate("document.getElementById('sh').shadowRoot.querySelector('#shfa').classList.contains('dynrtl-rtl')"))
        check("shadow-en-untagged", page.evaluate("!document.getElementById('sh').shadowRoot.querySelector('#shen').classList.contains('dynrtl-rtl')"))
        page.click("#in1"); page.keyboard.type("سلام")
        check("input-dir-auto", page.eval_on_selector("#in1", "e=>e.getAttribute('dir')") == "auto")
        check("input-font-class", page.eval_on_selector("#in1", "e=>e.classList.contains('dynrtl-rtl-input')"))
        page.click("#ta1"); page.keyboard.type("test")
        check("textarea-setup", page.eval_on_selector("#ta1", "e=>e.getAttribute('dir')") == "auto")
        page.click("#ed1"); page.keyboard.type("متن")
        check("contenteditable-setup", page.eval_on_selector("#ed1", "e=>e.getAttribute('dir')") == "auto")
        inner_tagged = None
        try:
            for f in page.frames:
                if "fa-inner" in (f.url or ""):
                    inner_tagged = f.eval_on_selector("#innerfa", "e=>e.classList.contains('dynrtl-rtl')")
                    break
        except Exception as e:
            inner_tagged = f"ERR {e}"
        check("iframe-untouched-by-design", inner_tagged is False, f"value={inner_tagged}")

        reqs.clear()
        page.goto(BASE + "en.html"); page.wait_for_timeout(1500)
        check("en-page-zero-tags", page.evaluate("document.querySelectorAll('.dynrtl-rtl').length") == 0)
        woff = [u for u in reqs if "woff2" in u]
        check("en-page-no-font-download", len(woff) == 0, f"woff2={len(woff)}")

        page.goto(BASE + "fa-lang.html"); page.wait_for_timeout(1500)
        check("fa-site-auto-skipped", page.evaluate("document.querySelectorAll('.dynrtl-rtl').length") == 0)

        page.goto(BASE + "fa.html"); page.wait_for_timeout(1500)
        n_before = page.evaluate("document.querySelectorAll('.dynrtl-rtl').length")
        tab_id = find_tab_by_host(worker)
        check("toggle-tab-found", tab_id is not None)
        tog = worker.evaluate(f"toggle({tab_id}, '127.0.0.1')")
        page.wait_for_timeout(800)
        n_after = page.evaluate("document.querySelectorAll('.dynrtl-rtl').length")
        check("toggle-off-works", tog.get("ok") and tog.get("state") == "off" and n_after == 0, f"before={n_before} after={n_after} resp={tog}")
        tog2 = worker.evaluate(f"commandToggle({tab_id})")
        page.wait_for_timeout(1500)
        n_on = page.evaluate("document.querySelectorAll('.dynrtl-rtl').length")
        check("shortcut-path-works", tog2.get("ok") and tog2.get("state") == "on" and n_on > 0, f"resp={tog2} tags={n_on}")
        page.goto(BASE + "fa-lang.html"); page.wait_for_timeout(1200)
        check("override-beats-autoskip", page.evaluate("document.querySelectorAll('.dynrtl-rtl').length") > 0)
        worker.evaluate("chrome.storage.local.set({siteOverrides:{}})")

        page.goto(BASE + "fa.html"); page.wait_for_timeout(1200)
        page.evaluate("() => { const d = document.createElement('div'); d.setAttribute('data-dynrtl-skip', ''); const p = document.createElement('p'); p.id = 'skipfa'; p.textContent = 'سلام'; d.appendChild(p); document.body.appendChild(d); }")
        page.wait_for_timeout(800)
        check("dynrtl-skip-honored", page.evaluate("!document.getElementById('skipfa').closest('.dynrtl-rtl')"))

        t0 = time.time()
        page.evaluate("""() => new Promise(res => { let i=0; const iv=setInterval(()=>{ for(let k=0;k<15;k++){ const d=document.createElement('div'); d.className='msg'; d.textContent='پیام چت شماره '+(i*15+k)+' سلام'; document.body.appendChild(d);} i++; if(i>=20){clearInterval(iv);res();} },50); })""")
        page.wait_for_function("document.querySelectorAll('.msg.dynrtl-rtl').length>=300", timeout=15000)
        dt = time.time() - t0
        check("chat-stream-all-tagged", True, f"300 msgs in {dt:.1f}s")
        check("chat-stream-fast", dt < 8, f"{dt:.1f}s")
        rt0 = time.time(); page.evaluate("1+1"); rt = time.time() - rt0
        check("tab-responsive-after-storm", rt < 1.0, f"roundtrip={rt*1000:.0f}ms")

        t0 = time.time()
        page.goto(BASE + "heavy.html")
        page.wait_for_function("document.querySelectorAll('p.fa.dynrtl-rtl').length>=500", timeout=20000)
        dt = time.time() - t0
        check("heavy-5500-nodes", dt < 10, f"{dt:.1f}s for 5500 nodes/500 FA")

        pop = ctx.new_page()
        pop.on("pageerror", lambda e: errors.append("popup: " + str(e)))
        pop.goto(f"chrome-extension://{ext_id}/popup/popup.html")
        pop.wait_for_timeout(800)
        check("popup-renders", pop.evaluate("!!document.getElementById('dr-site-toggle')"))
        check("popup-version-shown", (pop.evaluate("document.getElementById('dr-version').textContent") or "") == "v3.2", pop.evaluate("document.getElementById('dr-version').textContent"))
        check("popup-github-url", pop.evaluate("document.getElementById('dr-repo-link').href") == "https://github.com/soroush5/Dynamic-RTL")
        # real popup toggle path (popup sends host, like the toolbar click does)
        tog_pop = pop.evaluate(f"new Promise(res => chrome.runtime.sendMessage({{type:'DYNRTL_TOGGLE_CURRENT', tabId:{tab_id}, host:'127.0.0.1'}}, r => res(r)))")
        check("popup-toggle-path-off", tog_pop.get("ok") and tog_pop.get("state") == "off")
        pop.wait_for_timeout(600)
        check("popup-toggle-path-untags", page.evaluate("document.querySelectorAll('.dynrtl-rtl').length") == 0)
        tog_pop2 = pop.evaluate(f"new Promise(res => chrome.runtime.sendMessage({{type:'DYNRTL_TOGGLE_CURRENT', tabId:{tab_id}, host:'127.0.0.1'}}, r => res(r)))")
        check("popup-toggle-path-on", tog_pop2.get("state") == "on")
        pop.wait_for_timeout(1000)
        pop.close()

        check("zero-page-errors", len(errors) == 0, f"errors={errors[:3]}")
        browser.close()
    if proc:
        proc.terminate()
    srv.shutdown()
    fails = [r for r in results if not r["pass"]]
    print(f"\nTOTAL {len(results)-len(fails)}/{len(results)} passed", flush=True)
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
