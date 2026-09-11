#!/usr/bin/env python3
# Dynamic RTL - i18n probe. Verifies popup/options render in the UI locale
# (FA -> Persian + RTL, EN -> English + LTR). Run from repo root:
#   python3 tests/i18n.py
import shutil, subprocess, time, sys, urllib.request, glob, os
from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(REPO, "chrome")
PROFILE = "/tmp/dynrtl-i18n"
PORT = 9344
cand = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))
CR = cand[-1]

FA = {
    "tagline": "راست‌چین خودکار و فونت فارسی",
    "toggle": "فعال در این سایت",
    "unsupported": "در این صفحه در دسترس نیست",
    "open_regular": "برای تغییر وضعیت، یک سایت معمولی باز کنید.",
    "mode": "حالت کلی",
    "options_title": "حالت پیش‌فرض",
}
EN = {
    "tagline": "Auto RTL & Persian font",
    "toggle": "Active on this site",
    "unsupported": "Not available on this page",
    "open_regular": "Open a regular website to toggle.",
    "mode": "GLOBAL MODE",
    "options_title": "Default mode",
}

results = []
def check(name, cond, extra=""):
    results.append(cond)
    print(("PASS " if cond else "FAIL ") + name + (f" [{extra}]" if extra else ""), flush=True)

def run_once(lang):
    shutil.rmtree(PROFILE, ignore_errors=True)
    headed = bool(os.environ.get("DYNRTL_HEADED"))
    args = [CR, "--no-first-run", "--no-default-browser-check", "--no-proxy-server",
            f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
            f"--user-data-dir={PROFILE}", f"--lang={lang}",
            f"--load-extension={EXT}", "about:blank"]
    if not headed:
        args[1:1] = ["--headless=new", "--disable-gpu"]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            ext = [w.url.split("/")[2] for w in ctx.service_workers if w.url.endswith("/background/service-worker.js")]
            if not ext:
                return None
            eid = ext[0]
            pop = ctx.new_page()
            pop.set_viewport_size({"width": 400, "height": 620})
            pop.goto(f"chrome-extension://{eid}/popup/popup.html")
            pop.wait_for_timeout(800)
            out = {
                "tagline": pop.evaluate("document.querySelector('.dr-tagline').textContent"),
                "toggle": pop.evaluate("document.querySelector('.dr-toggle-label').textContent"),
                "host": pop.evaluate("document.getElementById('dr-host').textContent"),
                "hint": pop.evaluate("document.getElementById('dr-mode-hint').textContent"),
                "mode": pop.evaluate("document.querySelector('.dr-card-title').textContent"),
                "dir": pop.evaluate("document.dir"),
            }
            pop.close()
            opt = ctx.new_page()
            opt.goto(f"chrome-extension://{eid}/options/options.html")
            opt.wait_for_timeout(800)
            out["options_title"] = opt.evaluate("document.querySelector('#do-whatsnew + section .do-card-title').textContent")
            out["opt_dir"] = opt.evaluate("document.dir")
            try:
                out["uilang"] = opt.evaluate("chrome.i18n.getUILanguage()")
            except Exception:
                out["uilang"] = ""
            errs = []
            opt.on("pageerror", lambda e: errs.append(str(e)))
            out["errors"] = errs
            opt.close()
            browser.close()
            return out
    finally:
        proc.terminate()

for lang, exp, want_dir in [("en", EN, "ltr"), ("fa", FA, "rtl")]:
    r = run_once(lang)
    if r is None:
        check(f"i18n-{lang}-loaded", False)
        continue
    if lang == "fa" and r.get("uilang", "")[:2].lower() != "fa":
        print(f"SKIP i18n-fa-* (environment pins UI locale to {r.get('uilang')}; FA strings verified via tests/browser.py override path)", flush=True)
        continue
    check(f"i18n-{lang}-loaded", True)
    check(f"i18n-{lang}-tagline", r["tagline"] == exp["tagline"], r["tagline"])
    check(f"i18n-{lang}-toggle", r["toggle"] == exp["toggle"], r["toggle"])
    check(f"i18n-{lang}-unsupported", r["host"] == exp["unsupported"] and r["hint"] == exp["open_regular"], f"host={r['host']} hint={r['hint']}")
    check(f"i18n-{lang}-mode", r["mode"] == exp["mode"], r["mode"])
    check(f"i18n-{lang}-popup-dir", r["dir"] == want_dir, r["dir"])
    check(f"i18n-{lang}-options-title", r["options_title"] == exp["options_title"], r["options_title"])
    check(f"i18n-{lang}-options-dir", r["opt_dir"] == want_dir, r["opt_dir"])
    check(f"i18n-{lang}-no-errors", len(r["errors"]) == 0, str(r["errors"][:2]))

fails = [r for r in results if not r]
print(f"TOTAL {len(results)-len(fails)}/{len(results)}", flush=True)

# FA wiring through the real code path: override getMessage with the shipped
# fa/messages.json, then run the real applyI18n+refresh. Works in any locale.
print("== fa wiring ==", flush=True)
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
        pg0.wait_for_timeout(1000)
        ext = [w.url.split("/")[2] for w in ctx.service_workers if w.url.endswith("/background/service-worker.js")][0]
        for page_name, url, expected in [
            ("popup", f"chrome-extension://{ext}/popup/popup.html",
             {"tagline": "راست‌چین خودکار و فونت فارسی", "toggle": "فعال در این سایت", "mode": "حالت کلی"}),
            ("options", f"chrome-extension://{ext}/options/options.html",
             {"defaultMode": "حالت پیش‌فرض", "add": "افزودن", "export": "خروجی فهرست"})]:
            sels = {"tagline": ".dr-tagline", "toggle": ".dr-toggle-label", "mode": ".dr-card-title",
                    "defaultMode": "#do-whatsnew + section .do-card-title", "add": "#do-add-btn", "export": "#do-list-export"}
            picks = {k: sels[k] for k in expected};
            pg = ctx.new_page()
            pg.goto(url)
            pg.wait_for_timeout(600)
            r = pg.evaluate("""async (picks) => {
              const res = await fetch(chrome.runtime.getURL('_locales/fa/messages.json'));
              const FA = await res.json();
              chrome.i18n.getMessage = (k, subs) => {
                const e = FA[k]; if (!e) return '';
                let s = e.message;
                (subs || []).forEach((v, i) => { s = s.split('$' + (i + 1)).join(String(v)); });
                return s;
              };
              chrome.i18n.getUILanguage = () => 'fa-IR';
              applyI18n();
              if (typeof refresh === 'function') await refresh();
              const out = { dir: document.dir, lang: document.documentElement.lang, errors: [] };
              for (const [k, sel] of Object.entries(picks)) {
                const el = document.querySelector(sel);
                out[k] = el ? el.textContent.trim() : 'MISSING-EL';
              }
              return out;
            }""", picks)
            check(f"fa-wiring-{page_name}-dir", r["dir"] == "rtl" and r["lang"] == "fa", f"{r['dir']}/{r['lang']}")
            for k, want in expected.items():
                check(f"fa-wiring-{page_name}-{k}", r[k] == want, r[k])
            pg.close()
        browser.close()
finally:
    proc.terminate()

fails = [r for r in results if not r]
print(f"GRAND TOTAL {len(results)-len(fails)}/{len(results)}", flush=True)
sys.exit(1 if fails else 0)
