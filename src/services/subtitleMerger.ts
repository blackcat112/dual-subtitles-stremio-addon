import { SubtitleEntry, MergedSubtitleOptions } from '../types';
import { parseSRT, serializeSRT } from '../utils/srtParser';
import { logger } from '../utils/logger';

/**
 * Merge two SRT subtitle files into one dual-language subtitle
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
  
  // Apply offset if specified
  const offset = options.offset || 0;
  const adjustedEntries2 = entries2.map(entry => ({
    ...entry,
    startTime: entry.startTime + offset,
    endTime: entry.endTime + offset
  }));
  
  // Merge entries by timestamp overlap
  const mergedEntries: SubtitleEntry[] = [];
  const separator = options.separator || '\n';
  
  // Create a union of all unique time ranges
  const allTimes = new Set<number>();
  entries1.forEach(e => {
    allTimes.add(e.startTime);
    allTimes.add(e.endTime);
  });
  adjustedEntries2.forEach(e => {
    allTimes.add(e.startTime);
    allTimes.add(e.endTime);
  });
  
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
  
  // For each time segment, find matching subtitles
  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const startTime = sortedTimes[i];
    const endTime = sortedTimes[i + 1];
    
    // Find overlapping subtitles
    const sub1 = entries1.find(e => e.startTime <= startTime && e.endTime >= endTime);
    const sub2 = adjustedEntries2.find(e => e.startTime <= startTime && e.endTime >= endTime);
    
    if (sub1 || sub2) {
      const text1 = sub1?.text || '';
      const text2 = sub2?.text || '';
      
      // Combine texts based on top/bottom preference
      const combinedText = text1 && text2
        ? `${text1}${separator}${text2}`
        : text1 || text2;
      
      mergedEntries.push({
        index: mergedEntries.length + 1,
        startTime,
        endTime,
        text: combinedText
      });
    }
  }
  
  logger.success(`Merged ${mergedEntries.length} subtitle entries`);
  
  // Serialize back to SRT format
  return serializeSRT(mergedEntries);
}
