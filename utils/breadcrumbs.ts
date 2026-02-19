
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

const BREADCRUMB_REGEX = /<!--\s*breadcrumb:(\w+):([\s\S]*?)\s*-->/g;

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

  const escapedMarkerRegex = /&lt;!--\s*breadcrumb:(\w+):([\s\S]*?)\s*--&gt;/g;

  return html.replace(escapedMarkerRegex, (match, id, label) => {
    const decodedLabel = label.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return createBreadcrumbHtml(id, decodedLabel);
  });
}

/**
 * Creates the HTML string for a breadcrumb widget.
 */
export function createBreadcrumbHtml(id: string, label: string): string {
  // Use Tailwind classes for styling.
  // The outer div is contenteditable="false" so it's treated as a single block.
  // draggable="true" allows it to be moved.
  // New Design:
  // - Full-width line with text in the middle
  // - Accent color on hover
  // - Bookmark icon
  // - Uppercase, tracking-widest text

  // Lucide Bookmark Icon SVG
  const bookmarkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;

  return `
    <div
      class="breadcrumb-widget flex items-center gap-4 py-6 my-2 select-none group relative cursor-grab active:cursor-grabbing w-full"
      contenteditable="false"
      data-id="${id}"
      data-label="${label.replace(/"/g, '&quot;')}"
      draggable="true"
      title="Drag to move, click label to rename"
    >
      <div class="flex-1 h-px bg-border group-hover:bg-accent transition-colors duration-300"></div>

      <div class="breadcrumb-handle flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-widest text-muted group-hover:text-accent transition-colors duration-300 select-none whitespace-nowrap">
        <span class="opacity-50 group-hover:opacity-100 transition-opacity">${bookmarkIcon}</span>
        <span class="breadcrumb-text">${label}</span>
      </div>

      <div class="flex-1 h-px bg-border group-hover:bg-accent transition-colors duration-300"></div>
    </div>
  `.replace(/\s+/g, ' ').trim();
}

/**
 * Converts HTML from the editor back to raw content.
 * Replaces widgets with breadcrumb markers and decodes HTML entities.
 */
export function htmlToContent(html: string): string {
  if (!html) return '';

  // 1. Replace breadcrumb widgets with markers
  // Match the outer div of the widget.
  const widgetRegex = /<div[^>]*class=["'].*?breadcrumb-widget.*?["'][^>]*data-id=["'](\w+)["'][^>]*data-label=["']([\s\S]*?)["'][^>]*>[\s\S]*?<\/div>/gi;

  let content = html.replace(widgetRegex, (match, id, label) => {
    const decodedLabel = label.replace(/&quot;/g, '"');
    return createBreadcrumbMarker(id, decodedLabel);
  });

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
