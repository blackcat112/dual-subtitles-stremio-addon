import { translate } from 'google-translate-api-x';
import { logger } from '../utils/logger';
import { MicrosoftTranslatorClient } from './microsoftTranslator';

export class TranslatorService {
  private cache: Map<string, string> = new Map();
  private msClient: MicrosoftTranslatorClient | null = null;

  constructor() {
    const msKey = process.env.MICROSOFT_TRANSLATOR_KEY;
    const msRegion = process.env.MICROSOFT_TRANSLATOR_REGION || 'global';
    
    if (msKey) {
      this.msClient = new MicrosoftTranslatorClient(msKey, msRegion);
      logger.info('🚀 Microsoft Translator API Enabled (Premium Mode)');
    } else {
      logger.info('🐢 Using Google Translate Fallback (Free Mode - Limited)');
    }
  }

  /**
   * Main entry point: Translates a batch of texts
   * Automatically selects best provider (Microsoft if available, otherwise Google)
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<{ translated: string[], errorCount: number }> {
    // 1. Try Microsoft API if configured
    if (this.msClient) {
      return this.translateBatchMicrosoft(texts, from, to);
    }

    // 2. Fallback to Google (Safe Sequential Mode)
    return this.translateBatchGoogle(texts, from, to);
  }

  /**
   * Microsoft API Implementation
   * Reliable, fast, supports batches up to 100 items (we use 25 to be safe)
   */
  private async translateBatchMicrosoft(texts: string[], from: string, to: string): Promise<{ translated: string[], errorCount: number }> {
    logger.info(`Translating ${texts.length} lines with Microsoft API...`);
    
    const BATCH_SIZE = 25; // Microsoft allows up to 100, keeping it safe
    const results: string[] = new Array(texts.length).fill('');
    let errorCount = 0;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      const indices = chunk.map((_, idx) => i + idx);

      try {
        // Filter out empty lines to save quota and avoid API errors
        // We keep track of indices to map back correctly
        const validItems: { text: string, originalIdx: number }[] = [];
        
        chunk.forEach((text, idx) => {
          if (text.trim() && !/^\d+$/.test(text.trim())) {
            validItems.push({ text, originalIdx: indices[idx] });
          } else {
            results[indices[idx]] = text; // Copy non-translatable directly
          }
        });

        if (validItems.length > 0) {
          const textsToTranslate = validItems.map(item => item.text);
          const translatedTexts = await this.msClient!.translateBatch(textsToTranslate, from, to);
          
          // Map back to results
          translatedTexts.forEach((trans, idx) => {
            results[validItems[idx].originalIdx] = trans;
            
            // Cache success
            const key = `${from}:${to}:${validItems[idx].text}`;
            this.cache.set(key, trans);
          });
        }

      } catch (error) {
        logger.error('Microsoft API Batch Failed', error);
        errorCount += chunk.length;
        // Fallback: Copy original text for this chunk so index alignment isn't broken
        chunk.forEach((txt, idx) => { results[indices[idx]] = txt; });
      }
    }

    return { translated: results, errorCount };
  }

  /**
   * Google Translate (Sequential Mode)
   * The fallback implementation for free users. Slow but functional-ish.
   */
  private async translateBatchGoogle(texts: string[], from: string, to: string): Promise<{ translated: string[], errorCount: number }> {
    logger.info(`Translating ${texts.length} lines from ${from} to ${to} (Google Sequential Mode)`);
    
    const CONCURRENCY = 2; 
    const DELAY_BETWEEN_ITEMS = 300; // ms
    
    const results: string[] = new Array(texts.length).fill('');
    let errorCount = 0;
    
    const processItem = async (text: string, index: number, retries = 3): Promise<void> => {
      // Check internal cache first (in-memory)
      const key = `${from}:${to}:${text}`;
      if (this.cache.has(key)) {
        results[index] = this.cache.get(key)!;
        return;
      }

      // Skip empty/numbers
      if (!text.trim() || /^\d+$/.test(text.trim())) {
        results[index] = text;
        return;
      }

      try {
        const translated = await this.translateTextGoogleSingle(text, from, to);
        results[index] = translated;
        this.cache.set(key, translated);
      } catch (err: any) {
        if (retries > 0) {
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
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_ITEMS));
      
      if (i % 50 === 0) logger.debug(`Progress: ${i}/${texts.length}`);
    }
    
    return { translated: results, errorCount };
  }

  // Wrapper for single google call
  private async translateTextGoogleSingle(text: string, from: string, to: string): Promise<string> {
    const res = await translate(text, { from, to, forceBatch: false });
    return res.text;
  }

  // Legacy single translation method (kept for compatibility just in case)
  async translateText(text: string, from: string, to: string): Promise<string> {
    const { translated } = await this.translateBatch([text], from, to);
    return translated[0];
  }
}

export const translator = new TranslatorService();
