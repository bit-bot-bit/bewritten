
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
  // We use Tailwind classes for styling.
  // The outer div is contenteditable="false" so it's treated as a single block.
  // draggable="true" allows it to be moved.
  // Minify the HTML string to avoid issues with extra whitespace
  return `
    <div
      class="breadcrumb-widget flex items-center gap-2 py-4 my-2 select-none group relative"
      contenteditable="false"
      data-id="${id}"
      data-label="${label.replace(/"/g, '&quot;')}"
      draggable="true"
    >
      <div class="flex-1 h-px bg-border group-hover:bg-accent/50 transition-colors pointer-events-none"></div>
      <div
        class="breadcrumb-handle flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/85 backdrop-blur-xl border border-border group-hover:border-accent/50 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing z-10"
        title="Drag to move, click to rename"
      >
        <span class="text-lg leading-none select-none">🍪</span>
        <span class="breadcrumb-text text-xs font-medium text-muted group-hover:text-main whitespace-nowrap max-w-[200px] truncate select-none">${label}</span>
      </div>
      <div class="flex-1 h-px bg-border group-hover:bg-accent/50 transition-colors pointer-events-none"></div>
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
  // Note: we need to be careful to match the specific structure we created.
  // Using a simpler regex that looks for the data attributes is safer than matching exact HTML.

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
  // Use a more flexible regex to catch potentially encoded content in the middle
  // But our marker format is strict.
  // Just replacing the marker is safer.

  // We need to find the old marker. The label part is the variable.
  // We can't know the old label easily unless we parse, but regex can find it.
  const regex = new RegExp(`<!--\\s*breadcrumb:${id}:([\\s\\S]*?)\\s*-->`, 'g');
  return content.replace(regex, createBreadcrumbMarker(id, newLabel));
}
