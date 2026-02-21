import React from 'react';
import { Disc, Bold, Italic, Underline } from 'lucide-react';

interface FloatingToolbarProps {
  position: { x: number; y: number } | null;
  onAddBreadcrumb: () => void;
  isMobile?: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ position, onAddBreadcrumb, isMobile = false }) => {
  if (!position) return null;

  const style: React.CSSProperties = isMobile
    ? {
        left: '50%',
        bottom: '2rem',
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
      className="fixed z-50 flex items-center gap-1 p-1 bg-surface border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onMouseDown={(e) => e.preventDefault()} // Prevent stealing focus from editor selection
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFormat('bold');
        }}
        className="p-1.5 text-muted hover:text-main hover:bg-card rounded transition-colors"
        title="Bold"
      >
        <Bold size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFormat('italic');
        }}
        className="p-1.5 text-muted hover:text-main hover:bg-card rounded transition-colors"
        title="Italic"
      >
        <Italic size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFormat('underline');
        }}
        className="p-1.5 text-muted hover:text-main hover:bg-card rounded transition-colors"
        title="Underline"
      >
        <Underline size={14} />
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddBreadcrumb();
        }}
        className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-main hover:bg-accent/10 hover:text-accent rounded transition-colors"
        title="Add Breadcrumb"
      >
        <Disc size={14} />
        <span>Breadcrumb</span>
      </button>
    </div>
  );
};
