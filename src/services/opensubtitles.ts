import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { SubtitleSearchParams, SubtitleResult } from '../types';
import { logger } from '../utils/logger';

/**
 * OpenSubtitles API client
 * Docs: https://opensubtitles.stoplight.io/
 */
export class OpenSubtitlesClient {
  private baseUrl: string;
  private apiKeys: string[];
  private userAgent: string;
  private currentKeyIndex: number = 0;

  constructor() {
    this.baseUrl = config.opensubtitles.baseUrl;
    // Parse comma-separated keys or single key
    const rawKeys = process.env.OPENSUBTITLES_API_KEYS || config.opensubtitles.apiKey || '';
    this.apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
    this.userAgent = config.opensubtitles.userAgent;

    if (this.apiKeys.length === 0) {
      logger.error('❌ No API Keys configured! Please set OPENSUBTITLES_API_KEYS');
    } else {
      logger.info(`🔑 Initialized with ${this.apiKeys.length} API Key(s) for rotation`);
    }
  }

  /**
   * Helper to execute an operation with automatic key rotation on failure
   */
  private async executeWithRotation<T>(
    operationName: string,
    operation: (apiKey: string) => Promise<T>,
    retryCount = 0
  ): Promise<T | null> {
    if (this.apiKeys.length === 0) return null;
    if (retryCount >= this.apiKeys.length) {
      logger.error(`❌ All ${this.apiKeys.length} API keys exhausted for ${operationName}`);
      return null;
    }

    const currentKey = this.apiKeys[this.currentKeyIndex];

    try {
      return await operation(currentKey);
    } catch (error) {
      // Check if error is quota related OR server error (5xx)
      // 429: Too Many Requests (Quota)
      // 402: Payment Required (VIP Quota)
      // 403: Forbidden (Sometimes quota)
      // 500/502/503/504: Server Side Issues (Retry might fix)
      let isRetryableError = false;
      let status = 0;

      if (axios.isAxiosError(error) && error.response) {
        status = error.response.status;
        if (
          status === 429 || 
          status === 402 || 
          (status === 403 && error.response.data?.message?.includes('quota')) ||
          (status >= 500 && status < 600) // Retry all server errors
        ) {
          isRetryableError = true;
        }
      }

      if (isRetryableError) {
        logger.warn(`⚠️ Key ${this.currentKeyIndex + 1}/${this.apiKeys.length} failed (Status ${status}). Rotating/Retrying...`);
        
        // If it's a server error (5xx), maybe wait a bit? 
        // For now, rotation acts as a "fresh connection" attempt.
        
        // Rotate key index
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        
        // Recursive retry with new key
        return this.executeWithRotation(operationName, operation, retryCount + 1);
      } else {
        // If it's another error (e.g. Network, Validation), throw it or handle it upstream
        throw error; 
      }
    }
  }

  /**
   * Search for subtitles by IMDB ID and language
   */
  async searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleResult[]> {
    const { imdbId, language, type, season, episode } = params;
    
    // Wrap the core logic in a function that takes an apiKey
    const performSearch = async (apiKey: string) => {
      logger.info(`Searching subtitles for ${imdbId} (${language}) using Key #${this.currentKeyIndex + 1}`);

      const cleanImdbId = imdbId.replace('tt', '');
      const queryParams: Record<string, string | number> = {
        imdb_id: cleanImdbId,
        languages: language,
      };

      if ((type === 'episode' || type === 'series') && season && episode) {
        queryParams.season_number = parseInt(season.toString(), 10);
        queryParams.episode_number = parseInt(episode.toString(), 10);
      }

      const response = await axios.get(`${this.baseUrl}/subtitles`, {
        params: queryParams,
        headers: {
          'Api-Key': apiKey,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.data) {
        return [];
      }

      // ... (Filtering Logic remains mostly the same, simplified for brevity but essential logic kept) ...
      // Mapping and Filtering logic adapted to standard flow
      const subtitles: SubtitleResult[] = response.data.data.map((item: any) => {
        const file = item.attributes?.files?.[0];
        return {
          id: file?.file_id?.toString() || '',
          language: item.attributes?.language || language,
          downloadUrl: '', 
          fileName: file?.file_name || 'subtitle.srt',
          downloads: item.attributes?.download_count || 0,
          rating: item.attributes?.ratings || 0,
          season: item.attributes?.feature_details?.season_number,
          episode: item.attributes?.feature_details?.episode_number
        };
      }).filter((sub: any) => {
        if (!sub.id) return false;
        
        // Filter logic copied from previous implementation
         if ((type === 'episode' || type === 'series') && season && episode) {
            let detectedSeason = sub.season;
            let detectedEpisode = sub.episode;

            if ((detectedSeason === undefined || detectedEpisode === undefined) && sub.fileName) {
                 const sxxExxMatch = sub.fileName.match(/[sS](\d{1,2})[eE](\d{1,2})/);
                 if (sxxExxMatch) {
                    detectedSeason = parseInt(sxxExxMatch[1], 10);
                    detectedEpisode = parseInt(sxxExxMatch[2], 10);
                 }
            }

            if (detectedSeason !== undefined && Number(detectedSeason) !== Number(season)) return false;
            if (detectedEpisode !== undefined && Number(detectedEpisode) !== Number(episode)) return false;
            
            // Ultra-strict: If both undefined, reject
            if (detectedSeason === undefined && detectedEpisode === undefined) return false;
         }
        return true;
      });
      return subtitles;
    };

    try {
      const result = await this.executeWithRotation('Search', performSearch);
      return result || [];
    } catch (error) {
       logger.error('Search failed after rotation:', error);
       return [];
    }
  }

  /**
   * Download subtitle file by ID
   */
  async downloadSubtitle(fileId: string): Promise<string> {
    const performDownload = async (apiKey: string) => {
      logger.info(`Downloading subtitle ${fileId} using Key #${this.currentKeyIndex + 1}`);

      const downloadResponse = await axios.post(
        `${this.baseUrl}/download`,
        { file_id: parseInt(fileId, 10) },
        {
          headers: {
            'Api-Key': apiKey,
            'User-Agent': this.userAgent,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (!downloadResponse.data || !downloadResponse.data.link) {
        throw new Error('No download link received');
      }

      const subtitleResponse = await axios.get(downloadResponse.data.link, {
        responseType: 'text',
        timeout: 15000
      });

      return subtitleResponse.data;
    };

    try {
      const result = await this.executeWithRotation('Download', performDownload);
      return result || '';
    } catch (error) {
      logger.error('Download failed after rotation', error);
      return '';
    }
  }

  /**
   * Intelligent subtitle selection using multi-factor scoring
   * Based on community best practices:
   * - Trusted/Sub Translator uploaders (higher quality)
   * - Recent uploads (likely corrections of earlier subs)
   * - Ratings (user feedback)
   * - Downloads (popularity, but less weighted)
   * - Release info richness (BluRay, WEB-DL, FPS, etc.)
   */
  getBestSubtitle(subtitles: SubtitleResult[]): SubtitleResult | null {
    if (subtitles.length === 0) return null;
    
    // Calculate scores for each subtitle
    const scored = subtitles.map(sub => {
      let score = 0;
      
      // 1. Trusted uploader badge (highest priority)
      if (sub.uploaderRank) {
        if (sub.uploaderRank === 'trusted' || sub.uploaderRank === 'sub_translator') {
          score += 50; // Major boost for quality uploaders
        } else if (sub.uploaderRank.includes('star')) {
          score += 20; // Moderate boost for experienced users
        }
      }
      
      // 2. Upload recency (newer = likely corrected version)
      if (sub.uploadDate) {
        const uploadTime = new Date(sub.uploadDate).getTime();
        const now = Date.now();
        const daysSinceUpload = (now - uploadTime) / (1000 * 60 * 60 * 24);
        
        // Fresh uploads within 30 days get bonus
        if (daysSinceUpload < 30) {
          score += 30 - daysSinceUpload; // 30 points if uploaded today, decreasing linearly
        } else if (daysSinceUpload < 90) {
          score += 15; // Recent enough
        }
      }
      
      // 3. Rating (user feedback quality)
      const rating = sub.rating || 0;
      if (rating > 0) {
        score += rating * 4; // Scale 0-5 rating to 0-20 points
      }
      
      // 4. Release info richness (critical for sync quality)
      const fileName = sub.fileName?.toLowerCase() || '';
      let releaseScore = 0;
      
      // AGGRESSIVE BluRay preference (user ONLY wants BluRay)
      // BluRay = best sync, no commercials, no recaps
      if (/bluray|blu-ray|bdrip|brrip/i.test(fileName)) {
        releaseScore += 30; // MASSIVE boost for BluRay (doubled from 15)
      }
      
      // Common release types (higher specificity = better match likelihood)
      const releaseTypes = [
        { pattern: /web-?dl|webdl/i, points: 8, name: 'WEB-DL' },
        { pattern: /webrip|web-rip/i, points: 7, name: 'WEBRip' },
        { pattern: /hdtv|hd-tv/i, points: -10, name: 'HDTV' },  // PENALTY: often has recap/commercials
        { pattern: /dvdrip|dvd-rip/i, points: 4, name: 'DVDRip' },
      ];
      
      // FPS info (helps with PAL/NTSC conversions)
      if (/23\.97|23\.976|24\.00|25\.00|29\.97|30\.00/i.test(fileName)) {
        releaseScore += 5;
      }
      
      // Resolution info
      if (/1080p|720p|2160p|4k/i.test(fileName)) {
        releaseScore += 3;
      }
      
      // Codec info
      if (/x264|x265|h264|h265|hevc/i.test(fileName)) {
        releaseScore += 2;
      }
      
      // Check for other release types (only if not BluRay)
      if (releaseScore < 30) {  // Not BluRay
        for (const release of releaseTypes) {
          if (release.pattern.test(fileName)) {
            releaseScore += release.points;
            break; // Only count one release type
          }
        }
      }
      
      score += releaseScore;
      
      // 5. Downloads (least important, but still a signal)
      const downloads = sub.downloads || 0;
      const maxDownloads = Math.max(...subtitles.map(s => s.downloads || 0));
      if (maxDownloads > 0) {
        score += (downloads / maxDownloads) * 10; // Normalized 0-10 points
      }
      
      return { sub, score, releaseScore };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    const topThree = scored.slice(0, 3);
    
    logger.info(`📊 Selected subtitle with score ${best.score.toFixed(1)}: ${best.sub.fileName}`);
    logger.debug(`   ├─ Uploader: ${best.sub.uploaderRank || 'none'}`);
    logger.debug(`   ├─ Downloads: ${best.sub.downloads}, Rating: ${best.sub.rating}`);
    logger.debug(`   ├─ Upload date: ${best.sub.uploadDate || 'unknown'}`);
    logger.debug(`   └─ Release info score: ${best.releaseScore}/18`);
    
    // Log alternatives for debugging
    if (topThree.length > 1) {
      logger.debug(`   Alternatives:`);
      topThree.slice(1).forEach((alt, i) => {
        logger.debug(`   ${i + 2}. ${alt.sub.fileName} (score: ${alt.score.toFixed(1)})`);
      });
    }
    
    return best.sub;
  }
}

export const openSubtitlesClient = new OpenSubtitlesClient();
