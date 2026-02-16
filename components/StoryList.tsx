import React, { useState } from 'react';
import { Plus, Book, Trash2, ChevronRight, Info } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

export const StoryList = ({ stories, activeStoryId, onSelectStory, onDeleteStory, onAddStory }) => {
  const [storyToDelete, setStoryToDelete] = useState(null);

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

  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto h-full overflow-y-auto overflow-x-hidden">
      <ConfirmationModal
        isOpen={!!storyToDelete}
        onClose={() => setStoryToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Story?"
        message={`Are you sure you want to delete "${storyToDelete ? getStoryTitle(storyToDelete) : ''}"? This action cannot be undone.`}
      />

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

        <button onClick={onAddStory} className="bg-accent hover:brightness-110 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-accent/20 w-full md:w-auto justify-center self-stretch md:self-auto">
          <Plus size={20} />
          Create New Story
        </button>
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
              {stories.length > 1 && (
                <button onClick={(e) => handleDeleteClick(e, story.id)} className="text-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100" title="Delete Story">
                  <Trash2 size={18} />
                </button>
              )}
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

        <button onClick={onAddStory} className="rounded-2xl border-2 border-dashed border-border hover:border-muted hover:bg-card/30 flex flex-col items-center justify-center gap-4 h-64 text-muted hover:text-accent transition-all">
          <Plus size={48} className="opacity-50" />
          <span className="font-medium">Start a new journey</span>
        </button>
      </div>
    </div>
  );
};
