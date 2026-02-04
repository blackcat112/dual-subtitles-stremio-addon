import axios from 'axios';
import { logger } from '../utils/logger';

interface MicrosoftTranslationResult {
  translations: {
    text: string;
    to: string;
  }[];
}

export class MicrosoftTranslatorClient {
  private apiKey: string;
  private region: string;
  private endpoint = 'https://api.cognitive.microsofttranslator.com';

  constructor(apiKey: string, region: string = 'global') {
    this.apiKey = apiKey;
    this.region = region;
  }

  /**
   * Translate text using Microsoft Azure API
   * Supports batching (up to 100 elements or 50k chars)
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    try {
      const url = `${this.endpoint}/translate`;
      
      // Formatting body for Microsoft API: [{ "text": "..." }, { "text": "..." }]
      const body = texts.map(text => ({ text }));

      const response = await axios.post<MicrosoftTranslationResult[]>(url, body, {
        params: {
          'api-version': '3.0',
          from: from,
          to: to
        },
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Ocp-Apim-Subscription-Region': this.region,
          'Content-Type': 'application/json'
        }
      });

      // Extract translated texts from response
      // Response order matches request order
      return response.data.map(item => item.translations[0].text);

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        logger.error(`Microsoft API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      } else {
        logger.error('Microsoft Translator unknown error', error);
      }
      throw error; // Re-throw to be handled by the caller (fallback logic)
    }
  }
}
