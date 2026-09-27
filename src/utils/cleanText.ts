/**
 * Fixes double-encoded UTF-8 strings (mojibake) such as 'Ã©' -> 'é', 'â€™' -> '’', etc.
 */
export function fixMojibake(text?: string | null): string {
  if (!text) return '';
  // Quick return if string has no mojibake indicators
  if (!/[ÃÂ]|â\x80|â€/.test(text)) {
    return text;
  }

  try {
    const fixed = decodeURIComponent(escape(text));
    if (fixed && !/[ÃÂ]|â\x80|â€/.test(fixed)) {
      return fixed;
    }
  } catch {
    // ignore
  }

  // Fallback explicit replacements for French mojibake characters
  return text
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã«/g, 'ë')
    .replace(/Ã\xa0/g, 'à')
    .replace(/Ã /g, 'à')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã®/g, 'î')
    .replace(/Ã¯/g, 'ï')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã¹/g, 'ù')
    .replace(/Ã»/g, 'û')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã\x80/g, 'À')
    .replace(/Ã€/g, 'À')
    .replace(/Ã\x89/g, 'É')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã\x88/g, 'È')
    .replace(/Ãˆ/g, 'È')
    .replace(/Ã\x8a/g, 'Ê')
    .replace(/ÃŠ/g, 'Ê')
    .replace(/Ã‡/g, 'Ç')
    .replace(/â\x80\x99/g, '’')
    .replace(/â\x80\x9c/g, '“')
    .replace(/â\x80\x9d/g, '”')
    .replace(/â\x80\x93/g, '–')
    .replace(/â\x80\x94/g, '—')
    .replace(/â\x80\xa6/g, '…')
    .replace(/â€™/g, '’')
    .replace(/â€˜/g, '‘')
    .replace(/â€œ/g, '“')
    .replace(/â€\x9d/g, '”')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¦/g, '…')
    .replace(/Â«/g, '«')
    .replace(/Â»/g, '»')
    .replace(/Â\s/g, ' ')
    .replace(/Â/g, '');
}

/**
 * Cleans document text, extracting the pure textual content from any dictionary
 * strings (e.g. {'contenu': '...', 'opinion': 'pour'}), unescaping quotes and newlines,
 * and repairing any mojibake characters.
 */
export function cleanDocumentText(doc?: string | null): string {
  if (!doc) return '';
  let trimmed = doc.trim();

  if (trimmed.includes('contenu')) {
    // Match 'contenu': '...' or "contenu": "..."
    const match = trimmed.match(/['"]contenu['"]\s*:\s*(['"])([\s\S]*?)\1\s*(?:,\s*['"]opinion['"]|})/);
    if (match && match[2]) {
      trimmed = match[2]
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .trim();
    } else {
      const simpleMatch = trimmed.match(/['"]contenu['"]\s*:\s*['"]([\s\S]*?)['"](?:\s*,|\s*})/);
      if (simpleMatch && simpleMatch[1]) {
        trimmed = simpleMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .trim();
      }
    }
  }

  return fixMojibake(trimmed);
}
