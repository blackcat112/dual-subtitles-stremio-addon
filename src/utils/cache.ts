/**
 * Simple in-memory cache for subtitle content
 * Helps avoid hitting OpenSubtitles API rate limits
 */

interface CacheEntry {
  content: string;
  timestamp: number;
}

class SubtitleCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number; // Time to live in milliseconds

  constructor(ttlSeconds: number = 86400) { // Default: 24 hours
    this.ttl = ttlSeconds * 1000;
  }

  /**
   * Generate cache key from parameters
   */
  private getCacheKey(imdbId: string, language: string, season?: number, episode?: number): string {
    const key = `${imdbId}-${language}`;
    if (season !== undefined && episode !== undefined) {
      return `${key}-s${season}e${episode}`;
    }
    return key;
  }

  /**
   * Get cached subtitle if available and not expired
   */
  get(imdbId: string, language: string, season?: number, episode?: number): string | null {
    const key = this.getCacheKey(imdbId, language, season, episode);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      // Expired, remove from cache
      this.cache.delete(key);
      return null;
    }

    return entry.content;
  }

  /**
   * Store subtitle in cache
   */
  set(imdbId: string, language: string, content: string, season?: number, episode?: number): void {
    const key = this.getCacheKey(imdbId, language, season, episode);
    this.cache.set(key, {
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Export singleton instance
import { config } from '../config';
export const subtitleCache = new SubtitleCache(config.cacheTTL);
