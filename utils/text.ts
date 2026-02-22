/**
 * Strips HTML tags from a string and decodes HTML entities to return plain text.
 * Uses DOMParser to avoid executing scripts or loading resources.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    // Fallback for SSR/Node environments
    return html.replace(/<[^>]*>/g, '');
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
