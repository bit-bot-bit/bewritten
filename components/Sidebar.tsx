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
  storyUnlocked?: boolean;
}

import { fetchCurrentUser } from '../services/storyService';

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onThemeChange, onLogout, isMobile = false, storyUnlocked = false }) => {
  const [balanceToast, setBalanceToast] = React.useState<string | null>(null);

  const showBalance = async () => {
    try {
      const user = await fetchCurrentUser();
      const balance = user.tokenBalance !== undefined && user.tokenBalance !== null ? user.tokenBalance : '∞';
      const tier = user.tier ? user.tier.toUpperCase() : 'USER';
      setBalanceToast(`${tier} | ${balance} Tokens`);
      setTimeout(() => setBalanceToast(null), 3000);
    } catch {
      // ignore
    }
  };

  const navItems = [
    { id: AppTab.WRITE, label: 'Write', icon: Feather },
    { id: AppTab.CHARACTERS, label: 'Characters', icon: Users },
    { id: AppTab.WORLD, label: 'World', icon: Map },
    { id: AppTab.PLOT, label: 'Plot Arc', icon: Activity },
    { id: AppTab.SETTINGS, label: 'Settings', icon: Settings },
  ];

  const toolsLocked = !storyUnlocked;

  if (isMobile) {
    return (
      <>
        {balanceToast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-2">
            {balanceToast}
          </div>
        )}

        <div onClick={showBalance} className="fixed top-2 left-3 z-30 text-accent bg-surface/85 backdrop-blur-xl border border-border shadow-lg rounded-xl p-2 cursor-pointer active:scale-95 transition-transform">
          <BookOpen size={22} />
        </div>

        <div className="fixed top-2 right-3 z-30 flex items-center gap-2">
          <button onClick={onThemeChange} className="p-2 rounded-xl text-muted hover:text-accent bg-surface/85 backdrop-blur-xl border border-border shadow-lg transition-colors" title="Switch Theme">
            <Palette size={18} />
          </button>
          <button onClick={onLogout} className="p-2 rounded-xl text-muted hover:text-red-400 bg-surface/85 backdrop-blur-xl border border-border shadow-lg transition-colors" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/88 backdrop-blur-xl border-t border-border shadow-[0_-8px_32px_rgba(0,0,0,0.35)] grid grid-cols-6 px-1 py-1">
          <button
            onClick={() => onTabChange(AppTab.STORIES)}
            aria-pressed={activeTab === AppTab.STORIES}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] transition-colors ${
              activeTab === AppTab.STORIES ? '' : 'text-main/85'
            }`}
            style={activeTab === AppTab.STORIES ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
          >
            <Library size={16} />
            <span className="leading-none">Stories</span>
          </button>
          {navItems.map((item) => {
            const shouldDisable = toolsLocked && item.id !== AppTab.SETTINGS;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-pressed={activeTab === item.id}
                disabled={shouldDisable}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] transition-colors ${
                  activeTab === item.id ? '' : shouldDisable ? 'text-muted opacity-35' : 'text-main/85'
                }`}
                style={activeTab === item.id ? { backgroundColor: 'var(--color-text-main)', color: 'var(--color-bg)' } : undefined}
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
    <div className="w-20 bg-surface border-r border-border flex flex-col items-center py-6 gap-6 h-screen sticky top-0 z-20 relative">
      {balanceToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/90 text-white px-3 py-1.5 rounded-md text-[10px] font-bold shadow-xl w-max pointer-events-none whitespace-nowrap">
          {balanceToast}
        </div>
      )}

      <div onClick={showBalance} className="text-accent mb-2 cursor-pointer hover:scale-105 transition-transform active:scale-95" title="Show Balance">
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
          const shouldDisable = toolsLocked && item.id !== AppTab.SETTINGS;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-pressed={activeTab === item.id}
              disabled={shouldDisable}
              title={shouldDisable ? 'Select a story first' : item.label}
              className={`
                flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200
                ${activeTab === item.id ? 'border-accent ring-2 ring-accent/50 shadow-md -translate-y-px font-semibold' : shouldDisable ? 'opacity-30 text-muted grayscale border-transparent' : 'text-muted hover:text-main hover:bg-card border-transparent'}
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
