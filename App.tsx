import React, { useEffect, useMemo, useState } from 'react';
import { AppTab, ThemeId } from './types';
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
  fetchUserSettings,
  fetchCurrentUser,
  listStories,
  saveUserSettings,
  saveStoryForUser,
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
  solstice: {
    id: 'solstice',
    colors: {
      bg: '#1a1307',
      surface: '#2a1d0b',
      card: '#3a2a12',
      border: '#5a4423',
      textMain: '#f7efe0',
      textMuted: '#c7b69a',
      accent: '#f59e0b',
      accentDim: 'rgba(245, 158, 11, 0.2)',
    },
  },
  fjord: {
    id: 'fjord',
    colors: {
      bg: '#07171d',
      surface: '#0f252d',
      card: '#183744',
      border: '#2b5563',
      textMain: '#e7f6fb',
      textMuted: '#9ec2ce',
      accent: '#22d3ee',
      accentDim: 'rgba(34, 211, 238, 0.2)',
    },
  },
};

const THEME_STORAGE_KEY = 'bewritten_theme_id';
const THEME_IDS = Object.keys(THEMES) as ThemeId[];

function normalizeThemeId(raw: unknown): ThemeId {
  const themeId = String(raw || '').trim() as ThemeId;
  return THEMES[themeId] ? themeId : 'nexus';
}

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
    plotConsensusCache: {
      byChapter: {},
      all: { runs: [[], [], []], consensus: [] },
    },
    genre: '',
    aiReviews: [],
  };
}

const App = () => {
  const detectMobile = () => {
    if (typeof window === 'undefined') return false;
    const ua = String(window.navigator?.userAgent || '').toLowerCase();
    const uaMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/.test(ua);
    return uaMobile || window.innerWidth < 900;
  };

  const [user, setUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [activeStoryId, setActiveStoryId] = useState('');
  const [activeTab, setActiveTab] = useState(AppTab.STORIES);
  const [storyUnlocked, setStoryUnlocked] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'nexus';
    return normalizeThemeId(window.localStorage.getItem(THEME_STORAGE_KEY));
  });
  const [themeHydratedForUser, setThemeHydratedForUser] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isMobile, setIsMobile] = useState(detectMobile);
  const [showToolChapters, setShowToolChapters] = useState(() => !detectMobile());
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [saveMessage, setSaveMessage] = useState('Saved');

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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, currentThemeId);
    }
  }, [currentThemeId]);

  useEffect(() => {
    if (!user || !themeHydratedForUser) return;
    saveUserSettings({ themeId: currentThemeId }, { keepExistingKey: true }).catch(() => {});
  }, [user, themeHydratedForUser, currentThemeId]);

  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile) setShowToolChapters(false);
  }, [isMobile]);

  const refreshStories = async () => {
    const rows = await listStories();
    if (!rows || rows.length === 0) {
      const created = await createStoryForUser(createFreshStory(1));
      setStories([created]);
      setActiveStoryId(created.id);
      setSaveState('saved');
      setSaveMessage('Saved');
      return;
    }
    const normalizedRows = rows.map((story) => ({
      ...story,
      genre: typeof story.genre === 'string' ? story.genre : '',
      aiReviews: Array.isArray(story.aiReviews) ? story.aiReviews.slice(0, 3) : [],
    }));
    setStories(normalizedRows);
    setSaveState('saved');
    setSaveMessage('Saved');
    if (!activeStoryId || !normalizedRows.find((s) => s.id === activeStoryId)) setActiveStoryId(normalizedRows[0].id);
  };

  const hydrateThemeFromUserSettings = async () => {
    try {
      const settings = await fetchUserSettings();
      const nextTheme = normalizeThemeId(settings?.themeId);
      setCurrentThemeId(nextTheme);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      }
    } catch {
      // Keep local fallback if user settings cannot be loaded.
    } finally {
      setThemeHydratedForUser(true);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetchCurrentUser();
        setUser(me);
        await hydrateThemeFromUserSettings();
        await refreshStories();
      } catch {
        clearSession();
        setUser(null);
        setThemeHydratedForUser(false);
      } finally {
        setIsBootstrapping(false);
      }
    };
    boot().catch(() => setIsBootstrapping(false));
  }, []);

  const handleLogin = async (sessionUser) => {
    setUser(sessionUser);
    setActiveTab(AppTab.STORIES);
    setStoryUnlocked(false);
    setThemeHydratedForUser(false);
    await hydrateThemeFromUserSettings();
    await refreshStories();
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setThemeHydratedForUser(false);
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
        return next;
      });
    });
    setSaveState('dirty');
    setSaveMessage('Unsaved changes');
  };

  const handleAddStory = async () => {
    const story = createFreshStory(stories.length + 1);
    const created = await createStoryForUser(story);
    setStories((prev) => [...prev, created]);
    setActiveStoryId(created.id);
    setStoryUnlocked(true);
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

  const handleUpdateStory = (updatedStory) => {
    if (!updatedStory?.id) return;
    setStories((prev) => prev.map((story) => (story.id === updatedStory.id ? updatedStory : story)));
  };

  const handleSelectStory = (id) => {
    setActiveStoryId(id);
    setStoryUnlocked(true);
    setActiveTab(AppTab.WRITE);
  };

  const handleTabChange = (tab) => {
    const isToolTab = tab === AppTab.WRITE || tab === AppTab.CHARACTERS || tab === AppTab.WORLD || tab === AppTab.PLOT;
    if (isToolTab && !storyUnlocked) return;
    setActiveTab(tab);
  };

  const handlePasswordChange = async (currentPassword, newPassword) => {
    const updated = await changeCurrentUserPassword(currentPassword, newPassword);
    setUser((prev) => ({ ...prev, ...updated }));
  };

  const handleThemeToggle = () => {
    const idx = THEME_IDS.indexOf(currentThemeId);
    const next = THEME_IDS[(idx + 1) % THEME_IDS.length] || 'nexus';
    setCurrentThemeId(next);
  };

  const handleBackupRestoreComplete = async () => {
    await refreshStories();
  };

  useEffect(() => {
    if (!user || !activeStory) return;
    if (saveState !== 'dirty') return;

    const t = window.setTimeout(async () => {
      setSaveState('saving');
      setSaveMessage('Saving...');
      try {
        await saveStoryForUser(activeStory);
        setSaveState('saved');
        setSaveMessage('Saved');
      } catch {
        setSaveState('error');
        setSaveMessage('Save failed');
      }
    }, 3000);

    return () => window.clearTimeout(t);
  }, [stories, user, activeStory, saveState]);

  useEffect(() => {
    if (!user) return;
    if (!storyUnlocked || activeTab === AppTab.STORIES) return;

    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.altKey || e.shiftKey) return;

      const target = e.target;
      const tagName = target?.tagName?.toLowerCase?.() || '';
      const isTypingField =
        tagName === 'input' ||
        tagName === 'textarea' ||
        target?.isContentEditable;
      if (isTypingField) return;

      const key = String(e.key || '');
      if (key === '1') {
        e.preventDefault();
        handleTabChange(AppTab.WRITE);
      } else if (key === '2') {
        e.preventDefault();
        handleTabChange(AppTab.CHARACTERS);
      } else if (key === '3') {
        e.preventDefault();
        handleTabChange(AppTab.WORLD);
      } else if (key === '4') {
        e.preventDefault();
        handleTabChange(AppTab.PLOT);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user, storyUnlocked, activeTab]);

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
        isMobile={isMobile}
      />
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-background text-main flex overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} onThemeChange={handleThemeToggle} onLogout={handleLogout} userRole={user.role} isMobile={isMobile} storyUnlocked={storyUnlocked} />

      <main className={`flex-1 relative overflow-x-hidden ${isMobile ? 'pt-14 pb-20' : ''}`}>
        {activeTab === AppTab.STORIES && (
          <StoryList
            stories={stories}
            activeStoryId={activeStory.id}
            onSelectStory={handleSelectStory}
            onDeleteStory={handleDeleteStory}
            onAddStory={handleAddStory}
            onUpdateStory={handleUpdateStory}
          />
        )}

        {activeTab === AppTab.WRITE && (
          <Editor storyState={activeStory} setStoryState={updateCurrentStory} saveStatus={saveMessage} />
        )}

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
              chapters={activeStory.chapters}
              plotConsensusCache={activeStory.plotConsensusCache}
              setPlotConsensusCache={(updater) =>
                updateCurrentStory((s) => ({
                  ...s,
                  plotConsensusCache: typeof updater === 'function' ? updater(s.plotConsensusCache) : updater,
                }))
              }
            />
          )
        )}

        {activeTab === AppTab.SETTINGS && (
          <SettingsPage isAdmin={user.role === 'admin'} onRestoreComplete={handleBackupRestoreComplete} />
        )}
      </main>

      {activeTab !== AppTab.STORIES && activeTab !== AppTab.SETTINGS && <AIAssistant storyState={activeStory} isMobile={isMobile} />}
    </div>
  );
};

export default App;
