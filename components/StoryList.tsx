import React, { useState } from 'react';
import { Plus, Book, Trash2, ChevronRight, Info, Sparkles, X, Loader2, Upload } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { generateStoryInsights, generateStoryReview, importStoryFromText } from '../services/geminiService';
import { saveStoryForUser } from '../services/storyService';
import { generateId } from '../utils/id';

export const StoryList = ({ stories, activeStoryId, onSelectStory, onDeleteStory, onAddStory, onUpdateStory }) => {
  const [storyToDelete, setStoryToDelete] = useState(null);
  const [aiMenuStoryId, setAiMenuStoryId] = useState(null);
  const [insightsStory, setInsightsStory] = useState(null);
  const [insightsTab, setInsightsTab] = useState('review');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [insightsByStory, setInsightsByStory] = useState({});
  const [reviewGenre, setReviewGenre] = useState('');
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [versionName, setVersionName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setImportError('File is too large (max 5MB).');
      return;
    }

    setIsImporting(true);
    setImportError('');

    try {
      const text = await file.text();
      const imported = await importStoryFromText(text);

      const newStory = {
        id: generateId(),
        title: imported.title || 'Imported Story',
        chapters: (imported.chapters || []).map((ch, idx) => ({
          id: generateId(),
          title: ch.title || `Chapter ${idx + 1}`,
          content: ch.content || '',
          order: idx + 1,
        })),
        currentChapterId: '',
        characters: [],
        locations: [],
        plotPoints: [],
        plotConsensusCache: { byChapter: {}, all: { runs: [[], [], []], consensus: [] } },
        aiInsights: {},
        storyNotes: '',
        preservedVersions: [],
        genre: '',
        aiReviews: [],
      };

      if (newStory.chapters.length > 0) {
          newStory.currentChapterId = newStory.chapters[0].id;
      }

      onAddStory(newStory);
    } catch (err) {
      setImportError('Failed to import story. Please try again.');
      console.error(err);
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setStoryToDelete(id);
  };

  const confirmDelete = () => {
    if (storyToDelete) {
      onDeleteStory(storyToDelete);
      setStoryToDelete(null);
    }
  };

  const getStoryTitle = (id) => stories.find((s) => s.id === id)?.title || 'Story';
  const openInsights = async (story, tab = 'review') => {
    setInsightsStory(story);
    setInsightsTab(tab);
    setReviewGenre(String(story?.genre || ''));
    setNotesDraft(String(story?.storyNotes || ''));
    setVersionName('');
    setReviewError('');
    setInsightsError('');
    setAiMenuStoryId(null);
  };

  const updateAndPersistStory = async (updatedStory) => {
    if (!updatedStory?.id) return;
    onUpdateStory?.(updatedStory);
    await saveStoryForUser(updatedStory);
  };

  const saveGenre = async () => {
    if (!insightsStory) return;
    const normalized = String(reviewGenre || '').trim();
    const updatedStory = {
      ...insightsStory,
      genre: normalized,
    };
    setInsightsStory(updatedStory);
    await updateAndPersistStory(updatedStory);
  };

  const generateCriticalReview = async () => {
    if (!insightsStory) return;
    setIsGeneratingReview(true);
    setReviewError('');
    try {
      const storyForReview = {
        ...insightsStory,
        genre: String(reviewGenre || '').trim(),
      };
      const review = await generateStoryReview(storyForReview, storyForReview.genre || '');
      const reviewEntry = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        genre: storyForReview.genre || '',
        verdict: String(review?.verdict || ''),
        criticalReview: String(review?.criticalReview || ''),
        priorityFixes: Array.isArray(review?.priorityFixes) ? review.priorityFixes.slice(0, 8) : [],
        riskScore: Number(review?.riskScore || 0),
      };
      const existing = Array.isArray(storyForReview.aiReviews) ? storyForReview.aiReviews : [];
      const nextReviews = [reviewEntry, ...existing].slice(0, 3);
      const updatedStory = {
        ...storyForReview,
        aiReviews: nextReviews,
      };
      setInsightsStory(updatedStory);
      await updateAndPersistStory(updatedStory);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to generate critical review.');
    } finally {
      setIsGeneratingReview(false);
    }
  };

  const saveNotes = async () => {
    if (!insightsStory) return;
    const updatedStory = {
      ...insightsStory,
      storyNotes: String(notesDraft || ''),
    };
    setInsightsStory(updatedStory);
    await updateAndPersistStory(updatedStory);
  };

  const buildVersionSnapshot = (story) => {
    const snapshot = {
      title: story?.title || '',
      chapters: story?.chapters || [],
      currentChapterId: story?.currentChapterId || '',
      characters: story?.characters || [],
      locations: story?.locations || [],
      plotPoints: story?.plotPoints || [],
      plotConsensusCache: story?.plotConsensusCache || { byChapter: {}, all: { runs: [[], [], []], consensus: [] } },
      aiInsights: story?.aiInsights || {},
      genre: story?.genre || '',
      aiReviews: Array.isArray(story?.aiReviews) ? story.aiReviews.slice(0, 3) : [],
      storyNotes: String(story?.storyNotes || ''),
    };
    return JSON.parse(JSON.stringify(snapshot));
  };

  const preserveVersion = async () => {
    if (!insightsStory) return;
    const name = String(versionName || '').trim() || `Version ${new Date().toLocaleString()}`;
    const entry = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      snapshot: buildVersionSnapshot(insightsStory),
    };
    const existing = Array.isArray(insightsStory.preservedVersions) ? insightsStory.preservedVersions : [];
    const updatedStory = {
      ...insightsStory,
      preservedVersions: [entry, ...existing].slice(0, 10),
    };
    setVersionName('');
    setInsightsStory(updatedStory);
    await updateAndPersistStory(updatedStory);
  };

  const deleteVersion = async (versionId) => {
    if (!insightsStory) return;
    const existing = Array.isArray(insightsStory.preservedVersions) ? insightsStory.preservedVersions : [];
    const updatedStory = {
      ...insightsStory,
      preservedVersions: existing.filter((v) => v.id !== versionId),
    };
    setInsightsStory(updatedStory);
    await updateAndPersistStory(updatedStory);
  };

  const loadVersion = async (versionId) => {
    if (!insightsStory) return;
    const existing = Array.isArray(insightsStory.preservedVersions) ? insightsStory.preservedVersions : [];
    const version = existing.find((v) => v.id === versionId);
    if (!version?.snapshot) return;
    const snap = version.snapshot;
    const updatedStory = {
      ...insightsStory,
      title: snap.title || insightsStory.title,
      chapters: Array.isArray(snap.chapters) ? snap.chapters : insightsStory.chapters,
      currentChapterId: snap.currentChapterId || insightsStory.currentChapterId,
      characters: Array.isArray(snap.characters) ? snap.characters : insightsStory.characters,
      locations: Array.isArray(snap.locations) ? snap.locations : insightsStory.locations,
      plotPoints: Array.isArray(snap.plotPoints) ? snap.plotPoints : insightsStory.plotPoints,
      plotConsensusCache: snap.plotConsensusCache || insightsStory.plotConsensusCache,
      aiInsights: snap.aiInsights || insightsStory.aiInsights,
      genre: snap.genre ?? insightsStory.genre,
      aiReviews: Array.isArray(snap.aiReviews) ? snap.aiReviews.slice(0, 3) : insightsStory.aiReviews,
      storyNotes: String(snap.storyNotes ?? insightsStory.storyNotes ?? ''),
      preservedVersions: existing,
    };
    setInsightsStory(updatedStory);
    setReviewGenre(String(updatedStory.genre || ''));
    setNotesDraft(String(updatedStory.storyNotes || ''));
    await updateAndPersistStory(updatedStory);
  };

  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto h-full overflow-y-auto overflow-x-hidden">
      <ConfirmationModal
        isOpen={!!storyToDelete}
        onClose={() => setStoryToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Story?"
        message={`Are you sure you want to delete "${storyToDelete ? getStoryTitle(storyToDelete) : ''}"? This action cannot be undone.`}
      />

      {insightsStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setInsightsStory(null)} aria-label="Close AI insights modal" />
          <div
            className="relative w-full max-w-3xl border border-border rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)' }}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-main font-semibold flex items-center gap-2"><Sparkles size={16} />Story AI Insights</div>
                <div className="text-sm text-muted truncate">{insightsStory.title || 'Untitled Story'}</div>
              </div>
              <button onClick={() => setInsightsStory(null)} className="p-2 rounded-lg border border-border text-muted hover:text-main hover:bg-surface">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
              {[
                { id: 'review', label: 'AI Review' },
                { id: 'notes', label: 'Notes' },
                { id: 'versions', label: 'Versions' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInsightsTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors font-medium ${
                    insightsTab === tab.id
                      ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                      : 'border-border text-muted hover:text-main hover:bg-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {insightsTab === 'review' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-muted">Genre</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={reviewGenre}
                        onChange={(e) => setReviewGenre(e.target.value)}
                        placeholder="e.g. Cyberpunk Thriller"
                        className="themed-control flex-1 rounded-lg border px-3 py-2 text-main text-sm"
                      />
                      <button onClick={() => saveGenre().catch(() => {})} className="px-3 py-2 rounded-lg border border-border text-sm text-main hover:bg-surface">
                        Save Genre
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => generateCriticalReview().catch(() => {})}
                      disabled={isGeneratingReview}
                      className="px-3 py-2 rounded-lg border border-accent/40 bg-accent/15 text-accent text-sm hover:bg-accent/25 disabled:opacity-60"
                    >
                      {isGeneratingReview ? 'Reviewing...' : 'Generate Critical Review'}
                    </button>
                  </div>

                  {reviewError && <div className="text-sm text-red-300">{reviewError}</div>}

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-main">Last 3 Reviews</div>
                    {(Array.isArray(insightsStory?.aiReviews) ? insightsStory.aiReviews : []).length === 0 && (
                      <div className="text-sm text-muted">No reviews yet.</div>
                    )}
                    {(Array.isArray(insightsStory?.aiReviews) ? insightsStory.aiReviews : []).map((entry) => (
                      <div key={entry.id || entry.createdAt} className="border border-border rounded-xl p-3 bg-surface/40 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{new Date(entry.createdAt || Date.now()).toLocaleString()}</span>
                          {entry.genre ? <span className="px-2 py-0.5 rounded border border-border">{entry.genre}</span> : null}
                          {Number.isFinite(Number(entry.riskScore)) ? <span className="px-2 py-0.5 rounded border border-border">Risk {Number(entry.riskScore)}/10</span> : null}
                        </div>
                        {entry.verdict && <div className="text-sm font-semibold text-main">{entry.verdict}</div>}
                        {entry.criticalReview && <div className="text-sm text-main whitespace-pre-wrap">{entry.criticalReview}</div>}
                        {Array.isArray(entry.priorityFixes) && entry.priorityFixes.length > 0 && (
                          <ul className="list-disc pl-5 text-sm text-main space-y-1">
                            {entry.priorityFixes.map((fix, idx) => (
                              <li key={`${entry.id || 'review'}-${idx}`}>{fix}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insightsTab === 'notes' && (
                <div className="space-y-3">
                  <div className="text-sm text-muted">Private author notes for this story.</div>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="themed-control w-full rounded-lg border px-3 py-2 text-main text-sm min-h-[220px] resize-y"
                    placeholder="Write your notes here..."
                  />
                  <div>
                    <button onClick={() => saveNotes().catch(() => {})} className="px-3 py-2 rounded-lg border border-border text-sm text-main hover:bg-surface">
                      Save Notes
                    </button>
                  </div>
                </div>
              )}

              {insightsTab === 'versions' && (
                <div className="space-y-4">
                  <div className="text-sm text-muted">Preserve up to 10 story versions, then load or delete any saved version.</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={versionName}
                      onChange={(e) => setVersionName(e.target.value)}
                      placeholder="Version name (optional)"
                      className="themed-control flex-1 rounded-lg border px-3 py-2 text-main text-sm min-w-[240px]"
                    />
                    <button onClick={() => preserveVersion().catch(() => {})} className="px-3 py-2 rounded-lg border border-accent/40 bg-accent/15 text-accent text-sm hover:bg-accent/25">
                      Preserve Version
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(Array.isArray(insightsStory?.preservedVersions) ? insightsStory.preservedVersions : []).length === 0 && (
                      <div className="text-sm text-muted">No preserved versions yet.</div>
                    )}
                    {(Array.isArray(insightsStory?.preservedVersions) ? insightsStory.preservedVersions : []).map((entry) => (
                      <div key={entry.id} className="border border-border rounded-xl p-3 bg-surface/40 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-main truncate">{entry.name || 'Unnamed Version'}</div>
                          <div className="text-xs text-muted">{new Date(entry.createdAt || Date.now()).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => loadVersion(entry.id).catch(() => {})} className="px-2.5 py-1.5 rounded border border-border text-xs text-main hover:bg-surface">
                            Load
                          </button>
                          <button onClick={() => deleteVersion(entry.id).catch(() => {})} className="px-2.5 py-1.5 rounded border border-red-700/40 text-xs text-red-300 hover:bg-red-900/20">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12">
        <div className="w-full min-w-0">
          <h1 className="text-4xl font-serif font-bold text-main mb-3">My Stories</h1>
          <div className="flex flex-col md:flex-row md:items-center gap-3 min-w-0">
            <p className="text-muted max-w-xl">Manage your collection of worlds and narratives.</p>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold w-full md:w-fit min-w-0">
              <Info size={14} />
              <span className="break-words">Select a story to unlock Write, Character, and World tools</span>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stories.map((story) => (
          <div
            key={story.id}
            className={`
              relative group rounded-2xl border p-6 transition-all duration-300 flex flex-col h-64 cursor-pointer
              ${story.id === activeStoryId ? 'border-accent shadow-xl shadow-accent/10 ring-2 ring-accent/50 -translate-y-px' : 'bg-card/50 border-border hover:border-muted hover:bg-card'}
            `}
            style={story.id === activeStoryId ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
            onClick={() => onSelectStory(story.id)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${story.id === activeStoryId ? 'bg-black/10 text-inherit' : 'bg-surface text-muted'}`}>
                <Book size={24} />
              </div>
              <div className="relative flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAiMenuStoryId((prev) => (prev === story.id ? null : story.id));
                  }}
                  className="text-muted hover:text-accent p-2 rounded-lg hover:bg-accent/10 transition-colors"
                  title="AI Story Tools"
                >
                  <Plus size={18} />
                </button>
                {stories.length > 1 && (
                  <button onClick={(e) => handleDeleteClick(e, story.id)} className="text-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-colors" title="Delete Story">
                    <Trash2 size={18} />
                  </button>
                )}

                {aiMenuStoryId === story.id && (
                  <div
                    className="absolute top-10 right-0 z-20 w-44 rounded-xl border border-border shadow-xl p-2 space-y-1 backdrop-blur-sm"
                    style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openInsights(story, 'review')}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-main hover:bg-surface"
                    >
                      AI Review
                    </button>
                    <button
                      onClick={() => openInsights(story, 'versions')}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-main hover:bg-surface"
                    >
                      Versions
                    </button>
                  </div>
                )}
              </div>
            </div>

            <h3 className={`text-xl font-bold mb-2 line-clamp-1 ${story.id === activeStoryId ? 'text-inherit' : 'text-main'}`}>{story.title || 'Untitled Story'}</h3>

            <div className="flex-1">
              <p className={`text-sm mb-4 line-clamp-2 ${story.id === activeStoryId ? 'text-inherit/90' : 'text-muted'}`}>
                {story.chapters[0]?.content.substring(0, 100) || 'No content yet...'}
              </p>
            </div>

            <div className={`mt-auto flex items-center justify-between text-xs font-medium pt-4 border-t ${story.id === activeStoryId ? 'text-inherit/90 border-black/20' : 'text-muted border-border'}`}>
              <div className="flex gap-4 whitespace-nowrap">
                <span className="whitespace-nowrap">{story.chapters.length} Chapters</span>
                <span className="whitespace-nowrap">{story.characters.length} Characters</span>
              </div>
              {story.id === activeStoryId && (
                <span className="text-inherit flex items-center gap-1 whitespace-nowrap">
                  Active <ChevronRight size={12} />
                </span>
              )}
            </div>
          </div>
        ))}

        <button onClick={() => onAddStory(null)} className="rounded-2xl border-2 border-dashed border-border hover:border-muted hover:bg-card/30 flex flex-col items-center justify-center gap-4 h-64 text-muted hover:text-accent transition-all">
          <Plus size={48} className="opacity-50" />
          <span className="font-medium">Start a new journey</span>
        </button>

        <label className={`rounded-2xl border-2 border-dashed border-border hover:border-muted hover:bg-card/30 flex flex-col items-center justify-center gap-4 h-64 text-muted hover:text-accent transition-all cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
          <input type="file" accept=".txt,.md" className="hidden" onChange={handleFileImport} disabled={isImporting} />
          {isImporting ? <Loader2 size={48} className="animate-spin opacity-50" /> : <Upload size={48} className="opacity-50" />}
          <span className="font-medium">{isImporting ? 'Importing...' : 'Import from file'}</span>
          {importError && <span className="text-xs text-red-400 px-4 text-center">{importError}</span>}
        </label>
      </div>
    </div>
  );
};
