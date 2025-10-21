const PERSIAN_ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function isPersianOrArabic(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  return PERSIAN_ARABIC_REGEX.test(text);
}

export function startsWithPersianOrArabic(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const firstWord = trimmed.split(/\s+/)[0];
  return isPersianOrArabic(firstWord);
}
