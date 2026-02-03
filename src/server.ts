import { serveHTTP } from 'stremio-addon-sdk';
import addonInterface from './addon';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';

// Validate configuration
validateConfig();

// Start the addon server
serveHTTP(addonInterface, { port: config.port });

logger.success(`🚀 Dual Subtitles addon started!`);
logger.info(`📡 Server running on http://localhost:${config.port}`);
logger.info(`📋 Manifest available at http://localhost:${config.port}/manifest.json`);
logger.info(`💡 To install in Stremio, use: http://localhost:${config.port}/manifest.json`);

// Log configuration status
if (config.opensubtitles.apiKey) {
  logger.success('✅ OpenSubtitles API key configured');
} else {
  logger.warn('⚠️  OpenSubtitles API key NOT configured');
  logger.warn('   Set OPENSUBTITLES_API_KEY in .env file');
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});
