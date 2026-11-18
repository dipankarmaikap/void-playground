/**
 * Shared `Content-Disposition` filename sanitization for Invoice and Credit Note PDFs:
 * `/` and other filename hazards become `-`, whitespace collapses, leading and trailing
 * separators are stripped, the base is clamped to 80 characters, and an unusable base falls
 * back to the document-specific name.
 */
export function documentPdfFilename(base: string, fallback: string): string {
  let cleaned = base
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .trim();
  return `${cleaned || fallback}.pdf`;
}
