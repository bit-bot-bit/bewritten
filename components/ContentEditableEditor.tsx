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
      onClick={handleClick}
      role="textbox"
      aria-multiline="true"
      aria-placeholder={placeholder}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }} // Mimic textarea
    />
  );
};
