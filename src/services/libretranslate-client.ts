import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * LibreTranslate Client - Self-hosted translation service
 * Deployed on Contabo VPS (6 vCPU, 12GB RAM)
 * Supports: en, es, fr
 * Performance: 5-8 min per episode (700 lines)
 * No rate limits, unlimited usage
 */
export class LibreTranslateClient {
  private apiUrl: string;
  private apiKey: string;
  private isConfigured: boolean;

  constructor() {
    this.apiUrl = process.env.LIBRETRANSLATE_URL || '';
    this.apiKey = process.env.LIBRETRANSLATE_API_KEY || '';
    this.isConfigured = this.apiUrl.length > 0;
    
    if (!this.isConfigured) {
      logger.warn('⚠️  LIBRETRANSLATE_URL not configured. LibreTranslate disabled.');
    } else {
      const authStatus = this.apiKey ? 'with API key' : 'without API key';
      logger.info(`🌐 LibreTranslate configured at ${this.apiUrl} (${authStatus})`);
    }
  }

  /**
   * Check if LibreTranslate is available
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Translate a single text
   */
  async translate(text: string, from: string, to: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return text;
    }

    try {
      const requestBody: any = {
        q: text,
        source: from,
        target: to,
      };
      
      // Add API key if configured
      if (this.apiKey) {
        requestBody.api_key = this.apiKey;
      }
      
      const response = await axios.post(`${this.apiUrl}/translate`, requestBody, {
        timeout: 120000, // 120 seconds timeout (increased for long episodes 700+ lines)
      });
      
      return response.data.translatedText;
    } catch (error: any) {
      logger.error(`LibreTranslate error: ${error.message}`);
      throw error;
    }
  }


  /**
   * Translate multiple texts in a single API call (native batch support)
   */
  async translateBatchNative(texts: string[], from: string, to: string): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const requestBody: any = {
        q: texts, // LibreTranslate supports array of strings
        source: from,
        target: to,
      };
      
      // Add API key if configured
      if (this.apiKey) {
        requestBody.api_key = this.apiKey;
      }
      
      const response = await axios.post(`${this.apiUrl}/translate`, requestBody, {
        timeout: 120000, // 120 seconds timeout
      });
      
      // Response format: { translatedText: ["text1", "text2", ...] }
      return Array.isArray(response.data.translatedText) 
        ? response.data.translatedText 
        : [response.data.translatedText];
    } catch (error: any) {
      logger.error(`LibreTranslate batch error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch translate multiple texts with controlled parallelism
   * Uses native batch API to reduce HTTP overhead
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const results: string[] = [];
    
    // OPTIMIZED PARALLELISM: 5 concurrent batch requests (20 lines per batch)
    // Production data: 650 lines in 4min (~37s/100 lines), CPU ~85%
    const CONCURRENT_BATCHES = 5;
    const BATCH_SIZE = 20; // Translate 20 lines per batch API call
    
    logger.info(`📊 Starting translation: 0/${texts.length} lines (${CONCURRENT_BATCHES} concurrent batches of ${BATCH_SIZE})...`);
    
    for (let i = 0; i < texts.length; i += CONCURRENT_BATCHES * BATCH_SIZE) {
      const batchPromises = [];
      
      // Create up to CONCURRENT_BATCHES parallel requests, each handling BATCH_SIZE lines
      for (let j = 0; j < CONCURRENT_BATCHES; j++) {
        const startIdx = i + (j * BATCH_SIZE);
        const endIdx = Math.min(startIdx + BATCH_SIZE, texts.length);
        
        if (startIdx < texts.length) {
          const chunk = texts.slice(startIdx, endIdx);
          batchPromises.push(this.translateBatchNative(chunk, from, to));
        }
      }
      
      try {
        const batchResults = await Promise.all(batchPromises);
        // Flatten the array of arrays into a single array
        results.push(...batchResults.flat());
      } catch (error: any) {
        logger.error(`❌ Batch translation failed: ${error.message}. Falling back to individual translation.`);
        
        // Fallback: translate remaining lines individually
        for (let k = i; k < Math.min(i + CONCURRENT_BATCHES * BATCH_SIZE, texts.length); k++) {
          try {
            const translated = await this.translate(texts[k], from, to);
            results.push(translated);
          } catch (lineError: any) {
            logger.error(`❌ Line translation failed: ${lineError.message}. Using original.`);
            results.push(texts[k]);
          }
        }
      }
      
      // Progress logging every 100 lines
      if ((i + CONCURRENT_BATCHES * BATCH_SIZE) % 100 === 0 || results.length >= texts.length) {
        const completed = Math.min(results.length, texts.length);
        logger.info(`📊 Translation progress: ${completed}/${texts.length} lines`);
      }
    }
    
    logger.info(`✅ Translation complete: ${texts.length}/${texts.length} lines`);
    return results;
  }

}

export const libreTranslateClient = new LibreTranslateClient();

