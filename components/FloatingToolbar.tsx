import React, { useEffect, useState } from 'react';
import { Bookmark, Bold, Italic, Underline, Indent, Outdent, ArrowRightFromLine, Undo2, Redo2 } from 'lucide-react';

interface FloatingToolbarProps {
  position: { x: number; y: number } | null;
  onAddBreadcrumb: () => void;
  onIndent?: () => void;
  onBlockIndent?: () => void;
  onBlockOutdent?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  activeFormats?: { bold: boolean; italic: boolean; underline: boolean };
  isMobile?: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  position,
  onAddBreadcrumb,
  onIndent,
  onBlockIndent,
  onBlockOutdent,
  onUndo,
  onRedo,
  activeFormats = { bold: false, italic: false, underline: false },
  isMobile = false,
}) => {
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0);

  useEffect(() => {
    if (!isMobile) return;
    const handleResize = () => {
      setViewportHeight(window.visualViewport?.height || window.innerHeight);
    };
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  if (!position) return null;

  // Calculate safe bottom position for mobile
  // If keyboard is open, visualViewport height shrinks relative to layout viewport (on iOS)
  // or layout viewport shrinks (on Android).
  // We want to be just above the visual viewport bottom.
  const bottomOffset = typeof window !== 'undefined'
      ? Math.max(16, (window.innerHeight - viewportHeight) + 16)
      : 16;

  const style: React.CSSProperties = isMobile
    ? {
        left: '50%',
        bottom: `${bottomOffset}px`,
        transform: 'translateX(-50%)',
        top: 'auto',
      }
    : {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      };

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
  };

  return (
    <div
      className="fixed z-50 flex items-center gap-1 p-1 bg-surface/95 backdrop-blur-md border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onMouseDown={(e) => e.preventDefault()} // Prevent stealing focus from editor selection
    >
      {onUndo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUndo();
          }}
          className="p-2 text-muted hover:text-main hover:bg-white/10 rounded-lg transition-colors"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
      )}
      {onRedo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRedo();
          }}
          className="p-2 text-muted hover:text-main hover:bg-white/10 rounded-lg transition-colors"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFormat('bold');
        }}
        className={`p-2 rounded-lg transition-colors ${activeFormats.bold ? 'text-accent bg-accent/10' : 'text-muted hover:text-main hover:bg-white/10'}`}
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFormat('italic');
        }}
        className={`p-2 rounded-lg transition-colors ${activeFormats.italic ? 'text-accent bg-accent/10' : 'text-muted hover:text-main hover:bg-white/10'}`}
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFormat('underline');
        }}
        className={`p-2 rounded-lg transition-colors ${activeFormats.underline ? 'text-accent bg-accent/10' : 'text-muted hover:text-main hover:bg-white/10'}`}
        title="Underline"
      >
        <Underline size={16} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {onIndent && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndent();
          }}
          className="p-2 text-muted hover:text-main hover:bg-white/10 rounded-lg transition-colors"
          title="Insert Tab Character"
        >
          <ArrowRightFromLine size={16} />
        </button>
      )}

      {onBlockOutdent && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBlockOutdent();
          }}
          className="p-2 text-muted hover:text-main hover:bg-white/10 rounded-lg transition-colors"
          title="Decrease Indent"
        >
          <Outdent size={16} />
        </button>
      )}

      {onBlockIndent && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBlockIndent();
          }}
          className="p-2 text-muted hover:text-main hover:bg-white/10 rounded-lg transition-colors"
          title="Increase Indent"
        >
          <Indent size={16} />
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddBreadcrumb();
        }}
        className="p-2 text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
        title="Add Breadcrumb"
      >
        <Bookmark size={16} />
      </button>
    </div>
  );
};
