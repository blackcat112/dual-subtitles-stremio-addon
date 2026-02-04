import { SubtitleEntry, MergedSubtitleOptions } from '../types';
import { parseSRT, serializeSRT } from '../utils/srtParser';
import { logger } from '../utils/logger';

/**
 * Merge two SRT subtitle files into one dual-language subtitle
 * Simplified algorithm for maximum player compatibility
 */
export function mergeSubtitles(
  srt1Content: string,
  srt2Content: string,
  options: MergedSubtitleOptions
): string {
  logger.info(`Merging subtitles: ${options.topLanguage} + ${options.bottomLanguage}`);
  
  // Parse both SRT files
  const entries1 = parseSRT(srt1Content);
  const entries2 = parseSRT(srt2Content);
  
  if (entries1.length === 0 || entries2.length === 0) {
    logger.warn('One or both subtitle files are empty');
    return '';
  }
  
  // Apply offset if specified
  const offset = options.offset || 0;
  const adjustedEntries2 = offset !== 0 
    ? entries2.map(entry => ({
        ...entry,
        startTime: entry.startTime + offset,
        endTime: entry.endTime + offset
      }))
    : entries2;
  
  // Union Merge Strategy:
  // 1. Collect all start/end timestamps from both languages
  // 2. Sort unique times
  // 3. Create segments for each interval
  const allTimes = new Set<number>();
  entries1.forEach(e => { allTimes.add(e.startTime); allTimes.add(e.endTime); });
  adjustedEntries2.forEach(e => { allTimes.add(e.startTime); allTimes.add(e.endTime); });
  
  const uniqueTimes = Array.from(allTimes).sort((a, b) => a - b);
  const mergedEntries: SubtitleEntry[] = [];
  const minDuration = 500; // Minimum 500ms to be readable
  
  const cleanText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')       // Remove HTML tags like <font>
      .replace(/\{[^}]*\}/g, '')     // Remove ASS tags like {\c&H...}
      .trim();
  };

  for (let i = 0; i < uniqueTimes.length - 1; i++) {
    const startTime = uniqueTimes[i];
    const endTime = uniqueTimes[i+1];
    
    // Skip if segment is effectively zero duration
    if (endTime - startTime < 50) continue;
    
    // Find active subtitles in this interval
    const midPoint = startTime + (endTime - startTime) / 2;
    
    const sub1 = entries1.find(e => e.startTime <= midPoint && e.endTime >= midPoint);
    const sub2 = adjustedEntries2.find(e => e.startTime <= midPoint && e.endTime >= midPoint);
    
    if (!sub1 && !sub2) continue;
    
    // Process text:
    // 1. Clean tags
    // 2. Join multiple lines into one (to save vertical space)
    // 3. Trim
    const processText = (entry: SubtitleEntry) => {
      const cleaned = cleanText(entry.text);
      return cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const text1 = sub1 ? processText(sub1) : '';
    const text2 = sub2 ? processText(sub2) : '';
    
    // Only add if we have at least one text
    if (!text1 && !text2) continue;
    
    // Construct merged text
    // Format:
    // Text 1
    // Text 2
    let combinedText = text1;
    if (text2) {
      if (combinedText) combinedText += '\n';
      combinedText += text2;
    }
    
    // Optimization: Merge with previous entry if text is identical
    const prev = mergedEntries[mergedEntries.length - 1];
    
    // Check if we can merge with previous entry
    // Merge if text is identical AND the gap is small (< 500ms) or non-existent
    if (prev && prev.text === combinedText) {
      const gap = startTime - prev.endTime;
      if (gap <= 500) { // Bridge small gaps to prevent flickering
         prev.endTime = endTime;
         continue; // Done with this segment
      }
    }

    mergedEntries.push({
      index: mergedEntries.length + 1,
      startTime,
      endTime,
      text: combinedText
    });
  }
  
  logger.success(`Merged ${mergedEntries.length} subtitle entries (Union Strategy)`);
  
  // Serialize back to SRT format
  return serializeSRT(mergedEntries);
}
