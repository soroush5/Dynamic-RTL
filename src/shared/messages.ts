export enum MessageType {
  GetSiteStatus = 'dynamic.site.getStatus',
  UpdateSiteStatus = 'dynamic.site.updateStatus',
  UpdateDefaultMode = 'dynamic.site.updateDefaultMode',
  ContentToggle = 'dynamic.content.toggle',
  TriggerTranslation = 'dynamic.translation.trigger',
  RequestTranslation = 'dynamic.translation.request',
  ApiKeyMissing = 'dynamic.translation.apiKeyMissing',
  TestApiKey = 'dynamic.translation.testKey',
  FontUpdated = 'dynamic.font.updated'
}

export interface GetSiteStatusMessage {
  type: MessageType.GetSiteStatus;
}

export interface UpdateSiteStatusMessage {
  type: MessageType.UpdateSiteStatus;
  hostname: string;
  enabled: boolean;
}

export interface UpdateDefaultModeMessage {
  type: MessageType.UpdateDefaultMode;
  defaultEnabled: boolean;
}

export interface ContentToggleMessage {
  type: MessageType.ContentToggle;
  enabled: boolean;
}

export interface TriggerTranslationMessage {
  type: MessageType.TriggerTranslation;
  apiKey: string;
  tone: string;
  model: string;
}

export interface RequestTranslationMessage {
  type: MessageType.RequestTranslation;
  apiKey: string;
  model: string;
  tone: string;
  texts: Array<{ id: string; text: string }>;
}

export interface ApiKeyMissingMessage {
  type: MessageType.ApiKeyMissing;
}

export interface TestApiKeyMessage {
  type: MessageType.TestApiKey;
  apiKey: string;
}

export interface FontUpdatedMessage {
  type: MessageType.FontUpdated;
}

export type RuntimeRequest =
  | GetSiteStatusMessage
  | UpdateSiteStatusMessage
  | UpdateDefaultModeMessage
  | TriggerTranslationMessage
  | RequestTranslationMessage
  | ApiKeyMissingMessage
  | TestApiKeyMessage
  | FontUpdatedMessage;

export type RuntimeResponse = unknown;

export function sendRuntimeMessage<T extends RuntimeRequest, R = RuntimeResponse>(
  message: T
): Promise<R> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response as R);
      });
    } catch (error) {
      reject(error as Error);
    }
  });
}
