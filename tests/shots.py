#!/usr/bin/env python3
# Saves store screenshots into previews/. Run after ./scripts/build.sh:
#   python3 tests/shots.py
import os
import sys

from common import sync_playwright, Server, launch, tab_id, REPO

PREVIEWS = os.path.join(REPO, "previews")

DEMO = """<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Chat</title>
<style>
body { margin: 0; font: 16px/1.65 -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f1f1f; background: #fff; }
.top { height: 56px; display: flex; align-items: center; padding: 0 24px; border-bottom: 1px solid #eee; font-weight: 600; }
.chat { max-width: 720px; margin: 0 auto; padding: 28px 24px 140px; }
.user { margin: 0 0 24px auto; width: fit-content; max-width: 80%; background: #f3f3f3; border-radius: 18px; padding: 10px 16px; }
.bot { margin-bottom: 28px; }
code { background: #f3f3f3; border-radius: 4px; padding: 1px 5px; font-size: 14px; }
pre { background: #f6f6f6; border-radius: 10px; padding: 12px 16px; font-size: 14px; }
.composer { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); width: 672px; border: 1px solid #ddd;
  border-radius: 24px; padding: 14px 20px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
.composer div { outline: none; min-height: 24px; }
</style></head><body>
<div class="top">Assistant</div>
<div class="chat">
  <div class="user">چطور می‌توانم در React یک شمارنده ساده بسازم؟</div>
  <div class="bot">
    <p>برای ساخت یک شمارنده در React کافی است از هوک <code>useState</code> استفاده کنید. مراحل کار:</p>
    <ol>
      <li>یک کامپوننت تابعی بسازید.</li>
      <li>مقدار اولیه را با <code>useState(0)</code> تعریف کنید.</li>
      <li>با هر کلیک روی دکمه، مقدار را یکی زیاد کنید.</li>
    </ol>
    <pre><code>const [count, setCount] = useState(0);</code></pre>
    <p>اگر سوال دیگری داشتید، بپرسید!</p>
  </div>
  <div class="user">Thanks! Can you also show the English version?</div>
  <div class="bot"><p>Sure. Use <code>useState</code> for the value and update it in the click handler.</p></div>
</div>
<div class="composer"><div contenteditable="true" id="box"></div></div>
</body></html>"""


def main():
    os.makedirs(PREVIEWS, exist_ok=True)
    srv = Server({"/chat.html": DEMO})
    with sync_playwright() as p:
        for scheme, suffix in (("light", ""), ("dark", "-dark")):
            ctx, sw, ext_id = launch(p)
            demo = ctx.new_page()
            demo.set_viewport_size({"width": 1280, "height": 800})
            demo.goto(srv.base + "/chat.html")
            demo.click("#box")
            demo.keyboard.type("یک سوال دیگر دارم")
            demo.wait_for_timeout(600)
            if not suffix:
                demo.screenshot(path=os.path.join(PREVIEWS, "demo-chat.png"))
            tid = tab_id(sw, "chat.html")

            # The popup reads its own active tab; point it at the demo tab instead.
            pop = ctx.new_page()
            pop.emulate_media(color_scheme=scheme)
            pop.add_init_script(f"chrome.tabs.query = async () => [{{id: {tid}, url: 'https://chat.example.com/'}}];")
            pop.set_viewport_size({"width": 264, "height": 120})
            pop.goto(f"chrome-extension://{ext_id}/popup/popup.html")
            pop.wait_for_timeout(400)
            h = pop.evaluate("document.body.scrollHeight")
            pop.set_viewport_size({"width": 264, "height": h})
            pop.screenshot(path=os.path.join(PREVIEWS, f"popup{suffix}.png"))

            sw.evaluate("() => Store.save({siteOverrides: {'news.example.com': 'off', 'docs.example.org': 'on'}})")
            opt = ctx.new_page()
            opt.emulate_media(color_scheme=scheme)
            opt.set_viewport_size({"width": 800, "height": 900})
            opt.goto(f"chrome-extension://{ext_id}/options/options.html")
            opt.wait_for_timeout(500)
            opt.screenshot(path=os.path.join(PREVIEWS, f"options{suffix}.png"), full_page=True)
            ctx.close()
    srv.close()
    print("saved to", PREVIEWS)


if __name__ == "__main__":
    sys.exit(main())
