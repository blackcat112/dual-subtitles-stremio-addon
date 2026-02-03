import { addonBuilder } from 'stremio-addon-sdk';
import { manifest } from './config/manifest';
import { logger } from './utils/logger';
import { StremioSubtitle } from './types';

// Create addon builder with manifest
const builder = new addonBuilder(manifest);

/**
 * Subtitles handler
 * Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineSubtitlesHandler.md
 */
builder.defineSubtitlesHandler(async ({ type, id }) => {
  logger.info(`Subtitle request: type=${type}, id=${id}`);
  
  try {
    // Parse the ID to extract IMDB ID and episode info
    // Format: tt1234567 (movie) or tt1234567:1:1 (series S01E01)
    const [imdbId, season, episode] = id.split(':');
    
    logger.debug(`Parsed: imdbId=${imdbId}, season=${season}, episode=${episode}`);
    
    // TODO: Phase 2-4 implementation
    // 1. Fetch subtitles from OpenSubtitles in language 1 (e.g., Spanish)
    // 2. Fetch subtitles from OpenSubtitles in language 2 (e.g., French)
    // 3. Merge both SRT files
    // 4. Serve merged subtitle and return URL
    
    // For now, return empty array (stub)
    const subtitles: StremioSubtitle[] = [];
    
    /* Phase 2-4 implementation:
    const lang1 = 'es'; // Spanish
    const lang2 = 'fr'; // French
    
    const [srt1, srt2] = await Promise.all([
      fetchSubtitle({ imdbId, language: lang1, type: type as 'movie' | 'episode', season, episode }),
      fetchSubtitle({ imdbId, language: lang2, type: type as 'movie' | 'episode', season, episode })
    ]);
    
    if (srt1 && srt2) {
      const mergedSRT = mergeSubtitles(srt1, srt2, {
        topLanguage: lang1,
        bottomLanguage: lang2
      });
      
      // Store and serve merged subtitle
      const subtitleUrl = await storeSubtitle(mergedSRT, `${imdbId}-${lang1}-${lang2}`);
      
      subtitles.push({
        id: `dual-${lang1}-${lang2}`,
        lang: `${lang1.toUpperCase()} + ${lang2.toUpperCase()}`,
        url: subtitleUrl
      });
    }
    */
    
    logger.info(`Returning ${subtitles.length} subtitles`);
    
    return { subtitles };
  } catch (error) {
    logger.error('Error in subtitles handler:', error);
    return { subtitles: [] };
  }
});

export default builder.getInterface();
