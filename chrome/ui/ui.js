// Shared bits for the extension pages: translations and page direction.
'use strict';

const t = (key, subs) => Store.api.i18n.getMessage(key, subs) || '';

for (const el of document.querySelectorAll('[data-i18n]')) {
  const m = t(el.dataset.i18n);
  if (m) el.textContent = m;
}
for (const el of document.querySelectorAll('[data-i18n-title]')) {
  el.title = t(el.dataset.i18nTitle);
}
for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
  el.placeholder = t(el.dataset.i18nPlaceholder);
}
document.documentElement.lang = t('lang') || 'en';
document.documentElement.dir = t('dir') || 'ltr';
for (const el of document.querySelectorAll('.version')) {
  el.textContent = Store.api.runtime.getManifest().version;
}
