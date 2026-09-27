/**
 * Cleans document text, extracting the pure textual content from any dictionary
 * strings (e.g. {'contenu': '...', 'opinion': 'pour'}), unescaping quotes and newlines.
 */
export function cleanDocumentText(doc?: string | null): string {
  if (!doc) return '';
  const trimmed = doc.trim();
  if (trimmed.includes('contenu')) {
    // Match 'contenu': '...' or "contenu": "..."
    const match = trimmed.match(/['"]contenu['"]\s*:\s*(['"])([\s\S]*?)\1\s*(?:,\s*['"]opinion['"]|})/);
    if (match && match[2]) {
      return match[2]
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .trim();
    }
    const simpleMatch = trimmed.match(/['"]contenu['"]\s*:\s*['"]([\s\S]*?)['"](?:\s*,|\s*})/);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .trim();
    }
  }
  return trimmed;
}
