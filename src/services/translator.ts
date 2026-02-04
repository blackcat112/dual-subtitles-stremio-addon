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
   * Translate an array of subtitle lines efficiently
   * Ideally, we should batch these to reduce network requests.
   * However, huge batches might trigger rate limits or size limits.
   * A safe batch size is around 10-20 lines or ~2000 chars.
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    logger.info(`Translating batch of ${texts.length} lines from ${from} to ${to}`);
    
    // We process sequentially or in small parallel chunks to avoid 429
    // "google-translate-api-x" requests are independent HTTP calls.
    
    const results: string[] = [];
    const BATCH_SIZE = 10; // Reduced from 50 to 10 to avoid 429 Too Many Requests
    const CONCURRENCY_DELAY = 100; // Increased delay to be polite
    
    // Retry helper
    const retryOperation = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
      try {
        return await fn();
      } catch (err: any) {
        if (retries > 0 && err?.response?.status === 429) {
          logger.warn(`⚠️ Translate rate limit (429). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return retryOperation(fn, retries - 1, delay * 2);
        }
        throw err;
      }
    };

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      
      const chunkPromises = chunk.map(async (text) => {
        if (!text.trim() || /^\d+$/.test(text.trim())) return text;
        
        // Random delay to distribute requests
        await new Promise(r => setTimeout(r, Math.random() * CONCURRENCY_DELAY));
        
        // Wrap in retry logic
        return retryOperation(() => this.translateText(text, from, to));
      });

      try {
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      } catch (error) {
        // If a whole chunk fails after retries, fallback to original text for those lines
        // to ensure we at least deliver the subtitle structure
        logger.error('Batch translation chunk failed permanently, using original text as fallback');
        results.push(...chunk);
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < texts.length) {
         await new Promise(r => setTimeout(r, 500));
      }

      // Log progress periodically
      if ((i + BATCH_SIZE) % 50 === 0) {
        logger.debug(`Translated ${results.length}/${texts.length} lines...`);
      }
    }
    
    return results;
  }
}

export const translator = new TranslatorService();
