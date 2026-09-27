#!/usr/bin/env python3
# Behavior tests on local pages. Run from the repo root after ./scripts/build.sh:
#   python3 tests/core.py
import sys
import time

from common import sync_playwright, check, summary, Server, launch, tab_id, toggle, page_stats

HEAD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>t</title>'

FA = HEAD + """<style>
body { font-family: Georgia, serif; }
.flex { display: flex; gap: 4px; }
h2 { text-align: center; }
ol { padding-left: 40px; padding-right: 0; }
.mono { font-family: monospace; }
</style></head><body><main>
<p id="fa">سلام دنیا! این یک پاراگراف فارسی است.</p>
<p id="en">Hello world, this is an English paragraph.</p>
<p id="mixed">In Persian, the word <b id="word">سلام</b> means hello and it is used every day by millions of people.</p>
<p id="react">React یک کتابخانه جاوااسکریپت برای ساخت رابط کاربری است.</p>
<p id="withcode">برای نصب از <code id="code">npm install سلام</code> استفاده کنید و به <a id="link" href="#">https://example.com/a?b=c</a> بروید.</p>
<pre id="pre">سلام داخل کد</pre>
<h2 id="center">عنوان وسط‌چین</h2>
<ol id="list"><li id="li1">مورد اول فهرست</li><li>مورد دوم</li></ol>
<div class="flex" id="flex"><svg width="10" height="10"></svg>ارسال پیام</div>
<div class="flex" id="flexonly">فقط متن</div>
<p id="monowrap">متن با <span class="mono" id="mono">فونت ثابت</span> در وسط</p>
<table><tr><td id="td">خانه جدول</td><td>cell</td></tr></table>
<div data-dynrtl-skip><p id="skipped">نباید تغییر کند</p></div>
</main>
<input id="in" type="text" placeholder="type here">
<input id="center-in" type="text" style="text-align:center">
<textarea id="ta"></textarea>
<div id="ce" contenteditable="true"><p>existing english</p></div>
<div id="host"></div>
<script>
document.getElementById('host').attachShadow({mode: 'open'}).innerHTML =
  '<p id="sfa">متن فارسی داخل شدو</p><p id="sen">english in shadow</p>';
</script>
</body></html>"""

EN = HEAD + "</head><body><main><p>Hello world.</p><p>Another English paragraph, 123.</p></main></body></html>"
FA_SITE = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><p id="n">این سایت خودش فارسی است.</p></body></html>'


def heavy(en, fa):
    rows = [f'<p class="en">English line {i} lorem ipsum dolor sit amet, consectetur.</p>' for i in range(en)]
    rows += [f'<p class="fa">پاراگراف فارسی شماره {i} برای آزمایش سرعت.</p>' for i in range(fa)]
    return HEAD + "</head><body><main>" + "".join(rows) + "</main></body></html>"


def slow_page(handler):
    # Sends the Persian paragraph late, like a real page arriving over the network.
    handler.send_response(200)
    handler.send_header("Content-Type", "text/html; charset=utf-8")
    handler.send_header("Transfer-Encoding", "chunked")
    handler.end_headers()

    def chunk(s):
        b = s.encode("utf-8")
        handler.wfile.write(f"{len(b):x}\r\n".encode() + b + b"\r\n")
        handler.wfile.flush()

    chunk(HEAD + "<style>body{font-family:Arial}</style></head><body><p>English first.</p>")
    time.sleep(0.4)
    chunk("""<p id="x">سلام، این متن باید پیش از نمایش راست‌چین شود.</p>
<script>
new ResizeObserver((e, o) => {
  const x = document.getElementById('x');
  window.__first = x.getAttribute('data-dynrtl');
  window.__dir = getComputedStyle(x).direction;
  o.disconnect();
}).observe(document.getElementById('x'));
</script>""")
    time.sleep(0.3)
    chunk("</body></html>")
    handler.wfile.write(b"0\r\n\r\n")


PAGES = {
    "/fa.html": FA,
    "/en.html": EN,
    "/fa-site.html": FA_SITE,
    "/heavy.html": heavy(5000, 500),
    "/english-heavy.html": heavy(20000, 0),
    "/slow.html": slow_page,
}


def attr(page, sel):
    return page.eval_on_selector(sel, "e => e.getAttribute('data-dynrtl')")


def style(page, sel, prop):
    return page.eval_on_selector(sel, f"e => getComputedStyle(e).{prop}")


def main():
    srv = Server(PAGES)
    base = srv.base
    with sync_playwright() as p:
        ctx, sw, ext_id = launch(p)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # Basic marking
        page.goto(base + "/fa.html")
        page.wait_for_timeout(600)
        check("fa paragraph marked rtl", attr(page, "#fa") == "r")
        check("fa paragraph direction", style(page, "#fa", "direction") == "rtl")
        check("fa paragraph aligned right", style(page, "#fa", "textAlign") == "right")
        ff = style(page, "#fa", "fontFamily")
        check("fa paragraph font", ff.startswith('"Vazirmatn DynRTL"') and "Georgia" in ff, ff)
        cdp = ctx.new_cdp_session(page)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]
        node = cdp.send("DOM.querySelector", {"nodeId": root, "selector": "#fa"})["nodeId"]
        drawn = [f["familyName"] for f in cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]]
        cdp.detach()
        check("fa glyphs drawn with Vazirmatn", "Vazirmatn" in drawn, str(drawn))
        check("english paragraph untouched", attr(page, "#en") is None)
        check("english with one persian word stays ltr", attr(page, "#mixed") == "f", attr(page, "#mixed"))
        check("persian with english first word is rtl", attr(page, "#react") == "r")
        check("inline code stays ltr", style(page, "#code", "direction") == "ltr")
        check("link is plaintext", style(page, "#link", "unicodeBidi") == "plaintext")
        check("pre untouched", attr(page, "#pre") is None and style(page, "#pre", "direction") == "ltr")
        check("centered heading keeps center", attr(page, "#center") == "c" and style(page, "#center", "textAlign") == "center")
        check("list item rtl", attr(page, "#li1") == "r")
        check("list mirrored", attr(page, "#list") == "l" and style(page, "#list", "paddingRight") == "40px"
              and style(page, "#list", "paddingLeft") == "0px", style(page, "#list", "paddingRight"))
        check("flex row with icon not flipped", attr(page, "#flex") == "f" and style(page, "#flex", "direction") == "ltr")
        check("flex with text only flipped", attr(page, "#flexonly") == "r")
        check("span with own font gets font", attr(page, "#mono") == "f" and "monospace" in style(page, "#mono", "fontFamily"))
        check("table cell rtl", attr(page, "#td") == "r")
        check("skip attribute honored", attr(page, "#skipped") is None)
        check("shadow dom marked", page.evaluate("document.getElementById('host').shadowRoot.getElementById('sfa').getAttribute('data-dynrtl')") == "r")
        page.wait_for_timeout(300)
        check("shadow dom styled", page.evaluate("getComputedStyle(document.getElementById('host').shadowRoot.getElementById('sfa')).direction") == "rtl")
        check("shadow english untouched", page.evaluate("document.getElementById('host').shadowRoot.getElementById('sen').getAttribute('data-dynrtl')") is None)
        check("no attributes on body/main", page.evaluate("!document.body.hasAttribute('data-dynrtl') && !document.querySelector('main').hasAttribute('data-dynrtl')"))

        # Inputs
        page.click("#in")
        page.keyboard.type("hello")
        check("english input untouched", page.eval_on_selector("#in", "e => e.hasAttribute('data-dynrtl-in')") is False)
        page.keyboard.type(" سلام")
        check("persian input marked", page.eval_on_selector("#in", "e => e.getAttribute('data-dynrtl-in')") == "")
        check("input plaintext", style(page, "#in", "unicodeBidi") == "plaintext")
        check("input font", style(page, "#in", "fontFamily").startswith('"Vazirmatn DynRTL"'))
        page.click("#center-in")
        page.keyboard.type("سلام")
        check("centered input stays centered", style(page, "#center-in", "textAlign") == "center")
        page.click("#ta")
        page.keyboard.type("متن فارسی\nEnglish line")
        check("textarea marked", page.eval_on_selector("#ta", "e => e.hasAttribute('data-dynrtl-in')"))
        page.click("#ce")
        page.keyboard.press("End")
        page.keyboard.press("Enter")
        page.keyboard.type("سلام از ویرایشگر")
        check("contenteditable marked", page.eval_on_selector("#ce", "e => e.hasAttribute('data-dynrtl-in')"))
        dirs = page.evaluate("""() => {
          const ps = document.querySelectorAll('#ce p, #ce div');
          const r = document.createRange();
          return [...ps].map((p) => getComputedStyle(p).unicodeBidi);
        }""")
        check("editor lines are plaintext", all(d == "plaintext" for d in dirs), str(dirs))

        # Pre-paint: text arriving late must be marked in the same frame it first paints
        page.goto(base + "/slow.html")
        page.wait_for_function("window.__first !== undefined", timeout=5000)
        first = page.evaluate("[window.__first, window.__dir]")
        check("late parsed text marked before first paint", first == ["r", "rtl"], str(first))

        page.goto(base + "/en.html")
        page.wait_for_timeout(300)
        dyn = page.evaluate("""() => new Promise((res) => {
          const p = document.createElement('p');
          p.textContent = 'پیام تازه از چت: سلام، چطور می‌توانم کمک کنم؟';
          document.body.append(p);
          new ResizeObserver((e, o) => { o.disconnect(); res([p.getAttribute('data-dynrtl'), getComputedStyle(p).direction]); }).observe(p);
        })""")
        check("added text marked before its first paint", dyn == ["r", "rtl"], str(dyn))

        # Streaming chat reply: English start, then Persian tokens
        stream = page.evaluate("""() => new Promise((res) => {
          const p = document.createElement('p');
          document.body.append(p);
          const t = document.createTextNode('');
          p.append(t);
          const words = 'OK! این پاسخ به صورت جریانی و کلمه به کلمه نوشته می‌شود تا مثل چت هوش مصنوعی باشد'.split(' ');
          let i = 0;
          const iv = setInterval(() => {
            t.appendData((i ? ' ' : '') + words[i++]);
            if (i === words.length) { clearInterval(iv); setTimeout(() => res(p.getAttribute('data-dynrtl')), 100); }
          }, 15);
        })""")
        check("streamed reply ends up rtl", stream == "r", str(stream))

        # Recycled node (virtual lists): text replaced with English
        recycled = page.evaluate("""() => new Promise((res) => {
          const p = document.createElement('p');
          p.textContent = 'این یک پیام فارسی است';
          document.body.append(p);
          setTimeout(() => {
            const before = p.getAttribute('data-dynrtl');
            p.textContent = 'Now this row shows an English message';
            setTimeout(() => res([before, p.getAttribute('data-dynrtl')]), 100);
          }, 100);
        })""")
        check("recycled row unmarked", recycled == ["r", None], str(recycled))

        # English pages: nothing marked, font never loaded
        page.goto(base + "/english-heavy.html")
        page.wait_for_timeout(1200)
        tid = tab_id(sw, "english-heavy")
        st = page_stats(sw, tid)
        check("english page: no marks", st and st["marked"] == 0, str(st))
        check("english page: font not loaded", st and st["font"] == "unloaded", str(st))
        check("english page: 20k nodes cost under 15ms", st and st["ms"] < 15, f"{st and round(st['ms'], 2)}ms in {st and st['runs']} runs")

        # Heavy mixed page
        t0 = time.time()
        page.goto(base + "/heavy.html")
        page.wait_for_function("document.querySelectorAll('p.fa[data-dynrtl=r]').length === 500", timeout=10000)
        took = time.time() - t0
        st = page_stats(sw, tab_id(sw, "heavy.html"))
        check("heavy page: 500 of 5500 marked", True, f"{took:.2f}s wall, {st['ms']:.1f}ms script, {st['runs']} frames")
        check("heavy page: en untouched", page.evaluate("document.querySelectorAll('p.en[data-dynrtl]').length") == 0)
        check("heavy page: font loaded", st["font"] == "loaded", st["font"])

        # Chat storm: 300 messages in 1s
        t0 = time.time()
        page.evaluate("""() => new Promise((res) => {
          let i = 0;
          const iv = setInterval(() => {
            for (let k = 0; k < 15; k++) {
              const d = document.createElement('div');
              d.className = 'msg';
              d.textContent = 'پیام شماره ' + (i * 15 + k) + ' سلام';
              document.body.append(d);
            }
            if (++i >= 20) { clearInterval(iv); res(); }
          }, 50);
        })""")
        page.wait_for_function("document.querySelectorAll('.msg[data-dynrtl=r]').length >= 300", timeout=10000)
        check("chat storm: 300 messages marked", True, f"{time.time() - t0:.2f}s")

        # Sites that are already RTL are left alone
        page.goto(base + "/fa-site.html")
        page.wait_for_timeout(500)
        check("rtl site skipped", page.evaluate("document.querySelectorAll('[data-dynrtl]').length") == 0)
        state = sw.evaluate("async (id) => chrome.tabs.sendMessage(id, {t: 'state'}, {frameId: 0})", tab_id(sw, "fa-site"))
        check("rtl site reports auto", state == {"host": "127.0.0.1", "on": False, "auto": True}, str(state))

        # Toggle off / on through the same path as the popup and the shortcut
        page.goto(base + "/fa.html")
        page.wait_for_timeout(500)
        tid = tab_id(sw, "fa.html")
        nxt = toggle(sw, tid, page.url)
        page.wait_for_timeout(300)
        left = page.evaluate("document.querySelectorAll('[data-dynrtl],[data-dynrtl-in]').length")
        check("toggle off removes marks", nxt is False and left == 0, f"next={nxt} left={left}")
        check("toggle off leaves no style attr", page.evaluate("document.querySelectorAll('p[style]').length") == 0)
        rules = sw.evaluate("async () => (await Store.load()).siteOverrides")
        check("toggle off stored", rules == {"127.0.0.1": "off"}, str(rules))
        nxt = toggle(sw, tid, page.url)
        page.wait_for_timeout(300)
        check("toggle on marks again", nxt is True and attr(page, "#fa") == "r")
        rules = sw.evaluate("async () => (await Store.load()).siteOverrides")
        check("toggle back to default drops rule", rules == {}, str(rules))

        page.goto(base + "/fa-site.html")
        page.wait_for_timeout(300)
        toggle(sw, tab_id(sw, "fa-site"), page.url)
        page.wait_for_timeout(300)
        check("rtl site can be turned on", page.evaluate("document.querySelectorAll('[data-dynrtl]').length") > 0)
        sw.evaluate("() => chrome.storage.sync.set({siteOverrides: {}})")

        # Global mode off
        sw.evaluate("() => chrome.storage.sync.set({mode: 'disable_all'})")
        page.goto(base + "/fa.html")
        page.wait_for_timeout(400)
        check("disable_all: nothing marked", page.evaluate("document.querySelectorAll('[data-dynrtl]').length") == 0)
        toggle(sw, tab_id(sw, "fa.html"), page.url)
        page.wait_for_timeout(300)
        check("disable_all: site turned on", attr(page, "#fa") == "r")
        sw.evaluate("() => chrome.storage.sync.set({mode: 'enable_all', siteOverrides: {}})")

        # Custom font
        font_url = sw.evaluate("""async () => {
          const buf = await (await fetch(chrome.runtime.getURL('fonts/vazirmatn.woff2'))).arrayBuffer();
          let s = ''; const u = new Uint8Array(buf);
          for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
          const url = 'data:font/woff2;base64,' + btoa(s);
          await chrome.storage.local.set({customFontDataUrl: url});
          await Store.save({font: 'custom', customFontName: 'Test.woff2'});
          return url.length;
        }""")
        page.goto(base + "/fa.html")
        page.wait_for_timeout(800)
        faces = page.evaluate("[...document.fonts].filter(f => f.family.includes('Vazirmatn DynRTL')).map(f => f.status)")
        check("custom font active", faces == ["loaded"] and attr(page, "#fa") == "r", f"{faces} ({font_url} chars)")
        sw.evaluate("async () => { await chrome.storage.local.remove('customFontDataUrl'); await Store.save({font: 'vazirmatn', customFontName: ''}); }")

        # Tab icon: Chrome must reset per-tab icon state on navigation, or pages would need to report every time
        reset = sw.evaluate("""async (id) => {
          await chrome.action.setTitle({tabId: id, title: 'probe'});
          return id;
        }""", tab_id(sw, "fa.html"))
        page.goto(base + "/en.html")
        page.wait_for_timeout(300)
        title = sw.evaluate("async (id) => chrome.action.getTitle({tabId: id})", reset)
        check("per-tab action state resets on navigation", title == "Dynamic RTL", title)

        # Extension pages
        for name in ("popup/popup.html", "options/options.html", "welcome/welcome.html"):
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            pg.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
            pg.goto(f"chrome-extension://{ext_id}/{name}")
            pg.wait_for_timeout(500)
            check(f"{name} loads cleanly", not errs, str(errs))
            if name.startswith("options"):
                pg.fill("#site", "https://www.Example.com/path")
                pg.press("#site", "Enter")
                pg.wait_for_timeout(300)
                rules = sw.evaluate("async () => (await Store.load()).siteOverrides")
                check("options: add site", rules == {"example.com": "off"}, str(rules))
                pg.click(".state")
                pg.wait_for_timeout(200)
                check("options: flip site", sw.evaluate("async () => (await Store.load()).siteOverrides") == {"example.com": "on"})
                pg.fill("#site", "zzz")
                check("options: search filters", pg.evaluate("document.querySelectorAll('#list li').length") == 0)
                pg.fill("#site", "")
                pg.click(".remove")
                pg.wait_for_timeout(200)
                check("options: remove site", sw.evaluate("async () => (await Store.load()).siteOverrides") == {})
                pg.click("#mode")
                pg.wait_for_timeout(200)
                check("options: mode switch", sw.evaluate("async () => (await Store.load()).mode") == "disable_all")
                pg.click("#mode")
                pg.wait_for_timeout(200)
                check("options: shortcut shown", pg.inner_text("#shortcut") != "")
            if name.startswith("popup"):
                check("popup: unavailable on extension page", pg.inner_text("#host") != "" and pg.eval_on_selector("#toggle", "e => e.disabled"))
            pg.close()

        check("no page errors", not errors, str(errors[:3]))
        ctx.close()
    srv.close()
    return summary()


if __name__ == "__main__":
    sys.exit(main())
