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
  
  // Master-Slave Strategy:
  // Use entries1 (Top Language) as the "Master" for timing.
  // It provides the "professional" rhythm requested by the user.
  // entries2 (Bottom Language) are merged in if they overlap.
  // Any unique entries from entries2 that don't overlap are inserted as "orphans".

  const cleanText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') 
      .replace(/\{[^}]*\}/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const processedEntries: SubtitleEntry[] = [];
  const usedIndices2 = new Set<number>();

  // 1. Process Master Entries (entries1)
  for (const entry1 of entries1) {
    const start1 = entry1.startTime;
    const end1 = entry1.endTime;
    const text1 = cleanText(entry1.text);

    if (!text1) continue;

    // Find overlapping entries in entries2
    // Overlap condition: (StartA <= EndB) and (EndA >= StartB)
    const overlapping = adjustedEntries2.filter((entry2, index) => {
      const isOverlapping = (entry1.startTime < entry2.endTime - 50) && (entry1.endTime > entry2.startTime + 50);
      if (isOverlapping) usedIndices2.add(index);
      return isOverlapping;
    });

    // Style secondary text: Italic only (Safest for Stremio)
    // <font> tags are often rendered as raw text by Stremio's player
    const styleSecondary = (t: string) => `<i>${t}</i>`;

    let text2 = '';
    if (overlapping.length > 0) {
      // Join all overlapping texts and styling
      text2 = overlapping.map(e => cleanText(e.text)).join(' ');
      if (text2) text2 = styleSecondary(text2);
    }

    let combinedText = text1;
    if (text2) {
      combinedText += '\n' + text2;
    }

    processedEntries.push({
      index: 0, // Will reindex later
      startTime: start1,
      endTime: end1,
      text: combinedText
    });
  }

  // 2. Add Orphan Entries from entries2 (those that didn't match any Master entry)
  // This ensures we don't lose dialogue if the Master is silent
  adjustedEntries2.forEach((entry2, index) => {
    if (!usedIndices2.has(index)) {
      const text2 = cleanText(entry2.text);
      if (text2) {
        // Also style orphans from secondary language
        const styledText2 = `<i>${text2}</i>`;
        
        processedEntries.push({
          index: 0,
          startTime: entry2.startTime,
          endTime: entry2.endTime,
          text: styledText2
        });
      }
    }
  });

  // 3. Sort by start time and reindex
  processedEntries.sort((a, b) => a.startTime - b.startTime);
  
  const finalEntries = processedEntries.map((entry, idx) => ({
    ...entry,
    index: idx + 1
  }));
  
  logger.success(`Merged ${finalEntries.length} subtitle entries (Master-Slave Strategy)`);
  
  return serializeSRT(finalEntries);
}
