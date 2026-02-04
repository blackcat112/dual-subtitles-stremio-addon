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

  // ASS Time Format: H:MM:SS.cc
  const toAssTime = (ms: number): string => {
    const date = new Date(ms);
    const h = Math.floor(ms / 3600000);
    const m = date.getUTCMinutes();
    const s = date.getUTCSeconds();
    const cs = Math.floor(date.getUTCMilliseconds() / 10); // centiseconds
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, '\\N') // ASS uses \N for newlines
      .trim();
  };

  const processedEntries: string[] = [];
  const usedIndices2 = new Set<number>();

  // ASS Header
  // Colors are &HABGR (Alpha, Blue, Green, Red)
  // Yellow (RGB FFFF00) -> BGR 00FFFF -> &H0000FFFF
  // White -> &H00FFFFFF
  const assHeader = `[Script Info]
Title: Dual Subtitles
ScriptType: v4.00+
Collisions: Normal
PlayResX: 384
PlayResY: 288
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,1,2,10,10,25,1
Style: Secondary,Arial,20,&H0000FFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,1,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  processedEntries.push(assHeader);

  // 1. Process Master Entries (entries1)
  for (const entry1 of entries1) {
    const start = toAssTime(entry1.startTime);
    const end = toAssTime(entry1.endTime);
    let text1 = cleanText(entry1.text);

    if (!text1) continue;

    // Find overlapping
    const overlapping = adjustedEntries2.filter((entry2, index) => {
      if (usedIndices2.has(index)) return false;
      return (entry1.startTime < entry2.endTime - 50) && (entry1.endTime > entry2.startTime + 50);
    });

    let text2 = '';
    if (overlapping.length > 0) {
      // Consume overlapping
      text2 = overlapping.map(e => cleanText(e.text)).join('\\N');
      overlapping.forEach(e => {
        const originalIdx = adjustedEntries2.indexOf(e);
        if (originalIdx !== -1) usedIndices2.add(originalIdx);
      });
    }

    // Output Master Line
    // We use \N for line breaks. 
    // Format: Combined text in one event? Or two events?
    // Two events is safer for independent styling but Stremio might overlap them weirdly.
    // Better: One event with styling tags manually if mixed?
    // Actually ASS supports multiple lines in one event. 
    // To apply different styles (Colors) in one event, we use overrides: {\c&H00FFFF&}
    
    // BUT we defined Styles!
    // We can't strictly use 2 styles in 1 event easily without overrides.
    // The cleanest way in ASS for Dual Subs is explicit Override Tags.
    
    // Yellow Code: {\c&H00FFFF&}
    // Italic Code: {\i1}
    
    let combinedText = text1;
    if (text2) {
      combinedText += `\\N\\N{\\c&H00FFFF&}{\\i1}${text2}{\\i0}{\\c&HFFFFFF&}`;
    }

    // Output as "Default" style event
    processedEntries.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${combinedText}`);
  }

  // 2. Add Orphans
  adjustedEntries2.forEach((entry2, index) => {
    if (!usedIndices2.has(index)) {
      const start = toAssTime(entry2.startTime);
      const end = toAssTime(entry2.endTime);
      const text2 = cleanText(entry2.text);
      
      // Orphan is purely secondary, so apply Secondary style directly?
      // Or use Default style + Yellow tags.
      // Let's use tags for consistency if merging.
      // Or actually, we can use the "Secondary" style we defined!
      // But wait, if we use Secondary style, it applies to the whole line. Perfect for orphans.
      
      if (text2) {
         processedEntries.push(`Dialogue: 0,${start},${end},Secondary,,0,0,0,,${text2}`);
      }
    }
  });

  logger.success(`Merged ${processedEntries.length - 1} events to ASS format`);
  return processedEntries.join('\n');
}
