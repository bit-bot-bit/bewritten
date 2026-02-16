import React from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Chapter } from '../types';

interface ChapterRailProps {
  chapters: Chapter[];
  currentChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  showChapters: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

export const ChapterRail: React.FC<ChapterRailProps> = ({
  chapters,
  currentChapterId,
  onSelectChapter,
  showChapters,
  onToggle,
  isMobile = false,
}) => {
  if (isMobile) {
    return (
      <>
        {showChapters && <button onClick={onToggle} className="absolute inset-0 bg-black/45 backdrop-blur-[1px] z-20" aria-label="Close chapter list" />}
        <div
          className={`absolute inset-y-0 left-0 z-30 w-64 max-w-[85vw] bg-surface/92 backdrop-blur-xl border-r border-border shadow-2xl transition-transform duration-300 overflow-hidden flex flex-col ${
            showChapters ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 flex items-center justify-between bg-card/70 border-b border-border">
            <span className="font-semibold text-main text-sm uppercase tracking-wide">Chapters</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-24">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => {
                  onSelectChapter(chapter.id);
                  onToggle();
                }}
                className={`w-full text-left flex items-center gap-2 p-3 rounded-lg text-sm transition-colors ${
                  currentChapterId === chapter.id
                    ? 'bg-accent-dim text-accent border border-accent/30'
                    : 'text-main/90 bg-card/55 hover:bg-card'
                }`}
              >
                <FileText size={14} />
                <span className="truncate">{chapter.title}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-surface/92 backdrop-blur-xl p-1 rounded-r border-y border-r border-border text-main/85 hover:text-main z-30"
        >
          {showChapters ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </>
    );
  }

  return (
    <>
      <div className={`${showChapters ? 'w-64' : 'w-0'} bg-surface border-r border-border transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-4 flex items-center justify-between bg-card/50">
          <span className="font-semibold text-muted text-sm uppercase tracking-wide">Chapters</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => onSelectChapter(chapter.id)}
              className={`w-full text-left flex items-center gap-2 p-3 rounded-lg text-sm transition-colors ${
                currentChapterId === chapter.id
                  ? 'bg-accent-dim text-accent border border-accent/30'
                  : 'text-muted hover:bg-card'
              }`}
            >
              <FileText size={14} />
              <span className="truncate">{chapter.title}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-card p-1 rounded-r border-y border-r border-border text-muted hover:text-main z-10"
        style={{ left: showChapters ? '16rem' : '0' }}
      >
        {showChapters ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </>
  );
};
