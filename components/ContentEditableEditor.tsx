import React, { useEffect, useRef, useState } from 'react';
import { contentToHtml, htmlToContent, updateBreadcrumbLabel, createBreadcrumbMarker } from '../utils/breadcrumbs';

interface ContentEditableEditorProps {
  content: string;
  onChange: (content: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export const ContentEditableEditor: React.FC<ContentEditableEditorProps> = ({
  content,
  onChange,
  onKeyDown,
  placeholder,
  className,
  readOnly = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>(contentToHtml(content));
  const isComposingRef = useRef(false);

  // Initialize content
  useEffect(() => {
    if (editorRef.current) {
      const nextHtml = contentToHtml(content);

      const currentHtml = editorRef.current.innerHTML;

      // Update only if significantly different
      if (nextHtml !== lastHtmlRef.current) {
         editorRef.current.innerHTML = nextHtml;
         lastHtmlRef.current = nextHtml;
      } else if (editorRef.current.innerHTML === '' && nextHtml !== '') {
         editorRef.current.innerHTML = nextHtml;
      }
    }
  }, [content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (editorRef.current && !isComposingRef.current) {
      const html = editorRef.current.innerHTML;
      const text = htmlToContent(html);
      lastHtmlRef.current = contentToHtml(text); // Update our reference
      onChange(text);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    // Check if the pasted HTML contains our breadcrumb widgets
    if (html && html.includes('breadcrumb-widget')) {
       // 1. Convert pasted HTML to our internal content format (text + markers).
       //    This sanitizes unwanted formatting because htmlToContent strips regular tags.
       const contentWithMarkers = htmlToContent(html);

       // 2. Convert back to editor HTML (widgets)
       const cleanHtml = contentToHtml(contentWithMarkers);

       // 3. Insert the clean HTML with widgets
       document.execCommand('insertHTML', false, cleanHtml);
    } else {
       // Standard text paste
       document.execCommand('insertText', false, text);
    }
  };

  const handleKeyDownWrapper = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) onKeyDown(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if clicked on breadcrumb handle
    const target = e.target as HTMLElement;
    const handle = target.closest('.breadcrumb-handle');
    const widget = target.closest('.breadcrumb-widget') as HTMLElement;

    if (handle && widget) {
      e.stopPropagation(); // Prevent caret movement/selection clearing if possible
      const currentId = widget.dataset.id;
      const currentLabel = widget.dataset.label;

      // Simple prompt for renaming
      const newLabel = window.prompt('Rename breadcrumb:', currentLabel);
      if (newLabel !== null && newLabel !== currentLabel) {
        // We update via the parent's onChange handler to ensure state consistency.
        if (editorRef.current) {
            const currentContent = htmlToContent(editorRef.current.innerHTML);
            const updatedContent = updateBreadcrumbLabel(currentContent, currentId!, newLabel);
            onChange(updatedContent);
        }
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const widget = target.closest('.breadcrumb-widget');
    if (widget) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // Required for some browsers
      e.dataTransfer.setData('application/x-breadcrumb-id', widget.getAttribute('data-id') || '');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-breadcrumb-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData('application/x-breadcrumb-id');
    if (id && editorRef.current) {
      e.preventDefault();

      // Sanitize ID for selector usage
      const safeId = id.replace(/["\\]/g, '\\$&');
      const oldWidget = editorRef.current.querySelector(`.breadcrumb-widget[data-id="${safeId}"]`);
      if (oldWidget) {
        // Determine drop position
        let range: Range | null = null;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if ((document as any).caretPositionFromPoint) {
          // Firefox fallback
          const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }

        if (range) {
          // Enforce block-level placement (snap to nearest block start)
          // preventing insertion mid-sentence
          let targetNode = range.startContainer;
          // Traverse up to find a block container if we are in a text node
          if (targetNode.nodeType === Node.TEXT_NODE && targetNode.parentElement) {
             // Basic block elements in contenteditable
             const block = targetNode.parentElement.closest('p, div, h1, h2, h3, h4, h5, h6, li');
             // Ensure we are still inside the editor
             if (block && editorRef.current && editorRef.current.contains(block)) {
                 range.setStartBefore(block);
                 range.collapse(true);
             }
          }

          // Clone and insert at new position
          const newWidget = oldWidget.cloneNode(true);
          range.insertNode(newWidget);
          range.collapse(false);

          // Remove old widget
          oldWidget.remove();

          // Trigger update
          handleInput(null as any);
        }
      }
    }
  };

  return (
    <div
      ref={editorRef}
      className={`outline-none min-h-[50vh] ${className}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDownWrapper}
      onCompositionStart={() => (isComposingRef.current = true)}
      onCompositionEnd={() => {
        isComposingRef.current = false;
        handleInput(null as any);
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="textbox"
      aria-multiline="true"
      aria-placeholder={placeholder}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }} // Mimic textarea
    />
  );
};
