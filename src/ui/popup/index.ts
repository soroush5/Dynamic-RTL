import { css, html, LitElement, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import {
  MessageType,
  sendRuntimeMessage,
  GetSiteStatusMessage,
  UpdateSiteStatusMessage,
  UpdateDefaultModeMessage,
  TestApiKeyMessage
} from '../../shared/messages';
import { readLocal, readSync, removeLocal, writeLocal, writeSync } from '../../shared/storage';

interface SiteStatusResponse {
  hostname: string | null;
  isEnabled: boolean;
  defaultEnabled: boolean;
}

interface ApiKeyTestResponse {
  success: boolean;
  error?: string;
}

const MODELS = [
  { value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' }
];

const TONES = ['رسمی', 'گفتاری', 'دوستانه'];

function deriveFontFamily(fileName: string): string {
  const base = fileName
    .replace(/\.(ttf|otf)$/i, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) {
    return 'Custom Font';
  }
  return base
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('خطا در خواندن فایل فونت.'));
    reader.readAsDataURL(file);
  });
}

class DynamicRtlPopup extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-width: 320px;
      max-width: 360px;
      font-family: 'Vazirmatn', sans-serif;
      color: #1f2933;
      background: #f7fafc;
      direction: rtl;
    }

    h2 {
      font-size: 16px;
      margin: 0 0 8px;
      color: #0f172a;
    }

    h3 {
      font-size: 14px;
      margin: 16px 0 8px;
      color: #1e293b;
    }

    .container {
      padding: 16px;
    }

    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      margin-bottom: 16px;
    }

    .card:last-of-type {
      margin-bottom: 0;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .row:last-of-type {
      margin-bottom: 0;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    label {
      display: block;
      font-size: 13px;
      margin-bottom: 6px;
    }

    input[type='text'],
    input[type='password'],
    select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      background: #f8fafc;
      box-sizing: border-box;
    }

    input[type='file'] {
      font-size: 12px;
    }

    button {
      appearance: none;
      border: none;
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      transition: transform 0.1s ease, box-shadow 0.2s ease;
    }

    button.primary {
      background: linear-gradient(135deg, #2563eb, #4338ca);
      color: #fff;
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
    }

    button.secondary {
      background: transparent;
      color: #2563eb;
      border: 1px solid rgba(37, 99, 235, 0.4);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .hint {
      font-size: 12px;
      color: #475569;
      margin-top: 4px;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 12px;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .radio-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .radio-group label {
      margin: 0;
      font-size: 13px;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .font-status {
      font-size: 12px;
      color: #0f172a;
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 8px;
      margin-top: 8px;
    }

    .api-feedback {
      font-size: 12px;
      margin-top: 6px;
    }

    .api-feedback.success {
      color: #047857;
    }

    .api-feedback.error {
      color: #b91c1c;
    }
  `;

  @state() private hostname: string | null = null;
  @state() private siteEnabled = true;
  @state() private defaultEnabled = true;
  @state() private translateAvailable = false;
  @state() private useCustomFont = false;
  @state() private customFontName = 'پیش‌فرض (وزیرمتن)';
  @state() private apiKey = '';
  @state() private tone = TONES[0];
  @state() private model = MODELS[0].value;
  @state() private apiKeyTestResult: { message: string; success: boolean } | null = null;
  @state() private isTestingApiKey = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const tab = await this.getActiveTab();
    if (tab?.url && tab.url.startsWith('http')) {
      this.translateAvailable = true;
    }
    try {
      const status = await sendRuntimeMessage<GetSiteStatusMessage, SiteStatusResponse>({
        type: MessageType.GetSiteStatus
      });
      this.hostname = status.hostname;
      this.siteEnabled = status.isEnabled;
      this.defaultEnabled = status.defaultEnabled;
    } catch (error) {
      console.error('Failed to load site status', error);
    }

    const localSettings = await readLocal(['useCustomFont', 'customFontName', 'geminiApiKey']);
    this.useCustomFont = Boolean(localSettings.useCustomFont);
    this.customFontName = localSettings.customFontName ?? 'پیش‌فرض (وزیرمتن)';
    this.apiKey = localSettings.geminiApiKey ?? '';

    const syncSettings = await readSync(['translationTone', 'translationModel']);
    this.tone = syncSettings.translationTone ?? TONES[0];
    this.model = syncSettings.translationModel ?? MODELS[0].value;
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  private async handleSiteToggle(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    this.siteEnabled = target.checked;
    if (!this.hostname) {
      return;
    }
    await sendRuntimeMessage<UpdateSiteStatusMessage>({
      type: MessageType.UpdateSiteStatus,
      hostname: this.hostname,
      enabled: this.siteEnabled
    });
  }

  private async handleDefaultModeChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    this.defaultEnabled = target.value === 'enabled';
    await sendRuntimeMessage<UpdateDefaultModeMessage>({
      type: MessageType.UpdateDefaultMode,
      defaultEnabled: this.defaultEnabled
    });
    if (this.hostname) {
      const status = await sendRuntimeMessage<GetSiteStatusMessage, SiteStatusResponse>({
        type: MessageType.GetSiteStatus
      });
      this.siteEnabled = status.isEnabled;
    }
  }

  private async handleApiKeyInput(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    this.apiKey = target.value.trim();
    this.apiKeyTestResult = null;
    await writeLocal({ geminiApiKey: this.apiKey });
  }

  private async handleToneChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    this.tone = target.value;
    await writeSync({ translationTone: this.tone });
  }

  private async handleModelChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    this.model = target.value;
    await writeSync({ translationModel: this.model });
  }

  private async handleFontToggle(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    this.useCustomFont = target.checked;
    await writeLocal({ useCustomFont: this.useCustomFont });
    if (!this.useCustomFont) {
      await removeLocal(['customFontData', 'customFontFamily', 'customFontName']);
      this.customFontName = 'پیش‌فرض (وزیرمتن)';
    }
    await this.notifyFontUpdated();
  }

  private async handleFontSelection(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fontFamily = deriveFontFamily(file.name);
      await writeLocal({
        customFontData: dataUrl,
        customFontFamily: fontFamily,
        customFontName: file.name,
        useCustomFont: true
      });
      this.useCustomFont = true;
      this.customFontName = file.name;
      await this.notifyFontUpdated();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'خطا در بارگذاری فونت.');
    } finally {
      input.value = '';
    }
  }

  private async notifyFontUpdated(): Promise<void> {
    const tab = await this.getActiveTab();
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: MessageType.FontUpdated });
      } catch (error) {
        console.warn('Unable to notify content script about font update', error);
      }
    }
  }

  private async handleTranslateClick(): Promise<void> {
    if (!this.translateAvailable) {
      return;
    }
    if (!this.apiKey) {
      alert('لطفاً ابتدا کلید API را وارد کنید.');
      return;
    }
    const tab = await this.getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.TriggerTranslation,
        apiKey: this.apiKey,
        tone: this.tone,
        model: this.model
      });
    }
  }

  private async handleApiKeyTest(): Promise<void> {
    if (!this.apiKey) {
      this.apiKeyTestResult = { message: 'لطفاً ابتدا کلید API را وارد کنید.', success: false };
      return;
    }
    this.isTestingApiKey = true;
    this.apiKeyTestResult = null;
    try {
      const response = await sendRuntimeMessage<TestApiKeyMessage, ApiKeyTestResponse>({
        type: MessageType.TestApiKey,
        apiKey: this.apiKey
      });
      if (response.success) {
        this.apiKeyTestResult = { message: 'کلید با موفقیت تأیید شد.', success: true };
      } else {
        this.apiKeyTestResult = { message: response.error ?? 'کلید معتبر نیست.', success: false };
      }
    } catch (error) {
      this.apiKeyTestResult = {
        message: error instanceof Error ? error.message : 'خطا در بررسی کلید.',
        success: false
      };
    } finally {
      this.isTestingApiKey = false;
    }
  }

  render() {
    return html`
      <div class="container">
        <div class="card">
          <div class="section-title">
            <h2>وضعیت سایت</h2>
            ${this.hostname
              ? html`<span class="status-chip">${this.hostname}</span>`
              : html`<span class="status-chip">سایت در دسترس نیست</span>`}
          </div>
          <div class="row">
            <span>فعال بودن روی این سایت</span>
            <label class="toggle">
              <input type="checkbox" .checked=${this.siteEnabled} @change=${this.handleSiteToggle} ?disabled=${!this.hostname} />
              <span>${this.siteEnabled ? 'فعال' : 'غیرفعال'}</span>
            </label>
          </div>
          <div class="row">
            <span>حالت پیش‌فرض</span>
            <div class="radio-group">
              <label>
                <input
                  type="radio"
                  name="defaultMode"
                  value="enabled"
                  .checked=${this.defaultEnabled}
                  @change=${this.handleDefaultModeChange}
                />
                فعال
              </label>
              <label>
                <input
                  type="radio"
                  name="defaultMode"
                  value="disabled"
                  .checked=${!this.defaultEnabled}
                  @change=${this.handleDefaultModeChange}
                />
                غیرفعال
              </label>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>فونت سفارشی</h3>
          <label class="toggle">
            <input type="checkbox" .checked=${this.useCustomFont} @change=${this.handleFontToggle} />
            <span>استفاده از فونت شخصی</span>
          </label>
          <input type="file" accept=".ttf,.otf" @change=${this.handleFontSelection} ?disabled=${!this.useCustomFont} />
          <div class="font-status">${this.customFontName}</div>
          <div class="hint">برای اعمال فونت، فایل TTF یا OTF را انتخاب کنید.</div>
        </div>

        <div class="card">
          <h3>تنظیمات ترجمه</h3>
          <label>کلید API Gemini</label>
          <input type="text" .value=${this.apiKey} @input=${this.handleApiKeyInput} />
          <div class="actions">
            <button class="secondary" @click=${this.handleApiKeyTest} ?disabled=${this.isTestingApiKey}>
              ${this.isTestingApiKey ? 'در حال بررسی...' : 'تست کلید'}
            </button>
            <button class="primary" @click=${this.handleTranslateClick} ?disabled=${!this.translateAvailable}>
              ترجمه صفحه
            </button>
          </div>
          ${this.apiKeyTestResult
            ? html`<div class="api-feedback ${this.apiKeyTestResult.success ? 'success' : 'error'}">
                ${this.apiKeyTestResult.message}
              </div>`
            : nothing}
          <label>لحن ترجمه</label>
          <select @change=${this.handleToneChange} .value=${this.tone}>
            ${TONES.map((tone) => html`<option value=${tone}>${tone}</option>`)}
          </select>
          <label>مدل ترجمه</label>
          <select @change=${this.handleModelChange} .value=${this.model}>
            ${MODELS.map((item) => html`<option value=${item.value}>${item.label}</option>`)}
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dynamic-rtl-popup': DynamicRtlPopup;
  }
}

customElements.define('dynamic-rtl-popup', DynamicRtlPopup);
