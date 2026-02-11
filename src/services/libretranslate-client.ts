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
   * Batch translate multiple texts with controlled parallelism
   * Process 2 requests at a time to balance speed and VPS stability
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const results: string[] = [];
    
    // OPTIMIZED PARALLELISM: 6 concurrent requests
    // Based on VPS monitoring: balanced performance (150ms/line) with healthy CPU usage (~75%)
    const CONCURRENT_REQUESTS = 6;
    
    logger.info(`📊 Starting translation: 0/${texts.length} lines (${CONCURRENT_REQUESTS} concurrent)`);
    
    for (let i = 0; i < texts.length; i += CONCURRENT_REQUESTS) {
      const chunk = texts.slice(i, Math.min(i + CONCURRENT_REQUESTS, texts.length));
      
      try {
        const promises = chunk.map(text => this.translate(text, from, to));
        const translated = await Promise.all(promises);
        results.push(...translated);
      } catch (error: any) {
        logger.error(`❌ Parallel translation failed: ${error.message}. Falling back to sequential.`);
        
        // Fallback: translate each line individually
        for (const text of chunk) {
          try {
            const translated = await this.translate(text, from, to);
            results.push(translated);
          } catch (lineError: any) {
            logger.error(`❌ Line translation failed: ${lineError.message}. Using original.`);
            results.push(text);
          }
        }
      }
      
      // Progress logging every 100 lines
      if ((i + CONCURRENT_REQUESTS) % 100 === 0 || (i + chunk.length) >= texts.length) {
        const completed = Math.min(i + chunk.length, texts.length);
        logger.info(`📊 Translation progress: ${completed}/${texts.length} lines`);
      }
    }
    
    logger.info(`✅ Translation complete: ${texts.length}/${texts.length} lines`);
    return results;
  }
}

export const libreTranslateClient = new LibreTranslateClient();
