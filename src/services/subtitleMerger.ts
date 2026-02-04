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

  // Utility to split long text into multiple lines (max chars)
  // Replaces the basic flattening logic
  const processText = (text: string, isSecondary: boolean): string => {
    if (!text) return '';
    
    // 1. Clean basic tags
    let clean = text
      .replace(/<[^>]*>/g, '') 
      .replace(/\{[^}]*\}/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
      
    // 2. Wrap text (Limit ~40 chars per line)
    const MAX_LINE_LENGTH = 45;
    const words = clean.split(/\s+/);
    let lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + 1 + words[i].length <= MAX_LINE_LENGTH) {
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    if (currentLine) lines.push(currentLine);
    
    // 3. Re-assemble
    let final = lines.join('\n');
    
    // 4. Apply Secondary Styling override (if needed)
    if (isSecondary) {
       // Wrap entire block in italics? Or line by line?
       // SRT handles multiline italics fine if tags strictly enclose.
       // Safest: <i>Line1\nLine2</i>
       return `<i>${final}</i>`;
    }
    
    return final;
  };

  const processedEntries: SubtitleEntry[] = [];
  const usedIndices2 = new Set<number>();

  // 1. Process Master Entries (entries1)
  for (const entry1 of entries1) {
    const start1 = entry1.startTime;
    const end1 = entry1.endTime;
    // Process Master lines (no italics)
    const text1 = processText(entry1.text, false);

    if (!text1) continue;

    // Find overlapping entries in entries2
    const overlapping = adjustedEntries2.filter((entry2, index) => {
      const isOverlapping = (entry1.startTime < entry2.endTime - 50) && (entry1.endTime > entry2.startTime + 50);
      if (isOverlapping) usedIndices2.add(index);
      return isOverlapping;
    });

    let text2 = '';
    if (overlapping.length > 0) {
      // Join overlapping raw texts first with space, then process
      // This merges fragmented segments into one readable block
      const rawText2 = overlapping.map(e => e.text).join(' ');
      text2 = processText(rawText2, true);
    }

    let combinedText = text1;
    if (text2) {
      // Double newline for extra vertical spacing between languages
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
  adjustedEntries2.forEach((entry2, index) => {
    if (!usedIndices2.has(index)) {
      const pText2 = processText(entry2.text, true);
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
