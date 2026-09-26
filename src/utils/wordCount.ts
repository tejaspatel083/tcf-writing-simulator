/**
 * Counts words in French text sensibly according to TCF writing exam standards.
 * Ignores multiple spaces, leading/trailing whitespace, and standalone punctuation.
 */
export function countFrenchWords(text: string): number {
  if (!text) return 0;
  
  // Clean string: replace special quotes and standard punctuation with spaces except apostrophes and hyphens inside words
  const clean = text
    .trim()
    .replace(/[.,!?:;"«»()[\]{}—–/]/g, ' ')
    .replace(/\s+/g, ' ');

  if (!clean) return 0;

  // Split into tokens by whitespace
  const tokens = clean.split(' ').filter(token => {
    // Keep tokens that contain at least one letter or digit
    return /[\p{L}\p{N}]/u.test(token);
  });

  return tokens.length;
}

/**
 * Formats seconds into MM:SS format
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
