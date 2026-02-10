import { logger } from '../utils/logger';
import { libreTranslateClient } from './libretranslate-client';

/**
 * Service to handle text translation
 * Uses ONLY LibreTranslate (self-hosted on Contabo VPS)
 * 
 * LibreTranslate: Unlimited, 8-10 min/episode, self-hosted, 100% control
 * No external dependencies, no rate limits, no quotas
 */
export class TranslatorService {
  private cache: Map<string, string> = new Map();
  
  constructor() {}

  /**
   * Translate a single string using LibreTranslate
   */
  async translateText(text: string, from: string, to: string): Promise<string> {
    const key = `${from}:${to}:${text}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    try {
      const translated = await libreTranslateClient.translate(text, from, to);
      this.cache.set(key, translated);
      return translated;
    } catch (error) {
      logger.error(`Translation failed for: "${text.substring(0, 20)}..."`, error);
      return text; // Return original on error
    }
  }

  /**
   * Translate an array of subtitle lines using LibreTranslate
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<{ translated: string[], errorCount: number }> {
    if (!libreTranslateClient.isAvailable()) {
      logger.error('❌ LibreTranslate not configured! Set LIBRETRANSLATE_URL in environment.');
      return { translated: texts, errorCount: texts.length };
    }

    const results: string[] = new Array(texts.length);
    let errorCount = 0;

    try {
      logger.info(`🌐 Using LibreTranslate for translation (${texts.length} lines)`);
      
      const translated = await libreTranslateClient.translateBatch(texts, from, to);
      
      // Cache results
      translated.forEach((result, i) => {
        results[i] = result;
        const key = `${from}:${to}:${texts[i]}`;
        this.cache.set(key, result);
      });
      
      logger.info(`✅ LibreTranslate completed successfully`);
      return { translated: results, errorCount: 0 };
      
    } catch (error: any) {
      logger.error(`❌ LibreTranslate failed: ${error.message}`);
      logger.error('💡 Check that your Contabo VPS is running and accessible');
      
      // Return original texts on error
      return { translated: texts, errorCount: texts.length };
    }
  }

  /**
   * Helper to clean text before translation (remove empty lines, numbers, etc.)
   */
  private cleanText(text: string): string {
    if (!text || !text.trim()) return '';
    if (/^\d+$/.test(text.trim())) return '';
    return text;
  }
}

export const translatorService = new TranslatorService();

export const translator = new TranslatorService();
