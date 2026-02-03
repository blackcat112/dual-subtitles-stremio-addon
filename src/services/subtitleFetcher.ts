import { openSubtitlesClient } from './opensubtitles';
import { SubtitleSearchParams } from '../types';
import { logger } from '../utils/logger';
import { subtitleCache } from '../utils/cache';

/**
 * High-level service to fetch subtitles
 * Handles search and download in one operation
 * Uses cache to reduce API calls
 */
export async function fetchSubtitle(params: SubtitleSearchParams): Promise<string | null> {
  const { imdbId, language, season, episode } = params;

  // Check cache first
  const cached = subtitleCache.get(imdbId, language, season, episode);
  if (cached) {
    logger.info(`✨ Cache hit for ${imdbId} (${language})`);
    return cached;
  }

  try {
    // Step 1: Search for subtitles
    const searchResults = await openSubtitlesClient.searchSubtitles(params);
    
    if (searchResults.length === 0) {
      logger.warn(`No subtitles found for ${params.imdbId} in ${params.language}`);
      return null;
    }

    // Step 2: Get the best subtitle (highest downloads/rating)
    const bestSubtitle = openSubtitlesClient.getBestSubtitle(searchResults);
    
    if (!bestSubtitle) {
      logger.warn('No suitable subtitle found');
      return null;
    }

    logger.info(`Selected subtitle: ${bestSubtitle.fileName} (${bestSubtitle.downloads} downloads)`);

    // Step 3: Download the subtitle content
    const content = await openSubtitlesClient.downloadSubtitle(bestSubtitle.id);
    
    if (!content) {
      logger.error('Failed to download subtitle content');
      return null;
    }

    // Store in cache for future requests
    subtitleCache.set(imdbId, language, content, season, episode);
    logger.debug(`Cached subtitle for ${imdbId} (${language})`);

    return content;

  } catch (error) {
    logger.error('Error fetching subtitle:', error);
    return null;
  }
}

/**
 * Fetch subtitles for two languages
 * Returns [language1_content, language2_content]
 */
export async function fetchDualSubtitles(
  imdbId: string,
  type: 'movie' | 'episode',
  lang1: string,
  lang2: string,
  season?: number,
  episode?: number
): Promise<[string | null, string | null]> {
  logger.info(`Fetching dual subtitles: ${lang1} + ${lang2} for ${imdbId}`);

  // Fetch both subtitles in parallel
  const [subtitle1, subtitle2] = await Promise.all([
    fetchSubtitle({ imdbId, language: lang1, type, season, episode }),
    fetchSubtitle({ imdbId, language: lang2, type, season, episode })
  ]);

  return [subtitle1, subtitle2];
}
