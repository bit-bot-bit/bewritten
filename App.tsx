import React, { useEffect, useMemo, useState } from 'react';
import { AppTab } from './types';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { CharacterManager } from './components/CharacterManager';
import { WorldManager } from './components/WorldManager';
import { TimelineManager } from './components/TimelineManager';
import { AIAssistant } from './components/AIAssistant';
import { ChapterRail } from './components/ChapterRail';
import { StoryList } from './components/StoryList';
import { AuthPage } from './components/AuthPage';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { SettingsPage } from './components/SettingsPage';
import {
  clearSession,
  changeCurrentUserPassword,
  createStoryForUser,
  deleteStoryForUser,
  fetchCurrentUser,
  listStories,
  saveStoryForUser,
  syncStoriesForUser,
} from './services/storyService';
import { generateId } from './utils/id';

const THEMES = {
  nexus: {
    id: 'nexus',
    colors: {
      bg: '#020617',
      surface: '#0f172a',
      card: '#1e293b',
      border: '#334155',
      textMain: '#f1f5f9',
      textMuted: '#94a3b8',
      accent: '#3b82f6',
      accentDim: 'rgba(59, 130, 246, 0.2)',
    },
  },
  grimm: {
    id: 'grimm',
    colors: {
      bg: '#1c1917',
      surface: '#292524',
      card: '#44403c',
      border: '#57534e',
      textMain: '#f5f5f4',
      textMuted: '#a8a29e',
      accent: '#d97706',
      accentDim: 'rgba(217, 119, 6, 0.2)',
    },
  },
  nebula: {
    id: 'nebula',
    colors: {
      bg: '#09090b',
      surface: '#18181b',
      card: '#27272a',
      border: '#3f3f46',
      textMain: '#e4e4e7',
      textMuted: '#a1a1aa',
      accent: '#10b981',
      accentDim: 'rgba(16, 185, 129, 0.2)',
    },
  },
};

function createFreshStory(num = 1) {
  const chapterId = generateId();
  return {
    id: generateId(),
    title: `New Story ${num}`,
    chapters: [{ id: chapterId, title: 'Chapter 1', content: '', order: 1 }],
    currentChapterId: chapterId,
    characters: [],
    locations: [],
    plotPoints: [],
  };
}

const App = () => {
  const [user, setUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [activeStoryId, setActiveStoryId] = useState('');
  const [activeTab, setActiveTab] = useState(AppTab.STORIES);
  const [currentThemeId, setCurrentThemeId] = useState('nexus');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [showToolChapters, setShowToolChapters] = useState(true);

  const activeStory = useMemo(() => stories.find((s) => s.id === activeStoryId) || stories[0] || null, [stories, activeStoryId]);

  const applyTheme = (themeId) => {
    const theme = THEMES[themeId] || THEMES.nexus;
    const root = document.documentElement;
    root.style.setProperty('--color-bg', theme.colors.bg);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-card', theme.colors.card);
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-text-main', theme.colors.textMain);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-accent-dim', theme.colors.accentDim);
  };

  useEffect(() => {
    applyTheme(currentThemeId);
  }, [currentThemeId]);

  const refreshStories = async () => {
    const rows = await listStories();
    if (!rows || rows.length === 0) {
      const created = await createStoryForUser(createFreshStory(1));
      setStories([created]);
      setActiveStoryId(created.id);
      return;
    }
    setStories(rows);
    if (!activeStoryId || !rows.find((s) => s.id === activeStoryId)) setActiveStoryId(rows[0].id);
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetchCurrentUser();
        setUser(me);
        await refreshStories();
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setIsBootstrapping(false);
      }
    };
    boot().catch(() => setIsBootstrapping(false));
  }, []);

  const handleLogin = async (sessionUser) => {
    setUser(sessionUser);
    setActiveTab(AppTab.STORIES);
    await refreshStories();
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setStories([]);
    setActiveStoryId('');
    setActiveTab(AppTab.STORIES);
  };

  const updateCurrentStory = (update) => {
    if (!activeStory) return;

    setStories((prevStories) => {
      return prevStories.map((story) => {
        if (story.id !== activeStory.id) return story;
        const next = typeof update === 'function' ? update(story) : update;
        saveStoryForUser(next).catch(() => {});
        return next;
      });
    });
  };

  const handleAddStory = async () => {
    const story = createFreshStory(stories.length + 1);
    const created = await createStoryForUser(story);
    setStories((prev) => [...prev, created]);
    setActiveStoryId(created.id);
    setActiveTab(AppTab.WRITE);
  };

  const handleDeleteStory = async (id) => {
    await deleteStoryForUser(id);
    const remaining = stories.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const fresh = await createStoryForUser(createFreshStory(1));
      setStories([fresh]);
      setActiveStoryId(fresh.id);
      setActiveTab(AppTab.WRITE);
      return;
    }
    setStories(remaining);
    if (activeStoryId === id) setActiveStoryId(remaining[0].id);
  };

  const handleSelectStory = (id) => {
    setActiveStoryId(id);
    setActiveTab(AppTab.WRITE);
  };

  const handlePasswordChange = async (currentPassword, newPassword) => {
    const updated = await changeCurrentUserPassword(currentPassword, newPassword);
    setUser((prev) => ({ ...prev, ...updated }));
  };

  const handleThemeToggle = () => {
    const ids = Object.keys(THEMES);
    const idx = ids.indexOf(currentThemeId);
    const next = ids[(idx + 1) % ids.length];
    setCurrentThemeId(next);
  };

  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => {
      syncStoriesForUser(stories).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [stories, user]);

  if (isBootstrapping) {
    return <div className="h-screen w-screen bg-background text-main flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  if (user.mustChangePassword) {
    return <ForcePasswordChange email={user.email} onSubmit={handlePasswordChange} />;
  }

  if (!activeStory) {
    return <div className="h-screen w-screen bg-background text-main flex items-center justify-center">Loading stories...</div>;
  }

  const currentTheme = THEMES[currentThemeId] || THEMES.nexus;
  const activeChapter = activeStory.chapters.find((c) => c.id === activeStory.currentChapterId) || activeStory.chapters[0];

  const renderWithChapterRail = (content) => (
    <div className="flex h-full relative">
      <ChapterRail
        chapters={activeStory.chapters}
        currentChapterId={activeStory.currentChapterId}
        onSelectChapter={(chapterId) => updateCurrentStory((s) => ({ ...s, currentChapterId: chapterId }))}
        showChapters={showToolChapters}
        onToggle={() => setShowToolChapters((v) => !v)}
      />
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-background text-main flex overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onThemeChange={handleThemeToggle} onLogout={handleLogout} userRole={user.role} />

      <main className="flex-1 relative">
        {activeTab === AppTab.STORIES && (
          <StoryList
            stories={stories}
            activeStoryId={activeStory.id}
            onSelectStory={handleSelectStory}
            onDeleteStory={handleDeleteStory}
            onAddStory={handleAddStory}
          />
        )}

        {activeTab === AppTab.WRITE && <Editor storyState={activeStory} setStoryState={updateCurrentStory} />}

        {activeTab === AppTab.CHARACTERS && (
          renderWithChapterRail(
            <CharacterManager
              characters={activeStory.characters}
              setCharacters={(updater) => updateCurrentStory((s) => ({ ...s, characters: typeof updater === 'function' ? updater(s.characters) : updater }))}
              currentChapter={activeChapter}
            />
          )
        )}

        {activeTab === AppTab.WORLD && (
          renderWithChapterRail(
            <WorldManager
              locations={activeStory.locations}
              setLocations={(updater) => updateCurrentStory((s) => ({ ...s, locations: typeof updater === 'function' ? updater(s.locations) : updater }))}
              currentChapter={activeChapter}
              chapters={activeStory.chapters}
            />
          )
        )}

        {activeTab === AppTab.PLOT && (
          renderWithChapterRail(
            <TimelineManager
              plotPoints={activeStory.plotPoints}
              setPlotPoints={(updater) => updateCurrentStory((s) => ({ ...s, plotPoints: typeof updater === 'function' ? updater(s.plotPoints) : updater }))}
              characters={activeStory.characters}
              currentChapter={activeChapter}
              currentTheme={currentTheme}
            />
          )
        )}

        {activeTab === AppTab.SETTINGS && <SettingsPage isAdmin={user.role === 'admin'} />}
      </main>

      {activeTab !== AppTab.STORIES && activeTab !== AppTab.SETTINGS && <AIAssistant storyState={activeStory} />}
    </div>
  );
};

export default App;
