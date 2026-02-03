import { addonBuilder } from 'stremio-addon-sdk';
import { manifest } from './config/manifest';
import { config } from './config';
import { logger } from './utils/logger';
import { subtitleStorage } from './utils/storage';
import { fetchDualSubtitles } from './services/subtitleFetcher';
import { mergeSubtitles } from './services/subtitleMerger';
import { StremioSubtitle } from './types';

// Create addon builder with manifest
const builder = new addonBuilder(manifest);

/**
 * Subtitles handler
 * Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineSubtitlesHandler.md
 */
builder.defineSubtitlesHandler(async ({ type, id }) => {
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`🚀 Dual Subtitles Addon v1.1.0 (Strict Filter v3)`);
  logger.info(`📥 NEW SUBTITLE REQUEST`);
  logger.info(`   Type: ${type}`);
  logger.info(`   ID: ${id}`);
  
  try {
    // Parse the ID to extract IMDB ID and episode info
    // Format: tt1234567 (movie) or tt1234567:1:1 (series S01E01)
    const [imdbId, seasonStr, episodeStr] = id.split(':');
    
    const season = seasonStr ? parseInt(seasonStr, 10) : undefined;
    const episode = episodeStr ? parseInt(episodeStr, 10) : undefined;
    
    logger.info(`   Parsed - IMDB: ${imdbId}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Get languages from config (later we'll make this configurable)
    const lang1 = config.defaultLanguages.primary;   // Spanish
    const lang2 = config.defaultLanguages.secondary; // French
    
    logger.info(`Fetching subtitles: ${lang1} + ${lang2}`);

    // Step 1: Fetch both subtitles (uses cache if available)
    const [subtitle1, subtitle2] = await fetchDualSubtitles(
      imdbId,
      type as 'movie' | 'episode',
      lang1,
      lang2,
      season,
      episode
    );

    // Step 2: Check if we got both subtitles
    if (!subtitle1 || !subtitle2) {
      logger.warn(`Missing subtitles - ${lang1}: ${!!subtitle1}, ${lang2}: ${!!subtitle2}`);
      
      // Return empty array if we don't have both
      // Could be enhanced to return single subtitle if only one available
      return { subtitles: [] };
    }

    logger.success('Both subtitles fetched successfully');

    // Step 3: Merge the subtitles
    const mergedContent = mergeSubtitles(subtitle1, subtitle2, {
      topLanguage: lang1,
      bottomLanguage: lang2,
      separator: '\n' // Single newline between languages
    });

    if (!mergedContent) {
      logger.error('Failed to merge subtitles');
      return { subtitles: [] };
    }

    // Step 4: Store merged subtitle and get serving ID
    const subtitleId = subtitleStorage.store(mergedContent, imdbId, lang1, lang2);
    
    // Step 5: Build subtitle URL for Stremio
    // The subtitle will be served from /subtitle/:id endpoint
    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${config.port}`;
    const subtitleUrl = `${baseUrl}/subtitle/${subtitleId}.srt`;

    logger.success(`Merged subtitle ready: ${subtitleUrl}`);

    // Step 6: Return subtitle to Stremio
    const subtitles: StremioSubtitle[] = [{
      id: `dual-${lang1}-${lang2}`,
      lang: `${lang1.toUpperCase()} + ${lang2.toUpperCase()}`,
      url: subtitleUrl
    }];

    logger.info(`Returning ${subtitles.length} subtitle(s)`);
    
    return { subtitles };

  } catch (error) {
    logger.error('Error in subtitles handler:', error);
    return { subtitles: [] };
  }
});

export default builder.getInterface();
