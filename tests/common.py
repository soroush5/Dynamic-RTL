# Shared helpers for the browser tests.
# Needs Python Playwright with its bundled Chromium: pip install playwright && playwright install chromium
import http.server
import os
import tempfile
import threading
import time

from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME_EXT = os.path.join(REPO, "chrome")

results = []


def check(name, ok, extra=""):
    results.append((name, bool(ok), extra))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)


def summary():
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed", flush=True)
    return 1 if failed else 0


class Server:
    """Serves a dict of path -> html (or a callable that writes a chunked response)."""

    def __init__(self, pages, port=0):
        pages_ref = pages

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self):
                page = pages_ref.get(self.path.split("?")[0])
                if page is None:
                    self.send_response(404)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                if callable(page):
                    page(self)
                    return
                body = page.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self):
        self.httpd.shutdown()


def launch(p, ext=CHROME_EXT, headless=True, args=(), locale=None):
    profile = tempfile.mkdtemp(prefix="dynrtl-")
    extra = list(args)
    if locale:
        extra.append(f"--lang={locale}")
    ctx = p.chromium.launch_persistent_context(
        profile,
        channel="chromium",
        headless=headless,
        locale=locale,
        args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}", *extra],
        viewport={"width": 1280, "height": 900},
    )
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
    ext_id = sw.url.split("/")[2]
    # The welcome tab opens on install; close it so tests start clean.
    deadline = time.time() + 3
    while time.time() < deadline:
        for pg in ctx.pages:
            if "welcome" in pg.url:
                pg.close()
                deadline = 0
        time.sleep(0.1)
    return ctx, sw, ext_id


def tab_id(sw, url_part):
    # Without the tabs permission the worker can't read URLs, so ask each page.
    return sw.evaluate(
        """async (part) => {
          for (const t of await chrome.tabs.query({})) {
            try {
              const st = await chrome.tabs.sendMessage(t.id, {t: 'stats'}, {frameId: 0});
              if (st && st.url.includes(part)) return t.id;
            } catch (e) {}
          }
          return null;
        }""",
        url_part,
    )


def toggle(sw, tid, url):
    return sw.evaluate("([id, url]) => Store.toggle({id, url})", [tid, url])


def page_stats(sw, tid):
    return sw.evaluate(
        "async (id) => { try { return await chrome.tabs.sendMessage(id, {t: 'stats'}, {frameId: 0}); } catch (e) { return null; } }",
        tid,
    )


__all__ = ["sync_playwright", "check", "summary", "Server", "launch", "tab_id", "toggle", "page_stats", "REPO", "CHROME_EXT"]
