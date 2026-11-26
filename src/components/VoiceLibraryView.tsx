import {
  AlertCircle,
  AudioWaveform,
  Loader2,
  Mic2,
  Play,
  Search,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { GEMINI_VOICES, VOICE_CATEGORIES } from '../data/studioCatalog';
import {
  base64WavToBlob,
  generateSpeechChunk,
  StudioApiError,
} from '../services/apiClient';
import type { PrebuiltVoiceId, VoiceCategory, VoiceProfile } from '../types/studio';
import { AudioPlayer } from './AudioPlayer';

interface VoiceLibraryViewProps {
  selectedVoiceId: PrebuiltVoiceId;
  onSelectVoiceForStudio: (voiceId: PrebuiltVoiceId) => void;
}

export const VoiceLibraryView: React.FC<VoiceLibraryViewProps> = ({
  selectedVoiceId,
  onSelectVoiceForStudio,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<VoiceCategory>('All');
  const [auditioningId, setAuditioningId] = useState<PrebuiltVoiceId | null>(null);
  const [auditionBlobs, setAuditionBlobs] = useState<Partial<Record<PrebuiltVoiceId, Blob>>>({});
  const [auditionError, setAuditionError] = useState<string | null>(null);

  const filteredVoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GEMINI_VOICES.filter((voice) => {
      const matchesCategory =
        activeCategory === 'All' ||
        voice.categories.includes(activeCategory as Exclude<VoiceCategory, 'All'>);
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        voice.name.toLowerCase().includes(q) ||
        voice.primaryRole.toLowerCase().includes(q) ||
        voice.description.toLowerCase().includes(q) ||
        voice.categories.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, activeCategory]);

  const handleAudition = async (voice: VoiceProfile) => {
    setAuditionError(null);
    setAuditioningId(voice.id);

    try {
      const res = await generateSpeechChunk({
        providerId: 'gemini',
        modelId: 'gemini-3.8-flash-tts',
        voiceId: voice.id,
        text: voice.auditionSampleText,
        scriptLanguageMode: 'telugu',
        languageCodeOverride: 'te-IN',
        lockVoiceConsistency: true,
        voiceSeed: 424242,
        useVoiceDesign: true,
        voiceDesignPrompt: voice.auditionStylePrompt,
        emotionPreset: 'Neutral',
        emotionalIntensity: 'Balanced',
        speedPreset: 'Normal',
        speakingStyleNote: '',
      });
      const blob = base64WavToBlob(res.audioBase64, res.mimeType);
      setAuditionBlobs((prev) => ({ ...prev, [voice.id]: blob }));
    } catch (err) {
      const msg =
        err instanceof StudioApiError
          ? err.message
          : 'Failed to generate voice audition sample.';
      setAuditionError(`${voice.name}: ${msg}`);
    } finally {
      setAuditioningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Voice Library</h1>
          <p className="mt-1 text-sm text-slate-400">
            Verified voices returned by Google Gemini 3.8 Speech. Combine any base voice with Voice Design prompts on Gemini 3.8 Flash TTS for custom character personas.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono-tabular whitespace-nowrap">
          {filteredVoices.length} of {GEMINI_VOICES.length} verified voices
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#12121A] p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search voices by name, role, Telugu support, or tone..."
            className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090D] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {VOICE_CATEGORIES.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`h-9 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#181822] text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {auditionError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{auditionError}</span>
        </div>
      )}

      {filteredVoices.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-10 text-center">
          <AudioWaveform className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-white">
            No prebuilt Gemini voices match &ldquo;{activeCategory}&rdquo;
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Gemini 3.8 Speech provides 9 verified prebuilt voices (Charon, Algenib, Orus, Enceladus, Umbriel, Fenrir, Puck, Kore, Zephyr). Reset filters or pair a voice with Voice Design style prompting in the Voice Studio.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All');
              setSearchQuery('');
            }}
            className="mt-4 h-10 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVoices.map((voice) => {
            const isSelected = selectedVoiceId === voice.id;
            const isLoading = auditioningId === voice.id;
            const auditionBlob = auditionBlobs[voice.id];

            return (
              <div
                key={voice.id}
                className={`flex flex-col justify-between rounded-xl border bg-[#12121A] p-5 transition-colors ${
                  isSelected ? 'border-violet-500/60' : 'border-white/[0.08]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-lg font-bold text-white">
                          {voice.name}
                        </h2>
                        <span className="text-xs text-slate-400">
                          · {voice.genderPresentation}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-violet-300 mt-0.5">
                        {voice.primaryRole}
                      </p>
                    </div>

                    {isSelected && (
                      <span className="text-xs font-semibold text-violet-300 whitespace-nowrap">
                        Active Voice
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-300">
                    {voice.description}
                  </p>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div>
                      <span className="text-slate-500">Categories:</span>{' '}
                      {voice.categories.join(' · ')}
                    </div>
                    <div>
                      <span className="text-slate-500">Languages:</span>{' '}
                      {voice.languages.join(' · ')}
                    </div>
                    <div>
                      <span className="text-slate-500">Models:</span>{' '}
                      {voice.compatibleModels.join(', ')}
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#09090D] p-3 text-xs text-slate-300 border border-white/[0.05]">
                    <div className="text-[11px] text-slate-500 mb-1">
                      Telugu Audition Line
                    </div>
                    <p className="leading-relaxed">{voice.auditionSampleText}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {auditionBlob && (
                    <AudioPlayer
                      blob={auditionBlob}
                      compact
                      downloadBaseName={`voxforge_audition_${voice.id.toLowerCase()}`}
                    />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAudition(voice)}
                      disabled={isLoading}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-[#181822] px-3 text-xs font-semibold text-white transition-colors hover:border-violet-500/40 disabled:opacity-50 whitespace-nowrap"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                          <span>Generating Sample...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 text-violet-400" />
                          <span>{auditionBlob ? 'Re-Audition' : 'Audition Telugu'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectVoiceForStudio(voice.id)}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-violet-500 whitespace-nowrap"
                    >
                      <Mic2 className="h-3.5 w-3.5" />
                      <span>Use in Studio</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
