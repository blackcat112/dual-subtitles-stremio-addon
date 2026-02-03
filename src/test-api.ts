import { openSubtitlesClient } from './services/opensubtitles';
import { fetchDualSubtitles } from './services/subtitleFetcher';
import { logger } from './utils/logger';
import { config } from './config';

/**
 * Test script for OpenSubtitles API integration
 * Run with: npm run test:api
 */
async function testOpenSubtitlesAPI() {
  logger.info('=== Testing OpenSubtitles API Integration ===\n');

  // Check API key is configured
  if (!config.opensubtitles.apiKey) {
    logger.error('❌ OPENSUBTITLES_API_KEY not configured in .env');
    logger.info('Please add your API key to .env file');
    return;
  }

  logger.success('✅ API Key configured\n');

  // Test 1: Search for a popular movie (The Matrix)
  logger.info('Test 1: Searching subtitles for The Matrix (tt0133093)');
  try {
    const results = await openSubtitlesClient.searchSubtitles({
      imdbId: 'tt0133093',
      language: 'en',
      type: 'movie'
    });

    logger.success(`✅ Found ${results.length} English subtitles`);
    if (results.length > 0) {
      const best = openSubtitlesClient.getBestSubtitle(results);
      logger.info(`   Best subtitle: ${best?.fileName} (${best?.downloads} downloads)`);
    }
  } catch (error) {
    logger.error('❌ Search failed:', error);
  }

  console.log('\n---\n');

  // Test 2: Download a subtitle
  logger.info('Test 2: Download subtitle for The Matrix');
  try {
    const results = await openSubtitlesClient.searchSubtitles({
      imdbId: 'tt0133093',
      language: 'es',
      type: 'movie'
    });

    if (results.length > 0) {
      const best = openSubtitlesClient.getBestSubtitle(results);
      if (best) {
        logger.info(`Downloading: ${best.fileName}`);
        const content = await openSubtitlesClient.downloadSubtitle(best.id);
        
        if (content) {
          logger.success(`✅ Downloaded ${content.length} bytes`);
          logger.info(`   First 200 chars: ${content.substring(0, 200)}...`);
        } else {
          logger.error('❌ Download returned empty content');
        }
      }
    } else {
      logger.warn('⚠️  No Spanish subtitles found');
    }
  } catch (error) {
    logger.error('❌ Download failed:', error);
  }

  console.log('\n---\n');

  // Test 3: Fetch dual subtitles (Spanish + French)
  logger.info('Test 3: Fetch dual subtitles (ES + FR) for The Matrix');
  try {
    const [spanish, french] = await fetchDualSubtitles(
      'tt0133093',
      'movie',
      'es',
      'fr'
    );

    if (spanish && french) {
      logger.success(`✅ Both subtitles downloaded`);
      logger.info(`   Spanish: ${spanish.length} bytes`);
      logger.info(`   French: ${french.length} bytes`);
    } else {
      logger.warn(`⚠️  Partial success - Spanish: ${!!spanish}, French: ${!!french}`);
    }
  } catch (error) {
    logger.error('❌ Dual fetch failed:', error);
  }

  console.log('\n---\n');

  // Test 4: Series episode (Breaking Bad S01E01)
  logger.info('Test 4: Search for Breaking Bad S01E01 (tt0959621)');
  try {
    const results = await openSubtitlesClient.searchSubtitles({
      imdbId: 'tt0959621',
      language: 'en',
      type: 'episode',
      season: 1,
      episode: 1
    });

    logger.success(`✅ Found ${results.length} English subtitles for S01E01`);
    if (results.length > 0) {
      const best = openSubtitlesClient.getBestSubtitle(results);
      logger.info(`   Best subtitle: ${best?.fileName}`);
    }
  } catch (error) {
    logger.error('❌ Series search failed:', error);
  }

  console.log('\n=== Tests Complete ===\n');
}

// Run tests
testOpenSubtitlesAPI().catch(error => {
  logger.error('Test script failed:', error);
  process.exit(1);
});
