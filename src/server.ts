import express from 'express';
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
  
  // Set headers for SRT file
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${id}"`);
  res.send(content);
  
  logger.success(`Served subtitle: ${id} (${content.length} bytes)`);
});

// Mount Stremio addon routes
app.use(addonInterface.getRouter());

// Start server
app.listen(config.port, () => {
  logger.success(`🚀 Dual Subtitles addon started!`);
  logger.info(`📡 Server running on http://localhost:${config.port}`);
  logger.info(`📋 Manifest available at http://localhost:${config.port}/manifest.json`);
  logger.info(`🎬 Subtitles endpoint at http://localhost:${config.port}/subtitle/:id`);
  logger.info(`💡 To install in Stremio, use: http://localhost:${config.port}/manifest.json`);

  // Log configuration status  
  if (config.opensubtitles.apiKey) {
    logger.success('✅ OpenSubtitles API key configured');
  } else {
    logger.warn('⚠️  OpenSubtitles API key NOT configured');
    logger.warn('   Set OPENSUBTITLES_API_KEY in .env file');
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
