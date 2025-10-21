import {
  MessageType,
  RuntimeRequest,
  RuntimeResponse,
  ContentToggleMessage,
  RequestTranslationMessage,
  TriggerTranslationMessage,
  UpdateSiteStatusMessage
} from '../shared/messages';
import { SitePolicyStore } from './sitePolicyStore';
import { TranslationResult, TranslationService } from './translationService';

interface SiteStatusResponse {
  hostname: string | null;
  isEnabled: boolean;
  defaultEnabled: boolean;
}

interface TranslationResponse {
  success: boolean;
  translations?: TranslationResult[];
  error?: string;
  errorCode?: string;
}

interface ApiKeyTestResponse {
  success: boolean;
  error?: string;
}

export class MessageRouter {
  constructor(
    private readonly sitePolicyStore: SitePolicyStore,
    private readonly translationService: TranslationService
  ) {}

  register(): void {
    chrome.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse): boolean => {
      if (!request || typeof request !== 'object' || !('type' in request)) {
        return false;
      }

      switch (request.type) {
        case MessageType.GetSiteStatus:
          this.handleGetSiteStatus(sendResponse as (response: SiteStatusResponse) => void);
          return true;
        case MessageType.UpdateSiteStatus:
          this.handleUpdateSiteStatus(request, sendResponse as (response: RuntimeResponse) => void);
          return true;
        case MessageType.UpdateDefaultMode:
          this.handleUpdateDefaultMode(request.defaultEnabled, sendResponse as (response: RuntimeResponse) => void);
          return true;
        case MessageType.TriggerTranslation:
          this.handleTriggerTranslation(request, sendResponse as (response: RuntimeResponse) => void);
          return true;
        case MessageType.RequestTranslation:
          this.handleTranslation(request, sendResponse as (response: TranslationResponse) => void);
          return true;
        case MessageType.TestApiKey:
          this.handleApiKeyTest(request.apiKey, sendResponse as (response: ApiKeyTestResponse) => void);
          return true;
        default:
          return false;
      }
    });
  }

  private async handleGetSiteStatus(sendResponse: (response: SiteStatusResponse) => void): Promise<void> {
    try {
      const tab = await this.getActiveHttpTab();
      if (!tab?.url) {
        sendResponse({ hostname: null, isEnabled: false, defaultEnabled: true });
        return;
      }
      let hostname: string | null = null;
      try {
        hostname = new URL(tab.url).hostname;
      } catch (error) {
        hostname = null;
      }
      const policy = await this.sitePolicyStore.getPolicy();
      const isEnabled = hostname ? this.sitePolicyStore.isSiteEnabled(hostname, policy) : false;
      sendResponse({ hostname, isEnabled, defaultEnabled: policy.defaultEnabled });
    } catch (error) {
      console.error('Failed to retrieve site status', error);
      sendResponse({ hostname: null, isEnabled: false, defaultEnabled: true });
    }
  }

  private async handleUpdateSiteStatus(
    request: UpdateSiteStatusMessage,
    sendResponse: (response: RuntimeResponse) => void
  ): Promise<void> {
    try {
      await this.sitePolicyStore.updateSite(request.hostname, request.enabled);
      await this.broadcastToActiveTab({ type: MessageType.ContentToggle, enabled: request.enabled });
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to update site status', error);
      sendResponse({ success: false, error: 'Unable to update site status.' });
    }
  }

  private async handleUpdateDefaultMode(defaultEnabled: boolean, sendResponse: (response: RuntimeResponse) => void) {
    try {
      await this.sitePolicyStore.setDefaultEnabled(defaultEnabled);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to update default mode', error);
      sendResponse({ success: false, error: 'Unable to update default mode.' });
    }
  }

  private async handleTriggerTranslation(
    request: TriggerTranslationMessage,
    sendResponse: (response: RuntimeResponse) => void
  ): Promise<void> {
    try {
      await this.broadcastToActiveTab(request);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to forward translation trigger', error);
      sendResponse({ success: false, error: 'Unable to trigger translation.' });
    }
  }

  private async handleTranslation(
    request: RequestTranslationMessage,
    sendResponse: (response: TranslationResponse) => void
  ): Promise<void> {
    try {
      const translations = await this.translationService.translate(request);
      sendResponse({ success: true, translations });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error calling Gemini API.';
      if (message === 'RATE_LIMIT') {
        sendResponse({ success: false, error: message, errorCode: 'RATE_LIMIT' });
      } else {
        sendResponse({ success: false, error: message });
      }
    }
  }

  private async handleApiKeyTest(apiKey: string, sendResponse: (response: ApiKeyTestResponse) => void): Promise<void> {
    try {
      await this.translationService.testApiKey(apiKey);
      sendResponse({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در ارتباط با سرور گوگل.';
      sendResponse({ success: false, error: message });
    }
  }

  private async broadcastToActiveTab(message: TriggerTranslationMessage | ContentToggleMessage): Promise<void> {
    const tab = await this.getActiveHttpTab();
    if (!tab?.id) {
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      console.warn('Unable to send message to active tab', error);
    }
  }

  private async getActiveHttpTab(): Promise<chrome.tabs.Tab | undefined> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.url || !tab.url.startsWith('http')) {
      return undefined;
    }
    return tab;
  }
}
