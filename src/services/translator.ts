import { translate } from 'google-translate-api-x';
import { logger } from '../utils/logger';
import { deeplTranslator } from './deepl-translator';
import { libreTranslateClient } from './libretranslate-client';

/**
 * Service to handle text translation
 * Priority: LibreTranslate (self-hosted) → DeepL (if configured) → Google Translate (fallback)
 * 
 * LibreTranslate: Unlimited, 5-8 min/episode, self-hosted on Contabo (7/10 quality)
 * DeepL: 500k chars/month per key, superior quality (9/10)
 * Google: Unlimited but rate-limited, good quality (7/10)
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
   * Translate an array of subtitle lines efficiently using Native Batching
   * We pass the array DIRECTLY to the library, which sends fewer HTTP requests.
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<{ translated: string[], errorCount: number }> {
    const results: string[] = new Array(texts.length);
    let errorCount = 0;

    // PRIORITY 1: LibreTranslate (self-hosted, unlimited, fast)
    if (libreTranslateClient.isAvailable()) {
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
        
      } catch (libreError: any) {
        logger.warn(`⚠️  LibreTranslate failed: ${libreError.message}. Trying DeepL...`);
      }
    }

    // PRIORITY 2: DeepL (if configured, premium quality)
    if (deeplTranslator.isAvailable()) {
      try {
        logger.info(`🌐 Using DeepL for translation (${texts.length} lines)`);
        
        // DeepL handles batching internally, but we'll chunk to be safe
        for (let i = 0; i < texts.length; i += 50) {
          const chunk = texts.slice(i, Math.min(i + 50, texts.length));
          const translated = await deeplTranslator.translateBatch(chunk, from, to);
          
          chunk.forEach((_, idx) => {
            results[i + idx] = translated[idx];
            // Cache the result
            const key = `${from}:${to}:${chunk[idx]}`;
            this.cache.set(key, translated[idx]);
          });
          
          logger.debug(`DeepL: Translated ${i + chunk.length}/${texts.length} lines`);
        }
        
        return { translated: results, errorCount: 0 };
        
      } catch (deeplError: any) {
        logger.warn(`⚠️  DeepL failed: ${deeplError.message}. Falling back to Google Translate...`);
      }
    }

    // PRIORITY 3: Google Translate (fallback, rate-limited)
    logger.info(`🌐 Using Google Translate for translation (${texts.length} lines)`);
    
    const MAX_CHUNK_SIZE = 3;
    
    const processChunk = async (chunk: string[], indices: number[], retries = 2): Promise<void> => {
      const cleanChunk = chunk.map(text => {
         if (text.trim() && !/^\d+$/.test(text.trim())) {
           return text;
         }
         return '';
      });
      
      try {
        const res = await translate(cleanChunk, { from, to, forceBatch: false }) as any;
        
        if (Array.isArray(res)) {
           res.forEach((r: any, i) => {
             results[indices[i]] = r.text;
             const key = `${from}:${to}:${chunk[i]}`;
             this.cache.set(key, r.text);
           });
        } else if (res && res.text) {
           results[indices[0]] = res.text;
        }

      } catch (err: any) {
        if (retries > 0 && err?.response?.status === 429) {
           const delay = 5000 * Math.pow(2, 2 - retries);
           logger.warn(`⚠️  Rate limit hit. Backing off ${delay/1000}s...`);
           await new Promise(r => setTimeout(r, delay));
           return processChunk(chunk, indices, retries - 1);
        }
        
        logger.error(`Chunk failed permanently: ${err.message}`);
        chunk.forEach((txt, i) => { results[indices[i]] = txt; });
        errorCount++;
      }
    };

    // Create chunks
    for (let i = 0; i < texts.length; i += MAX_CHUNK_SIZE) {
      const chunk = texts.slice(i, i + MAX_CHUNK_SIZE);
      const indices = chunk.map((_, idx) => i + idx);
      
      await processChunk(chunk, indices);
      
      // OPTIMIZED: Conservative delay (750-1000ms)
      const baseDelay = 750;
      const jitter = Math.random() * 250;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
      
      if ((i + MAX_CHUNK_SIZE) % 50 === 0) {
        logger.debug(`Processed ${Math.min(i + MAX_CHUNK_SIZE, texts.length)}/${texts.length} lines`);
      }
    }

    return { translated: results, errorCount };
  }
}

export const translator = new TranslatorService();
