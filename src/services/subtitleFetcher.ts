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
function calculateSimilarity(str1: string, str2: string): number {
  const tokenize = (s: string) => {
    return new Set(
      s.toLowerCase()
       .replace(/[^a-z0-9]+/g, ' ')
       .split(' ')
       .filter(w => w.length > 2) // Ignore short words
    );
  };

  const set1 = tokenize(str1);
  const set2 = tokenize(str2);
  
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Fetch subtitles for two languages with Smart Synchronization
 * Returns [language1_content, language2_content]
 */
export async function fetchDualSubtitles(
  imdbId: string,
  type: 'movie' | 'episode' | 'serie', // 'serie' is what Stremio sends sometimes
  lang1: string,
  lang2: string,
  season?: number,
  episode?: number
): Promise<[string | null, string | null]> {
  logger.info(`Fetching dual subtitles: ${lang1} + ${lang2} for ${imdbId} (Smart Sync)`);

  // 1. Fetch Candidates (Top 5 for each language)
  // We can't use the simple fetchSubtitle() because we need lists to compare
  const params1_base = { imdbId, language: lang1, type: type as any, season, episode };
  const params2_base = { imdbId, language: lang2, type: type as any, season, episode };

  const [results1, results2] = await Promise.all([
    openSubtitlesClient.searchSubtitles(params1_base),
    openSubtitlesClient.searchSubtitles(params2_base)
  ]);

  if (results1.length === 0 || results2.length === 0) {
    logger.warn(`Missing subtitles for one language (L1: ${results1.length}, L2: ${results2.length})`);
    return [null, null];
  }

  // Take top candidates
  const candidates1 = results1.slice(0, 5);
  const candidates2 = results2.slice(0, 5);

  // 2. Find Best Pair
  let bestPair = {
    sub1: candidates1[0], // Default to top ones
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

  logger.info(`Smart Matching: Selected pair with score ${bestPair.score.toFixed(2)}`);
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

import { parseSRT, serializeSRT } from '../utils/srtParser';
import { translator } from './translator';

/**
 * Fetch a single Source Subtitle and Auto-Translate it to Target Language
 * Guarantees perfect synchronization as timestamps are identical.
 */
export async function fetchAndTranslateSubtitle(
  imdbId: string,
  type: 'movie' | 'episode' | 'serie',
  sourceLang: string,
  targetLang: string,
  season?: number,
  episode?: number
): Promise<[string | null, string | null]> {
  logger.info(`Fetching & Translating: ${sourceLang} -> ${targetLang} for ${imdbId} (Perfect Sync)`);

  // 0. Check Cache for ALREADY translated version
  // We use a special cache key suffix or prefix to differentiate "source file" from "generated translation"
  // Since our cache stores by (imdbId, lang), we can use a fake language code like "fr_auto" or just "fr" 
  // BUT "fr" might be a real file. 
  // Better: Use a completely separate key structure? 
  // subtitleCache uses: key = `${imdbId}:${language}:${season}:${episode}`;
  // So we can use language = `${targetLang}_from_${sourceLang}`
  
  const cacheLangKey = `${targetLang}_from_${sourceLang}`;
  const allowCache = true; // Feature flag just in case

  if (allowCache) {
    const cachedTranslated = subtitleCache.get(imdbId, cacheLangKey, season, episode);
    if (cachedTranslated) {
      logger.info(`✨ Cache hit for Translated Subtitle (${cacheLangKey})`);
      // We also need the sourceSrt to return the pair
      // Ideally we should cache the PAIR or just fetch source again (it's fast/cached)
      const sourceSrtCached = await fetchSubtitle({ imdbId, language: sourceLang, type, season, episode });
      if (sourceSrtCached) {
         return [sourceSrtCached, cachedTranslated];
      }
    }
  }

  // 1. Fetch Source Subtitle (Best Candidate)
  // We use the simpler fetchSubtitle logic which gets the single best file
  const sourceSrt = await fetchSubtitle({
    imdbId,
    language: sourceLang,
    type,
    season,
    episode
  });

  if (!sourceSrt) {
    logger.warn(`Source subtitle (${sourceLang}) not found for translation`);
    return [null, null];
  }

  try {
    // 2. Parse Source
    const entries = parseSRT(sourceSrt);
    if (entries.length === 0) return [sourceSrt, null];

    // 3. Extract Texts
    // Clean tags before translating to avoid confusing the translator
    // (though google translate often handles simple tags, it's safer to strip for pure text)
    // Actually, we should strip tags in the merging phase, but for translation, 
    // sending raw tags might result in broken tags. 
    // Let's strip tags for translation input.
    const cleanForTranslation = (t: string) => t.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').trim();
    
    const textsToTranslate = entries.map(e => cleanForTranslation(e.text));

    // 4. Translate Batch
    const translatedTexts = await translator.translateBatch(textsToTranslate, sourceLang, targetLang);

    // 5. Reconstruct Target SRT
    // We map the translated text back to the original timestamps
    const translatedEntries = entries.map((entry, index) => ({
      ...entry,
      text: translatedTexts[index] || '' // Fallback to empty if translation missing
    }));

    const translatedSrt = serializeSRT(translatedEntries);

    // 6. Cache the Result!
    if (translatedSrt && allowCache) {
       subtitleCache.set(imdbId, cacheLangKey, translatedSrt, season, episode);
       logger.info(`💾 Cached translated subtitle: ${cacheLangKey}`);
    }

    logger.success(`✅ Generated translated subtitle (${targetLang}) from source (${sourceLang})`);

    return [sourceSrt, translatedSrt];

  } catch (error) {
    logger.error('Error during auto-translation workflow', error);
    // Fallback: Return only source if translation fails? 
    // Or return null to trigger 404? 
    // Providing source is better than nothing.
    return [sourceSrt, null];
  }
}
