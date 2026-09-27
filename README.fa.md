# Dynamic RTL

متن فارسی و عربی را در هر سایتی راست‌چین و با فونت وزیرمتن نمایش می‌دهد؛ در چت‌های هوش مصنوعی (ChatGPT، Claude، Gemini و بقیه)، ایکس، اینستاگرام و هر صفحه‌ای که انگلیسی و فارسی را کنار هم دارد.

<p>
  <a href="https://github.com/soroush5/Dynamic-RTL/releases/latest/download/dynamic-rtl-chrome-latest.zip"><img src="https://img.shields.io/badge/Download-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download for Chrome"></a>
  <a href="https://github.com/soroush5/Dynamic-RTL/releases/latest/download/dynamic-rtl-firefox-latest.zip"><img src="https://img.shields.io/badge/Download-Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white" alt="Download for Firefox"></a>
  <a href="https://github.com/soroush5/Dynamic-RTL/releases/latest/download/dynamic-rtl-safari-latest.zip"><img src="https://img.shields.io/badge/Download-Safari-000000?style=for-the-badge&logo=safari&logoColor=white" alt="Download for Safari"></a>
</p>

[English](README.md)

## چه کار می‌کند

- متن فارسی یا عربی را همان لحظه‌ای که صفحه بارگذاری می‌شود یا پیام تازه‌ای می‌رسد پیدا می‌کند و فقط همان پاراگراف، مورد فهرست یا خانه جدول را راست‌چین می‌کند.
- متن پیش از نمایش علامت می‌خورد؛ صفحه از همان اول راست‌چین و با فونت درست باز می‌شود و پرشی دیده نمی‌شود.
- حروف فارسی با وزیرمتن نمایش داده می‌شوند و کلمه‌های انگلیسی داخل همان پاراگراف فونت خود سایت را نگه می‌دارند.
- پاراگراف انگلیسی که یک کلمه فارسی دارد چپ‌چین می‌ماند؛ جمله فارسی که با یک کلمه انگلیسی شروع شود راست‌چین می‌شود.
- کد، بلوک‌های `pre` و آدرس‌ها جهت خودشان را حفظ می‌کنند.
- در کادرهای تایپ و ورودی چت‌ها، هر خط جهت خودش را می‌گیرد؛ پس خط فارسی راست و خط انگلیسی چپ می‌ایستد.
- سایت‌هایی که خودشان راست‌چین هستند دست نمی‌خورند، مگر اینکه خودتان روشنشان کنید.

## تازه‌های نسخه ۴

- بسیار سبک‌تر؛ در صفحه‌ای که فارسی ندارد فقط یک بررسی سریع انجام می‌شود. نسبت به نسخه ۳٫۲ بین ۲ تا ۹ برابر زمان اجرای کمتری مصرف می‌کند.
- فونت دیگر دیر نمی‌رسد و از همان ابتدای بارگذاری صفحه آماده است.
- تشخیص جهت دقیق‌تر: فهرست‌ها درست آینه می‌شوند، متن وسط‌چین وسط‌چین می‌ماند و ردیف‌های دکمه و آیکن به هم نمی‌ریزند.
- پشتیبانی بهتر از Shadow DOM و پاسخ‌های جریانی چت‌ها.
- پنجره و صفحه تنظیمات تازه، ساده و مینیمال، با حالت تیره.
- روی بیش از ۱۵۰ سایت واقعی آزمایش شده است.

## نصب

فایل زیپ مرورگر خود را از [صفحه Releases](https://github.com/soroush5/Dynamic-RTL/releases) (یا پوشه [`resources/`](resources)) دانلود کنید.

**کروم، اج، بریو، آرک و اپرا**

1. فایل `dynamic-rtl-chrome-v4.0.zip` را از حالت فشرده خارج کنید.
2. به `chrome://extensions` بروید و Developer mode را روشن کنید.
3. روی Load unpacked بزنید و پوشه را انتخاب کنید.

**فایرفاکس** (۱۲۸ به بالا)

- موقت: در `about:debugging#/runtime/this-firefox` روی Load Temporary Add-on بزنید و `manifest.json` داخل پوشه را انتخاب کنید. تا بستن فایرفاکس فعال می‌ماند.
- دائمی در نسخه‌های Developer Edition، Nightly یا ESR: در `about:config` مقدار `xpinstall.signatures.required` را `false` کنید، پسوند زیپ را به `.xpi` تغییر دهید و آن را روی فایرفاکس بکشید.

**سافاری** (۲۶ به بالا)

فایل `dynamic-rtl-safari-v4.0.zip` را باز کنید، سپس از Settings، بخش Developer، گزینه Add Temporary Extension را بزنید و پوشه را انتخاب کنید. بعد در Settings، بخش Extensions فعالش کنید. با بستن سافاری غیرفعال می‌شود.

## استفاده

- با کلیک روی آیکن، افزونه را برای سایت فعلی روشن یا خاموش کنید. جایی که خاموش است آیکن خاکستری می‌شود.
- میان‌بر: Ctrl+Shift+Y (در مک Command+Shift+Y)، یا راست‌کلیک روی صفحه.
- در تنظیمات می‌توانید افزونه را برای همه سایت‌ها یا فقط سایت‌های انتخابی فعال کنید، فونت دلخواه بارگذاری کنید و فهرست سایت‌ها را مدیریت کنید.

هر قانون برای یک دامنه، زیردامنه‌هایش را هم شامل می‌شود.

## حریم خصوصی

هیچ درخواستی به اینترنت فرستاده نمی‌شود و هیچ داده‌ای از مرورگر شما خارج نمی‌شود. جزئیات در [PRIVACY.md](PRIVACY.md).

## سازندگان

- توسعه: [soroush5](https://github.com/soroush5)
- فونت: [وزیرمتن](https://github.com/rastikerdar/vazirmatn)، اثر صابر راستی‌کردار

## مجوز

MIT
