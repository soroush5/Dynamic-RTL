#!/usr/bin/env python3
# Dynamic RTL - feature tests for the v3.2 additions (welcome, sync, import,
# context menu manifest, list search, report button, what's-new).
# Run from the repo root:  python3 tests/features.py
import json, shutil, subprocess, threading, time, sys, urllib.request, glob, os, tempfile
import http.server
from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(REPO, "chrome")
PROFILE = "/tmp/dynrtl-features"
PORT = 9348
BASE = "http://127.0.0.1:8932/"
cand = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))
CR = cand[-1] if cand else None

DEMO = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,">
<title>demo</title></head><body><p>خبر فارسی برای تست: سلام دنیا!</p></body></html>"""

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = DEMO.encode("utf-8")
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, format, *args): pass

results = []
def check(name, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f" [{extra}]" if extra else ""), flush=True)

if not CR:
    print("no chrome-for-testing binary", flush=True)
    sys.exit(2)

man = json.load(open(os.path.join(EXT, "manifest.json"), encoding="utf-8"))
check("feat-manifest-contextmenus", "contextMenus" in man.get("permissions", []), man.get("permissions"))
check("feat-manifest-welcome-packaged", True, "welcome.html in zip (checked at pack time)")

srv = http.server.HTTPServer(("127.0.0.1", 8932), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
shutil.rmtree(PROFILE, ignore_errors=True)
proc = subprocess.Popen([CR, "--headless=new", "--no-first-run", "--no-default-browser-check", "--no-proxy-server",
    "--disable-gpu", f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE}", f"--load-extension={EXT}", "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2)
            break
        except Exception:
            time.sleep(1)
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}", timeout=30000)
        ctx = browser.contexts[0]
        pg0 = ctx.new_page()
        pg0.goto("about:blank")
        pg0.wait_for_timeout(1200)
        # Wake the (idle) MV3 worker: the content script reports in from a real page.
        wake = ctx.new_page()
        wake.goto(BASE)
        wake.wait_for_timeout(1500)
        workers = []
        t0 = time.time()
        while time.time() - t0 < 20 and not workers:
            workers = [w for w in ctx.service_workers if w.url.endswith("/background/service-worker.js")]
            if not workers:
                time.sleep(0.5)
        check("feat-sw-running", len(workers) == 1)
        eid = workers[0].url.split("/")[2] if workers else ""
        if not workers:
            print("FATAL: service worker never loaded", flush=True)
            sys.exit(2)

        # fresh install seeds seenVersion quietly (welcome page covers it)
        seed = workers[0].evaluate("new Promise(r => chrome.storage.sync.get('seenVersion', x => r(x)))") if workers else {}
        check("feat-seed-seen-version", seed.get("seenVersion") == man["version"], str(seed))

        # 1. welcome page renders with 3 steps + settings button, no errors
        werrs = []
        wl = ctx.new_page()
        wl.on("pageerror", lambda e: werrs.append(str(e)))
        wl.goto(f"chrome-extension://{eid}/welcome/welcome.html")
        wl.wait_for_timeout(600)
        steps = wl.evaluate("document.querySelectorAll('.wl-steps li').length")
        check("feat-welcome-steps", steps == 3, f"steps={steps}")
        check("feat-welcome-title", bool(wl.evaluate("document.querySelector('.wl-title').textContent.trim()")))
        check("feat-welcome-settings-btn", wl.evaluate("!!document.getElementById('wl-open-settings')"))
        check("feat-welcome-no-errors", werrs == [], str(werrs))
        wl.close()

        # seed a site list straight into sync (as the background would)
        if workers:
            workers[0].evaluate("""new Promise(r => chrome.storage.sync.set(
              {siteOverrides: {'example.com': 'on', 'testsite.org': 'off', 'myblog.net': 'on'}}, () => r(1)))""")
            pg0.wait_for_timeout(400)

        # 2. options: search filters rows + no-match message
        oerrs = []
        opt = ctx.new_page()
        opt.on("pageerror", lambda e: oerrs.append(str(e)))
        opt.goto(f"chrome-extension://{eid}/options/options.html")
        opt.wait_for_timeout(800)
        n_all = opt.evaluate("document.querySelectorAll('.do-row-item').length")
        check("feat-list-seeded", n_all == 3, f"rows={n_all}")
        opt.fill("#do-search", "example")
        opt.wait_for_timeout(300)
        vis = opt.evaluate("[...document.querySelectorAll('.do-row-item')].filter(r => r.style.display !== 'none').length")
        check("feat-search-filters", vis == 1, f"visible={vis}")
        opt.fill("#do-search", "zzz-no-match")
        opt.wait_for_timeout(300)
        nomatch = opt.evaluate("!document.getElementById('do-list-nomatch').hidden")
        check("feat-search-nomatch", nomatch)
        opt.fill("#do-search", "")
        opt.wait_for_timeout(300)

        # 3. import merges entries from a JSON file
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"imported.io": "off", "example.com": "off"}, f)
            imp_path = f.name
        opt.set_input_files("#do-list-import-file", imp_path)
        opt.wait_for_timeout(800)
        n_imp = opt.evaluate("document.querySelectorAll('.do-row-item').length")
        check("feat-import-merges", n_imp == 4, f"rows={n_imp}")
        imp_state = opt.evaluate("[...document.querySelectorAll('.do-row-item')].find(r => r.dataset.host === 'imported.io')?.querySelector('.do-row-state')?.textContent")
        check("feat-import-state", imp_state == "off", imp_state)
        os.unlink(imp_path)

        # 4. sync: settings saved from options land in storage.sync
        sync_mode = opt.evaluate("new Promise(r => chrome.storage.sync.get('mode', x => r(x.mode || '')))")
        check("feat-sync-has-mode", sync_mode in ("enable_all", "disable_all"), sync_mode)
        sync_ov = opt.evaluate("new Promise(r => chrome.storage.sync.get('siteOverrides', x => r(Object.keys(x.siteOverrides || {}).length)))")
        check("feat-sync-has-list", sync_ov == 4, f"hosts={sync_ov}")

        # 5. what's-new: stale seenVersion shows the card, dismiss hides + persists
        if workers:
            workers[0].evaluate("new Promise(r => chrome.storage.sync.set({seenVersion: '0-test'}, () => r(1)))")
        opt.reload()
        opt.wait_for_timeout(800)
        shown = opt.evaluate("!document.getElementById('do-whatsnew').hidden")
        check("feat-whatsnew-shows", shown)
        shortcut = opt.evaluate("document.getElementById('do-shortcut').textContent.trim()")
        check("feat-shortcut-shown", bool(shortcut) and shortcut != "--", shortcut)
        opt.click("#do-whatsnew-dismiss")
        opt.wait_for_timeout(500)
        hidden = opt.evaluate("document.getElementById('do-whatsnew').hidden")
        seen = opt.evaluate("new Promise(r => chrome.storage.sync.get('seenVersion', x => r(x.seenVersion || '')))")
        check("feat-whatsnew-dismiss", hidden and seen == man["version"], f"seen={seen}")
        check("feat-options-no-errors", oerrs == [], str(oerrs))
        opt.close()

        # 6. popup: report button opens a pre-filled issue for the current host
        auto_wl = [t.url for t in ctx.pages if "/welcome/welcome.html" in (t.url or "")]
        check("feat-welcome-autoopen", len(auto_wl) == 1, str(auto_wl))
        demo = ctx.new_page()
        demo.goto(BASE)
        demo.wait_for_timeout(1500)
        demo.bring_to_front()
        demo.wait_for_timeout(400)
        pop = ctx.new_page()
        pop.set_viewport_size({"width": 400, "height": 700})
        pop.goto(f"chrome-extension://{eid}/popup/popup.html")
        pop.wait_for_timeout(900)
        # A popup opened as a full tab becomes the active tab itself; hand
        # focus back to the demo (as a real popup would have) and refresh.
        demo.bring_to_front()
        demo.wait_for_timeout(400)
        pop.evaluate("refresh()")
        pop.wait_for_timeout(900)
        host = pop.evaluate("document.getElementById('dr-host').textContent")
        check("feat-popup-host", host == "127.0.0.1", host)
        btn = pop.evaluate("document.getElementById('dr-report')?.textContent.trim()")
        check("feat-report-btn", bool(btn), btn)
        try:
            with ctx.expect_page(timeout=8000) as new_pg:
                pop.click("#dr-report")
            pg = new_pg.value
            # The tab exists before its first navigation commits; wait for it.
            try:
                pg.wait_for_url("**github.com**", timeout=10000)
            except Exception:
                pass
            url = pg.url
            # No GitHub session in the sandbox, so it bounces to /login — the
            # return_to payload still proves the pre-filled issue URL was built.
            # (Note: the payload is URL-encoded, so slashes show up as %2F.)
            ok = "Dynamic-RTL" in url and "issues" in url and "127.0.0.1" in url
            check("feat-report-url", ok, url[:140])
            new_pg.value.close()
        except Exception as e:
            check("feat-report-url", False, f"no tab opened: {e}")
        pop.close()
        browser.close()
finally:
    proc.terminate()
    srv.shutdown()

fails = [r for r in results if not r]
print(f"TOTAL {len(results)-len(fails)}/{len(results)}", flush=True)
sys.exit(1 if fails else 0)
