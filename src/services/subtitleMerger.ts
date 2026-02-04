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
  // Utility to clean text but preserve full width (User preference)
  const cleanText = (text: string, isSecondary: boolean): string => {
    if (!text) return '';
    let clean = text
      .replace(/<[^>]*>/g, '') 
      .replace(/\{[^}]*\}/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    
    // Flatten to single line for better flow? 
    // User said "me da igual que se vea ancho".
    // Let's replace internal newlines with spaces to avoid weird multi-stacking
    // clean = clean.replace(/\n/g, ' '); 
    // Actually standard SRTs usually have max 2 lines. Let's keep original line breaks if they exist, 
    // but maybe ensure max 2 lines? 
    // Let's just strip excessive whitespace.
    
    clean = clean.replace(/\n+/g, '\n').trim();

    if (isSecondary) {
       return `<i>${clean}</i>`;
    }
    return clean;
  };

  const processedEntries: SubtitleEntry[] = [];
  const usedIndices2 = new Set<number>(); // Track indices used in merging

  // 1. Process Master Entries (entries1)
  for (const entry1 of entries1) {
    const start1 = entry1.startTime;
    const end1 = entry1.endTime;
    const text1 = cleanText(entry1.text, false);

    if (!text1) continue;

    // Find overlapping entries in entries2 that haven't been fully consumed yet
    // Strict Consumption Rule: 
    // If we use an entry here, we mark it used.
    // However, if a slave entry overlaps TWO masters slightly, we might want to prioritize the best overlap?
    // Using simple "First Match wins" avoids repetition.
    
    const overlapping = adjustedEntries2.filter((entry2, index) => {
      // Logic: Overlap exists AND not already used
      if (usedIndices2.has(index)) return false;

      const isOverlapping = (entry1.startTime < entry2.endTime - 50) && (entry1.endTime > entry2.startTime + 50);
      return isOverlapping;
    });

    let text2 = '';
    if (overlapping.length > 0) {
      // Use the overlapping entries
      text2 = overlapping.map(e => cleanText(e.text, true)).join(' ');
      
      // Mark them as used so they don't appear in the NEXT master entry
      // This fixes: "sale una frase y luego sale otra vez"
      overlapping.forEach(e => {
        // Find the original index to mark as used
        const originalIdx = adjustedEntries2.indexOf(e);
        if (originalIdx !== -1) usedIndices2.add(originalIdx);
      });
    }

    let combinedText = text1;
    if (text2) {
      // User specific request: "vuelve a poner dos saltos de linea"
      combinedText += '\n\n' + text2;
    }

    processedEntries.push({
      index: 0,
      startTime: start1,
      endTime: end1,
      text: combinedText
    });
  }

  // 2. Add Orphan Entries from entries2
  // Only add if NOT used in master merge
  adjustedEntries2.forEach((entry2, index) => {
    if (!usedIndices2.has(index)) {
      const pText2 = cleanText(entry2.text, true);
      if (pText2) {
        processedEntries.push({
          index: 0,
          startTime: entry2.startTime,
          endTime: entry2.endTime,
          text: pText2
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
