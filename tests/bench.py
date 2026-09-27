#!/usr/bin/env python3
# Compares browser work with no extension and with one or more builds.
#   python3 tests/bench.py [--pages DIR] [--runs N] none chrome path/to/other/build
# Each variant gets a fresh browser. Numbers are medians of Chrome's own counters
# (Performance.getMetrics) after the page settles.
import argparse
import os
import statistics
import sys
import tempfile

from common import sync_playwright, Server, REPO

METRICS = ["TaskDuration", "ScriptDuration", "RecalcStyleDuration", "LayoutDuration", "JSHeapUsedSize"]


def chat_page(messages):
    rows = []
    for i in range(messages):
        rows.append(
            f'<div class="msg user"><p>سوال شماره {i}: چطور می‌توانم در React از useEffect استفاده کنم؟</p></div>'
            f'<div class="msg bot"><p>برای این کار ابتدا کامپوننت را بسازید و سپس از <code>useEffect</code> استفاده کنید.</p>'
            '<ol><li>مرحله اول: نصب پکیج</li><li>مرحله دوم: نوشتن کد</li></ol>'
            '<pre><code>npm install react</code></pre><p>This part of the answer is in English.</p></div>'
        )
    stream = """<script>
const box = document.createElement('div'); box.className = 'msg bot'; document.body.append(box);
const p = document.createElement('p'); box.append(p);
const words = 'این پاسخ به صورت جریانی نوشته می‌شود و هر کلمه جداگانه اضافه می‌شود تا مثل پاسخ هوش مصنوعی باشد'.split(' ');
let i = 0; const iv = setInterval(() => { p.append((i ? ' ' : '') + words[i % words.length]); if (++i > 150) clearInterval(iv); }, 20);
</script>"""
    return ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>chat</title>"
            "<style>body{font:15px/1.6 system-ui;max-width:760px;margin:auto}.msg{padding:8px 12px;margin:8px 0}"
            ".user{background:#eef}</style></head><body>" + "".join(rows) + stream + "</body></html>")


def english_page(paragraphs):
    rows = [f"<article><h2>Heading {i}</h2><p>Plain English paragraph {i} with a <a href='#'>link</a>.</p></article>"
            for i in range(paragraphs)]
    return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>en</title></head><body>" + "".join(rows) + "</body></html>"


def measure(p, ext, url, runs, settle):
    args = []
    if ext:
        args = [f"--disable-extensions-except={ext}", f"--load-extension={ext}"]
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(prefix="bench-"), channel="chromium", headless=True, args=args)
    if ext:
        ctx.service_workers or ctx.wait_for_event("serviceworker", timeout=15000)
    ctx.new_page().goto(url, wait_until="load")  # warm the HTTP cache
    samples = {m: [] for m in METRICS}
    for _ in range(runs):
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send("Performance.enable")
        page.goto(url, wait_until="load")
        page.wait_for_timeout(settle)
        got = {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}
        for m in METRICS:
            samples[m].append(got.get(m, 0))
        page.close()
    ctx.close()
    return {m: statistics.median(v) for m, v in samples.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", help="directory of extra .html files to include")
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("variants", nargs="+", help="'none', 'chrome' or a path to an unpacked build")
    a = ap.parse_args()

    pages = {"/chat.html": chat_page(150), "/english.html": english_page(3000)}
    if a.pages:
        for f in sorted(os.listdir(a.pages)):
            if f.endswith(".html"):
                with open(os.path.join(a.pages, f), encoding="utf-8") as fh:
                    pages["/" + f] = fh.read()
    srv = Server(pages)

    with sync_playwright() as p:
        table = {}
        for v in a.variants:
            ext = None if v == "none" else os.path.abspath(os.path.join(REPO, v) if v == "chrome" else v)
            for path in pages:
                settle = 4000 if path == "/chat.html" else 1500
                table[(v, path)] = measure(p, ext, srv.base + path, a.runs, settle)
                print(v, path, {k: round(x * 1000, 1) if k != "JSHeapUsedSize" else round(x / 1e6, 2)
                                for k, x in table[(v, path)].items()}, flush=True)
    srv.close()

    print("\nms of main-thread work added over no extension (median):")
    base = "none" if "none" in a.variants else None
    for path in pages:
        line = [f"{path:22}"]
        for v in a.variants:
            if v == base:
                continue
            t = table[(v, path)]["TaskDuration"] - (table[(base, path)]["TaskDuration"] if base else 0)
            s = table[(v, path)]["ScriptDuration"] - (table[(base, path)]["ScriptDuration"] if base else 0)
            line.append(f"{'/'.join(v.rstrip('/').split('/')[-2:])}: task {t * 1000:+7.1f}  script {s * 1000:+6.1f}")
        print("  ".join(line))


if __name__ == "__main__":
    sys.exit(main())
