
/**
 * DOM utility functions for the ContentEditable editor.
 */

import { createBreadcrumbHtml } from './breadcrumbs';

/**
 * Inserts a breadcrumb widget at the current cursor position.
 * Returns true if successful.
 */
export function insertBreadcrumbAtCursor(id: string, label: string): boolean {
  if (typeof window === 'undefined') return false;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const widgetHtml = createBreadcrumbHtml(id, label);

  // Use execCommand to insert HTML, which preserves undo stack and fires input event
  return document.execCommand('insertHTML', false, widgetHtml);
}

/**
 * Wraps the current selection with the given prefix/suffix (for Markdown).
 */
export function wrapSelectionWith(prefix: string, suffix: string = prefix) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const text = range.toString();

  // If we want to toggle, we'd need to check if it's already wrapped.
  // For simplicity, just wrap.
  const newText = `${prefix}${text}${suffix}`;

  // We can use execCommand 'insertText' to preserve undo history if possible
  // but standard execCommand only inserts plain text.
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
  const element = container.querySelector(`[data-id="${elementId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Optionally highlight it
    element.classList.add('highlight-pulse');
    setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
  }
}
