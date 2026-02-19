/**
 * Utility functions for managing breadcrumbs within story content.
 *
 * New Format (Wrappers):
 * <!-- bc:start:id:Label -->Selected Text<!-- bc:end:id -->
 */

export interface Breadcrumb {
  id: string;
  label: string;
  text: string;
}

const OLD_BREADCRUMB_REGEX = /<!--\s*breadcrumb:([a-zA-Z0-9-]+):([\s\S]*?)\s*-->/g;
const BC_START_REGEX = /<!--\s*bc:start:([a-zA-Z0-9-]+):([\s\S]*?)\s*-->/g;
const BC_END_REGEX = /<!--\s*bc:end:([a-zA-Z0-9-]+)\s*-->/g;

/**
 * Parses content to find all breadcrumbs.
 */
export function parseBreadcrumbs(content: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [];
  if (!content) return breadcrumbs;

  let match;
  BC_START_REGEX.lastIndex = 0;

  while ((match = BC_START_REGEX.exec(content)) !== null) {
    const id = match[1];
    const label = match[2].trim();
    const startIndex = match.index + match[0].length;

    const endRegex = new RegExp(`<!--\\s*bc:end:${id}\\s*-->`, 'g');
    endRegex.lastIndex = startIndex;
    const endMatch = endRegex.exec(content);

    if (endMatch) {
      const text = content.substring(startIndex, endMatch.index);
      breadcrumbs.push({
        id,
        label,
        text: text.trim()
      });
    }
  }

  return breadcrumbs;
}

/**
 * Converts raw content (with markers) to HTML for the editor.
 * Replaces markers with span wrappers.
 */
export function contentToHtml(content: string): string {
  if (!content) return '';

  // 1. Strip old breadcrumbs (migration)
  let html = content.replace(OLD_BREADCRUMB_REGEX, '');

  // 2. Escape HTML entities
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Replace start markers
  // The markers are now escaped: &lt;!-- bc:start:id:label --&gt;
  const startMarkerRegex = /&lt;!--\s*bc:start:([a-zA-Z0-9-]+):([\s\S]*?)\s*--&gt;/g;
  html = html.replace(startMarkerRegex, (match, id, label) => {
    const safeLabel = label.replace(/"/g, '&quot;');
    return `<span class="breadcrumb-highlight bg-accent-dim border-b border-accent box-decoration-clone" data-breadcrumb-id="${id}" data-label="${safeLabel}">`;
  });

  // 4. Replace end markers
  const endMarkerRegex = /&lt;!--\s*bc:end:([a-zA-Z0-9-]+)\s*--&gt;/g;
  html = html.replace(endMarkerRegex, '</span>');

  return html;
}

/**
 * Converts HTML from the editor back to raw content.
 * Replaces spans with markers and decodes HTML entities.
 */
export function htmlToContent(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Replace breadcrumb spans with markers
  const spans = doc.querySelectorAll('span.breadcrumb-highlight, span[data-breadcrumb-id]');
  spans.forEach(span => {
    const id = span.getAttribute('data-breadcrumb-id');
    const label = span.getAttribute('data-label') || 'Breadcrumb';

    if (id) {
      const safeLabel = label.replace(/-->/g, '--&gt;');
      const startComment = ` bc:start:${id}:${safeLabel} `;
      const endComment = ` bc:end:${id} `;

      const startNode = doc.createComment(startComment);
      const endNode = doc.createComment(endComment);

      span.parentNode?.insertBefore(startNode, span);
      span.parentNode?.insertBefore(endNode, span.nextSibling);

      // Unwrap the span
      while (span.firstChild) {
        span.parentNode?.insertBefore(span.firstChild, endNode);
      }
      span.remove();
    }
  });

  // Remove widgets if any
  doc.querySelectorAll('.breadcrumb-widget').forEach(w => w.remove());

  let content = doc.body.innerHTML;

  // 2. Clean up block elements
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div><div>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  return content;
}

/**
 * Strips breadcrumb markers from content (for export/preview).
 */
export function stripBreadcrumbs(content: string): string {
  if (!content) return '';
  let clean = content.replace(OLD_BREADCRUMB_REGEX, '');
  clean = clean.replace(BC_START_REGEX, '').replace(BC_END_REGEX, '');
  return clean;
}

/**
 * Removes a specific breadcrumb by ID (unwraps text).
 */
export function removeBreadcrumb(content: string, id: string): string {
  const startRegex = new RegExp(`<!--\\s*bc:start:${id}:[\\s\\S]*?\\s*-->`, 'g');
  const endRegex = new RegExp(`<!--\\s*bc:end:${id}\\s*-->`, 'g');
  return content.replace(startRegex, '').replace(endRegex, '');
}

/**
 * Updates a breadcrumb's label.
 */
export function updateBreadcrumbLabel(content: string, id: string, newLabel: string): string {
  const startRegex = new RegExp(`(<!--\\s*bc:start:${id}:)([\\s\\S]*?)(\\s*-->)`, 'g');
  return content.replace(startRegex, `$1${newLabel}$3`);
}
