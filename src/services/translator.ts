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
   * Translate an array of subtitle lines efficiently using Native Batching
   * We pass the array DIRECTLY to the library, which sends fewer HTTP requests.
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    logger.info(`Translating ${texts.length} lines from ${from} to ${to} (Native Batching)`);
    
    // We send chunks of simple text. 
    // The library handles array inputs: translate([t1, t2], ...).
    const MAX_CHUNK_SIZE = 50; // Google batch endpoint can handle ~50-100 items usually
    const results: string[] = new Array(texts.length).fill('');
    
    // Helper to retry chunks
    const processChunk = async (chunk: string[], indices: number[], retries = 3): Promise<void> => {
      try {
        // Filter out things that don't need translation to save payload size
        // But we need to maintain index alignment.
        // The library returns an array of results matching the input array length.
        
        let hasContent = false;
        const cleanChunk = chunk.map(text => {
           if (text.trim() && !/^\d+$/.test(text.trim())) {
             hasContent = true;
             return text;
           }
           return ''; // Placeholder for empty/numeric lines we don't want to translate
        });

        if (!hasContent) {
           // If chunk is all numbers/empty, just copy original
           chunk.forEach((txt, i) => { results[indices[i]] = txt; });
           return;
        }

        // Native Array Call
        // Note: The library returns { text: string } | { text: string }[] (if input is array)
        // actually for array input it returns an object with text as string (joined) or array?
        // Let's verify standard behavior: usually it returns an array of objects.
        const res = await translate(chunk, { from, to }) as any;
        
        // Map results back
        if (Array.isArray(res)) {
           res.forEach((r: any, i) => {
             results[indices[i]] = r.text;
             // Cache individual results
             const key = `${from}:${to}:${chunk[i]}`;
             this.cache.set(key, r.text);
           });
        } else if (res && res.text) {
           // Single result fallback (shouldn't happen with array input but safety first)
           results[indices[0]] = res.text;
        }

      } catch (err: any) {
        if (retries > 0 && err?.response?.status === 429) {
           const delay = 2000 + (Math.random() * 1000);
           logger.warn(`⚠️ Batch 429. Retrying in ${Math.round(delay)}ms...`);
           await new Promise(r => setTimeout(r, delay));
           return processChunk(chunk, indices, retries - 1);
        }
        
        // Critical Failure for this chunk
        logger.error(`Chunk failed permanently: ${err.message}`);
        // Fallback to original text
        chunk.forEach((txt, i) => { results[indices[i]] = txt; });
      }
    };

    // Create chunks
    for (let i = 0; i < texts.length; i += MAX_CHUNK_SIZE) {
      const chunk = texts.slice(i, i + MAX_CHUNK_SIZE);
      const indices = chunk.map((_, idx) => i + idx);
      
      await processChunk(chunk, indices);
      
      // Small delay between HTTP requests to be polite
      await new Promise(r => setTimeout(r, 300));
      
      if ((i + MAX_CHUNK_SIZE) % 200 === 0) {
        logger.debug(`Processed ${Math.min(i + MAX_CHUNK_SIZE, texts.length)}/${texts.length} lines`);
      }
    }
    
    return results;
  }
}

export const translator = new TranslatorService();
