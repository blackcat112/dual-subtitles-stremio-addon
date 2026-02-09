import * as deepl from 'deepl-node';
import { logger } from '../utils/logger';

/**
 * DeepL Translator with API Key Rotation
 * Similar to OpenSubtitlesClient rotation strategy
 * Each free tier key = 500k chars/month
 * With 3-5 keys = 1.5M-2.5M chars/month total
 */
export class DeepLTranslator {
  private translators: deepl.Translator[];
  private apiKeys: string[];
  private currentKeyIndex: number = 0;

  constructor() {
    // Load API keys from environment (comma-separated)
    const keysEnv = process.env.DEEPL_API_KEYS || '';
    this.apiKeys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (this.apiKeys.length === 0) {
      logger.warn('⚠️  No DeepL API keys configured. DeepL translation disabled.');
      this.translators = [];
    } else {
      this.translators = this.apiKeys.map(key => new deepl.Translator(key));
      logger.info(`🔑 Initialized DeepL with ${this.apiKeys.length} API Key(s) for rotation`);
    }
  }

  /**
   * Check if DeepL is available
   */
  isAvailable(): boolean {
    return this.translators.length > 0;
  }

  /**
   * Execute translation with automatic key rotation on quota errors
   */
  private async executeWithRotation<T>(
    operation: string,
    fn: (translator: deepl.Translator, keyIndex: number) => Promise<T>
  ): Promise<T> {
    if (!this.isAvailable()) {
      throw new Error('DeepL not configured. Set DEEPL_API_KEYS environment variable.');
    }

    const startKeyIndex = this.currentKeyIndex;
    let attempts = 0;

    while (attempts < this.translators.length) {
      const translator = this.translators[this.currentKeyIndex];
      
      try {
        logger.debug(`${operation} using DeepL Key #${this.currentKeyIndex + 1}`);
        return await fn(translator, this.currentKeyIndex);
      } catch (error: any) {
        const isQuotaError = error?.message?.includes('quota') || 
                           error?.message?.includes('limit') ||
                           error?.code === 456; // DeepL quota exceeded code

        if (isQuotaError) {
          logger.warn(`⚠️  DeepL Key #${this.currentKeyIndex + 1} quota exceeded. Rotating...`);
          this.currentKeyIndex = (this.currentKeyIndex + 1) % this.translators.length;
          attempts++;

          // If we've tried all keys, throw error
          if (this.currentKeyIndex === startKeyIndex) {
            throw new Error('All DeepL API keys exhausted. Monthly quota exceeded on all keys.');
          }
        } else {
          // Non-quota error, throw immediately
          throw error;
        }
      }
    }

    throw new Error('DeepL translation failed after trying all API keys.');
  }

  /**
   * Translate text using DeepL API
   */
  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return text;
    }

    return this.executeWithRotation('Translate', async (translator) => {
      // DeepL language codes (uppercase)
      const sourceCode = this.normalizeLanguageCode(sourceLang);
      const targetCode = this.normalizeLanguageCode(targetLang);

      const result = await translator.translateText(
        text,
        sourceCode as deepl.SourceLanguageCode,
        targetCode as deepl.TargetLanguageCode
      );

      return result.text;
    });
  }

  /**
   * Batch translate multiple texts
   */
  async translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    return this.executeWithRotation('BatchTranslate', async (translator) => {
      const sourceCode = this.normalizeLanguageCode(sourceLang);
      const targetCode = this.normalizeLanguageCode(targetLang);

      const results = await translator.translateText(
        texts,
        sourceCode as deepl.SourceLanguageCode,
        targetCode as deepl.TargetLanguageCode
      );

      // TypeScript needs explicit type check
      if (Array.isArray(results)) {
        return results.map(r => r.text);
      }
      // Single result (though DeepL always returns array for batch)
      return [(results as deepl.TextResult).text];
    });
  }

  /**
   * Normalize language codes to DeepL format
   * DeepL uses: EN, ES, FR, DE, etc. (uppercase, 2-letter)
   */
  private normalizeLanguageCode(lang: string): string {
    const langMap: Record<string, string> = {
      'en': 'EN-US',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT-PT',
      'nl': 'NL',
      'pl': 'PL',
      'ru': 'RU',
      'ja': 'JA',
      'zh': 'ZH',
      'ar': 'AR', // Added in newer DeepL versions
    };

    const normalized = lang.toLowerCase().substring(0, 2);
    return langMap[normalized] || normalized.toUpperCase();
  }

  /**
   * Get usage statistics for current API key
   */
  async getUsage(): Promise<deepl.Usage | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const translator = this.translators[this.currentKeyIndex];
      return await translator.getUsage();
    } catch (error) {
      logger.error('Failed to get DeepL usage:', error);
      return null;
    }
  }
}

export const deeplTranslator = new DeepLTranslator();
