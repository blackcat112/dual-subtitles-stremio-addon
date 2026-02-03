import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { SubtitleSearchParams, SubtitleResult } from '../types';
import { logger } from '../utils/logger';

/**
 * OpenSubtitles API client
 * Docs: https://opensubtitles.stoplight.io/
 */
class OpenSubtitlesClient {
  private baseUrl: string;
  private apiKey: string;
  private userAgent: string;

  constructor() {
    this.baseUrl = config.opensubtitles.baseUrl;
    this.apiKey = config.opensubtitles.apiKey;
    this.userAgent = config.opensubtitles.userAgent;
  }

  /**
   * Search for subtitles by IMDB ID and language
   */
  async searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleResult[]> {
    const { imdbId, language, type, season, episode } = params;
    
    logger.info(`Searching subtitles for ${imdbId} in ${language} (${type})`);
    
    if (!this.apiKey) {
      logger.error('OpenSubtitles API key not configured');
      return [];
    }

    try {
      // Remove 'tt' prefix from IMDB ID for the API
      const cleanImdbId = imdbId.replace('tt', '');
      
      // Build query parameters
      const queryParams: Record<string, string | number> = {
        imdb_id: cleanImdbId,
        languages: language,
      };

      // Add episode info if it's a series
      if (type === 'episode' && season && episode) {
        queryParams.season_number = parseInt(season.toString(), 10);
        queryParams.episode_number = parseInt(episode.toString(), 10);
      }

      logger.debug('API Request params:', queryParams);

      const response = await axios.get(`${this.baseUrl}/subtitles`, {
        params: queryParams,
        headers: {
          'Api-Key': this.apiKey,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.data) {
        logger.warn(`No subtitles found for ${imdbId} in ${language}`);
        return [];
      }

      const subtitles: SubtitleResult[] = response.data.data.map((item: any) => {
        const file = item.attributes?.files?.[0];
        return {
          id: file?.file_id?.toString() || '',
          language: item.attributes?.language || language,
          downloadUrl: '', // Will be obtained in download step
          fileName: file?.file_name || 'subtitle.srt',
          downloads: item.attributes?.download_count || 0,
          rating: item.attributes?.ratings || 0,
          // Extract metadata for filtering
          season: item.attributes?.feature_details?.season_number,
          episode: item.attributes?.feature_details?.episode_number
        };
      }).filter((sub: any) => {
        if (!sub.id) return false;
        
        // Strict filtering for episodes
        if (type === 'episode' && season && episode) {
          let detectedSeason = sub.season;
          let detectedEpisode = sub.episode;

          // Fallback: Try to parse from filename if metadata is missing or incomplete
          if ((detectedSeason === undefined || detectedEpisode === undefined) && sub.fileName) {
             const sxxExxMatch = sub.fileName.match(/[sS](\d{1,2})[eE](\d{1,2})/);
             const xFormatMatch = sub.fileName.match(/(\d{1,2})x(\d{1,2})/);
             
             if (sxxExxMatch) {
                detectedSeason = parseInt(sxxExxMatch[1], 10);
                detectedEpisode = parseInt(sxxExxMatch[2], 10);
             } else if (xFormatMatch) {
                detectedSeason = parseInt(xFormatMatch[1], 10);
                detectedEpisode = parseInt(xFormatMatch[2], 10);
             }
          }

          const logPrefix = `[Filter ${sub.fileName.substring(0, 20)}...]`;

          // Check Season
          if (detectedSeason !== undefined && detectedSeason !== null) {
             if (Number(detectedSeason) !== Number(season)) {
               logger.debug(`${logPrefix} REJECT: Season mismatch (Found: ${detectedSeason}, Wanted: ${season})`);
               return false;
             }
          }
          
          // Check Episode
          if (detectedEpisode !== undefined && detectedEpisode !== null) {
             if (Number(detectedEpisode) !== Number(episode)) {
               logger.debug(`${logPrefix} REJECT: Episode mismatch (Found: ${detectedEpisode}, Wanted: ${episode})`);
               return false;
             }
          }

          // Ultra-strict mode (Re-verified)
          if (detectedSeason === undefined && detectedEpisode === undefined) {
             logger.debug(`${logPrefix} REJECT: Undefined season/episode (Strict Mode v2)`);
             return false;
          }
          
          logger.debug(`${logPrefix} ACCEPT: Matches S${detectedSeason}E${detectedEpisode}`);
        }
        return true;
      });

      logger.success(`Found ${subtitles.length} subtitles for ${imdbId} after strict filtering`);
      if (subtitles.length > 0) {
        logger.info(`Top result: ${subtitles[0].fileName} (Season: ${(subtitles[0] as any).season}, Episode: ${(subtitles[0] as any).episode})`);
      } else {
        logger.warn(`No subtitles matched strict criteria for S${season}E${episode}`);
      }
      return subtitles;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          logger.error(`OpenSubtitles API error: ${axiosError.response.status}`, axiosError.response.data);
        } else if (axiosError.request) {
          logger.error('OpenSubtitles API: No response received');
        } else {
          logger.error('OpenSubtitles API request error:', axiosError.message);
        }
      } else {
        logger.error('Failed to search subtitles:', error);
      }
      return [];
    }
  }

  /**
   * Download subtitle file by ID
   */
  async downloadSubtitle(fileId: string): Promise<string> {
    logger.info(`Downloading subtitle file ${fileId}`);
    
    if (!this.apiKey) {
      logger.error('OpenSubtitles API key not configured');
      return '';
    }

    try {
      // Step 1: Request download link
      const downloadResponse = await axios.post(
        `${this.baseUrl}/download`,
        { file_id: parseInt(fileId, 10) },
        {
          headers: {
            'Api-Key': this.apiKey,
            'User-Agent': this.userAgent,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (!downloadResponse.data || !downloadResponse.data.link) {
        logger.error('No download link received from API');
        return '';
      }

      const downloadLink = downloadResponse.data.link;
      logger.debug(`Download link obtained: ${downloadLink}`);

      // Step 2: Download the actual subtitle file
      const subtitleResponse = await axios.get(downloadLink, {
        responseType: 'text',
        timeout: 15000
      });

      const content = subtitleResponse.data;
      
      if (!content || typeof content !== 'string') {
        logger.error('Invalid subtitle content received');
        return '';
      }

      logger.success(`Downloaded subtitle (${content.length} bytes)`);
      return content;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          logger.error(`Download error: ${axiosError.response.status}`, axiosError.response.data);
        } else if (axiosError.request) {
          logger.error('Download: No response received');
        } else {
          logger.error('Download request error:', axiosError.message);
        }
      } else {
        logger.error('Failed to download subtitle:', error);
      }
      return '';
    }
  }

  /**
   * Get the best subtitle from search results
   * Prioritizes by download count and rating
   */
  getBestSubtitle(subtitles: SubtitleResult[]): SubtitleResult | null {
    if (subtitles.length === 0) {
      return null;
    }

    // Sort by downloads (primary) and rating (secondary)
    const sorted = [...subtitles].sort((a, b) => {
      const downloadDiff = (b.downloads || 0) - (a.downloads || 0);
      if (downloadDiff !== 0) return downloadDiff;
      return (b.rating || 0) - (a.rating || 0);
    });

    return sorted[0];
  }
}

export const openSubtitlesClient = new OpenSubtitlesClient();
