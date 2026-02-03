// Custom types for the Dual Subtitles addon

export interface SubtitleSearchParams {
  imdbId: string;
  language: string;
  type: 'movie' | 'episode';
  season?: number;
  episode?: number;
}

export interface SubtitleResult {
  id: string;
  language: string;
  downloadUrl: string;
  fileName: string;
  downloads?: number;
  rating?: number;
}

export interface SubtitleEntry {
  index: number;
  startTime: number; // milliseconds
  endTime: number;   // milliseconds
  text: string;
}

export interface MergedSubtitleOptions {
  topLanguage: string;
  bottomLanguage: string;
  separator?: string;
  offset?: number; // milliseconds offset for sync adjustment
}

export interface StremioSubtitle {
  id: string;
  lang: string;
  url: string;
}

export interface OpenSubtitlesConfig {
  apiKey: string;
  baseUrl: string;
  userAgent: string;
}
