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
