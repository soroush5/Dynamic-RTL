import { MessageType } from '../shared/messages';
import { readLocal, readSync } from '../shared/storage';

const CONTEXT_MENU_ID = 'translatePage';

export class ContextMenuController {
  register(): void {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: 'ترجمه فارسی این صفحه (Dynamic RTL)',
        contexts: ['page']
      });
    });

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id || !tab.url?.startsWith('http')) {
        return;
      }

      const [{ geminiApiKey }, syncSettings] = await Promise.all([
        readLocal(['geminiApiKey']),
        readSync(['translationTone', 'translationModel'])
      ]);

      if (!geminiApiKey) {
        await this.notifyApiKeyMissing(tab.id);
        return;
      }

      const tone = syncSettings.translationTone ?? 'رسمی';
      const model = syncSettings.translationModel ?? 'gemini-2.5-flash-preview-04-17';

      chrome.tabs.sendMessage(tab.id, {
        type: MessageType.TriggerTranslation,
        apiKey: geminiApiKey,
        tone,
        model
      });
    });
  }

  private async notifyApiKeyMissing(tabId: number): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: MessageType.ApiKeyMissing });
    } catch (error) {
      console.warn('Unable to notify tab about missing API key', error);
    }
  }
}
