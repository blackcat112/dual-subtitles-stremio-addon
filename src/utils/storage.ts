/**
 * Subtitle storage and serving
 * Stores merged subtitles in memory and provides URLs
 */

interface StoredSubtitle {
  content: string;
  timestamp: number;
  id: string;
}

class SubtitleStorage {
  private storage: Map<string, StoredSubtitle> = new Map();
  private ttl: number = 3600000; // 1 hour

  /**
   * Store merged subtitle and return serving ID
   */
  store(content: string, imdbId: string, lang1: string, lang2: string): string {
    const id = `${imdbId}-${lang1}-${lang2}-${Date.now()}`;
    
    this.storage.set(id, {
      content,
      timestamp: Date.now(),
      id
    });

    // Clean expired entries
    this.cleanExpired();

    return id;
  }

  /**
   * Retrieve subtitle by ID
   */
  get(id: string): string | null {
    const subtitle = this.storage.get(id);
    
    if (!subtitle) {
      return null;
    }

    // Check if expired
    if (Date.now() - subtitle.timestamp > this.ttl) {
      this.storage.delete(id);
      return null;
    }

    return subtitle.content;
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [id, subtitle] of this.storage.entries()) {
      if (now - subtitle.timestamp > this.ttl) {
        this.storage.delete(id);
      }
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { count: number; ids: string[] } {
    return {
      count: this.storage.size,
      ids: Array.from(this.storage.keys())
    };
  }

  /**
   * Clear all stored subtitles (for debugging/testing)
   */
  clear(): void {
    this.storage.clear();
  }
}

export const subtitleStorage = new SubtitleStorage();
