import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // OpenSubtitles API
  opensubtitles: {
    apiKey: process.env.OPENSUBTITLES_API_KEY || '',
    baseUrl: 'https://api.opensubtitles.com/api/v1',
    userAgent: 'DualSubtitlesStremioAddon v1.0'
  },
  
  // Server
  port: parseInt(process.env.PORT || '7000', 10),
  
  // Cache
  cacheTTL: parseInt(process.env.CACHE_TTL || '86400', 10), // 24 hours default
  
  // Default language pairs
  defaultLanguages: {
    primary: 'es',   // Spanish
    secondary: 'fr'  // French
  }
};

// Validate required configuration
export function validateConfig(): void {
  if (!config.opensubtitles.apiKey) {
    console.warn('⚠️  WARNING: OPENSUBTITLES_API_KEY is not set. The addon will not function properly.');
    console.warn('   Please set it in your .env file or environment variables.');
  }
}
