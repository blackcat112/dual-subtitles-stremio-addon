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
  // Utility to clean text so we can split lines cleanly
  // Styling is applied LATER during the merge to avoid breaking tags
  const cleanRawText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') 
      .replace(/\{[^}]*\}/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  };
  
  // Target width for the left column to ensure alignment
  const COL_WIDTH = 60;

  const processedEntries: SubtitleEntry[] = [];
  const usedIndices2 = new Set<number>();

  // 1. Process Master Entries (entries1)
  for (const entry1 of entries1) {
    const start1 = entry1.startTime;
    const end1 = entry1.endTime;
    const rawText1 = cleanRawText(entry1.text);

    if (!rawText1) continue;

    const overlapping = adjustedEntries2.filter((entry2, index) => {
      // Strict Consumption
      if (usedIndices2.has(index)) return false;
      const isOverlapping = (entry1.startTime < entry2.endTime - 50) && (entry1.endTime > entry2.startTime + 50);
      return isOverlapping;
    });

    let rawText2 = '';
    if (overlapping.length > 0) {
      // Join overlapping texts (space separated for flow, then we split lines)
      // Actually standardizing on single block merging for best matching
      rawText2 = overlapping.map(e => cleanRawText(e.text)).join(' ');
      
      overlapping.forEach(e => {
        const originalIdx = adjustedEntries2.indexOf(e);
        if (originalIdx !== -1) usedIndices2.add(originalIdx);
      });
    }

    // --- Side-by-Side Merge Logic ---
    const lines1 = rawText1.split('\n');
    const lines2 = rawText2 ? rawText2.split('\n') : [];

    const maxLines = Math.max(lines1.length, lines2.length);
    const combinedLines: string[] = [];

    for (let i = 0; i < maxLines; i++) {
        const seg1 = lines1[i] || ''; // Primary (Left)
        // Secondary (Right) - Apply Italics here
        const rawSeg2 = lines2[i] || '';
        const seg2 = rawSeg2 ? `<i>${rawSeg2}</i>` : ''; 
        
        // Pad the left segment with spaces to try and align the separator
        // Note: With variable width fonts, perfect alignment is impossible,
        // but this "fixed char width" approach is the standard best effort.
        let paddedSeg1 = seg1;
        if (seg1.length < COL_WIDTH) {
            // Fill with spaces
            paddedSeg1 = seg1.padEnd(COL_WIDTH, ' ');
        }
        
        if (seg1 && seg2) {
            // Both exist: Join with separator
            // Use padded left side
            combinedLines.push(`${paddedSeg1}   |   ${seg2}`);
        } else if (seg1) {
            // Only Left
            combinedLines.push(`${seg1}`);
        } else if (seg2) {
            // Only Right
            // If we have a right line but no left line, we should probably still indent
            // so it appears in the right column
            const emptyLeft = ''.padEnd(COL_WIDTH, ' ');
            combinedLines.push(`${emptyLeft}   |   ${seg2}`); 
        }
    }

    processedEntries.push({
      index: 0,
      startTime: start1,
      endTime: end1,
      text: combinedLines.join('\n')
    });
  }

  // 2. Add Orphan Entries from entries2
  adjustedEntries2.forEach((entry2, index) => {
    if (!usedIndices2.has(index)) {
      const rawText2 = cleanRawText(entry2.text);
      if (rawText2) {
        // Orphans: Just show them centered/normal or side?
        // Let's put them on the right side logic to be consistent
        const lines = rawText2.split('\n');
        const emptyLeft = ''.padEnd(COL_WIDTH, ' ');
        // Use the padding to push content to the right
        const formatted = lines.map(line => `${emptyLeft}   |   <i>${line}</i>`).join('\n');
        
        processedEntries.push({
          index: 0,
          startTime: entry2.startTime,
          endTime: entry2.endTime,
          text: formatted
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
