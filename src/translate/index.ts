import { MessageType, RequestTranslationMessage, sendRuntimeMessage } from '../shared/messages';
import { isVisible } from '../shared/dom';

const TRANSLATION_CONTAINER_CLASS = 'gemini-translation-container';
const TRANSLATION_TEXT_CLASS = 'gemini-translation-text';
const PROCESSED_ATTR = 'data-gemini-translated';
const MIN_WORDS_TO_TRANSLATE = 6;

interface TranslationSegment {
  id: string;
  text: string;
  element: Element;
}

interface TranslationResponse {
  success: boolean;
  translations?: Array<{ id: string; translation: string }>;
  error?: string;
  errorCode?: string;
}

class TranslationIndicator {
  private container: HTMLDivElement | null = null;

  show(message = 'در حال ترجمه...'): void {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'gemini-translation-indicator';
      Object.assign(this.container.style, {
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 15px',
        borderRadius: '5px',
        zIndex: '999999',
        fontSize: '13px',
        fontFamily: 'Vazirmatn, sans-serif',
        direction: 'rtl' as const,
        textAlign: 'right' as const,
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      });
      document.body.appendChild(this.container);
    }
    this.container.textContent = message;
    this.container.style.display = 'block';
  }

  update(message: string): void {
    if (!this.container) {
      this.show(message);
      return;
    }
    this.container.textContent = message;
    if (this.container.style.display === 'none') {
      this.container.style.display = 'block';
    }
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}

class TranslationExtractor {
  extract(): TranslationSegment[] {
    const selectors =
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, caption, dd, dt, figcaption, summary, td:not(:has(p, div, ul, ol, blockquote))';
    const elements = Array.from(document.querySelectorAll<Element>(selectors));
    const segments: TranslationSegment[] = [];
    let counter = 0;

    elements.forEach((element) => {
      if (
        element.closest(
          `.${TRANSLATION_CONTAINER_CLASS}, script, style, noscript, textarea, input, [contenteditable], code, pre, a`
        )
      ) {
        return;
      }
      if (element.hasAttribute(PROCESSED_ATTR)) {
        return;
      }
      if (!isVisible(element)) {
        return;
      }

      let directText = '';
      element.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          directText += node.textContent ?? '';
        }
      });
      directText = directText.replace(/\s+/g, ' ').trim();
      if (!directText) {
        return;
      }
      const wordCount = directText.split(/\s+/).filter(Boolean).length;
      const letterCount = (directText.match(/[a-zA-Z]/g) || []).length;
      if (wordCount < MIN_WORDS_TO_TRANSLATE || letterCount <= directText.length / 4) {
        return;
      }

      let elementId = element.id;
      if (!elementId) {
        elementId = `gemini-translate-id-${counter++}`;
        element.id = elementId;
      }

      segments.push({
        id: elementId,
        text: directText,
        element
      });
    });

    return segments;
  }
}

class TranslationRenderer {
  clearPrevious(): void {
    document.querySelectorAll(`.${TRANSLATION_CONTAINER_CLASS}`).forEach((container) => container.remove());
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((element) => {
      element.removeAttribute(PROCESSED_ATTR);
    });
  }

  render(originals: TranslationSegment[], translations: Array<{ id: string; translation: string }>, indicator: TranslationIndicator): void {
    const elementsById = new Map(originals.map((segment) => [segment.id, segment.element]));
    const insertions: Array<{ original: Element; container: HTMLElement }> = [];

    translations.forEach((result, index) => {
      const originalElement = elementsById.get(result.id);
      if (!originalElement) {
        return;
      }
      if (!result.translation) {
        originalElement.setAttribute(PROCESSED_ATTR, 'true');
        return;
      }
      const container = document.createElement('div');
      container.className = TRANSLATION_CONTAINER_CLASS;
      Object.assign(container.style, {
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: '6px',
        marginTop: '6px',
        padding: '8px 10px',
        direction: 'rtl',
        textAlign: 'right'
      });

      const heading = document.createElement('div');
      heading.style.fontSize = '12px';
      heading.style.fontWeight = '600';
      heading.style.marginBottom = '4px';
      heading.textContent = 'ترجمه دینامیک RTL';
      container.appendChild(heading);

      const textElement = document.createElement('div');
      textElement.className = TRANSLATION_TEXT_CLASS;
      textElement.textContent = result.translation;
      container.appendChild(textElement);

      originalElement.setAttribute(PROCESSED_ATTR, 'true');
      insertions.push({ original: originalElement, container });
      indicator.update(`در حال ترجمه صفحه: پردازش ترجمه (${index + 1}/${translations.length})...`);
    });

    indicator.update(`در حال ترجمه صفحه: درج ترجمه‌ها (${insertions.length})...`);
    requestAnimationFrame(() => {
      insertions.forEach((insertion) => {
        const parent = insertion.original.parentNode;
        if (parent) {
          parent.insertBefore(insertion.container, insertion.original.nextSibling);
        }
      });
    });
  }
}

class TranslationController {
  private readonly indicator = new TranslationIndicator();
  private readonly extractor = new TranslationExtractor();
  private readonly renderer = new TranslationRenderer();
  private isTranslating = false;

  constructor() {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.type === MessageType.TriggerTranslation) {
        this.handleTranslationRequest(message.apiKey, message.tone, message.model);
      } else if (message.type === MessageType.ApiKeyMissing) {
        alert('لطفاً ابتدا کلید API Gemini خود را در تنظیمات افزونه وارد کنید.');
      }
    });
  }

  private async handleTranslationRequest(apiKey: string, tone: string, model: string): Promise<void> {
    if (this.isTranslating) {
      alert('ترجمه در حال اجرا است. لطفاً صبر کنید.');
      return;
    }
    if (!apiKey || !tone || !model) {
      alert('اطلاعات لازم برای ترجمه (کلید، لحن، مدل) یافت نشد.');
      return;
    }

    this.isTranslating = true;
    this.indicator.show();
    this.renderer.clearPrevious();

    try {
      const segments = this.extractor.extract();
      if (segments.length === 0) {
        this.indicator.update('متنی برای ترجمه در این صفحه پیدا نشد.');
        setTimeout(() => this.indicator.hide(), 3000);
        throw new Error('No text found to translate.');
      }

      this.indicator.update('در حال ترجمه صفحه: ارسال درخواست به Gemini...');
      const response = await this.requestTranslation(apiKey, tone, model, segments);
      if (!response.success || !response.translations) {
        const message = response.error ?? 'ترجمه از اسکریپت پس‌زمینه دریافت نشد.';
        if (response.errorCode === 'RATE_LIMIT') {
          this.indicator.update('محدودیت تعداد درخواست API');
          alert('تعداد درخواست‌های شما از حد مجاز Gemini فراتر رفته است. لطفاً بعداً دوباره تلاش کنید.');
        } else {
          this.indicator.update(`خطا: ${message}`);
          alert(`خطا در فرآیند ترجمه: ${message}`);
        }
        throw new Error(message);
      }

      this.indicator.update('در حال ترجمه صفحه: دریافت پاسخ...');
      this.renderer.render(segments, response.translations, this.indicator);
      const translatedCount = response.translations.filter((item) => item.translation).length;
      this.indicator.update(`ترجمه صفحه انجام شد (${translatedCount} بخش).`);
      setTimeout(() => this.indicator.hide(), 2500);
    } catch (error) {
      console.error('Translation process failed:', error);
      if (error instanceof Error && error.message === 'No text found to translate.') {
        // Already handled visually
      } else if (error instanceof Error && error.message === 'RATE_LIMIT') {
        // Already handled when response indicated rate limit
      } else if (error instanceof Error) {
        this.indicator.update(`خطا: ${error.message}`);
      } else {
        this.indicator.update('خطای ناشناخته در ترجمه.');
      }
    } finally {
      this.isTranslating = false;
    }
  }

  private async requestTranslation(
    apiKey: string,
    tone: string,
    model: string,
    segments: TranslationSegment[]
  ): Promise<TranslationResponse> {
    const request: RequestTranslationMessage = {
      type: MessageType.RequestTranslation,
      apiKey,
      tone,
      model,
      texts: segments.map((segment) => ({ id: segment.id, text: segment.text }))
    };
    return sendRuntimeMessage<RequestTranslationMessage, TranslationResponse>(request);
  }
}

new TranslationController();
console.log('Dynamic RTL Translator content script loaded.');
