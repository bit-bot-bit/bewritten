import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { contentToHtml, htmlToContent, updateBreadcrumbLabel } from '../utils/breadcrumbs';
import { wrapSelectionWithBreadcrumb } from '../utils/editorDom';
import { generateId } from '../utils/id';
import { FloatingToolbar } from './FloatingToolbar';

interface ContentEditableEditorProps {
  content: string;
  onChange: (content: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export interface EditorRef {
  addBreadcrumbFromSelection: () => void;
  focus: () => void;
}

export const ContentEditableEditor = forwardRef<EditorRef, ContentEditableEditorProps>(({
  content,
  onChange,
  onKeyDown,
  placeholder,
  className,
  readOnly = false,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>(contentToHtml(content));
  const isComposingRef = useRef(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number, y: number } | null>(null);

  // Initialize content
  useEffect(() => {
    if (editorRef.current) {
      const nextHtml = contentToHtml(content);

      // Only update if significantly different to avoid cursor jumps
      // Note: This is tricky with contenteditable.
      // Ideally we only update if external change.
      // But here we rely on lastHtmlRef to track local changes.
      if (nextHtml !== lastHtmlRef.current) {
         editorRef.current.innerHTML = nextHtml;
         lastHtmlRef.current = nextHtml;
      } else if (editorRef.current.innerHTML === '' && nextHtml !== '') {
         editorRef.current.innerHTML = nextHtml;
      }
    }
  }, [content]);

  const handleInput = useCallback(() => {
    if (editorRef.current && !isComposingRef.current) {
      const html = editorRef.current.innerHTML;
      const text = htmlToContent(html);
      lastHtmlRef.current = contentToHtml(text); // Update our reference
      onChange(text);
      updateToolbarPosition(); // Check selection after input
    }
  }, [onChange]);

  const addBreadcrumbFromSelection = useCallback(() => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    // Verify selection is within editor
    if (!editorRef.current.contains(selection.anchorNode)) return;

    const id = generateId();
    // Use selected text as label, truncated
    const text = selection.toString().trim();
    if (!text) return;

    const label = text.length > 50 ? text.substring(0, 50) + '...' : text;

    if (wrapSelectionWithBreadcrumb(id, label)) {
        // Trigger update
        handleInput();
        setToolbarPosition(null);
    }
  }, [handleInput]);

  useImperativeHandle(ref, () => ({
    addBreadcrumbFromSelection,
    focus: () => editorRef.current?.focus()
  }));

  const updateToolbarPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setToolbarPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    // Check if selection is inside editor
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
        setToolbarPosition(null);
        return;
    }

    // Check if selection intersects any breadcrumb highlight
    if (editorRef.current) {
      const highlights = editorRef.current.querySelectorAll('.breadcrumb-highlight');
      let intersects = false;
      for (let i = 0; i < highlights.length; i++) {
        if (range.intersectsNode(highlights[i])) {
          intersects = true;
          break;
        }
      }
      if (intersects) {
        setToolbarPosition(null);
        return;
      }
    }

    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
       // Position above selection
       // Account for scroll? getBoundingClientRect is relative to viewport.
       // Our FloatingToolbar uses fixed positioning, so this is correct.
       setToolbarPosition({
         x: rect.left + rect.width / 2,
         y: rect.top
       });
    } else {
       setToolbarPosition(null);
    }
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
        // Debounce or just run? Selection change fires rapidly.
        // We need it to be responsive.
        requestAnimationFrame(updateToolbarPosition);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    // Also handle scroll to update position
    window.addEventListener('scroll', handleSelectionChange, true);
    window.addEventListener('resize', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', handleSelectionChange, true);
      window.removeEventListener('resize', handleSelectionChange);
    };
  }, [updateToolbarPosition]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    // Check if pasted HTML contains breadcrumb highlights
    if (html && (html.includes('breadcrumb-highlight') || html.includes('breadcrumb-widget'))) {
       // Sanitize via htmlToContent -> contentToHtml cycle
       const contentWithMarkers = htmlToContent(html);
       const cleanHtml = contentToHtml(contentWithMarkers);
       document.execCommand('insertHTML', false, cleanHtml);
    } else {
       // Standard text paste
       document.execCommand('insertText', false, text);
    }
  };

  const handleKeyDownWrapper = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) onKeyDown(e);
    // Hide toolbar on typing
    setToolbarPosition(null);
  };

  return (
    <>
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
          handleInput();
        }}
        onClick={() => updateToolbarPosition()} // Ensure update on click
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
      />
      <FloatingToolbar position={toolbarPosition} onAddBreadcrumb={addBreadcrumbFromSelection} />
    </>
  );
});

ContentEditableEditor.displayName = 'ContentEditableEditor';
