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
   * Batch translate multiple texts with smart batching
   * Groups multiple lines together to reduce HTTP overhead
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const results: string[] = [];
    
    // SMART BATCHING: Group 10 lines per request
    // 751 lines ÷ 10 = ~75 requests (instead of 751)
    const BATCH_SIZE = 10;
    const SEPARATOR = '\n####SPLIT####\n'; // Unique separator unlikely to appear in subtitles
    
    logger.info(`📊 Starting batched translation: 0/${texts.length} lines (${Math.ceil(texts.length / BATCH_SIZE)} batches)`);
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, Math.min(i + BATCH_SIZE, texts.length));
      
      // Join multiple lines with separator
      const batchedText = chunk.join(SEPARATOR);
      
      try {
        // Translate the entire batch as one request
        const translatedBatch = await this.translate(batchedText, from, to);
        
        // Split the response back into individual lines
        const translatedLines = translatedBatch.split(SEPARATOR);
        
        // Handle mismatch (LibreTranslate might return fewer splits)
        if (translatedLines.length !== chunk.length) {
          logger.warn(`⚠️ Batch split mismatch: expected ${chunk.length}, got ${translatedLines.length}. Using line-by-line fallback.`);
          
          // Fallback: translate each line individually
          for (const text of chunk) {
            const translated = await this.translate(text, from, to);
            results.push(translated);
          }
        } else {
          // Success: add all translated lines
          results.push(...translatedLines);
        }
      } catch (error: any) {
        logger.error(`❌ Batch translation failed: ${error.message}. Falling back to line-by-line.`);
        
        // Fallback: translate each line individually
        for (const text of chunk) {
          try {
            const translated = await this.translate(text, from, to);
            results.push(translated);
          } catch (lineError: any) {
            logger.error(`❌ Line translation failed: ${lineError.message}. Using original.`);
            results.push(text); // Use original text on error
          }
        }
      }
      
      // Progress logging every ~100 lines
      if ((i + BATCH_SIZE) % 100 === 0 || (i + chunk.length) >= texts.length) {
        const completed = Math.min(i + chunk.length, texts.length);
        logger.info(`📊 Translation progress: ${completed}/${texts.length} lines (${Math.ceil(completed / BATCH_SIZE)}/${Math.ceil(texts.length / BATCH_SIZE)} batches)`);
      }
    }
    
    logger.info(`✅ Batched translation complete: ${texts.length}/${texts.length} lines`);
    return results;
  }
}

export const libreTranslateClient = new LibreTranslateClient();
