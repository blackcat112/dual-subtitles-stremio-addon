import { openSubtitlesClient } from './opensubtitles';
import { SubtitleSearchParams } from '../types';
import { logger } from '../utils/logger';
import { subtitleCache } from '../utils/cache';

/**
 * High-level service to fetch subtitles
 * Handles search and download in one operation
 * Uses cache to reduce API calls
 */
export async function fetchSubtitle(params: SubtitleSearchParams): Promise<string | null> {
  const { imdbId, language, season, episode } = params;

  // Check cache first
  const cached = subtitleCache.get(imdbId, language, season, episode);
  if (cached) {
    logger.info(`✨ Cache hit for ${imdbId} (${language})`);
    return cached;
  }

  try {
    // Step 1: Search for subtitles
    const searchResults = await openSubtitlesClient.searchSubtitles(params);
    
    if (searchResults.length === 0) {
      logger.warn(`No subtitles found for ${params.imdbId} in ${params.language}`);
      return null;
    }

    // Step 2: Get the best subtitle (highest downloads/rating)
    const bestSubtitle = openSubtitlesClient.getBestSubtitle(searchResults);
    
    if (!bestSubtitle) {
      logger.warn('No suitable subtitle found');
      return null;
    }

    logger.info(`Selected subtitle: ${bestSubtitle.fileName} (${bestSubtitle.downloads} downloads)`);

    // Step 3: Download the subtitle content
    const content = await openSubtitlesClient.downloadSubtitle(bestSubtitle.id);
    
    if (!content) {
      logger.error('Failed to download subtitle content');
      return null;
    }

    // Store in cache for future requests
    subtitleCache.set(imdbId, language, content, season, episode);
    logger.debug(`Cached subtitle for ${imdbId} (${language})`);

    return content;

  } catch (error) {
    logger.error('Error fetching subtitle:', error);
    return null;
  }
}

/**
 * Calculate Jaccard similarity coefficient between two strings (filenames)
 * Used to find matching subtitles (e.g. same release group)
 */
/**
 * Calculate similarity with Release Type Awareness
 * Prioritizes matching "release groups" and "source types" (WEB-DL, HDTV, BluRay)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  // 1. Critical Tags Verification (Source & Resolution)
  // If one is HDTV and other is WEB-DL, they often have different cuts/lengths.
  const criticalTags = ['hdtv', 'web dl', 'webrip', 'bluray', 'bdrip', 'dvdrip', '1080p', '720p', '2160p', '4k'];
  let criticalMatchCount = 0;
  let criticalMismatch = false;

  for (const tag of criticalTags) {
    const has1 = s1.includes(normalize(tag));
    const has2 = s2.includes(normalize(tag));
    
    if (has1 && has2) criticalMatchCount++;
    if (has1 !== has2) {
       // If distinct mismatch on source type (e.g. HDTV vs BluRay), penalize heavily
       if ((tag === 'hdtv' && s2.includes('bluray')) || (tag === 'bluray' && s2.includes('hdtv'))) {
         criticalMismatch = true;
       }
    }
  }

  // 2. Token Matching (Jaccard)
  const tokenize = (s: string) => {
    return new Set(s.split(' ').filter(w => w.length > 2)); // Ignore short words
  };
  const set1 = tokenize(s1);
  const set2 = tokenize(s2);
  
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  let jaccard = intersection.size / union.size;

  // 3. Score Boosting/Penalizing
  if (criticalMismatch) {
    jaccard *= 0.5; // Heavy penalty for source mismatch
  } else if (criticalMatchCount > 0) {
    jaccard += (criticalMatchCount * 0.1); // Boost for matching tags
  }

  return Math.min(jaccard, 1.0); // Cap at 1.0
}

/**
 * Fetch subtitles for two languages with Smart Synchronization
 */
export async function fetchDualSubtitles(
  imdbId: string,
  type: 'movie' | 'episode' | 'serie',
  lang1: string,
  lang2: string,
  season?: number,
  episode?: number,
  moviehash?: string
): Promise<[string | null, string | null]> {
  logger.info(`Fetching dual subtitles: ${lang1} + ${lang2} for ${imdbId} (Smart Sync)`);
  if (moviehash) logger.info(`  #️⃣  Using VideoHash: ${moviehash}`);

  const params1_base = { imdbId, language: lang1, type: type as any, season, episode, moviehash };
  const params2_base = { imdbId, language: lang2, type: type as any, season, episode, moviehash };

  const [results1, results2] = await Promise.all([
    openSubtitlesClient.searchSubtitles(params1_base),
    openSubtitlesClient.searchSubtitles(params2_base)
  ]);

  if (results1.length === 0 || results2.length === 0) {
    logger.warn(`Missing subtitles for one language (L1: ${results1.length}, L2: ${results2.length})`);
    return [null, null];
  }

  // Take top 10 candidates to increase chance of finding matching release
  const candidates1 = results1.slice(0, 10);
  const candidates2 = results2.slice(0, 10);

  let bestPair = {
    sub1: candidates1[0],
    sub2: candidates2[0],
    score: -1
  };

  for (const sub1 of candidates1) {
    for (const sub2 of candidates2) {
      const score = calculateSimilarity(sub1.fileName, sub2.fileName);
      if (score > bestPair.score) {
        bestPair = { sub1, sub2, score };
      }
    }
  }

  logger.info(`Smart Matching: Key tags found? Score: ${bestPair.score.toFixed(2)}`);
  logger.info(`  L1: ${bestPair.sub1.fileName}`);
  logger.info(`  L2: ${bestPair.sub2.fileName}`);

  // 3. Check Cache & Download
  // We need to handle caching manually here since we bypassed fetchSubtitle
  const getContent = async (sub: any, lang: string) => {
    const cached = subtitleCache.get(imdbId, lang, season, episode);
    // Rough cache check: IF the cached content matches what we WOULD have downloaded... 
    // But we don't know file ID of cache.
    // Simpler: Just rely on downloadSubtitle (it doesn't cache itself).
    
    // Actually, we should use the cache key logic.
    // But since we are picking specific files now, the generic cache (by IMDB ID) might be outdated if we picked a DIFFERENT release.
    // For now, let's just download fresh to ensure sync, or update cache.
    
    // To be safe and effective: Download by ID.
    const content = await openSubtitlesClient.downloadSubtitle(sub.id);
    if (content) {
      subtitleCache.set(imdbId, lang, content, season, episode);
    }
    return content;
  };

  const [content1, content2] = await Promise.all([
    getContent(bestPair.sub1, lang1),
    getContent(bestPair.sub2, lang2)
  ]);

  return [content1, content2];
}
