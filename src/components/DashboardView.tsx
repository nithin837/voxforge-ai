import {
  AlertTriangle,
  ArrowRight,
  AudioWaveform,
  Clock,
  FolderOpen,
  Mic2,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { GEMINI_MODELS, GEMINI_VOICES, SCRIPT_SAMPLES } from '../data/studioCatalog';
import { formatDuration } from '../services/audioProcessorService';
import type {
  AppView,
  AudioHistoryRecord,
  PrebuiltVoiceId,
  ProjectRecord,
  ProviderStatusInfo,
} from '../types/studio';

interface DashboardViewProps {
  projects: ProjectRecord[];
  history: AudioHistoryRecord[];
  providers: ProviderStatusInfo[];
  onCreateNew: () => void;
  onCreateFromSample: (sampleId: string) => void;
  onOpenProject: (projectId: string) => void;
  onUseVoice: (voiceId: PrebuiltVoiceId) => void;
  onOpenHistoryItem: (historyId: string) => void;
  onNavigate: (view: AppView) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  history,
  providers,
  onCreateNew,
  onCreateFromSample,
  onOpenProject,
  onUseVoice,
  onOpenHistoryItem,
  onNavigate,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const gemini = providers.find((p) => p.id === 'gemini');
  const totalAudioDuration = history.reduce((acc, item) => acc + (item.durationSec || 0), 0);
  const completedChunksTotal = projects.reduce(
    (acc, proj) => acc + proj.chunks.filter((c) => c.status === 'completed').length,
    0
  );

  return (
    <div className="space-y-8">
      {/* Missing API Key Banner */}
      {gemini && !gemini.configured && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">
                Server Speech API Key Not Configured
              </p>
              <p className="mt-0.5 text-xs text-amber-200/80">
                Add <span className="font-mono-tabular">GEMINI_API_KEY</span> in AI Studio Settings &gt; Secrets to enable live audio generation and Roman Telugu transliteration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('providers')}
            className="h-10 rounded-lg border border-amber-400/40 px-3.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 whitespace-nowrap shrink-0"
          >
            View Setup Info
          </button>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12121A]">
        {!heroImgFailed && (
          <img
            src="/src/assets/images/studio_hero_backdrop_1795694208453.jpg"
            alt="VOXFORGE AI recording studio microphone booth"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090D] via-[#09090D]/85 to-[#09090D]/50" />

        <div className="relative z-10 flex flex-col justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium tracking-wide text-violet-300">
              VOXFORGE AI · Cinematic Voice Production Studio
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
              Give Every Story a Voice.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Craft expressive Telugu Unicode, Roman Telugu, and English narrations for YouTube, horror storytelling, documentaries, and Reels—complete with resilient long-script chunking and lossless WAV or MP3 mastering.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onCreateNew}
              className="flex h-12 items-center gap-2.5 rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-violet-400 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>CREATE NEW VOICEOVER</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column Studio Statistics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4">
          <div className="text-xs text-slate-400">Saved Projects</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-white">
            {projects.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Stored locally in IndexedDB</div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4">
          <div className="text-xs text-slate-400">Generated Exports</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-white">
            {history.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {completedChunksTotal} synthesized chunks
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4">
          <div className="text-xs text-slate-400">Mastered Audio</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-white">
            {formatDuration(totalAudioDuration)}
          </div>
          <div className="mt-1 text-xs text-slate-500">24 kHz WAV &amp; 192 kbps MP3</div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4">
          <div className="text-xs text-slate-400">Active TTS Engine</div>
          <div className="mt-1.5 text-lg font-semibold text-white truncate">
            {gemini?.configured ? 'Gemini 3.8 TTS' : 'Setup Needed'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {GEMINI_VOICES.length} verified voices available
          </div>
        </div>
      </section>

      {/* Quick Start Story Templates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Quick Start Templates
          </h2>
          <button
            type="button"
            onClick={onCreateNew}
            className="text-xs font-medium text-violet-300 hover:text-violet-200 whitespace-nowrap"
          >
            Blank Canvas
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SCRIPT_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => onCreateFromSample(sample.id)}
              className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#12121A] p-4 text-left transition-colors hover:border-violet-500/40 hover:bg-[#161621]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span>{sample.voiceId} Voice</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">
                    {sample.mode === 'telugu'
                      ? 'Telugu Unicode'
                      : sample.mode === 'roman_telugu'
                        ? 'Roman Telugu'
                        : 'Mixed Telugu-English'}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-sm font-semibold text-white group-hover:text-violet-200">
                  {sample.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">
                  {sample.text}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-violet-300">
                <span>Load in Studio</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Projects & Recently Generated Audio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Recent Projects
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              View All
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="py-8 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-2 text-sm text-slate-300">No saved projects yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Start a new voiceover or pick a Telugu template above.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="mt-4 h-10 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {projects.slice(0, 4).map((proj) => {
                const completed = proj.chunks.filter((c) => c.status === 'completed').length;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => onOpenProject(proj.id)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-white/[0.02] px-2 -mx-2 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {proj.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {proj.voiceId} · {completed}/{proj.chunks.length} chunks ·{' '}
                        {new Date(proj.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-violet-300 shrink-0">
                      Open
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Recently Generated Audio */}
        <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Recently Generated Audio
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              Audio History
            </button>
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center">
              <AudioWaveform className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-2 text-sm text-slate-300">No saved audio exports yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Generated master narrations saved to history will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {history.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {item.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {item.voiceId} · {item.languageLabel} ·{' '}
                      <span className="font-mono-tabular">
                        {formatDuration(item.durationSec)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenHistoryItem(item.id)}
                    className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] bg-[#181822] px-3 text-xs font-medium text-slate-200 hover:border-violet-500/40 shrink-0"
                  >
                    <Play className="h-3 w-3" />
                    <span>Listen</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Available Voice Models & Quick Voice Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Available Voice Models
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('providers')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              Capabilities
            </button>
          </div>
          <div className="space-y-3">
            {Object.values(GEMINI_MODELS).map((model) => (
              <div
                key={model.id}
                className="border-b border-white/[0.06] pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">
                    {model.displayName}
                  </span>
                  <span className="font-mono-tabular text-xs text-slate-400 shrink-0">
                    Max {model.maxCharsPerChunk} chars/chunk
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {model.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Quick Access to Studio Voices
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('voices')}
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              Explore Library
            </button>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {GEMINI_VOICES.map((voice) => (
              <div
                key={voice.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <span>{voice.name}</span>
                    <span className="text-xs font-normal text-slate-400">
                      · {voice.genderPresentation} · {voice.primaryRole}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUseVoice(voice.id)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#181822] px-3 text-xs font-medium text-slate-200 hover:border-violet-500/40 hover:text-white shrink-0"
                >
                  <Mic2 className="h-3.5 w-3.5 text-violet-400" />
                  <span>Use</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
