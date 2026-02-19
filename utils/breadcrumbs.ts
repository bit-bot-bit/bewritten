
/**
 * Utility functions for managing breadcrumbs within story content.
 *
 * Format: <!-- breadcrumb:id:Label -->
 */

export interface Breadcrumb {
  id: string;
  label: string;
  index: number; // Character index in the raw text content
}

const BREADCRUMB_REGEX = /<!--\s*breadcrumb:([a-zA-Z0-9-]+):([\s\S]*?)\s*-->/g;

/**
 * Parses content to find all breadcrumbs.
 */
export function parseBreadcrumbs(content: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [];
  let match;
  BREADCRUMB_REGEX.lastIndex = 0;

  while ((match = BREADCRUMB_REGEX.exec(content)) !== null) {
    breadcrumbs.push({
      id: match[1],
      label: match[2].trim(),
      index: match.index,
    });
  }

  return breadcrumbs;
}

/**
 * Generates the storage string for a breadcrumb.
 */
export function createBreadcrumbMarker(id: string, label: string): string {
  const safeLabel = label.replace(/-->/g, '--&gt;');
  return `<!-- breadcrumb:${id}:${safeLabel} -->`;
}

/**
 * Converts raw content (with breadcrumb markers) to HTML for the editor.
 * Replaces markers with interactive widgets.
 */
export function contentToHtml(content: string): string {
  if (!content) return '';

  // Escape HTML entities in the content first
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const escapedMarkerRegex = /&lt;!--\s*breadcrumb:([a-zA-Z0-9-]+):([\s\S]*?)\s*--&gt;/g;

  return html.replace(escapedMarkerRegex, (match, id, label) => {
    const decodedLabel = label.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return createBreadcrumbHtml(id, decodedLabel);
  });
}

/**
 * Creates the HTML string for a breadcrumb widget.
 */
export function createBreadcrumbHtml(id: string, label: string): string {
  // New Design:
  // - Inline-block marker (0 width) behaving as an anchor
  // - Absolute handle in gutter
  // - Horizontal line across text on hover

  const bookmarkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;

  return `
    <span
      class="breadcrumb-widget group relative inline-block select-none align-middle w-0 h-4 mx-1 overflow-visible z-10"
      contenteditable="false"
      data-id="${id}"
      data-label="${label.replace(/"/g, '&quot;')}"
      draggable="true"
      title="Drag to move: ${label}"
      style="vertical-align: text-bottom;"
    >
      <span class="breadcrumb-handle absolute top-1/2 -translate-y-1/2 flex items-center justify-center
             w-6 h-6 rounded-full bg-surface border border-border text-muted
             group-hover:text-accent group-hover:border-accent group-hover:bg-accent/10
             cursor-grab active:cursor-grabbing transition-all z-20 shadow-sm"
            style="left: -2.5rem;">
        ${bookmarkIcon}
      </span>

      <span class="absolute left-0 top-1/2 w-[200vw] h-px bg-accent/0 group-hover:bg-accent/30 transition-colors pointer-events-none z-0"></span>

      <span class="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
             bg-card text-main text-xs px-2 py-1 rounded shadow-md border border-border whitespace-nowrap z-30 pointer-events-none"
            style="left: -3.5rem; transform: translateX(-100%);">
        ${label}
      </span>
    </span>
  `.replace(/\s+/g, ' ').trim();
}

/**
 * Converts HTML from the editor back to raw content.
 * Replaces widgets with breadcrumb markers and decodes HTML entities.
 */
export function htmlToContent(html: string): string {
  if (!html) return '';

  // Use DOMParser to handle the structure safely and prevent nested widget garbage
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Replace breadcrumb widgets with markers
  const widgets = doc.body.querySelectorAll('.breadcrumb-widget');
  widgets.forEach(widget => {
      const id = widget.getAttribute('data-id');
      const label = widget.getAttribute('data-label');

      if (id && label) {
          // Create the marker as a Comment Node to ensure innerHTML output is a raw comment
          // We replicate the formatting logic from createBreadcrumbMarker but without the wrapper tags
          // createBreadcrumbMarker uses: `<!-- breadcrumb:${id}:${safeLabel} -->`
          const safeLabel = label.replace(/-->/g, '--&gt;');
          const commentContent = ` breadcrumb:${id}:${safeLabel} `;
          widget.replaceWith(doc.createComment(commentContent));
      } else {
          // Clean up malformed widgets
          widget.remove();
      }
  });

  let content = doc.body.innerHTML;

  // 2. Clean up block-level elements that browsers insert for newlines
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
  return content.replace(BREADCRUMB_REGEX, '');
}

/**
 * Removes a specific breadcrumb by ID.
 */
export function removeBreadcrumb(content: string, id: string): string {
  const regex = new RegExp(`<!--\\s*breadcrumb:${id}:[\\s\\S]*?\\s*-->`, 'g');
  return content.replace(regex, '');
}

/**
 * Updates a breadcrumb's label.
 */
export function updateBreadcrumbLabel(content: string, id: string, newLabel: string): string {
  const regex = new RegExp(`<!--\\s*breadcrumb:${id}:([\\s\\S]*?)\\s*-->`, 'g');
  return content.replace(regex, createBreadcrumbMarker(id, newLabel));
}
