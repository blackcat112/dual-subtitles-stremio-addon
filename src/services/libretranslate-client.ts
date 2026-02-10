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
  private isConfigured: boolean;

  constructor() {
    this.apiUrl = process.env.LIBRETRANSLATE_URL || '';
    this.isConfigured = this.apiUrl.length > 0;
    
    if (!this.isConfigured) {
      logger.warn('⚠️  LIBRETRANSLATE_URL not configured. LibreTranslate disabled.');
    } else {
      logger.info(`🌐 LibreTranslate configured at ${this.apiUrl}`);
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
      const response = await axios.post(`${this.apiUrl}/translate`, {
        q: text,
        source: from,
        target: to,
      }, {
        timeout: 30000, // 30 seconds timeout
      });
      
      return response.data.translatedText;
    } catch (error: any) {
      logger.error(`LibreTranslate error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch translate multiple texts
   * LibreTranslate doesn't support native batching, so we process in parallel
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const results: string[] = [];
    
    // Process in parallel (chunks of 10 to avoid overwhelming the server)
    const CONCURRENT_REQUESTS = 10;
    
    for (let i = 0; i < texts.length; i += CONCURRENT_REQUESTS) {
      const chunk = texts.slice(i, Math.min(i + CONCURRENT_REQUESTS, texts.length));
      const promises = chunk.map(text => this.translate(text, from, to));
      const translated = await Promise.all(promises);
      results.push(...translated);
      
      if ((i + CONCURRENT_REQUESTS) % 50 === 0) {
        logger.debug(`LibreTranslate: ${i + chunk.length}/${texts.length} lines translated`);
      }
    }
    
    return results;
  }
}

export const libreTranslateClient = new LibreTranslateClient();
