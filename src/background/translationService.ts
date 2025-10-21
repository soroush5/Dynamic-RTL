import { RequestTranslationMessage } from '../shared/messages';

export interface TranslationResult {
  id: string;
  translation: string;
}

const SEPARATOR = '|||---|||';

export class TranslationService {
  async translate(request: RequestTranslationMessage): Promise<TranslationResult[]> {
    const { apiKey, model, tone, texts } = request;
    if (!apiKey || !model || texts.length === 0) {
      throw new Error('Missing API Key, model or texts for translation.');
    }

    const prompt = this.buildPrompt(tone, texts.map((item) => item.text));
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await this.extractError(response);
      throw new Error(errorText || `Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const candidates: unknown = data?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error('No translation candidates returned by Gemini API.');
    }
    const firstCandidate: any = candidates[0];
    const parts: unknown = firstCandidate?.content?.parts;
    if (!Array.isArray(parts)) {
      throw new Error('Unexpected response structure from Gemini API.');
    }
    const textResponse = parts
      .map((part: any) => (typeof part.text === 'string' ? part.text : ''))
      .join('');

    const segments = textResponse
      .split(SEPARATOR)
      .map((segment: string) => segment.trim())
      .filter((segment: string) => segment.length > 0);

    return texts.map((item, index) => ({
      id: item.id,
      translation: segments[index] ?? ''
    }));
  }

  async testApiKey(apiKey: string): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      let message = `خطای ${response.status}`;
      try {
        const data = await response.json();
        message = data?.error?.message ?? message;
      } catch (error) {
        // Ignore parsing errors
      }
      throw new Error(message);
    }
  }

  private buildPrompt(tone: string, texts: string[]): string {
    const normalizedTone = tone || 'رسمی';
    const numbered = texts
      .map((text, index) => `${index + 1}. ${text.replace(/\n\s*\n/g, '\n').trim()}`)
      .join('\n');
    return `Translate the following English texts to Persian using a "${normalizedTone}" tone. Provide ONLY the Persian translations for each text, separated by "${SEPARATOR}".\n\nInput Texts:\n${numbered}\n\nPersian Translations (separated by "${SEPARATOR}"):`;
  }

  private async extractError(response: Response): Promise<string | null> {
    try {
      const data = await response.json();
      const message = data?.error?.message ?? null;
      if (typeof message === 'string') {
        if (message.toLowerCase().includes('api key not valid')) {
          return 'کلید API نامعتبر است.';
        }
        if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
          return 'RATE_LIMIT';
        }
        return message;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}
