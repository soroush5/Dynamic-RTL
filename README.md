# Dynamic RTL (نسخه 1.3.0)

افزونه کروم برای تشخیص خودکار متن فارسی و عربی در صفحات وب و اعمال جهت راست به چپ (RTL) و فونت مناسب (پیش‌فرض: وزیرمتن، قابل تنظیم).

[English README / توضیحات انگلیسی](README.en.md)

<br>

<p align="center">
  <a href="https://github.com/so-roush/Dynamic-RTL/archive/refs/heads/main.zip" style="text-decoration:none;">
    <svg width="280" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="button-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="3" dy="5" stdDeviation="5" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect x="5" y="5" width="270" height="90" rx="10" ry="10" fill="#FFFFFF" filter="url(#button-shadow)" stroke="#CCCCCC" stroke-width="1"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#333333">
        دریافت آخرین نسخه
      </text>
    </svg>
  </a>
</p>

<br>

## ویژگی‌ها

- تشخیص خودکار متن فارسی و عربی در هر صفحه وب.
- اعمال جهت راست به چپ (RTL) و فونت مناسب به متن‌های تشخیص داده شده.
- محدود کردن اعمال استایل به متن‌هایی که با کلمات فارسی یا عربی شروع می‌شوند.
- پشتیبانی از محتوای پویا (متنی که بعداً در صفحه بارگذاری می‌شود).
- تشخیص بهبود یافته برای فیلدهای ورودی (`input`, `textarea`) و المان‌های قابل ویرایش (`contenteditable`).
- امکان غیرفعال کردن افزونه برای وب‌سایت‌های خاص.
- امکان انتخاب حالت پیش‌فرض (فعال یا غیرفعال) برای همه سایت‌ها.
- **جدید:** امکان آپلود و استفاده از فونت TTF سفارشی (ترجیحاً متغیر/Variable) به جای فونت پیش‌فرض وزیرمتن.
- سازگار با Manifest V3 کروم.

## نصب

### روش پیشنهادی: نصب دستی

**به فارسی:**

1.  **دانلود:** آخرین نسخه افزونه را از بخش [Releases](https://github.com/so-roush/Dynamic-RTL/releases) دانلود کنید (فایل `.zip`). یا اگر می‌خواهید از کد منبع استفاده کنید، سورس کد را به صورت ZIP از [اینجا](https://github.com/so-roush/Dynamic-RTL/archive/refs/heads/main.zip) دانلود نمایید.
2.  **اکسترکت:** فایل ZIP دانلود شده را در یک پوشه دلخواه از حالت فشرده خارج کنید (Extract کنید).
3.  **باز کردن صفحه افزونه‌ها:** مرورگر کروم (یا مرورگرهای مشابه مانند Edge, Brave, Vivaldi) را باز کرده و به آدرس `chrome://extensions` بروید.
4.  **فعال کردن حالت توسعه‌دهنده:** در گوشه بالا سمت راست صفحه افزونه‌ها، کلید "Developer mode" یا "حالت توسعه‌دهنده" را فعال کنید.
5.  **بارگذاری افزونه:** روی دکمه "Load unpacked" یا "بارگذاری بسته بازشده" کلیک کنید.
6.  **انتخاب پوشه:** پوشه‌ای که در مرحله ۲ اکسترکت کرده بودید را انتخاب کنید.
7.  **تایید:** افزونه نصب شده و آیکون آن باید در نوار ابزار مرورگر شما ظاهر شود.

**In English:**

1.  **Download:** Download the latest release (the `.zip` file) from the [Releases](https://github.com/so-roush/Dynamic-RTL/releases) page. Alternatively, if you want the source code, download it as a ZIP file from [here](https://github.com/so-roush/Dynamic-RTL/archive/refs/heads/main.zip).
2.  **Extract:** Extract the downloaded ZIP file into a folder of your choice.
3.  **Open Extensions Page:** Open your Chrome browser (or a similar Chromium-based browser like Edge, Brave, Vivaldi) and navigate to `chrome://extensions`.
4.  **Enable Developer Mode:** In the top right corner of the extensions page, toggle on "Developer mode".
5.  **Load Extension:** Click the "Load unpacked" button.
6.  **Select Folder:** Select the folder where you extracted the extension files in step 2.
7.  **Confirm:** The extension is now installed, and its icon should appear in your browser toolbar.

### از فروشگاه وب کروم (به زودی)

وقتی افزونه در فروشگاه وب کروم منتشر شود، می‌توانید آن را مستقیماً از آنجا نصب کنید.

## استفاده

### تنظیمات سایت فعلی

- برای فعال یا غیرفعال کردن افزونه در سایت فعلی، روی آیکون افزونه در نوار ابزار کلیک کنید و کلید "فعال در این سایت" را تغییر دهید.
- تغییرات بلافاصله اعمال می‌شوند.

### تنظیمات کلی (داخل پاپ‌آپ افزونه)

با کلیک روی عنوان "تنظیمات کلی" می‌توانید این بخش را باز یا بسته کنید.

*   **حالت پیش‌فرض:**
    *   **فعال در همه سایت‌ها:** افزونه در همه جا فعال است مگر اینکه آن را برای سایتی خاص غیرفعال کنید.
    *   **غیرفعال در همه سایت‌ها:** افزونه در همه جا غیرفعال است مگر اینکه آن را برای سایتی خاص فعال کنید.
*   **فونت سفارشی:**
    *   کلید "استفاده از فونت سفارشی" را فعال کنید.
    *   روی دکمه انتخاب فایل کلیک کرده و فونت `TTF` مورد نظر خود را انتخاب کنید.
    *   **توصیه:** برای بهترین نتیجه، از فونت‌های متغیر (Variable Fonts) استفاده کنید.
    *   با غیرفعال کردن این کلید، افزونه به فونت پیش‌فرض (وزیرمتن) بازمی‌گردد.

## مجوز

این پروژه متن‌باز است و تحت مجوز MIT در دسترس است.

## اعتبارات

- توسعه‌دهنده: [so-roush](https://github.com/so-roush)
- فونت پیش‌فرض: [وزیرمتن](https://github.com/rastikerdar/vazirmatn) توسط صابر راستی‌کردار

## Language

- [فارسی (Persian)](README.fa.md) 
