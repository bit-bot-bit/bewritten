import React from 'react';
import { createPortal } from 'react-dom';
import { Edit3, Eye, Mic, MicOff } from 'lucide-react';

export const EditorToolbar = ({
  isMobileStyle = false,
  isDictating = false,
  viewMode = 'edit',
  onDictateToggle,
  onViewModeChange
}) => {
  const content = (
    <div className={isMobileStyle
      ? "flex"
      : "hidden sm:flex bg-surface rounded-lg p-1 border border-border"}>
      <button
        onClick={onDictateToggle}
        className={`p-1.5 rounded-md border transition-all ${isDictating ? 'border-red-500/50 text-red-500 ring-2 ring-red-500/30 shadow-sm animate-pulse' : 'border-transparent text-muted hover:text-main hover:bg-card/70'}`}
        title="Dictate"
      >
        {isDictating ? <Mic size={16} /> : <MicOff size={16} />}
      </button>
      <div className="w-px bg-border mx-1" />
      <button
        onClick={() => onViewModeChange('edit')}
        aria-pressed={viewMode === 'edit'}
        className={`p-1.5 rounded-md border transition-all ${viewMode === 'edit' ? 'border-accent ring-2 ring-accent/50 shadow-sm' : 'border-transparent text-muted hover:text-main hover:bg-card/70'}`}
        style={viewMode === 'edit' ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
        title="Edit Mode"
      >
        <Edit3 size={16} />
      </button>
      <button
        onClick={() => onViewModeChange('page')}
        aria-pressed={viewMode === 'page'}
        className={`p-1.5 rounded-md border transition-all ${viewMode === 'page' ? 'border-accent ring-2 ring-accent/50 shadow-sm' : 'border-transparent text-muted hover:text-main hover:bg-card/70'}`}
        style={viewMode === 'page' ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
        title="Page View"
      >
        <Eye size={16} />
      </button>
    </div>
  );

  if (isMobileStyle) {
    const portalTarget = document.getElementById('mobile-editor-toolbar');
    if (portalTarget) {
      return createPortal(content, portalTarget);
    }
  }

  return content;
};
