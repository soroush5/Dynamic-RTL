#!/usr/bin/env python3
# Loads the extension on real sites and checks it behaves. Nothing is submitted
# or signed into: the test only reads pages, adds a sample reply to the DOM and
# types into the main input without sending.
#   python3 tests/sites.py                 all sites, 4 browsers in parallel
#   python3 tests/sites.py chatgpt x.com   only sites whose URL contains one of these
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from common import sync_playwright, launch, REPO

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
OUT = os.environ.get("DYNRTL_OUT", os.path.join(REPO, "tests", "out"))

AI = [
    "https://chatgpt.com/", "https://claude.ai/", "https://gemini.google.com/app", "https://copilot.microsoft.com/",
    "https://www.perplexity.ai/", "https://poe.com/", "https://chat.deepseek.com/", "https://grok.com/",
    "https://chat.mistral.ai/chat", "https://huggingface.co/chat/", "https://character.ai/", "https://you.com/",
    "https://www.phind.com/", "https://www.meta.ai/", "https://pi.ai/", "https://www.kimi.com/",
    "https://chat.qwen.ai/", "https://www.doubao.com/chat/", "https://chatglm.cn/", "https://duck.ai/",
    "https://lmarena.ai/", "https://openrouter.ai/chat", "https://aistudio.google.com/", "https://notebooklm.google.com/",
    "https://chat.z.ai/", "https://www.blackbox.ai/", "https://t3.chat/", "https://manus.im/",
    "https://www.genspark.ai/", "https://felo.ai/", "https://consensus.app/", "https://elicit.com/",
    "https://v0.app/", "https://bolt.new/", "https://lovable.dev/", "https://replit.com/",
    "https://www.cursor.com/", "https://github.com/features/copilot", "https://gamma.app/", "https://www.midjourney.com/",
    "https://elevenlabs.io/", "https://suno.com/", "https://ideogram.ai/", "https://www.krea.ai/",
    "https://quillbot.com/", "https://www.grammarly.com/", "https://www.deepl.com/translator",
    "https://translate.google.com/?sl=en&tl=fa&text=hello%20world&op=translate", "https://openai.com/",
    "https://www.anthropic.com/", "https://huggingface.co/", "https://x.ai/", "https://mistral.ai/",
    "https://deepmind.google/", "https://ollama.com/", "https://groq.com/", "https://cohere.com/",
    "https://www.jasper.ai/", "https://writesonic.com/", "https://www.heygen.com/", "https://runwayml.com/",
    "https://leonardo.ai/", "https://www.hailuo.ai/", "https://chat.minimax.io/", "https://www.tongyi.com/",
    "https://yiyan.baidu.com/", "https://www.notion.com/product/ai",
]

BIG = [
    "https://x.com/", "https://www.instagram.com/", "https://www.facebook.com/", "https://www.youtube.com/",
    "https://www.reddit.com/", "https://en.wikipedia.org/wiki/Main_Page", "https://www.linkedin.com/",
    "https://www.amazon.com/", "https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/",
    "https://github.com/", "https://stackoverflow.com/questions", "https://medium.com/", "https://www.twitch.tv/",
    "https://www.tiktok.com/", "https://www.pinterest.com/", "https://www.netflix.com/", "https://open.spotify.com/",
    "https://web.whatsapp.com/", "https://web.telegram.org/", "https://discord.com/", "https://slack.com/",
    "https://www.microsoft.com/", "https://www.apple.com/", "https://www.yahoo.com/", "https://edition.cnn.com/",
    "https://www.bbc.com/news", "https://www.nytimes.com/", "https://www.theguardian.com/international",
    "https://www.ebay.com/", "https://www.aliexpress.com/", "https://www.booking.com/", "https://www.airbnb.com/",
    "https://www.imdb.com/", "https://www.quora.com/", "https://www.tumblr.com/", "https://www.threads.com/",
    "https://bsky.app/", "https://mastodon.social/explore", "https://news.ycombinator.com/", "https://www.figma.com/",
    "https://www.msn.com/", "https://www.npmjs.com/", "https://developer.mozilla.org/en-US/", "https://www.w3schools.com/",
    "https://www.coursera.org/", "https://www.khanacademy.org/", "https://archive.org/", "https://soundcloud.com/",
    "https://vimeo.com/", "https://www.canva.com/", "https://trello.com/", "https://gitlab.com/",
    "https://vercel.com/", "https://www.cloudflare.com/", "https://outlook.live.com/", "https://www.dropbox.com/",
    "https://docs.google.com/", "https://www.google.com/maps", "https://www.espn.com/", "https://www.paypal.com/",
    "https://www.zoom.com/",
]

# English-language pages that show real Persian or Arabic text.
MIXED = [
    "https://www.google.com/search?q=%D8%B3%D9%84%D8%A7%D9%85&hl=en",
    "https://www.bing.com/search?q=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1+%D8%A7%DB%8C%D8%B1%D8%A7%D9%86&setlang=en",
    "https://html.duckduckgo.com/html/?q=%D8%AA%D9%87%D8%B1%D8%A7%D9%86",
    "https://www.youtube.com/results?search_query=%D8%A2%D9%85%D9%88%D8%B2%D8%B4+%D9%BE%D8%A7%DB%8C%D8%AA%D9%88%D9%86",
    "https://en.wikipedia.org/wiki/Persian_language", "https://en.wikipedia.org/wiki/Hafez",
    "https://en.wikipedia.org/wiki/Arabic", "https://t.me/s/bbcpersian", "https://www.reddit.com/r/iran/",
    "https://github.com/rastikerdar/vazirmatn", "https://news.google.com/search?q=%D8%A7%DB%8C%D8%B1%D8%A7%D9%86&hl=en-US",
    "https://huggingface.co/datasets?search=persian", "https://x.com/bbcpersian",
    "https://www.instagram.com/bbcpersian/", "https://soundcloud.com/search?q=%D9%85%D9%88%D8%B3%DB%8C%D9%82%DB%8C",
]

# Already right to left: should be left alone.
RTL = [
    "https://fa.wikipedia.org/", "https://www.bbc.com/persian", "https://www.digikala.com/", "https://www.aparat.com/",
    "https://ar.wikipedia.org/", "https://www.aljazeera.net/", "https://virgool.io/", "https://www.zoomit.ir/",
]

# Built with DOM calls, not innerHTML, so Trusted Types pages accept it.
INJECT = """async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const el = (tag, id, ...kids) => { const e = document.createElement(tag); if (id) e.id = id; e.append(...kids); return e; };
  const fa = 'این پاراگراف از روی متن خود سایت ساخته شده تا با استایل واقعی سایت آزمایش شود.';
  // Reuse a real paragraph so the site's own styles apply.
  const visible = (e) => e.offsetWidth > 40 && e.offsetHeight > 8;
  const tpl = [...document.querySelectorAll('main p, article p, [role=main] p, p')].find(visible);
  const host = document.querySelector('main, [role=main]') || document.body;
  const clone = tpl ? tpl.cloneNode(false) : document.createElement('div');
  clone.id = 'dynrtl-clone';
  clone.textContent = fa;
  if (tpl) tpl.after(clone); else host.prepend(clone);
  const firstPaint = await new Promise((res) => {
    const ro = new ResizeObserver(() => { ro.disconnect(); res(clone.getAttribute('data-dynrtl')); });
    ro.observe(clone);
    setTimeout(() => res('timeout'), 3000);
  });
  const sample = el('div', 'dynrtl-sample',
    el('p', 'dynrtl-p', 'سلام! برای نصب React از دستور ', el('code', 'dynrtl-code', 'npm install react'), ' استفاده کنید. این یک پاسخ نمونه است.'),
    el('ol', 'dynrtl-ol', el('li', 'dynrtl-li', 'مورد اول فهرست'), el('li', '', 'مورد دوم فهرست')),
    el('p', 'dynrtl-en', 'This English line should stay left to right.'));
  host.prepend(sample);
  for (let i = 0; i < 3; i++) await frame();
  await new Promise((r) => setTimeout(r, 400));
  // Some apps re-render and drop foreign nodes. Put them back in <body> and look again.
  let moved = false;
  for (const n of [clone, sample]) if (!n.isConnected) { document.body.prepend(n); moved = true; }
  if (moved) { for (let i = 0; i < 3; i++) await frame(); await new Promise((r) => setTimeout(r, 300)); }
  const $ = (id) => document.getElementById(id);
  const cs = (id, p) => $(id) ? getComputedStyle($(id))[p] : null;
  const faces = [...document.fonts].filter((f) => f.family.includes('Vazirmatn DynRTL')).map((f) => f.status);
  return {
    moved,
    connected: clone.isConnected && sample.isConnected,
    centered: getComputedStyle(clone.parentElement).textAlign.includes('center'),
    in_editor: clone.isContentEditable && !!clone.closest('[data-dynrtl-in]'),
    clone_first_paint: firstPaint,
    clone_flag: clone.getAttribute('data-dynrtl'),
    clone_dir: getComputedStyle(clone).direction,
    clone_bidi: getComputedStyle(clone).unicodeBidi,
    clone_font: getComputedStyle(clone).fontFamily.slice(0, 60),
    p_flag: $('dynrtl-p')?.getAttribute('data-dynrtl'),
    p_dir: cs('dynrtl-p', 'direction'),
    code_dir: cs('dynrtl-code', 'direction'),
    li_flag: $('dynrtl-li')?.getAttribute('data-dynrtl'),
    ol_flag: $('dynrtl-ol')?.getAttribute('data-dynrtl'),
    en_flag: $('dynrtl-en')?.getAttribute('data-dynrtl'),
    faces,
    marked_total: document.querySelectorAll('[data-dynrtl]').length,
    overflow_x: document.documentElement.scrollWidth > innerWidth + 1,
  };
}"""

FIND_INPUT = """() => {
  const sel = 'textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], ' +
    'input[type=search], input[type=text], input:not([type])';
  const ok = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 60 && r.height > 12 && r.bottom > 0 && r.top < innerHeight && !e.disabled && !e.readOnly &&
      getComputedStyle(e).visibility !== 'hidden';
  };
  const all = [...document.querySelectorAll(sel)].filter(ok);
  // Prefer a big composer over a small search box.
  all.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight));
  const el = all[0];
  if (!el) return null;
  el.setAttribute('data-dynrtl-test-input', '');
  return el.tagName.toLowerCase() + (el.isContentEditable ? '[ce]' : '');
}"""

FOCUS_INPUT = """() => {
  const el = document.querySelector('[data-dynrtl-test-input]');
  el.focus();
  let a = document.activeElement;
  while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
  return a === el || el.contains(a);
}"""

INPUT_STATE = """() => {
  const el = document.querySelector('[data-dynrtl-test-input]');
  if (!el) return null;
  const host = el.isContentEditable ? (el.closest('[data-dynrtl-in]') || el) : el;
  return { marked: host.hasAttribute('data-dynrtl-in'), bidi: getComputedStyle(host).unicodeBidi,
           font: getComputedStyle(host).fontFamily.slice(0, 40) };
}"""

STATS = "async (part) => { for (const t of await chrome.tabs.query({})) { try { const s = await chrome.tabs.sendMessage(t.id, {t: 'stats'}, {frameId: 0}); if (s && s.url.includes(part)) return s; } catch (e) {} } return null; }"
STATE = "async (part) => { for (const t of await chrome.tabs.query({})) { try { const s = await chrome.tabs.sendMessage(t.id, {t: 'stats'}, {frameId: 0}); if (s && s.url.includes(part)) return await chrome.tabs.sendMessage(t.id, {t: 'state'}, {frameId: 0}); } catch (e) {} } return null; }"

lock = threading.Lock()


def glyph_fonts(ctx, page, selector):
    # The fonts Chrome actually drew the node's glyphs with.
    try:
        cdp = ctx.new_cdp_session(page)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]
        node = cdp.send("DOM.querySelector", {"nodeId": root, "selector": selector})["nodeId"]
        fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]
        cdp.detach()
        return [f["familyName"] for f in fonts]
    except Exception:
        return None


def test_site(ctx, sw, url, kind):
    r = {"url": url, "kind": kind}
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:120]))
    try:
        t0 = time.time()
        for attempt in range(4):
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                r.pop("load_error", None)
                break
            except Exception as e:
                r["load_error"] = str(e).split("\n")[0][:120]
                # Our own connection dropped: wait for it instead of blaming the site.
                if "INTERNET_DISCONNECTED" in r["load_error"] or "NETWORK_CHANGED" in r["load_error"]:
                    time.sleep(15)
        if "load_error" in r and "ERR_" in r["load_error"]:
            r["note"] = "not reachable from this network"
            r["ok"] = None
            r["problems"] = []
            with lock:
                print(json.dumps(r, ensure_ascii=False), flush=True)
            page.close()
            return r
        page.wait_for_timeout(4000)
        r["load_s"] = round(time.time() - t0, 1)
        r["final_url"] = page.url
        r["title"] = (page.title() or "")[:60]
        part = page.url.split("#")[0][:60]
        r["stats"] = sw.evaluate(STATS, part)
        r["state"] = sw.evaluate(STATE, part)
        r["page_errors"] = len(errors)
        if kind == "rtl":
            r["marked_real"] = page.evaluate("document.querySelectorAll('[data-dynrtl]').length")
        else:
            r["marked_real"] = page.evaluate("document.querySelectorAll('[data-dynrtl]').length")
            r["inject"] = page.evaluate(INJECT)
            r["glyph_fonts"] = glyph_fonts(ctx, page, "#dynrtl-p")
            which = page.evaluate(FIND_INPUT)
            r["input"] = which
            if which:
                try:
                    if page.evaluate(FOCUS_INPUT):
                        page.keyboard.insert_text("سلام، این یک آزمایش است")
                        page.wait_for_timeout(300)
                        r["input_state"] = page.evaluate(INPUT_STATE)
                        page.keyboard.press("ControlOrMeta+a")
                        page.keyboard.press("Backspace")
                    else:
                        r["input_note"] = "covered by a dialog"
                except Exception as e:
                    r["input_error"] = str(e).split("\n")[0][:120]
        r["stats_after"] = sw.evaluate(STATS, part)
        name = url.split("//")[1].replace("/", "_").replace("?", "_")[:60]
        os.makedirs(OUT, exist_ok=True)
        if kind != "rtl":
            page.evaluate("document.getElementById('dynrtl-sample')?.remove()")
        page.screenshot(path=os.path.join(OUT, name + ".png"), timeout=10000)
    except Exception as e:
        r["error"] = str(e).split("\n")[0][:160]
    finally:
        try:
            page.close()
        except Exception:
            pass
    verdict(r)
    with lock:
        print(json.dumps(r, ensure_ascii=False), flush=True)
    return r


def verdict(r):
    problems = []
    st = r.get("stats_after") or r.get("stats")
    if not st:
        problems.append("content script not reachable")
    else:
        if st.get("errors"):
            problems.append("script error: " + str(st.get("lastError")))
    if r["kind"] == "rtl":
        if r.get("marked_real"):
            problems.append("marked an RTL site")
        if r.get("state") and not r["state"].get("auto"):
            problems.append("RTL site not detected")
    elif "inject" in r:
        i = r["inject"]
        rtl = ("r", "c")
        if not i["connected"]:
            r["note"] = "site keeps removing the test nodes"
        else:
            if i["p_flag"] not in rtl or i["p_dir"] != "rtl":
                problems.append(f"sample not rtl ({i['p_flag']}/{i['p_dir']})")
            # Inside an editor the host gets per-line direction instead of a mark.
            if i.get("in_editor"):
                if i["clone_bidi"] != "plaintext":
                    problems.append(f"editor line not plaintext ({i['clone_bidi']})")
            elif i["clone_flag"] not in rtl or i["clone_dir"] != "rtl":
                problems.append(f"site-styled clone not rtl ({i['clone_flag']}/{i['clone_dir']})")
            if not i["moved"] and not i.get("in_editor") and i["clone_first_paint"] not in rtl:
                problems.append(f"clone not marked at first paint ({i['clone_first_paint']})")
            if "Vazirmatn DynRTL" not in (i["clone_font"] or ""):
                problems.append("font not applied")
            if i["faces"] != ["loaded"]:
                problems.append(f"font face {i['faces']}")
            if r.get("glyph_fonts") is not None and "Vazirmatn" not in r["glyph_fonts"]:
                problems.append(f"glyphs not drawn with Vazirmatn {r['glyph_fonts']}")
            if i["code_dir"] != "ltr":
                problems.append("code not ltr")
            if i["li_flag"] not in rtl or i["ol_flag"] != "l":
                problems.append(f"list ({i['li_flag']}/{i['ol_flag']})")
        if i["en_flag"] is not None:
            problems.append("english line marked")
        if r.get("input_state") and not r["input_state"]["marked"]:
            problems.append("input not marked")
    elif r.get("state") and r["state"].get("auto"):
        r["note"] = "site is RTL, skipped"
    r["problems"] = problems
    r["ok"] = not problems and "error" not in r


def worker(jobs, idx):
    out = []
    with sync_playwright() as p:
        ctx, sw, _ = launch(p, args=[f"--user-agent={UA}"])
        for url, kind in jobs:
            for attempt in range(2):
                try:
                    r = test_site(ctx, sw, url, kind)
                except Exception as e:
                    r = {"url": url, "kind": kind, "error": str(e)[:160], "ok": False, "problems": ["crash"]}
                # Sites that redirect mid-test get one more try.
                if "context was destroyed" not in str(r.get("error", "")):
                    break
            out.append(r)
        ctx.close()
    return out


def main():
    jobs = [(u, "ai") for u in AI] + [(u, "big") for u in BIG] + [(u, "mixed") for u in MIXED] + [(u, "rtl") for u in RTL]
    filters = sys.argv[1:]
    if filters:
        jobs = [j for j in jobs if any(f in j[0] for f in filters)]
    n = min(4, len(jobs))
    chunks = [jobs[i::n] for i in range(n)]
    with ThreadPoolExecutor(n) as ex:
        results = [r for part in ex.map(worker, chunks, range(n)) for r in part]
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "results.json"), "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    skipped = [r for r in results if r.get("ok") is None]
    bad = [r for r in results if r.get("ok") is False]
    print(f"\n{len(results) - len(bad) - len(skipped)}/{len(results) - len(skipped)} reachable sites clean, "
          f"{len(skipped)} unreachable")
    for r in bad:
        print(" -", r["url"], r.get("error") or r.get("load_error") or "", "; ".join(r.get("problems", [])))


if __name__ == "__main__":
    main()
