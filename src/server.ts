import express from 'express';
import { getRouter } from 'stremio-addon-sdk';
import addonInterface from './addon';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { subtitleStorage } from './utils/storage';

// Validate configuration
validateConfig();

// Create Express app
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Clear cache endpoint (for debugging/testing)
app.get('/clear-cache', (req, res) => {
  subtitleStorage.clear();
  logger.info('Cache cleared manually');
  res.json({ status: 'cache cleared', timestamp: new Date().toISOString() });
});

// Serve static files from public dir
app.use(express.static('public'));

// Serve configuration page explicitly at /configure
app.get('/configure', (req, res) => {
  res.sendFile('configure.html', { root: './public' });
});

// Dynamic Subtitle Merge Endpoint
// Updated to accept optional videoHash for perfect sync
app.get('/subtitle/:imdbId/:season/:episode/:lang1/:lang2/:videoHash?', async (req, res) => {
  const { imdbId, season, episode, lang1, lang2, videoHash } = req.params;
  
  const hashLog = videoHash && videoHash !== 'nohash' ? ` (#${videoHash.substring(0,8)})` : '';
  logger.info(`🚨 ON-DEMAND REQUEST: ${imdbId} S${season}E${episode} [${lang1}+${lang2}]${hashLog}`);

  try {
    const s = parseInt(season);
    const e = parseInt(episode);
    
    // Determine type (if it has S/E it's likely a series, but we can infer)
    const type = (season && episode && season !== '0') ? 'episode' : 'movie'; 

    // Fetch and Merge on the fly
    const { fetchDualSubtitles } = require('./services/subtitleFetcher');
    const { mergeSubtitles } = require('./services/subtitleMerger');

    const [srt1, srt2] = await fetchDualSubtitles(
      imdbId,
      type,
      lang1,
      lang2,
      s,
      e,
      (videoHash !== 'nohash') ? videoHash : undefined
    );

    if (!srt1 && !srt2) {
      logger.warn('No subtitles found for on-demand request');
      res.status(404).send('Not found');
      return;
    }

    // If one is missing, we might want to just serve the one we have?
    // Or strictly dual? Let's try to merge what we have.
    // If we have 0, we 404.
    
    // We need to know which is "Top" language.
    // We assume lang1 is Top (Master) as per URL structure.
    
    const validSrt1 = srt1 || '';
    const validSrt2 = srt2 || '';

    const mergedSrt = mergeSubtitles(validSrt1, validSrt2, {
      topLanguage: lang1,
      bottomLanguage: lang2
    });

    // Send response
    res.setHeader('Content-Type', 'application/x-subrip');
    res.setHeader('Content-Disposition', `inline; filename="${imdbId}-${lang1}-${lang2}.srt"`);
    res.send(mergedSrt);
    logger.success(`✅ Served merged subtitle for ${imdbId} (${lang1}+${lang2})`);

  } catch (error) {
    logger.error('Error in on-demand subtitle generation', error);
    res.status(500).send('Internal Server Error');
  }
});

// Serve subtitle files from storage
app.get('/subtitle/:id', (req, res) => {
  const { id } = req.params;
  logger.info(`Subtitle request: ${id}`);
  
  const content = subtitleStorage.get(id.replace('.srt', ''));
  
  if (!content) {
    logger.warn(`Subtitle not found: ${id}`);
    res.status(404).send('Subtitle not found');
    return;
  }
  
  // Set headers optimized for Stremio subtitle players
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Send as plain text with explicit UTF-8 (no BOM)
  res.status(200).send(content);
  
  logger.success(`Served subtitle: ${id} (${content.length} bytes)`);
});

// Mount Stremio addon routes using SDK's getRouter
app.use(getRouter(addonInterface));

// Start server
app.listen(config.port, () => {
  logger.success(`🚀 Dual Subtitles addon started!`);
  logger.info(`📡 Server running on http://localhost:${config.port}`);
  logger.info(`📋 Manifest available at http://localhost:${config.port}/manifest.json`);
  logger.info(`🎬 Subtitles endpoint at http://localhost:${config.port}/subtitle/:id`);
  logger.info(`💡 To install in Stremio, use: http://localhost:${config.port}/manifest.json`);
  logger.info('');

  // Log configuration status  
  if (config.opensubtitles.apiKey) {
    logger.success('✅ OpenSubtitles API key configured');
  } else {
    logger.warn('⚠️  OpenSubtitles API key NOT configured');
    logger.warn('   Set OPENSUBTITLES_API_KEY in .env file');
  }

  // Keep-Alive Logic for Render Free Tier
  // Render spins down inactive web services after 15 minutes.
  // We ping our own /health endpoint every 14 minutes to stay awake during usage.
  if (process.env.RENDER || process.env.KEEP_ALIVE) {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
    logger.info(`⏰ Keep-Alive system active: Pinging /health every 14 minutes`);
    
    setInterval(async () => {
      try {
        // Use standard http/https module or axios if available. We have axios.
        const axios = require('axios');
        await axios.get(`http://localhost:${config.port}/health`);
        // We generally don't log success to avoid cluttering logs, 
        // but for debugging phase it might be useful. Keeping it silent for production cleanliness.
        // logger.debug('Keep-Alive ping sent');
      } catch (err: any) {
        logger.error(`Keep-Alive ping failed: ${err.message}`);
      }
    }, PING_INTERVAL);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});
