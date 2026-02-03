import { SubtitleEntry } from '../types';

/**
 * Parse SRT subtitle file content into structured entries
 */
export function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  
  // Split by double newlines (subtitle blocks)
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    
    if (lines.length < 3) {
      continue; // Invalid block
    }
    
    // Line 1: Index
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) {
      continue;
    }
    
    // Line 2: Timestamps (00:00:00,000 --> 00:00:05,000)
    const timestampMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timestampMatch) {
      continue;
    }
    
    const [, startH, startM, startS, startMs, endH, endM, endS, endMs] = timestampMatch;
    
    const startTime = 
      parseInt(startH, 10) * 3600000 +
      parseInt(startM, 10) * 60000 +
      parseInt(startS, 10) * 1000 +
      parseInt(startMs, 10);
    
    const endTime =
      parseInt(endH, 10) * 3600000 +
      parseInt(endM, 10) * 60000 +
      parseInt(endS, 10) * 1000 +
      parseInt(endMs, 10);
    
    // Lines 3+: Text content
    const text = lines.slice(2).join('\n');
    
    entries.push({
      index,
      startTime,
      endTime,
      text
    });
  }
  
  return entries;
}

/**
 * Convert milliseconds to SRT timestamp format (00:00:00,000)
 */
function millisecondsToTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Serialize subtitle entries back to SRT format
 */
export function serializeSRT(entries: SubtitleEntry[]): string {
  return entries.map((entry, idx) => {
    const index = idx + 1;
    const startTimestamp = millisecondsToTimestamp(entry.startTime);
    const endTimestamp = millisecondsToTimestamp(entry.endTime);
    
    return `${index}\n${startTimestamp} --> ${endTimestamp}\n${entry.text}\n`;
  }).join('\n');
}
