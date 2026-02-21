/**
 * DOM utility functions for the ContentEditable editor.
 */

/**
 * Wraps the current selection with a breadcrumb span.
 * Returns true if successful.
 */
export function wrapSelectionWithBreadcrumb(id: string, label: string): boolean {
  if (typeof window === 'undefined') return false;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);

  const span = document.createElement('span');
  span.className = 'breadcrumb-highlight bg-yellow-500/30 text-main box-decoration-clone';
  span.dataset.breadcrumbId = id;
  span.dataset.label = label;

  try {
    range.surroundContents(span);
    return true;
  } catch (e) {
    // Fallback for complex selections (e.g. crossing block boundaries)
    // We can use extractContents, but that might break block structure if not careful.
    // Ideally we shouldn't allow crossing blocks for inline spans.
    console.warn("Could not wrap selection:", e);
    return false;
  }
}

/**
 * Wraps the current selection with the given prefix/suffix (for Markdown).
 */
export function wrapSelectionWith(prefix: string, suffix: string = prefix) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const text = range.toString();

  const newText = `${prefix}${text}${suffix}`;
  document.execCommand('insertText', false, newText);
}

/**
 * Inserts text at the current cursor position.
 */
export function insertText(text: string) {
  document.execCommand('insertText', false, text);
}

/**
 * Focuses the editor at the end of the content.
 */
export function focusEditorEnd(element: HTMLElement) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  element.focus();
}

/**
 * Scrolls to a specific element by ID within a container.
 */
export function scrollToElement(container: HTMLElement | null, elementId: string) {
  if (!container) return;
  const element = container.querySelector(`[data-breadcrumb-id="${elementId}"]`) || container.querySelector(`[data-id="${elementId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('highlight-pulse');
    setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
  }
}
