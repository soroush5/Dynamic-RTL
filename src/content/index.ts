import { debounce } from '../shared/debounce';
import { MessageType } from '../shared/messages';
import { readLocal, readSync } from '../shared/storage';
import { isPersianOrArabic, startsWithPersianOrArabic } from '../shared/rtl';

const STYLE_ELEMENT_ID = 'dynamic-rtl-styles';
const RTL_LISTENER_ATTR = 'data-rtl-listener';
const RTL_ATTRIBUTE = 'data-rtl';
const RTL_INPUT_CLASS = 'rtl-input-active';

interface FontSettings {
  fontFamily: string;
  fontSrc: string;
}

class FontManager {
  private currentFont: FontSettings | null = null;

  async load(): Promise<void> {
    const localSettings = await readLocal(['useCustomFont', 'customFontData', 'customFontFamily']);
    if (localSettings.useCustomFont && localSettings.customFontData && localSettings.customFontFamily) {
      this.currentFont = {
        fontFamily: localSettings.customFontFamily,
        fontSrc: `url('${localSettings.customFontData}') format('truetype')`
      };
    } else {
      this.currentFont = {
        fontFamily: 'Vazirmatn',
        fontSrc: `url('${chrome.runtime.getURL('fonts/Vazirmatn[wght].ttf')}') format('truetype-variations')`
      };
    }
    this.apply();
  }

  apply(): void {
    if (!this.currentFont) {
      return;
    }
    let styleElement = document.getElementById(STYLE_ELEMENT_ID);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = STYLE_ELEMENT_ID;
      (document.head ?? document.documentElement).appendChild(styleElement);
    }
    styleElement.textContent = `
      @font-face {
        font-family: '${this.currentFont.fontFamily}';
        src: ${this.currentFont.fontSrc};
        font-weight: 100 900;
        font-display: block;
      }
      [${RTL_ATTRIBUTE}="true"],
      input[${RTL_ATTRIBUTE}="true"],
      textarea[${RTL_ATTRIBUTE}="true"],
      [contenteditable][${RTL_ATTRIBUTE}="true"],
      .${RTL_INPUT_CLASS} {
        direction: rtl !important;
        text-align: right !important;
        font-family: '${this.currentFont.fontFamily}', Arial, sans-serif !important;
      }
      input[type="text"]:focus,
      textarea:focus {
        direction: auto !important;
      }
    `;
  }

  remove(): void {
    const styleElement = document.getElementById(STYLE_ELEMENT_ID);
    if (styleElement?.parentElement) {
      styleElement.parentElement.removeChild(styleElement);
    }
  }
}

class RtlContentController {
  private isEnabled = false;
  private readonly fontManager = new FontManager();
  private readonly processDocumentDebounced: () => void;
  private readonly processInputsDebounced: () => void;
  private mainObserver: MutationObserver | null = null;
  private inputObserver: MutationObserver | null = null;

  constructor() {
    this.processDocumentDebounced = debounce(() => this.processDocument(), 300);
    this.processInputsDebounced = debounce(() => this.processInputs(), 300);
  }

  async init(): Promise<void> {
    if (this.shouldIgnorePage()) {
      return;
    }
    await this.fontManager.load();
    await this.refreshEnabledState();
    this.registerMessageListeners();
    if (this.isEnabled) {
      this.enableRtlProcessing();
    }
  }

  private registerMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      switch (message.type) {
        case MessageType.ContentToggle:
          this.toggle(Boolean(message.enabled));
          break;
        case MessageType.FontUpdated:
          this.fontManager.load().catch((error) => console.error('Failed to reload font settings', error));
          break;
        default:
          break;
      }
    });
  }

  private shouldIgnorePage(): boolean {
    const lang = document.documentElement.lang?.toLowerCase();
    return lang === 'fa-ir' || lang === 'fa' || lang === 'ar';
  }

  private async refreshEnabledState(): Promise<void> {
    const syncSettings = await readSync(['defaultEnabled', 'disabledSites', 'enabledSites']);
    const hostname = window.location.hostname;
    const defaultEnabled = syncSettings.defaultEnabled ?? true;
    const disabledSites = Array.isArray(syncSettings.disabledSites) ? syncSettings.disabledSites : [];
    const enabledSites = Array.isArray(syncSettings.enabledSites) ? syncSettings.enabledSites : [];
    if (defaultEnabled) {
      this.isEnabled = !disabledSites.includes(hostname);
    } else {
      this.isEnabled = enabledSites.includes(hostname);
    }
  }

  private toggle(enabled: boolean): void {
    if (this.isEnabled === enabled) {
      return;
    }
    this.isEnabled = enabled;
    if (enabled) {
      this.enableRtlProcessing();
    } else {
      this.disableRtlProcessing();
    }
  }

  private enableRtlProcessing(): void {
    this.fontManager.apply();
    this.setupObservers();
    this.processDocument();
    this.processInputs();
  }

  private disableRtlProcessing(): void {
    this.mainObserver?.disconnect();
    this.inputObserver?.disconnect();
    this.mainObserver = null;
    this.inputObserver = null;
    this.clearRtlAttributes();
  }

  private setupObservers(): void {
    if (this.mainObserver) {
      this.mainObserver.disconnect();
    }
    this.mainObserver = new MutationObserver((mutations) => {
      if (!this.isEnabled) {
        return;
      }
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          this.processTextNode(mutation.target as Text);
        } else if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              this.processTextNode(node as Text);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (!element.closest(`[${RTL_ATTRIBUTE}="true"]`)) {
                this.walkSubtree(element);
              }
            }
          });
        }
      }
    });
    this.mainObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    if (this.inputObserver) {
      this.inputObserver.disconnect();
    }
    this.inputObserver = new MutationObserver((mutations) => {
      if (!this.isEnabled) {
        return;
      }
      let shouldProcess = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.matches('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable]') ||
                element.querySelector('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable]')
              ) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (shouldProcess) {
          break;
        }
      }
      if (shouldProcess) {
        this.processInputsDebounced();
      }
    });
    this.inputObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  private processDocument(): void {
    if (!this.isEnabled) {
      return;
    }
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          const parent = node.parentElement;
          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('script, style, noscript, textarea, input, [contenteditable]')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.hasAttribute(RTL_ATTRIBUTE)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent || node.textContent.trim() === '') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    let node: Node | null;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      this.processTextNode(node as Text);
    }
  }

  private walkSubtree(root: Element): void {
    if (!this.isEnabled) {
      return;
    }
    if (root.closest('script, style, noscript, textarea, input, [contenteditable]')) {
      return;
    }
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          const parent = node.parentElement;
          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('script, style, noscript, textarea, input, [contenteditable]')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.hasAttribute(RTL_ATTRIBUTE)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent || node.textContent.trim() === '') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    let node: Node | null;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      this.processTextNode(node as Text);
    }
  }

  private processTextNode(node: Text): void {
    const parent = node.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) {
      return;
    }
    if (parent.hasAttribute(RTL_ATTRIBUTE)) {
      return;
    }
    const text = node.textContent;
    if (text && text.trim() !== '' && isPersianOrArabic(text) && startsWithPersianOrArabic(text)) {
      parent.setAttribute(RTL_ATTRIBUTE, 'true');
    }
  }

  private processInputs(): void {
    if (!this.isEnabled) {
      return;
    }
    const inputSelector = `input[type="text"], input[type="search"], input:not([type]), textarea`;
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(inputSelector);
    inputs.forEach((element) => this.setupInputElement(element));
    const editableSelector = '[contenteditable=""], [contenteditable="true"]';
    const editables = document.querySelectorAll<HTMLElement>(editableSelector);
    editables.forEach((element) => this.setupEditableElement(element));
  }

  private setupInputElement(element: HTMLInputElement | HTMLTextAreaElement): void {
    if (element.hasAttribute(RTL_LISTENER_ATTR)) {
      return;
    }
    element.setAttribute(RTL_LISTENER_ATTR, 'true');
    if (
      (isPersianOrArabic(element.value) && startsWithPersianOrArabic(element.value)) ||
      (element.placeholder && isPersianOrArabic(element.placeholder) && startsWithPersianOrArabic(element.placeholder))
    ) {
      element.setAttribute(RTL_ATTRIBUTE, 'true');
      element.classList.add(RTL_INPUT_CLASS);
    }
    element.addEventListener('input', () => {
      if (isPersianOrArabic(element.value) && startsWithPersianOrArabic(element.value)) {
        element.setAttribute(RTL_ATTRIBUTE, 'true');
        element.classList.add(RTL_INPUT_CLASS);
      } else if (element.value.trim() === '') {
        if (
          !(element.placeholder &&
            isPersianOrArabic(element.placeholder) &&
            startsWithPersianOrArabic(element.placeholder))
        ) {
          element.removeAttribute(RTL_ATTRIBUTE);
          element.classList.remove(RTL_INPUT_CLASS);
        }
      } else {
        element.removeAttribute(RTL_ATTRIBUTE);
        element.classList.remove(RTL_INPUT_CLASS);
      }
    });
    element.addEventListener('focus', () => {
      if (isPersianOrArabic(element.value) && startsWithPersianOrArabic(element.value)) {
        element.setAttribute(RTL_ATTRIBUTE, 'true');
        element.classList.add(RTL_INPUT_CLASS);
      }
    });
    element.addEventListener('blur', () => {
      if (isPersianOrArabic(element.value) && startsWithPersianOrArabic(element.value)) {
        element.setAttribute(RTL_ATTRIBUTE, 'true');
        element.classList.add(RTL_INPUT_CLASS);
      } else {
        element.removeAttribute(RTL_ATTRIBUTE);
        element.classList.remove(RTL_INPUT_CLASS);
      }
    });
  }

  private setupEditableElement(element: HTMLElement): void {
    if (element.hasAttribute(RTL_LISTENER_ATTR)) {
      return;
    }
    element.setAttribute(RTL_LISTENER_ATTR, 'true');
    element.addEventListener('input', () => {
      const text = element.innerText || element.textContent || '';
      if (isPersianOrArabic(text) && startsWithPersianOrArabic(text)) {
        element.setAttribute(RTL_ATTRIBUTE, 'true');
      } else {
        element.removeAttribute(RTL_ATTRIBUTE);
      }
    });
  }

  private clearRtlAttributes(): void {
    document.querySelectorAll(`[${RTL_ATTRIBUTE}="true"]`).forEach((element) => {
      element.removeAttribute(RTL_ATTRIBUTE);
      if (element instanceof HTMLElement) {
        element.classList.remove(RTL_INPUT_CLASS);
      }
    });
  }
}

const controller = new RtlContentController();
controller.init().catch((error) => console.error('Failed to initialize RTL content controller', error));
