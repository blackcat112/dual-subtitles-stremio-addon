import { translate } from 'google-translate-api-x';
import { logger } from '../utils/logger';

/**
 * Service to handle text translation using Google Translate (Unofficial/Free)
 * Includes caching and simple rate limiting/batching
 */
export class TranslatorService {
  private cache: Map<string, string> = new Map();
  // Simple in-memory cache. 
  // In production with high load, we might want Redis or file-based cache.
  
  constructor() {}

  /**
   * Translate a single string
   */
  async translateText(text: string, from: string, to: string): Promise<string> {
    const key = `${from}:${to}:${text}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    try {
      // Map common codes if necessary (e.g. 'es' is standard)
      // google-translate-api-x usually handles standard ISO 639-1
      
      const res = await translate(text, { from, to });
      
      if (res && res.text) {
        this.cache.set(key, res.text);
        return res.text;
      }
      
      return text; // Fallback to original
    } catch (error) {
      logger.error(`Translation failed for: "${text.substring(0, 20)}..."`, error);
      return text; // Return original on error to not break the app
    }
  }

  /**
   * Translate an array of subtitle lines using Sequential robust calls
   * Native Batching (RPC) failed due to 429. processing line-by-line is slower but safer.
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<{ translated: string[], errorCount: number }> {
    logger.info(`Translating ${texts.length} lines from ${from} to ${to} (Sequential Mode)`);
    
    // We process in small "concurrent" chunks effectively acting as a small batch 
    // but using individual web requests which might be less suspicious than the batch RPC
    const CONCURRENCY = 2; 
    const DELAY_BETWEEN_ITEMS = 300; // ms
    
    const results: string[] = new Array(texts.length).fill('');
    let errorCount = 0;
    
    const processItem = async (text: string, index: number, retries = 3): Promise<void> => {
      // Skip empty/numbers
      if (!text.trim() || /^\d+$/.test(text.trim())) {
        results[index] = text;
        return;
      }

      try {
        const translated = await this.translateText(text, from, to);
        results[index] = translated;
      } catch (err: any) {
        if (retries > 0) {
           // Exponential backoff
           const delay = 1000 * (4 - retries); 
           await new Promise(r => setTimeout(r, delay));
           return processItem(text, index, retries - 1);
        }
        logger.warn(`Failed line ${index}: ${text.substring(0, 15)}...`);
        results[index] = text; // Fallback
        errorCount++;
      }
    };

    // Process loop
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const promises = batch.map((text, idx) => processItem(text, i + idx));
      
      await Promise.all(promises);
      
      // Delay to respect rate limits
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_ITEMS));
      
      if (i % 50 === 0) logger.debug(`Progress: ${i}/${texts.length}`);
    }
    
    return { translated: results, errorCount };
  }
}

export const translator = new TranslatorService();
