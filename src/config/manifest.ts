// Stremio addon manifest
// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md

export const manifest = {
  id: 'org.dualsubtitles.stremio',
  version: '1.0.0',
  
  name: 'Dual Subtitles',
  description: 'Learn languages with dual subtitles - display two subtitle languages simultaneously (ES + FR/EN)',
  
  // This addon provides subtitles
  resources: ['subtitles'],
  
  // Support both movies and series
  types: ['movie', 'series'],
  
  // Only works with IMDB IDs
  idPrefixes: ['tt'],
  
  // No catalogs needed for subtitle addons
  catalogs: [],
  
  // Metadata
  logo: 'https://via.placeholder.com/200x200.png?text=Dual+Subtitles',
  background: 'https://via.placeholder.com/1920x1080.png?text=Dual+Subtitles+Background',
  
  // Contact info
  contactEmail: 'your-email@example.com',
  
  // Behavior flags
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};
