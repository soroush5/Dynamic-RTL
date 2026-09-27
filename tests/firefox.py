#!/usr/bin/env python3
# Checks the Firefox build in real Firefox. Needs: pip install selenium, and Firefox.
#   python3 tests/firefox.py
import os
import shutil
import sys
import tempfile
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.service import Service

from common import Server, check, summary, REPO
from core import PAGES

EXT = os.path.join(REPO, "firefox")


def main():
    srv = Server(PAGES)
    xpi = os.path.join(tempfile.mkdtemp(), "dynrtl.xpi")
    shutil.make_archive(xpi[:-4], "zip", EXT)
    os.rename(xpi[:-4] + ".zip", xpi)

    opts = webdriver.FirefoxOptions()
    opts.add_argument("-headless")
    # GECKODRIVER=/path/to/geckodriver skips Selenium's own download.
    service = Service(os.environ["GECKODRIVER"]) if os.environ.get("GECKODRIVER") else None
    d = webdriver.Firefox(options=opts, service=service)
    try:
        d.install_addon(xpi, temporary=True)
        time.sleep(1.5)
        # The welcome tab opens on install; stay on the first one.
        d.switch_to.window(d.window_handles[0])

        d.get(srv.base + "/fa.html")
        time.sleep(1)
        attr = lambda sel: d.execute_script(f"return document.querySelector('{sel}').getAttribute('data-dynrtl')")
        style = lambda sel, p: d.execute_script(f"return getComputedStyle(document.querySelector('{sel}')).{p}")
        check("ff: persian paragraph rtl", attr("#fa") == "r" and style("#fa", "direction") == "rtl")
        check("ff: font family", style("#fa", "fontFamily").startswith('"Vazirmatn DynRTL"'), style("#fa", "fontFamily"))
        faces = d.execute_script("return [...document.fonts].filter(f => f.family.includes('Vazirmatn DynRTL')).map(f => f.status)")
        check("ff: font loaded", faces == ["loaded"], str(faces))
        check("ff: english untouched", attr("#en") is None)
        check("ff: code ltr", style("#code", "direction") == "ltr")
        check("ff: list mirrored", attr("#list") == "l" and style("#list", "paddingRight") == "40px")
        check("ff: flex row not flipped", attr("#flex") == "f")
        check("ff: shadow dom", d.execute_script(
            "const e = document.getElementById('host').shadowRoot.getElementById('sfa');"
            "return [e.getAttribute('data-dynrtl'), getComputedStyle(e).direction]") == ["r", "rtl"])

        box = d.find_element(By.ID, "in")
        box.click()
        box.send_keys("سلام")
        time.sleep(0.3)
        check("ff: input marked", d.execute_script("return document.getElementById('in').getAttribute('data-dynrtl-in')") == ""
              and style("#in", "unicodeBidi") == "plaintext")
        ce = d.find_element(By.ID, "ce")
        ce.click()
        ce.send_keys(Keys.END, Keys.ENTER, "متن فارسی")
        time.sleep(0.3)
        check("ff: editor marked", d.execute_script("return document.getElementById('ce').hasAttribute('data-dynrtl-in')"))

        dyn = d.execute_async_script("""const done = arguments[0];
          const p = document.createElement('p'); p.textContent = 'پیام تازه: سلام، چطوری؟'; document.body.append(p);
          new ResizeObserver((e, o) => { o.disconnect(); done([p.getAttribute('data-dynrtl'), getComputedStyle(p).direction]); }).observe(p);""")
        check("ff: new text marked before first paint", dyn == ["r", "rtl"], str(dyn))

        d.get(srv.base + "/slow.html")
        time.sleep(1.5)
        check("ff: late parsed text marked before first paint",
              d.execute_script("return [window.__first, window.__dir]") == ["r", "rtl"],
              str(d.execute_script("return [window.__first, window.__dir]")))

        d.get(srv.base + "/fa-site.html")
        time.sleep(0.8)
        check("ff: rtl site skipped", d.execute_script("return document.querySelectorAll('[data-dynrtl]').length") == 0)

        d.get(srv.base + "/english-heavy.html")
        time.sleep(1)
        check("ff: english page untouched", d.execute_script("return document.querySelectorAll('[data-dynrtl]').length") == 0)

        # Extension pages load without errors
        # Firefox won't let WebDriver open extension pages directly, so move
        # the welcome tab (already an extension page) around instead.
        ext_tab = None
        for h in d.window_handles:
            d.switch_to.window(h)
            if d.current_url.startswith("moz-extension://"):
                ext_tab = h
                check("ff: welcome page renders", d.find_element(By.TAG_NAME, "h1").text != "")
                break
        if ext_tab:
            before = set(d.window_handles)
            d.find_element(By.ID, "settings").click()
            time.sleep(1)
            new = [h for h in d.window_handles if h not in before]
            d.switch_to.window(new[0] if new else ext_tab)
            check("ff: settings open from welcome", "options.html" in d.current_url, d.current_url)
            site = d.find_element(By.ID, "site")
            site.send_keys("example.com", Keys.ENTER)
            time.sleep(0.5)
            check("ff: options add site", len(d.find_elements(By.CSS_SELECTOR, "#list li")) == 1)
            d.find_element(By.CSS_SELECTOR, ".state").click()
            time.sleep(0.3)
            check("ff: options flip site", d.find_element(By.CSS_SELECTOR, ".state").get_dom_attribute("class") == "state on")
            d.find_element(By.CSS_SELECTOR, ".remove").click()
            time.sleep(0.3)
            check("ff: options remove site", len(d.find_elements(By.CSS_SELECTOR, "#list li")) == 0)
            check("ff: shortcut shown", d.find_element(By.ID, "shortcut").text != "", d.find_element(By.ID, "shortcut").text)
        else:
            check("ff: welcome tab opened on install", False)
    finally:
        d.quit()
        srv.close()
    return summary()


if __name__ == "__main__":
    sys.exit(main())
