import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AudioHistoryView } from './components/AudioHistoryView';
import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import { ProvidersView } from './components/ProvidersView';
import { VoiceLibraryView } from './components/VoiceLibraryView';
import { VoiceStudioView } from './components/VoiceStudioView';
import { SCRIPT_SAMPLES, VOICE_DESIGN_PRESETS } from './data/studioCatalog';
import { fetchProvidersStatus } from './services/apiClient';
import { buildChunksFromText } from './services/chunkingService';
import {
  clearAudioHistory,
  createBlankProject,
  deleteAudioHistoryItem,
  deleteProject,
  duplicateProject,
  generateVoiceSeed,
  listAudioHistory,
  listProjects,
  saveAudioHistoryItem,
  saveProject,
} from './services/storageService';
import type {
  AppView,
  AudioHistoryRecord,
  PrebuiltVoiceId,
  ProjectRecord,
  ProviderStatusInfo,
} from './types/studio';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [history, setHistory] = useState<AudioHistoryRecord[]>([]);
  const [providers, setProviders] = useState<ProviderStatusInfo[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState('Saved locally');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const list = await fetchProvidersStatus();
      setProviders(list);
    } catch {
      // Keep previous state if offline
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const [loadedProjects, loadedHistory] = await Promise.all([
        listProjects().catch(() => [] as ProjectRecord[]),
        listAudioHistory().catch(() => [] as AudioHistoryRecord[]),
        loadProviders(),
      ]);

      if (!mounted) return;

      if (loadedProjects.length > 0) {
        const normalizedProjects = loadedProjects.map((p) => ({
          ...p,
          languageCodeOverride: p.languageCodeOverride ?? 'te-IN',
          lockVoiceConsistency: p.lockVoiceConsistency ?? true,
          voiceSeed: p.voiceSeed ?? generateVoiceSeed(),
        }));
        setProjects(normalizedProjects);
        setActiveProjectId(normalizedProjects[0].id);
      } else {
        const initial = createBlankProject({
          title: 'Midnight Telugu Horror Narration',
          scriptText: SCRIPT_SAMPLES[0].text,
          scriptLanguageMode: 'telugu',
        });
        const saved = await saveProject(initial).catch(() => initial);
        if (!mounted) return;
        setProjects([saved]);
        setActiveProjectId(saved.id);
      }

      setHistory(loadedHistory);
      setHydrated(true);
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [loadProviders]);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

  const scheduleAutosave = useCallback((projectToSave: ProjectRecord, immediate = false) => {
    setSaveStateLabel('Saving...');
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveProject(projectToSave);
        setSaveStateLabel('Autosaved locally');
      } catch {
        setSaveStateLabel('Local storage full');
      }
    }, immediate ? 40 : 350);
  }, []);

  const handleChangeProject = useCallback(
    (updatedOrFn: ProjectRecord | ((prev: ProjectRecord) => ProjectRecord)) => {
      setProjects((prevList) =>
        prevList.map((p) => {
          if (typeof updatedOrFn === 'function') {
            if (p.id !== activeProjectId) return p;
            const next = updatedOrFn(p);
            const hasChunkDelta = next.chunks !== p.chunks;
            scheduleAutosave(next, hasChunkDelta);
            return next;
          }
          if (p.id !== updatedOrFn.id) return p;
          scheduleAutosave(updatedOrFn, updatedOrFn.chunks !== p.chunks);
          return updatedOrFn;
        })
      );
    },
    [activeProjectId, scheduleAutosave]
  );

  const handleCreateNewProject = async () => {
    const fresh = createBlankProject({
      title: `Voiceover Project ${projects.length + 1}`,
    });
    const saved = await saveProject(fresh).catch(() => fresh);
    setProjects((prev) => [saved, ...prev]);
    setActiveProjectId(saved.id);
    setActiveView('studio');
  };

  const handleCreateFromSample = async (sampleId: string) => {
    const sample = SCRIPT_SAMPLES.find((s) => s.id === sampleId);
    if (!sample) return;
    const preset =
      VOICE_DESIGN_PRESETS.find((p) => p.id === sample.presetId) ??
      VOICE_DESIGN_PRESETS[0];

    const fresh = createBlankProject({
      title: sample.title,
      scriptText: sample.text,
      scriptLanguageMode: sample.mode,
      voiceId: sample.voiceId,
      voiceDesignPresetId: preset.id,
      voiceDesignPrompt: preset.description,
      emotionPreset: preset.defaultEmotion,
      speedPreset: preset.defaultSpeed,
      chunks: buildChunksFromText(sample.text, 600, []),
    });

    const saved = await saveProject(fresh).catch(() => fresh);
    setProjects((prev) => [saved, ...prev]);
    setActiveProjectId(saved.id);
    setActiveView('studio');
  };

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setActiveView('studio');
  };

  const handleRenameProject = async (projectId: string, nextTitle: string) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    const updated = { ...target, title: nextTitle, updatedAt: Date.now() };
    await saveProject(updated).catch(() => updated);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
  };

  const handleDuplicateProject = async (source: ProjectRecord) => {
    const copy = await duplicateProject(source);
    setProjects((prev) => [copy, ...prev]);
    setActiveProjectId(copy.id);
    setActiveView('studio');
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== projectId);
      if (activeProjectId === projectId) {
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
        } else {
          const fallback = createBlankProject();
          saveProject(fallback).catch(() => {});
          setActiveProjectId(fallback.id);
          return [fallback];
        }
      }
      return remaining;
    });
  };

  const handleUseVoice = (voiceId: PrebuiltVoiceId) => {
    if (activeProject) {
      const updated = { ...activeProject, voiceId, updatedAt: Date.now() };
      handleChangeProject(updated);
    }
    setActiveView('studio');
  };

  const handleSaveToHistory = async (entry: AudioHistoryRecord) => {
    const saved = await saveAudioHistoryItem(entry);
    setHistory((prev) => [saved, ...prev]);
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    await deleteAudioHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAudioHistory = async () => {
    await clearAudioHistory();
    setHistory([]);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090D] text-slate-300">
        <div className="text-center space-y-2">
          <div className="font-display text-xl font-bold text-white">VOXFORGE AI</div>
          <p className="text-xs text-slate-400">Initializing studio workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      activeView={activeView}
      onNavigate={setActiveView}
      onCreateNewProject={handleCreateNewProject}
      activeProjectTitle={activeProject?.title}
      providers={providers}
    >
      {activeView === 'dashboard' && (
        <DashboardView
          projects={projects}
          history={history}
          providers={providers}
          onCreateNew={handleCreateNewProject}
          onCreateFromSample={handleCreateFromSample}
          onOpenProject={handleOpenProject}
          onUseVoice={handleUseVoice}
          onOpenHistoryItem={(id) => {
            setSelectedHistoryId(id);
            setActiveView('history');
          }}
          onNavigate={setActiveView}
        />
      )}

      {activeView === 'studio' && activeProject && (
        <VoiceStudioView
          project={activeProject}
          providers={providers}
          onChangeProject={handleChangeProject}
          onDuplicateProject={handleDuplicateProject}
          onSaveToHistory={handleSaveToHistory}
          saveStateLabel={saveStateLabel}
        />
      )}

      {activeView === 'voices' && (
        <VoiceLibraryView
          selectedVoiceId={activeProject?.voiceId ?? 'Charon'}
          onSelectVoiceForStudio={handleUseVoice}
        />
      )}

      {activeView === 'projects' && (
        <ProjectsView
          projects={projects}
          activeProjectId={activeProject?.id ?? ''}
          onCreateNew={handleCreateNewProject}
          onOpenProject={handleOpenProject}
          onRenameProject={handleRenameProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
        />
      )}

      {activeView === 'history' && (
        <AudioHistoryView
          history={history}
          initialExpandedId={selectedHistoryId}
          onDeleteEntry={handleDeleteHistoryEntry}
        />
      )}

      {activeView === 'providers' && (
        <ProvidersView
          providers={providers}
          onRefreshProviders={loadProviders}
          onClearAudioHistory={handleClearAudioHistory}
        />
      )}
    </AppShell>
  );
}
