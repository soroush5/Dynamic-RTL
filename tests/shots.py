#!/usr/bin/env python3
# Dynamic RTL - store preview capture. Saves UI screenshots into previews/.
# Run from repo root:  python3 tests/shots.py
import shutil, subprocess, threading, time, sys, urllib.request, glob, os
import http.server
from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(REPO, "chrome")
PROFILE = "/tmp/dynrtl-shots"
PORT = 9347
PREVIEWS = os.path.join(REPO, "previews")
os.makedirs(PREVIEWS, exist_ok=True)
cand = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))
CR = cand[-1]

DEMO = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,">
<title>Persian news demo</title>
<style>body{font-family:Tahoma,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;line-height:2}h1{font-size:26px}a{color:#0b57d0}</style>
</head><body>
<h1>خبر مهم امروز: رونمایی از نسخه جدید داینامیک RTL</h1>
<p>این افزونه متن فارسی و عربی را در هر صفحه‌ای به‌صورت خودکار راست‌چین می‌کند و فونت وزیرمتن را اعمال می‌نماید.</p>
<p>برای اطلاعات بیشتر به <a href="https://example.com/guide">https://example.com/guide</a> مراجعه کنید یا نسخه انگلیسی را بخوانید.</p>
<p>Hello world, this English paragraph stays exactly as it was.</p>
</body></html>"""

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = DEMO.encode("utf-8")
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, format, *args): pass

srv = http.server.HTTPServer(("127.0.0.1", 8945), H)
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
        eid = [w.url.split("/")[2] for w in ctx.service_workers if w.url.endswith("/background/service-worker.js")][0]
        demo = ctx.new_page()
        demo.set_viewport_size({"width": 1280, "height": 800})
        demo.goto("http://127.0.0.1:8945/")
        demo.wait_for_timeout(2500)
        demo.screenshot(path=os.path.join(PREVIEWS, "demo-fa-rtl.png"))
        print("saved demo-fa-rtl.png", flush=True)
        pop = ctx.new_page()
        pop.set_viewport_size({"width": 400, "height": 620})
        pop.goto(f"chrome-extension://{eid}/popup/popup.html")
        pop.wait_for_timeout(700)
        pop.screenshot(path=os.path.join(PREVIEWS, "popup.png"))
        print("saved popup.png", flush=True)
        pop.close()
        opt = ctx.new_page()
        opt.set_viewport_size({"width": 900, "height": 700})
        opt.goto(f"chrome-extension://{eid}/options/options.html")
        opt.wait_for_timeout(700)
        opt.screenshot(path=os.path.join(PREVIEWS, "options.png"))
        print("saved options.png", flush=True)
        opt.close()
        tile = ctx.new_page()
        tile.set_viewport_size({"width": 440, "height": 280})
        tile.set_content("""<body style="margin:0;font-family:Tahoma,sans-serif;background:linear-gradient(135deg,#1a1b26,#2b3a67);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center">
<h1 style="margin:0;font-size:44px">Dynamic RTL</h1>
<p style="margin:8px 0 0;font-size:22px" dir="rtl">راست‌چین خودکار فارسی و عربی</p>
<p style="margin:10px 0 0;font-size:14px;opacity:.8">Chrome &bull; Firefox &bull; Safari</p>
</body>""")
        tile.wait_for_timeout(500)
        tile.screenshot(path=os.path.join(PREVIEWS, "promo-tile-440x280.png"))
        print("saved promo-tile-440x280.png", flush=True)
        tile.close()
        browser.close()
finally:
    proc.terminate()
    srv.shutdown()
print("SHOTS-DONE", flush=True)
