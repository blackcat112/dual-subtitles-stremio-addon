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
   * Batch translate multiple texts
   * LibreTranslate doesn't support native batching, so we process sequentially
   */
  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const results: string[] = [];
    
    // SEQUENTIAL processing to avoid VPS overload
    // Contabo 6 vCPU handles 1 request at a time more reliably
    logger.info(`📊 Starting translation: 0/${texts.length} lines`);
    
    for (let i = 0; i < texts.length; i++) {
      const translated = await this.translate(texts[i], from, to);
      results.push(translated);
      
      // Progress logging every 50 lines
      if ((i + 1) % 50 === 0 || (i + 1) === texts.length) {
        logger.info(`📊 Translation progress: ${i + 1}/${texts.length} lines completed`);
      }
    }
    
    logger.info(`✅ Translation complete: ${texts.length}/${texts.length} lines`);
    return results;
  }
}

export const libreTranslateClient = new LibreTranslateClient();
