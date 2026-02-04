import { addonBuilder } from 'stremio-addon-sdk';
import { manifest } from './config/manifest';
import { logger } from './utils/logger';

// Create addon builder with manifest
const builder = new addonBuilder(manifest);

/**
 * Subtitles handler
 * Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineSubtitlesHandler.md
 */
builder.defineSubtitlesHandler(async (args: any) => {
  const { type, id, extra } = args;
  // Stremio ID format: "tt1234567" (movie) or "tt1234567:1:1" (series)
  const [imdbId, seasonStr, episodeStr] = id.split(':');
  const season = seasonStr ? parseInt(seasonStr, 10) : 0;
  const episode = episodeStr ? parseInt(episodeStr, 10) : 0;
  
  // Extract videoHash if available (Perfect Sync)
  // extra is typed as any in some SDK versions, but usually contains { videoHash: string }
  const videoHash = (extra as any)?.videoHash || 'nohash';

  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`🚀 Dual Subtitles Addon (On-Demand Mode)`);
  logger.info(`📥 MENU REQUEST: ${imdbId} S${season}E${episode}`);
  if (videoHash !== 'nohash') logger.info(`   #️⃣  VideoHash detected: ${videoHash}`);

  // Determine host URL
  // In production (Render), use the env var. Locally, default to port.
  // Note: Stremio needs HTTPS for remote addons, but local can be HTTP.
  const host = process.env.RENDER_EXTERNAL_URL || 'https://dual-subtitles-stremio-addon.onrender.com';

  const makeSubtitle = (lang1: string, lang2: string, label: string, flags: string) => ({
    id: `dual-${imdbId}-${lang1}-${lang2}`,
    url: `${host}/subtitle/${imdbId}/${season}/${episode}/${lang1}/${lang2}/${videoHash}`,
    lang: `Dual ${flags} ${label}`
  });

  // Static Offer List (Blind Offer)
  // We return these options instantly. No API calls made yet.
  // The user sees these in the list.
  const subtitles = [
    makeSubtitle('es', 'fr', 'Español + Français', '🇪🇸 🇫🇷'),
    makeSubtitle('es', 'en', 'Español + English',  '🇪🇸 🇬🇧'),
    makeSubtitle('fr', 'en', 'Français + English', '🇫🇷 🇬🇧'),
  ];

  logger.info(`Returning ${subtitles.length} on-demand options`);
  
  return { subtitles };
});

export default builder.getInterface();
