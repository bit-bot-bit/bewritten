import React from 'react';
import { BookOpen, Users, Map, Activity, Feather, Library, Palette, LogOut, Settings } from 'lucide-react';
import { AppTab } from '../types';

interface SidebarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onThemeChange: () => void;
  onLogout: () => void;
  isMobile?: boolean;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onThemeChange, onLogout, isMobile = false }) => {
  const navItems = [
    { id: AppTab.WRITE, label: 'Write', icon: Feather },
    { id: AppTab.CHARACTERS, label: 'Characters', icon: Users },
    { id: AppTab.WORLD, label: 'World', icon: Map },
    { id: AppTab.PLOT, label: 'Plot Arc', icon: Activity },
    { id: AppTab.SETTINGS, label: 'Settings', icon: Settings },
  ];

  const isStoriesTab = activeTab === AppTab.STORIES;

  if (isMobile) {
    return (
      <>
        <div className="fixed top-2 left-3 z-30 text-accent bg-surface border border-border rounded-xl p-2">
          <BookOpen size={22} />
        </div>

        <div className="fixed top-2 right-3 z-30 flex items-center gap-2">
          <button onClick={onThemeChange} className="p-2 rounded-xl text-muted hover:text-accent bg-surface border border-border transition-colors" title="Switch Theme">
            <Palette size={18} />
          </button>
          <button onClick={onLogout} className="p-2 rounded-xl text-muted hover:text-red-400 bg-surface border border-border transition-colors" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border grid grid-cols-6 px-1 py-1">
          <button
            onClick={() => onTabChange(AppTab.STORIES)}
            aria-pressed={activeTab === AppTab.STORIES}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] ${
              activeTab === AppTab.STORIES ? 'text-accent bg-accent/10 border border-accent/40' : 'text-muted'
            }`}
          >
            <Library size={16} />
            <span className="leading-none">Stories</span>
          </button>
          {navItems.map((item) => {
            const shouldDisable = isStoriesTab && item.id !== AppTab.SETTINGS;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-pressed={activeTab === item.id}
                disabled={shouldDisable}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] ${
                  activeTab === item.id ? 'text-accent bg-accent/10 border border-accent/40' : shouldDisable ? 'text-muted opacity-30' : 'text-muted'
                }`}
              >
                <item.icon size={16} />
                <span className="leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <div className="w-20 bg-surface border-r border-border flex flex-col items-center py-6 gap-6 h-screen sticky top-0 z-20">
      <div className="text-accent mb-2">
        <BookOpen size={32} />
      </div>

      <div className="w-full px-2">
        <button
          onClick={() => onTabChange(AppTab.STORIES)}
          aria-pressed={activeTab === AppTab.STORIES}
          className={`
            w-full flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200 mb-4
            ${activeTab === AppTab.STORIES ? 'border-accent ring-2 ring-accent/50 shadow-md -translate-y-px' : 'border-transparent bg-card text-muted hover:text-main hover:bg-surface'}
          `}
          style={activeTab === AppTab.STORIES ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
        >
          <Library size={24} />
          <span className="text-[10px] font-bold tracking-wide whitespace-nowrap">Stories</span>
        </button>

        <div className="h-px w-10 mx-auto bg-border mb-4" />
      </div>

      <nav className="flex flex-col gap-4 w-full px-2 flex-1">
        {navItems.map((item) => {
          const shouldDisable = isStoriesTab && item.id !== AppTab.SETTINGS;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-pressed={activeTab === item.id}
              disabled={shouldDisable}
              title={shouldDisable ? 'Select a story first' : item.label}
              className={`
                flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200
                ${activeTab === item.id ? 'border-accent ring-2 ring-accent/50 shadow-md -translate-y-px font-semibold' : shouldDisable ? 'opacity-30 cursor-not-allowed text-muted grayscale border-transparent' : 'text-muted hover:text-main hover:bg-card border-transparent'}
              `}
              style={activeTab === item.id ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
            >
              <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span className="text-[10px] font-medium tracking-wide whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 w-full px-2">
        <button onClick={onThemeChange} className="p-3 rounded-xl text-muted hover:text-accent hover:bg-card transition-colors flex justify-center" title="Switch Theme">
          <Palette size={20} />
        </button>

        <button onClick={onLogout} className="p-3 rounded-xl text-muted hover:text-red-400 hover:bg-red-900/10 transition-colors flex justify-center" title="Sign Out">
          <LogOut size={20} />
        </button>
      </div>
    </div>
  );
};
