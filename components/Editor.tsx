import React, { useEffect, useMemo, useState } from 'react';
import { checkContinuity } from '../services/geminiService';
import { AlertCircle, CheckCircle, Wand2, Loader2, Plus, FileText, Trash2, ChevronLeft, ChevronRight, Download, Edit3, Eye } from 'lucide-react';
import { ExportModal } from './ExportModal';
import { ConfirmationModal } from './ConfirmationModal';
import { generateId } from '../utils/id';
import { formatTitleCase } from '../utils/titleCase';

const BOOK_FORMATS = [
  { id: 'standard', name: 'Standard (6" x 9")', width: '6in', heightPx: 864, pageCss: '@page { size: 6in 9in; margin: 1in; }' },
  { id: 'a5', name: 'A5', width: '148mm', heightPx: 794, pageCss: '@page { size: A5; margin: 20mm; }' },
  { id: 'pocket', name: 'Pocket (4.25" x 6.87")', width: '4.25in', heightPx: 660, pageCss: '@page { size: 4.25in 6.87in; margin: 0.5in; }' },
];

const DPI = 96;
const PREVIEW_LAYOUT_BY_FORMAT = {
  standard: { marginPx: 96, marginCss: '1in' },
  a5: { marginPx: Math.round((20 / 25.4) * DPI), marginCss: '20mm' },
  pocket: { marginPx: 48, marginCss: '0.5in' },
};
const PREVIEW_TYPOGRAPHY_BY_FORMAT = {
  standard: { fontPx: 15.5, lineHeight: 1.5, chapterLabelPx: 11, chapterTitlePx: 46, chapterGapPx: 34, firstPageHeadingLines: 5 },
  a5: { fontPx: 14.5, lineHeight: 1.52, chapterLabelPx: 10, chapterTitlePx: 40, chapterGapPx: 30, firstPageHeadingLines: 5 },
  pocket: { fontPx: 13.5, lineHeight: 1.5, chapterLabelPx: 9, chapterTitlePx: 34, chapterGapPx: 24, firstPageHeadingLines: 5 },
};

function widthToPx(width) {
  const value = width.trim().toLowerCase();
  if (value.endsWith('in')) return parseFloat(value.replace('in', '')) * DPI;
  if (value.endsWith('mm')) return parseFloat(value.replace('mm', '')) * (DPI / 25.4);
  if (value.endsWith('px')) return parseFloat(value.replace('px', ''));
  return parseFloat(value) || 0;
}

function getMeasureContext(fontPx) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = `${fontPx}px Merriweather, serif`;
  return ctx;
}

function wrapParagraphByWidth(paragraph, maxWidthPx, ctx, fontPx) {
  if (!paragraph.trim()) return [''];
  const words = paragraph.split(/\s+/);
  const lines = [];
  let current = '';

  const measure = (text) => (ctx ? ctx.measureText(text).width : text.length * (fontPx * 0.55));

  const pushWordHardWrapped = (word) => {
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (measure(next) <= maxWidthPx) chunk = next;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) lines.push(chunk);
  };

  for (const word of words) {
    if (!word) continue;
    if (measure(word) > maxWidthPx) {
      if (current) {
        lines.push(current);
        current = '';
      }
      pushWordHardWrapped(word);
      continue;
    }

    if (!current) {
      current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (measure(next) <= maxWidthPx) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function paginateContent(content, format, typography) {
  const marginPx = PREVIEW_LAYOUT_BY_FORMAT[format.id]?.marginPx ?? 96;
  const pageWidthPx = widthToPx(format.width);
  const contentWidthPx = Math.max(80, pageWidthPx - marginPx * 2);
  const contentHeightPx = Math.max(120, format.heightPx - marginPx * 2);
  const lineHeightPx = typography.fontPx * typography.lineHeight;
  const linesPerPage = Math.max(1, Math.floor(contentHeightPx / lineHeightPx) - 1);
  const firstPageHeadingLines = typography.firstPageHeadingLines;
  const ctx = getMeasureContext(typography.fontPx);

  const paragraphs = content.split('\n');
  const lines = [];
  for (const paragraph of paragraphs) lines.push(...wrapParagraphByWidth(paragraph, contentWidthPx, ctx, typography.fontPx));

  if (lines.length === 0) return [''];

  const pages = [];
  const firstPageCapacity = Math.max(1, linesPerPage - firstPageHeadingLines);
  pages.push(lines.slice(0, firstPageCapacity).join('\n'));

  for (let i = firstPageCapacity; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join('\n'));
  }
  return pages.length > 0 ? pages : [''];
}

export const Editor = ({ storyState, setStoryState, saveStatus = 'Saved' }) => {
  const detectMobile = () => (typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const [analysis, setAnalysis] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMobile, setIsMobile] = useState(detectMobile);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [showChapters, setShowChapters] = useState(() => !detectMobile());
  const [showExport, setShowExport] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('edit');
  const [selectedFormat, setSelectedFormat] = useState(BOOK_FORMATS[0]);

  const currentChapter = storyState.chapters.find((c) => c.id === storyState.currentChapterId) || storyState.chapters[0];
  const previewLayout = PREVIEW_LAYOUT_BY_FORMAT[selectedFormat.id] ?? { marginPx: 96, marginCss: '1in' };
  const previewTypography = PREVIEW_TYPOGRAPHY_BY_FORMAT[selectedFormat.id] || PREVIEW_TYPOGRAPHY_BY_FORMAT.standard;
  const pagedContent = useMemo(
    () => paginateContent(currentChapter.content, selectedFormat, previewTypography),
    [currentChapter.content, selectedFormat, previewTypography]
  );
  const pageWidthPx = widthToPx(selectedFormat.width);
  const maxPreviewWidth = Math.max(180, viewportWidth - (isMobile ? 72 : 120));
  const previewScale = Math.min(1, maxPreviewWidth / pageWidthPx);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(detectMobile());
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile) setShowChapters(false);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && viewMode === 'page' && showChapters) {
      setShowChapters(false);
    }
  }, [isMobile, viewMode, showChapters]);

  const updateContent = (newContent) => {
    setStoryState((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) => (c.id === currentChapter.id ? { ...c, content: newContent } : c)),
    }));
  };

  const updateChapterTitle = (newTitle) => {
    setStoryState((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) => (c.id === currentChapter.id ? { ...c, title: newTitle } : c)),
    }));
  };

  const updateStoryTitle = (newTitle) => setStoryState((prev) => ({ ...prev, title: newTitle }));
  const normalizeStoryTitle = () => {
    const next = formatTitleCase(storyState.title);
    if (next && next !== storyState.title) updateStoryTitle(next);
  };
  const normalizeChapterTitle = () => {
    const next = formatTitleCase(currentChapter.title);
    if (next && next !== currentChapter.title) updateChapterTitle(next);
  };

  const handleEditorKeyDown = (e) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = currentChapter.content;

    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      const selected = value.slice(start, end);
      const isWrapped = selected.length >= 2 && selected.startsWith('*') && selected.endsWith('*');

      let nextValue = value;
      let nextStart = start;
      let nextEnd = end;

      if (start !== end) {
        if (isWrapped) {
          const unwrapped = selected.slice(1, -1);
          nextValue = `${value.slice(0, start)}${unwrapped}${value.slice(end)}`;
          nextStart = start;
          nextEnd = start + unwrapped.length;
        } else {
          nextValue = `${value.slice(0, start)}*${selected}*${value.slice(end)}`;
          nextStart = start + 1;
          nextEnd = end + 1;
        }
      } else {
        nextValue = `${value.slice(0, start)}**${value.slice(end)}`;
        nextStart = start + 1;
        nextEnd = start + 1;
      }

      updateContent(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = nextStart;
        textarea.selectionEnd = nextEnd;
      });
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextValue = `${value.slice(0, start)}\t${value.slice(end)}`;
      updateContent(nextValue);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
    }
  };

  const addChapter = () => {
    const newChapter = { id: generateId(), title: `Chapter ${storyState.chapters.length + 1}`, content: '', order: storyState.chapters.length + 1 };
    setStoryState((prev) => ({ ...prev, chapters: [...prev.chapters, newChapter], currentChapterId: newChapter.id }));
  };

  const confirmDeleteChapter = () => {
    if (!chapterToDelete || storyState.chapters.length <= 1) return;
    const newChapters = storyState.chapters.filter((c) => c.id !== chapterToDelete);
    setStoryState((prev) => ({ ...prev, chapters: newChapters, currentChapterId: prev.currentChapterId === chapterToDelete ? newChapters[0].id : prev.currentChapterId }));
    setChapterToDelete(null);
  };

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    const fullText = storyState.chapters.map((c) => `[${c.title}]\n${c.content}`).join('\n\n');
    const results = await checkContinuity(fullText, storyState.characters, storyState.locations, storyState.plotPoints);
    setAnalysis(results);
    setIsAnalyzing(false);
  };

  return (
    <div className="flex h-full relative">
      <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} story={storyState} />

      <ConfirmationModal
        isOpen={!!chapterToDelete}
        onClose={() => setChapterToDelete(null)}
        onConfirm={confirmDeleteChapter}
        title="Delete Chapter?"
        message={`Are you sure you want to delete "${storyState.chapters.find((c) => c.id === chapterToDelete)?.title || ''}"?`}
      />

      {isMobile && showChapters && <button onClick={() => setShowChapters(false)} className="absolute inset-0 bg-black/30 z-20" aria-label="Close chapters" />}
      <div
        className={`${
          isMobile
            ? `absolute inset-y-0 left-0 z-30 w-64 max-w-[85vw] transform ${showChapters ? 'translate-x-0' : '-translate-x-full'}`
            : showChapters
              ? 'w-64'
              : 'w-0'
        } bg-surface border-r border-border transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between bg-card/50">
          <span className="font-semibold text-muted text-sm uppercase tracking-wide">Chapters</span>
          <button onClick={addChapter} className="text-muted hover:text-main"><Plus size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {storyState.chapters.map((chapter) => (
            <div
              key={chapter.id}
              onClick={() => setStoryState((s) => ({ ...s, currentChapterId: chapter.id }))}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer text-sm transition-colors ${storyState.currentChapterId === chapter.id ? 'bg-accent-dim text-accent border border-accent/30' : 'text-muted hover:bg-card'}`}
            >
              <div className="flex items-center gap-2 truncate"><FileText size={14} /><span className="truncate">{chapter.title}</span></div>
              {storyState.chapters.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); setChapterToDelete(chapter.id); }} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 p-1"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <button onClick={() => setShowExport(true)} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-card hover:bg-card/80 text-muted hover:text-accent transition-colors text-sm font-medium border border-border"><Download size={16} />Export Story</button>
        </div>
      </div>

      <button onClick={() => setShowChapters(!showChapters)} className="absolute left-0 top-1/2 -translate-y-1/2 bg-card p-1 rounded-r border-y border-r border-border text-muted hover:text-main z-30" style={{ left: !isMobile && showChapters ? '16rem' : '0' }}>
        {showChapters ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="flex-1 h-full flex flex-col max-w-4xl mx-auto w-full relative">
        <div className="px-4 md:px-12 pt-6 md:pt-8 pb-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <input type="text" value={storyState.title} onChange={(e) => updateStoryTitle(e.target.value)} onBlur={normalizeStoryTitle} placeholder="Story Title" className="bg-transparent text-sm font-semibold uppercase tracking-widest text-muted outline-none focus:text-accent transition-colors" />
              <span className="text-[11px] px-2 py-1 rounded border border-border text-muted bg-card/70">{saveStatus}</span>
            </div>

            <div className="flex bg-surface rounded-lg p-1 border border-border">
              <button
                onClick={() => setViewMode('edit')}
                aria-pressed={viewMode === 'edit'}
                className={`p-1.5 rounded-md border transition-all ${viewMode === 'edit' ? 'border-accent ring-2 ring-accent/50 shadow-sm' : 'border-transparent text-muted hover:text-main hover:bg-card/70'}`}
                style={viewMode === 'edit' ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
                title="Edit Mode"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('page')}
                aria-pressed={viewMode === 'page'}
                className={`p-1.5 rounded-md border transition-all ${viewMode === 'page' ? 'border-accent ring-2 ring-accent/50 shadow-sm' : 'border-transparent text-muted hover:text-main hover:bg-card/70'}`}
                style={viewMode === 'page' ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
                title="Page View"
              >
                <Eye size={16} />
              </button>
            </div>
          </div>

          <input type="text" value={currentChapter.title} onChange={(e) => updateChapterTitle(e.target.value)} onBlur={normalizeChapterTitle} placeholder="Chapter Title" className="w-full bg-transparent text-2xl md:text-4xl font-serif font-bold text-main placeholder-muted outline-none border-b border-transparent focus:border-border transition-colors pb-2" />
        </div>

        {viewMode === 'edit' ? (
          <div className="flex-1 px-4 md:px-12 pb-6 md:pb-12 overflow-hidden">
            <textarea value={currentChapter.content} onChange={(e) => updateContent(e.target.value)} onKeyDown={handleEditorKeyDown} placeholder="Start writing your chapter..." className="w-full h-full bg-transparent resize-none outline-none text-lg leading-relaxed font-serif text-main/90 placeholder-muted/50 selection:bg-accent-dim" spellCheck={true} autoCorrect="on" autoCapitalize="sentences" />
          </div>
        ) : (
          <div className="flex-1 bg-surface/50 border-t border-border overflow-y-auto overflow-x-hidden p-3 md:p-8 flex flex-col items-center">
            <div className="mb-6 w-full md:flex md:justify-center">
              <div className="w-full md:w-auto overflow-x-auto md:overflow-visible pb-1">
                <div className="flex gap-2 items-center bg-card p-2 rounded-xl border border-border min-w-max md:min-w-0">
                <span className="text-xs font-bold text-muted uppercase px-2">Book Size:</span>
                {BOOK_FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt)}
                    aria-pressed={selectedFormat.id === fmt.id}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-all ${selectedFormat.id === fmt.id ? 'border-accent shadow-md ring-2 ring-accent/50 font-semibold -translate-y-px' : 'bg-surface/40 text-main border-border hover:bg-surface font-medium'}`}
                    style={selectedFormat.id === fmt.id ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
                  >
                    {fmt.name}
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="mb-4 self-center text-center text-xs rounded px-2 py-1 border" style={{ color: 'var(--color-text-main)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              Showing simulated pagination for {selectedFormat.name}
            </div>

            <div className="w-full flex flex-col items-center gap-8 overflow-x-hidden">
              {pagedContent.map((page, idx) => (
                <div key={`page-${idx}`} className="flex flex-col items-center gap-2">
                  <div
                    className="bg-white text-black shadow-2xl overflow-hidden"
                    style={{
                      width: `${Math.round(pageWidthPx * previewScale)}px`,
                      height: `${Math.round(selectedFormat.heightPx * previewScale)}px`,
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="w-full h-full font-serif whitespace-pre-wrap break-words"
                      style={{
                        boxSizing: 'border-box',
                        width: selectedFormat.width,
                        height: `${selectedFormat.heightPx}px`,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                        padding: previewLayout.marginCss,
                        fontSize: `${previewTypography.fontPx}px`,
                        lineHeight: previewTypography.lineHeight,
                        fontFamily: 'Merriweather, Georgia, "Times New Roman", serif',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                      }}
                    >
                      {idx === 0 && (
                        <div style={{ textAlign: 'center', marginBottom: `${previewTypography.chapterGapPx}px` }}>
                          <div style={{ fontSize: `${previewTypography.chapterLabelPx}px`, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.65, marginBottom: '0.9rem' }}>Chapter</div>
                          <div style={{ fontSize: `${previewTypography.chapterTitlePx}px`, fontWeight: 700, lineHeight: 1.2 }}>{currentChapter.title?.trim() || 'Untitled Chapter'}</div>
                        </div>
                      )}
                      {page || <span className="text-gray-400 italic">No content...</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted">Page {idx + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hidden lg:flex w-80 bg-surface border-l border-border flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-muted">Continuity Check</h3>
          <button onClick={handleAnalysis} disabled={isAnalyzing} className="text-xs bg-accent hover:brightness-110 disabled:opacity-50 text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-all">
            {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}Analyze
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {analysis.length === 0 && !isAnalyzing && (
            <div className="text-center mt-10 text-muted text-sm">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p>No issues found (or run analysis to check).</p>
            </div>
          )}

          {analysis.map((item, idx) => (
            <div key={idx} className={`p-4 rounded-lg border text-sm ${item.severity === 'error' ? 'bg-red-900/20 border-red-800 text-red-200' : item.severity === 'warning' ? 'bg-amber-900/20 border-amber-800 text-amber-200' : 'bg-blue-900/20 border-blue-800 text-blue-200'}`}>
              <div className="flex items-start gap-2 mb-1"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span className="font-semibold">{item.type?.toUpperCase?.() || 'INFO'}</span></div>
              <p className="opacity-90 leading-normal">{item.message}</p>
              {item.details && item.details.length > 0 && (
                <ul className="list-disc list-inside mt-2 text-xs opacity-75 space-y-1">
                  {item.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
