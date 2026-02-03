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
  
  logger.debug(`Parsed ${entries1.length} entries from language 1`);
  logger.debug(`Parsed ${entries2.length} entries from language 2`);
  
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
  
  // Use simpler merge strategy: iterate through language 1 and find overlapping language 2
  const mergedEntries: SubtitleEntry[] = [];
  const minDuration = 200; // Minimum 200ms duration to avoid ultra-short segments
  
  for (const sub1 of entries1) {
    // Find overlapping subtitle in language 2
    const sub2 = adjustedEntries2.find(s2 => 
      // Check if there's any time overlap
      (s2.startTime <= sub1.endTime && s2.endTime >= sub1.startTime)
    );
    
    // Skip if duration is too short
    if (sub1.endTime - sub1.startTime < minDuration) {
      continue;
    }
    
    // Clean and limit text to first line only (for simplicity)
    const text1 = sub1.text.split('\n')[0].trim();
    const text2 = sub2 ? sub2.text.split('\n')[0].trim() : '';
    
    // Skip if first language text is empty
    if (!text1) {
      continue;
    }
    
    // Create merged entry with both languages
    const combinedText = text2 
      ? `${text1}\n${text2}` // Two lines: language 1, then language 2
      : text1; // Only language 1 if no match
    
    mergedEntries.push({
      index: mergedEntries.length + 1,
      startTime: sub1.startTime,
      endTime: sub1.endTime,
      text: combinedText
    });
  }
  
  logger.success(`Merged ${mergedEntries.length} subtitle entries`);
  
  // Serialize back to SRT format
  return serializeSRT(mergedEntries);
}
