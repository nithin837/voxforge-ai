import {
  AudioWaveform,
  FolderKanban,
  History,
  LayoutDashboard,
  Mic2,
  MoreHorizontal,
  Plus,
  ServerCog,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import type { AppView, ProviderStatusInfo } from '../types/studio';

interface AppShellProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onCreateNewProject: () => void;
  activeProjectTitle?: string;
  providers: ProviderStatusInfo[];
  children: React.ReactNode;
}

const NAV_ITEMS: { id: AppView; label: string; mobileLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard },
  { id: 'studio', label: 'Voice Studio', mobileLabel: 'Studio', icon: Mic2 },
  { id: 'voices', label: 'Voice Library', mobileLabel: 'Voices', icon: AudioWaveform },
  { id: 'projects', label: 'My Projects', mobileLabel: 'Projects', icon: FolderKanban },
  { id: 'history', label: 'Audio History', mobileLabel: 'History', icon: History },
  { id: 'providers', label: 'Providers & Info', mobileLabel: 'Providers', icon: ServerCog },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeView,
  onNavigate,
  onCreateNewProject,
  activeProjectTitle,
  providers,
  children,
}) => {
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);

  const geminiProvider = providers.find((p) => p.id === 'gemini');
  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeView) ?? NAV_ITEMS[0];

  const handleMobileNav = (view: AppView) => {
    setMoreSheetOpen(false);
    onNavigate(view);
  };

  return (
    <div className="flex min-h-screen bg-[#09090D] text-[#F4F4F7]">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/[0.08] bg-[#0D0D14]">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.08]">
          {!emblemFailed ? (
            <img
              src="/src/assets/images/voice_studio_emblem_1795694208645.jpg"
              alt="VOXFORGE AI studio emblem"
              referrerPolicy="no-referrer"
              onError={() => setEmblemFailed(true)}
              className="h-9 w-9 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 shrink-0">
              <AudioWaveform className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight text-white truncate">
              VOXFORGE AI
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Give Every Story a Voice.
            </div>
          </div>
        </div>

        <div className="p-4">
          <button
            type="button"
            onClick={onCreateNewProject}
            className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-violet-400 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>New Project</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary studio navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex w-full h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600/15 text-violet-200 border border-violet-500/30'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.08] p-4 text-xs text-slate-400">
          <div className="font-medium text-slate-300">Speech Backend</div>
          <div className="mt-1 flex items-center gap-1.5 text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span className="truncate">
              {geminiProvider
                ? geminiProvider.configured
                  ? 'Gemini 3.8 TTS Ready'
                  : 'API Key Needed in Secrets'
                : 'Checking provider...'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Desktop Top Bar (3-zone contract) */}
        <header className="hidden lg:flex h-16 items-center justify-between gap-8 border-b border-white/[0.08] bg-[#09090D]/90 px-8 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display text-base font-semibold text-white whitespace-nowrap shrink-0">
              {activeNavMeta.label}
            </span>
            {activeView === 'studio' && activeProjectTitle && (
              <>
                <span className="text-slate-600" aria-hidden="true">/</span>
                <span className="text-sm text-slate-300 truncate max-w-xs">
                  {activeProjectTitle}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 whitespace-nowrap shrink-0">
            <span>
              {geminiProvider?.configured
                ? 'Gemini 3.8 Speech Connected'
                : 'Server Key Missing'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Telugu & English Ready</span>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onCreateNewProject}
              className="flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-violet-500 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Voiceover</span>
            </button>
          </div>
        </header>

        {/* Mobile Compact Top Header (52px) */}
        <header className="flex lg:hidden h-[52px] items-center justify-between gap-3 border-b border-white/[0.08] bg-[#09090D]/95 px-4 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-display text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              VOXFORGE AI
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-xs text-slate-400 truncate">
              {activeNavMeta.mobileLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onCreateNewProject}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-violet-500 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-7 lg:pb-10 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (64px) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 items-center h-16 border-t border-white/[0.08] bg-[#0D0D14]/95 backdrop-blur-md pb-safe lg:hidden"
      >
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleMobileNav(item.id)}
              className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[64px]">{item.mobileLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            activeView === 'history' || activeView === 'providers'
              ? 'text-violet-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet for Audio History & Providers */}
      {moreSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreSheetOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t border-white/[0.1] bg-[#12121A] p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base font-semibold text-white">
                Studio Menu
              </span>
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleMobileNav('history')}
                className={`flex h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium ${
                  activeView === 'history'
                    ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30'
                    : 'bg-[#181822] text-slate-200'
                }`}
              >
                <History className="h-4 w-4 text-violet-400" />
                <span>Audio History</span>
              </button>
              <button
                type="button"
                onClick={() => handleMobileNav('providers')}
                className={`flex h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium ${
                  activeView === 'providers'
                    ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30'
                    : 'bg-[#181822] text-slate-200'
                }`}
              >
                <ServerCog className="h-4 w-4 text-violet-400" />
                <span>Providers, Settings & Roadmap</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
