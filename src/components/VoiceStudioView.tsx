import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Download,
  Eraser,
  Info,
  Layers,
  Loader2,
  Lock,
  Merge,
  Mic2,
  Play,
  Redo2,
  RefreshCw,
  Save,
  Scissors,
  Sliders,
  Sparkles,
  Square,
  Undo2,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMOTION_PRESETS,
  GEMINI_MODELS,
  GEMINI_VOICES,
  SCRIPT_SAMPLES,
  SPEED_PRESETS,
  VOCAL_TAGS,
  VOICE_DESIGN_PRESETS,
} from '../data/studioCatalog';
import {
  base64WavToBlob,
  generateSpeechChunk,
  StudioApiError,
} from '../services/apiClient';
import {
  convertAudioBlobToMp3,
  formatDuration,
  mergeAudioChunks,
  triggerBlobDownload,
} from '../services/audioProcessorService';
import {
  buildChunksFromText,
  computeScriptMetrics,
  resolveTargetChunkSize,
} from '../services/chunkingService';
import { generateVoiceSeed } from '../services/storageService';
import {
  analyzeVocalTagsInScript,
  looksLikeRomanTelugu,
} from '../services/tagCompatibilityService';
import type {
  AudioHistoryRecord,
  ChunkSizePreset,
  EmotionalIntensity,
  EmotionPreset,
  ModelId,
  PrebuiltVoiceId,
  ProjectRecord,
  ProviderStatusInfo,
  ScriptChunk,
  ScriptLanguageMode,
  SpeechLanguageOverride,
  SpeedPreset,
} from '../types/studio';
import { AudioPlayer } from './AudioPlayer';
import { TeluguOptimizationPanel } from './TeluguOptimizationPanel';

interface VoiceStudioViewProps {
  project: ProjectRecord;
  providers: ProviderStatusInfo[];
  onChangeProject: (
    updated: ProjectRecord | ((prev: ProjectRecord) => ProjectRecord)
  ) => void;
  onDuplicateProject: (project: ProjectRecord) => void;
  onSaveToHistory: (entry: AudioHistoryRecord) => Promise<void>;
  saveStateLabel: string;
}

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({
  project,
  providers,
  onChangeProject,
  onDuplicateProject,
  onSaveToHistory,
  saveStateLabel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  // Undo / Redo script stack
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // UI expandable panels (collapsible for Android ergonomics)
  const [showTeluguTools, setShowTeluguTools] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showSampleMenu, setShowSampleMenu] = useState(false);

  // Generation state
  const [isGeneratingQueue, setIsGeneratingQueue] = useState(false);
  const [activeChunkIds, setActiveChunkIds] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Voice audition state
  const [auditioning, setAuditioning] = useState(false);
  const [auditionBlob, setAuditionBlob] = useState<Blob | null>(null);

  // Combined master audio state
  const [mergingMaster, setMergingMaster] = useState(false);
  const [masterAudio, setMasterAudio] = useState<{
    wavBlob: Blob;
    durationSec: number;
    peaks: number[];
  } | null>(null);
  const [savingHistory, setSavingHistory] = useState(false);
  const [exportingMasterMp3, setExportingMasterMp3] = useState(false);

  const activeModel = GEMINI_MODELS[project.modelId] ?? GEMINI_MODELS['gemini-3.8-flash-tts'];
  const geminiProvider = providers.find((p) => p.id === 'gemini');
  const languageCodeOverride = project.languageCodeOverride ?? 'te-IN';
  const lockVoiceConsistency = project.lockVoiceConsistency ?? true;
  const voiceSeed = project.voiceSeed ?? 424242;

  const metrics = useMemo(
    () =>
      computeScriptMetrics(
        project.scriptText,
        project.speedPreset,
        project.scriptLanguageMode
      ),
    [project.scriptText, project.speedPreset, project.scriptLanguageMode]
  );

  const tagAnalysis = useMemo(
    () => analyzeVocalTagsInScript(project.scriptText, project.modelId),
    [project.scriptText, project.modelId]
  );

  const targetChunkChars = useMemo(
    () =>
      resolveTargetChunkSize(
        project.chunkSizePreset,
        project.customChunkSize,
        activeModel.maxCharsPerChunk
      ),
    [project.chunkSizePreset, project.customChunkSize, activeModel.maxCharsPerChunk]
  );

  const romanTeluguDetected = useMemo(
    () => looksLikeRomanTelugu(project.scriptText, project.scriptLanguageMode),
    [project.scriptText, project.scriptLanguageMode]
  );

  const completedChunks = useMemo(
    () => project.chunks.filter((c) => c.status === 'completed' && c.audioBlob),
    [project.chunks]
  );
  const failedChunksCount = useMemo(
    () => project.chunks.filter((c) => c.status === 'failed').length,
    [project.chunks]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Automatically merge completed chunks into the Master Narration Player
  useEffect(() => {
    let cancelled = false;
    const blobs = project.chunks
      .filter((c) => c.status === 'completed' && c.audioBlob)
      .map((c) => c.audioBlob as Blob);

    if (blobs.length === 0) {
      setMasterAudio(null);
      return;
    }

    setMergingMaster(true);
    mergeAudioChunks(blobs, {
      pauseDurationMs: project.pauseDurationMs,
      normalizeVolume: project.normalizeVolume,
    })
      .then((res) => {
        if (!cancelled) {
          setMasterAudio({
            wavBlob: res.wavBlob,
            durationSec: res.durationSec,
            peaks: res.peaks,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGlobalError('Could not merge audio segments in browser Web Audio mixer.');
        }
      })
      .finally(() => {
        if (!cancelled) setMergingMaster(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project.chunks, project.pauseDurationMs, project.normalizeVolume]);

  const updateProject = (patch: Partial<ProjectRecord>) => {
    onChangeProject((prev) => ({
      ...prev,
      ...patch,
      updatedAt: Date.now(),
    }));
  };

  const handleScriptChange = (nextText: string) => {
    if (nextText === project.scriptText) return;
    setUndoStack((prev) => [...prev.slice(-24), project.scriptText]);
    setRedoStack([]);
    updateProject({ scriptText: nextText });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, project.scriptText]);
    updateProject({ scriptText: previous });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, project.scriptText]);
    updateProject({ scriptText: next });
  };

  const handleInsertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      handleScriptChange(`${project.scriptText}${project.scriptText ? ' ' : ''}${tag} `);
      return;
    }
    const start = el.selectionStart ?? project.scriptText.length;
    const end = el.selectionEnd ?? project.scriptText.length;
    const before = project.scriptText.slice(0, start);
    const after = project.scriptText.slice(end);
    const padLeft = before && !/\s$/.test(before) ? ' ' : '';
    const padRight = after && !/^\s/.test(after) ? ' ' : '';
    const insertion = `${padLeft}${tag}${padRight}`;
    const nextText = `${before}${insertion}${after}`;
    handleScriptChange(nextText);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + insertion.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleCopyScript = async () => {
    if (!project.scriptText) return;
    try {
      await navigator.clipboard.writeText(project.scriptText);
      showToast('Script copied to clipboard');
    } catch {
      showToast('Select text manually to copy on this browser');
    }
  };

  const handlePasteScript = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        handleScriptChange(
          project.scriptText ? `${project.scriptText}\n\n${clip}` : clip
        );
        showToast('Pasted from clipboard');
      }
    } catch {
      showToast('Browser blocked automatic paste — tap inside the editor and paste directly');
    }
  };

  const handleLoadSample = (sampleId: string) => {
    const sample = SCRIPT_SAMPLES.find((s) => s.id === sampleId);
    if (!sample) return;
    const preset = VOICE_DESIGN_PRESETS.find((p) => p.id === sample.presetId) ?? VOICE_DESIGN_PRESETS[0];
    setUndoStack((prev) => [...prev.slice(-24), project.scriptText]);
    setRedoStack([]);
    const nextChunks = buildChunksFromText(sample.text, targetChunkChars, []);
    updateProject({
      title: sample.title,
      scriptText: sample.text,
      scriptLanguageMode: sample.mode,
      voiceId: sample.voiceId,
      voiceDesignPresetId: preset.id,
      voiceDesignPrompt: preset.description,
      emotionPreset: preset.defaultEmotion,
      speedPreset: preset.defaultSpeed,
      chunks: nextChunks,
    });
    setShowSampleMenu(false);
    showToast(`Loaded "${sample.title}"`);
  };

  const handlePrepareChunks = (preserveCompleted = true) => {
    if (!project.scriptText.trim()) {
      setGlobalError('Enter or paste a script before splitting into chunks.');
      return [];
    }
    setGlobalError(null);
    const nextChunks = buildChunksFromText(
      project.scriptText,
      targetChunkChars,
      preserveCompleted ? project.chunks : []
    );
    updateProject({ chunks: nextChunks });
    showToast(`Prepared ${nextChunks.length} chunk${nextChunks.length === 1 ? '' : 's'}`);
    return nextChunks;
  };

  const handleEditChunkText = (chunkId: string, nextText: string) => {
    const updated = project.chunks.map((c) =>
      c.id === chunkId
        ? {
            ...c,
            text: nextText,
            status: c.text !== nextText ? ('pending' as const) : c.status,
            audioBlob: c.text !== nextText ? undefined : c.audioBlob,
          }
        : c
    );
    updateProject({ chunks: updated });
  };

  const handleSplitChunkAtMidpoint = (chunkId: string) => {
    const idx = project.chunks.findIndex((c) => c.id === chunkId);
    if (idx === -1) return;
    const target = project.chunks[idx];
    if (target.text.trim().length < 40) return;

    const mid = Math.floor(target.text.length / 2);
    const spaceAfter = target.text.indexOf(' ', mid);
    const spaceBefore = target.text.lastIndexOf(' ', mid);
    const splitPos =
      spaceAfter !== -1 && spaceAfter - mid < 40
        ? spaceAfter
        : spaceBefore > 15
          ? spaceBefore
          : mid;

    const firstPart = target.text.slice(0, splitPos).trim();
    const secondPart = target.text.slice(splitPos).trim();
    if (!firstPart || !secondPart) return;

    const next = [...project.chunks];
    next.splice(
      idx,
      1,
      {
        id: `chunk_${Date.now()}_a_${Math.random().toString(36).slice(2, 6)}`,
        index: idx,
        text: firstPart,
        status: 'pending',
        retryCount: 0,
      },
      {
        id: `chunk_${Date.now()}_b_${Math.random().toString(36).slice(2, 6)}`,
        index: idx + 1,
        text: secondPart,
        status: 'pending',
        retryCount: 0,
      }
    );
    updateProject({
      chunks: next.map((c, i) => ({ ...c, index: i })),
    });
  };

  const handleMergeWithNextChunk = (chunkId: string) => {
    const idx = project.chunks.findIndex((c) => c.id === chunkId);
    if (idx === -1 || idx >= project.chunks.length - 1) return;
    const current = project.chunks[idx];
    const nextChunk = project.chunks[idx + 1];
    const mergedText = `${current.text.trim()} ${nextChunk.text.trim()}`;

    if (mergedText.length > activeModel.maxCharsPerChunk) {
      setGlobalError(
        `Merged chunk (${mergedText.length} chars) exceeds ${activeModel.shortLabel} limit of ${activeModel.maxCharsPerChunk} chars.`
      );
      return;
    }

    const nextList = [...project.chunks];
    nextList.splice(idx, 2, {
      id: current.id,
      index: idx,
      text: mergedText,
      status: 'pending',
      retryCount: 0,
    });
    updateProject({
      chunks: nextList.map((c, i) => ({ ...c, index: i })),
    });
  };

  const abortableSleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted || ms <= 0) {
        resolve();
        return;
      }
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        window.clearTimeout(timer);
        resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

  const synthesizeSingleChunk = async (
    chunk: ScriptChunk,
    signal: AbortSignal
  ): Promise<'completed' | 'rate_limited' | 'failed' | 'cancelled'> => {
    setActiveChunkIds((prev) => [...prev, chunk.id]);

    onChangeProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      chunks: prev.chunks.map((c) =>
        c.id === chunk.id ? { ...c, status: 'generating' as const, errorMessage: undefined } : c
      ),
    }));

    try {
      const p = projectRef.current;
      const res = await generateSpeechChunk(
        {
          providerId: p.providerId,
          modelId: p.modelId,
          voiceId: p.voiceId,
          text: chunk.text,
          scriptLanguageMode: p.scriptLanguageMode,
          languageCodeOverride: p.languageCodeOverride ?? 'te-IN',
          lockVoiceConsistency: p.lockVoiceConsistency !== false,
          voiceSeed: p.voiceSeed ?? 424242,
          useVoiceDesign: p.useVoiceDesign,
          voiceDesignPrompt: p.voiceDesignPrompt,
          emotionPreset: p.emotionPreset,
          emotionalIntensity: p.emotionalIntensity,
          speedPreset: p.speedPreset,
          speakingStyleNote: p.speakingStyleNote,
        },
        signal
      );

      const audioBlob = base64WavToBlob(res.audioBase64, res.mimeType);

      onChangeProject((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        chunks: prev.chunks.map((c) =>
          c.id === chunk.id
            ? {
                ...c,
                status: 'completed' as const,
                audioBlob,
                errorMessage: undefined,
                errorCode: undefined,
                lastGeneratedAt: Date.now(),
                appliedTagsSummary: res.tagReport.warnings,
              }
            : c
        ),
      }));
      return 'completed';
    } catch (err) {
      const apiErr =
        err instanceof StudioApiError
          ? err
          : new StudioApiError(
              err instanceof Error ? err.message : 'Chunk generation failed.',
              'GENERATION_FAILED',
              true,
              0
            );

      const wasCancelled = signal.aborted;
      onChangeProject((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        chunks: prev.chunks.map((c) =>
          c.id === chunk.id
            ? {
                ...c,
                status: wasCancelled ? ('pending' as const) : ('failed' as const),
                errorMessage: wasCancelled ? undefined : apiErr.message,
                errorCode: wasCancelled ? undefined : apiErr.code,
                retryCount: wasCancelled ? c.retryCount : c.retryCount + 1,
              }
            : c
        ),
      }));

      if (!wasCancelled && (apiErr.code === 'MISSING_API_KEY' || apiErr.code === 'INVALID_API_KEY')) {
        setGlobalError(apiErr.message);
        abortControllerRef.current?.abort();
      }
      if (wasCancelled) return 'cancelled';
      if (apiErr.code === 'RATE_LIMIT' || apiErr.code === 'MODEL_UNAVAILABLE') {
        return 'rate_limited';
      }
      return 'failed';
    } finally {
      setActiveChunkIds((prev) => prev.filter((id) => id !== chunk.id));
    }
  };

  const runQueue = async (mode: 'pending_and_failed' | 'failed_only' | 'all') => {
    if (isGeneratingQueue) return;
    setGlobalError(null);

    let workingChunks = projectRef.current.chunks;
    const textChangedSignificantly =
      workingChunks.length === 0 ||
      (mode === 'all' &&
        workingChunks.map((c) => c.text).join('\n') !== project.scriptText.trim());

    if (workingChunks.length === 0 || textChangedSignificantly) {
      workingChunks = buildChunksFromText(
        project.scriptText,
        targetChunkChars,
        mode === 'all' ? [] : projectRef.current.chunks
      );
      updateProject({ chunks: workingChunks });
    }

    if (workingChunks.length === 0) {
      setGlobalError('Please enter a script before generating speech.');
      return;
    }

    const targets = workingChunks.filter((c) => {
      if (mode === 'all') return true;
      if (mode === 'failed_only') return c.status === 'failed';
      return c.status !== 'completed';
    });

    if (targets.length === 0) {
      showToast('All chunks are already generated');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGeneratingQueue(true);

    try {
      const concurrency = projectRef.current.parallelChunks ? 2 : 1;
      let cursor = 0;

      const worker = async () => {
        while (cursor < targets.length && !controller.signal.aborted) {
          const item = targets[cursor];
          cursor += 1;
          let outcome = await synthesizeSingleChunk(item, controller.signal);

          if (outcome === 'rate_limited' && !controller.signal.aborted) {
            showToast('Provider rate limit hit — cooling down 15s and retrying chunk...');
            await abortableSleep(15_000, controller.signal);
            if (!controller.signal.aborted) {
              outcome = await synthesizeSingleChunk(item, controller.signal);
            }
            if (outcome === 'rate_limited' && !controller.signal.aborted) {
              setGlobalError(
                'Gemini TTS rate limit reached. All completed chunks have been preserved — wait 20–30 seconds and click Resume Remaining.'
              );
              break;
            }
          }

          if (concurrency === 1 && cursor < targets.length && !controller.signal.aborted) {
            await abortableSleep(1200, controller.signal);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, targets.length) }, () => worker())
      );
    } finally {
      setIsGeneratingQueue(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerateSingleChunk = async (chunk: ScriptChunk) => {
    if (isGeneratingQueue) return;
    setGlobalError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGeneratingQueue(true);
    try {
      await synthesizeSingleChunk(chunk, controller.signal);
    } finally {
      setIsGeneratingQueue(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelQueue = () => {
    abortControllerRef.current?.abort();
    showToast('Generation stopped — completed chunks preserved');
  };

  const handleAuditionActiveVoice = async () => {
    const voice = GEMINI_VOICES.find((v) => v.id === project.voiceId) ?? GEMINI_VOICES[0];
    setAuditioning(true);
    setGlobalError(null);
    try {
      const res = await generateSpeechChunk({
        providerId: 'gemini',
        modelId: project.modelId,
        voiceId: voice.id,
        text: voice.auditionSampleText,
        scriptLanguageMode: 'telugu',
        languageCodeOverride: 'te-IN',
        lockVoiceConsistency,
        voiceSeed,
        useVoiceDesign: project.useVoiceDesign,
        voiceDesignPrompt: project.voiceDesignPrompt || voice.auditionStylePrompt,
        emotionPreset: project.emotionPreset,
        emotionalIntensity: project.emotionalIntensity,
        speedPreset: project.speedPreset,
        speakingStyleNote: project.speakingStyleNote,
      });
      setAuditionBlob(base64WavToBlob(res.audioBase64, res.mimeType));
    } catch (err) {
      setGlobalError(
        err instanceof StudioApiError ? err.message : 'Failed to audition voice.'
      );
    } finally {
      setAuditioning(false);
    }
  };

  const handleSaveMasterToHistory = async (format: 'wav' | 'mp3') => {
    if (!masterAudio) return;
    setSavingHistory(true);
    try {
      const blobToSave =
        format === 'mp3'
          ? await convertAudioBlobToMp3(masterAudio.wavBlob)
          : masterAudio.wavBlob;

      const entry: AudioHistoryRecord = {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: `${project.title || 'Narration'} (${format.toUpperCase()})`,
        projectId: project.id,
        projectTitle: project.title || 'Untitled Project',
        createdAt: Date.now(),
        voiceId: project.voiceId,
        modelId: project.modelId,
        languageLabel: metrics.detectedScriptLabel,
        durationSec: masterAudio.durationSec,
        format,
        sizeBytes: blobToSave.size,
        audioBlob: blobToSave,
      };
      await onSaveToHistory(entry);
      showToast(`Saved ${format.toUpperCase()} master to Audio History`);
    } catch {
      setGlobalError('Could not save master audio to local IndexedDB history.');
    } finally {
      setSavingHistory(false);
    }
  };

  const handleDownloadMasterMp3 = async () => {
    if (!masterAudio) return;
    setExportingMasterMp3(true);
    try {
      const mp3Blob = await convertAudioBlobToMp3(masterAudio.wavBlob);
      const safeName = (project.title || 'voxforge_master')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .toLowerCase();
      triggerBlobDownload(mp3Blob, `${safeName}_master.mp3`);
    } catch {
      setGlobalError('MP3 encoding failed for the merged audio.');
    } finally {
      setExportingMasterMp3(false);
    }
  };

  const progressPct =
    project.chunks.length > 0
      ? Math.round((completedChunks.length / project.chunks.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Studio Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex items-center gap-2 rounded-xl border border-violet-500/40 bg-[#181824] px-4 py-3 text-xs font-medium text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Missing API Key Warning */}
      {geminiProvider && !geminiProvider.configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-100">
              GEMINI_API_KEY is not configured.
            </span>{' '}
            You can write, chunk, and save scripts now, and configure <span className="font-mono-tabular">GEMINI_API_KEY</span> in AI Studio Settings &gt; Secrets when ready to synthesize speech.
          </div>
        </div>
      )}

      {/* Global Error Alert */}
      {globalError && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-rose-300 hover:text-white shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Project Title & Autosave Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#12121A] p-4">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={project.title}
            onChange={(e) => updateProject({ title: e.target.value })}
            aria-label="Project title"
            placeholder="Project Title..."
            className="w-full bg-transparent font-display text-lg font-bold text-white placeholder:text-slate-500 focus:outline-none"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{saveStateLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{activeModel.shortLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Voice: {project.voiceId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Undo script change"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-white disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Redo script change"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-white disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateProject(project)}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#181822] px-3 text-xs font-medium text-slate-200 hover:border-violet-500/40 whitespace-nowrap"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Duplicate</span>
          </button>
        </div>
      </section>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Script Editor + Telugu Optimizer + Chunking Queue */}
        <div className="xl:col-span-7 space-y-6">
          {/* Script Editor */}
          <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Language Mode Segmented Control */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#09090D] p-1 border border-white/[0.06]">
                {(
                  [
                    { id: 'auto', label: 'Auto Detect' },
                    { id: 'telugu', label: 'Telugu Script' },
                    { id: 'roman_telugu', label: 'Roman Telugu' },
                    { id: 'english', label: 'English' },
                  ] as { id: ScriptLanguageMode; label: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => updateProject({ scriptLanguageMode: mode.id })}
                    className={`h-8 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      project.scriptLanguageMode === mode.id
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Editor Utility Actions */}
              <div className="flex items-center gap-1.5 relative">
                <button
                  type="button"
                  onClick={() => setShowSampleMenu((v) => !v)}
                  className="h-9 rounded-lg border border-white/[0.08] bg-[#181822] px-3 text-xs font-medium text-slate-200 hover:border-violet-500/40 whitespace-nowrap"
                >
                  Samples
                </button>
                {showSampleMenu && (
                  <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-white/[0.1] bg-[#161621] p-2 shadow-2xl">
                    {SCRIPT_SAMPLES.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleLoadSample(sample.id)}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-violet-600/20 hover:text-white"
                      >
                        <div className="font-semibold">{sample.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {sample.voiceId} · {sample.mode}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopyScript}
                  aria-label="Copy script"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handlePasteScript}
                  aria-label="Paste script"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-white"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleScriptChange('')}
                  aria-label="Clear script"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-rose-300"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Expressive Vocal Tags Quick Toolbar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Insert Vocal Cue</span>
                <span className="text-[11px] text-slate-500">
                  {activeModel.supportsNativeVocalTags
                    ? 'Native bursts supported on 3.8 Flash TTS'
                    : '3.8 Flash Lite adapts/strips vocal tags'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {VOCAL_TAGS.map((t) => {
                  const status =
                    project.modelId === 'gemini-3.8-flash-tts'
                      ? t.flashTtsSupport
                      : t.liteTtsSupport;
                  return (
                    <button
                      key={t.tag}
                      type="button"
                      title={t.adaptationNote}
                      onClick={() => handleInsertTag(t.tag)}
                      className={`h-8 rounded-lg border px-2.5 text-xs font-mono-tabular transition-colors whitespace-nowrap ${
                        status === 'native'
                          ? 'border-violet-500/30 bg-violet-600/10 text-violet-200 hover:bg-violet-600/25'
                          : status === 'adapted'
                            ? 'border-white/[0.08] bg-[#181822] text-slate-300 hover:border-amber-500/40'
                            : 'border-white/[0.06] bg-[#121218] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {t.tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Script Textarea */}
            <textarea
              ref={textareaRef}
              value={project.scriptText}
              onChange={(e) => handleScriptChange(e.target.value)}
              rows={9}
              placeholder="Write or paste your Telugu Unicode (తెలుగు), Roman Telugu (e.g. Aa ratri oka chinna shabdam...), or English narration script here..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090D] p-4 text-base leading-relaxed text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none resize-y min-h-[200px]"
            />

            {/* Vocal Tag Compatibility Advisory */}
            {tagAnalysis.advisoryMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{tagAnalysis.advisoryMessage}</span>
              </div>
            )}

            {/* Script Telemetry Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-tabular">
                <span>{metrics.words} words</span>
                <span aria-hidden="true">·</span>
                <span>
                  {metrics.characters} chars (Chunk limit: {activeModel.maxCharsPerChunk}/req)
                </span>
                <span aria-hidden="true">·</span>
                <span>Est. {formatDuration(metrics.estimatedSeconds)}</span>
              </div>
              <div className="text-slate-300">{metrics.detectedScriptLabel}</div>
            </div>

            {/* Toggle Telugu Optimizer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowTeluguTools((v) => !v)}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#181822] px-3.5 text-xs font-medium text-violet-200 hover:border-violet-500/40"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span>
                  {showTeluguTools
                    ? 'Hide Telugu Optimizer & Pronunciation Tester'
                    : romanTeluguDetected
                      ? 'Roman Telugu Detected · Open Unicode Converter & Pronunciation Test'
                      : 'Open Telugu Optimizer & Pronunciation Test'}
                </span>
                {showTeluguTools ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </section>

          {/* Telugu Language Optimization Panel */}
          {(showTeluguTools || romanTeluguDetected) && (
            <TeluguOptimizationPanel
              scriptText={project.scriptText}
              scriptLanguageMode={project.scriptLanguageMode}
              languageCodeOverride={languageCodeOverride}
              lockVoiceConsistency={lockVoiceConsistency}
              voiceSeed={voiceSeed}
              transliteratedPreview={project.transliteratedPreview}
              modelId={project.modelId}
              voiceId={project.voiceId}
              useVoiceDesign={project.useVoiceDesign}
              voiceDesignPrompt={project.voiceDesignPrompt}
              onUpdatePreview={(val) => updateProject({ transliteratedPreview: val })}
              onApplyTransliteration={(teluguText) => {
                handleScriptChange(teluguText);
                updateProject({
                  scriptLanguageMode: 'telugu',
                  languageCodeOverride: 'te-IN',
                });
                showToast('Applied Telugu Unicode script with te-IN pronunciation lock');
              }}
            />
          )}

          {/* Long Script Chunking & Generation Engine */}
          <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Long Script Chunking Engine
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically splits at paragraph &amp; sentence boundaries preserving Telugu Unicode and punctuation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handlePrepareChunks(true)}
                disabled={isGeneratingQueue || !project.scriptText.trim()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181822] px-3.5 text-xs font-semibold text-white hover:border-violet-500/40 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Layers className="h-3.5 w-3.5 text-violet-400" />
                <span>Split / Refresh Chunks</span>
              </button>
            </div>

            {/* Chunk Size Presets & Execution Mode */}
            <div className="flex flex-col gap-3 rounded-lg bg-[#09090D] p-3 border border-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 mr-1">Target Size:</span>
                  {(
                    [
                      { id: 'short', label: 'Short (300)' },
                      { id: 'medium', label: 'Medium (600)' },
                      { id: 'long', label: 'Long (1000)' },
                      { id: 'custom', label: 'Custom' },
                    ] as { id: ChunkSizePreset; label: string }[]
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateProject({ chunkSizePreset: preset.id })}
                      className={`h-8 rounded-md px-2.5 text-xs font-medium whitespace-nowrap ${
                        project.chunkSizePreset === preset.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#161621] text-slate-300 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}

                  {project.chunkSizePreset === 'custom' && (
                    <input
                      type="number"
                      min={120}
                      max={activeModel.maxCharsPerChunk - 100}
                      step={50}
                      value={project.customChunkSize}
                      onChange={(e) =>
                        updateProject({
                          customChunkSize: Math.max(
                            120,
                            Math.min(activeModel.maxCharsPerChunk - 100, Number(e.target.value) || 600)
                          ),
                        })
                      }
                      aria-label="Custom chunk character limit"
                      className="h-8 w-24 rounded-md border border-violet-500/40 bg-[#161621] px-2 font-mono-tabular text-xs text-white focus:outline-none"
                    />
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={project.parallelChunks}
                    onChange={(e) => updateProject({ parallelChunks: e.target.checked })}
                    className="h-4 w-4 accent-violet-600 rounded"
                  />
                  <span>
                    Parallel 2x{' '}
                    <span className="text-slate-500">
                      (sequential recommended for 3.8 Flash TTS)
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Generation Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => runQueue('pending_and_failed')}
                disabled={isGeneratingQueue || !project.scriptText.trim()}
                className="flex h-12 flex-1 min-w-[200px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50 whitespace-nowrap"
              >
                {isGeneratingQueue ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Generating ({completedChunks.length}/{project.chunks.length})...
                    </span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    <span>
                      {completedChunks.length > 0 && completedChunks.length < project.chunks.length
                        ? `Resume Remaining (${project.chunks.length - completedChunks.length} left)`
                        : completedChunks.length > 0
                          ? `All ${completedChunks.length} Chunks Ready`
                          : 'Generate AI Voiceover'}
                    </span>
                  </>
                )}
              </button>

              {!isGeneratingQueue &&
                project.chunks.length > 0 &&
                completedChunks.length === project.chunks.length && (
                  <button
                    type="button"
                    onClick={() => runQueue('all')}
                    className="flex h-12 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#181822] px-4 text-xs font-semibold text-slate-200 hover:border-violet-500/40 whitespace-nowrap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Regenerate All</span>
                  </button>
                )}

              {isGeneratingQueue && (
                <button
                  type="button"
                  onClick={handleCancelQueue}
                  className="flex h-12 items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 whitespace-nowrap"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              )}

              {!isGeneratingQueue && failedChunksCount > 0 && (
                <button
                  type="button"
                  onClick={() => runQueue('failed_only')}
                  className="flex h-12 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Failed ({failedChunksCount})</span>
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {project.chunks.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-400">
                  <span>
                    Completed {completedChunks.length} of {project.chunks.length} chunks
                    {failedChunksCount > 0 ? ` · ${failedChunksCount} failed` : ''}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#09090D]">
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Chunk List */}
            {project.chunks.length > 0 && (
              <div className="space-y-3 pt-2">
                {project.chunks.map((chunk, idx) => {
                  const isBusy = activeChunkIds.includes(chunk.id);
                  return (
                    <div
                      key={chunk.id}
                      className={`rounded-xl border p-3.5 space-y-3 ${
                        chunk.status === 'failed'
                          ? 'border-rose-500/40 bg-rose-950/10'
                          : chunk.status === 'completed'
                            ? 'border-emerald-500/25 bg-[#0E0E15]'
                            : 'border-white/[0.07] bg-[#0E0E15]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono-tabular font-semibold text-white">
                            Chunk {idx + 1} / {project.chunks.length}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="font-mono-tabular text-slate-400">
                            {chunk.text.length} chars
                          </span>
                          <span className="text-slate-500">·</span>
                          <span
                            className={
                              chunk.status === 'completed'
                                ? 'text-emerald-300'
                                : chunk.status === 'failed'
                                  ? 'text-rose-300'
                                  : isBusy
                                    ? 'text-violet-300'
                                    : 'text-slate-400'
                            }
                          >
                            {isBusy
                              ? 'Synthesizing...'
                              : chunk.status === 'completed'
                                ? 'Ready'
                                : chunk.status === 'failed'
                                  ? 'Failed'
                                  : 'Pending'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSplitChunkAtMidpoint(chunk.id)}
                            disabled={isGeneratingQueue || chunk.text.length < 40}
                            title="Split chunk in half"
                            className="flex h-8 items-center gap-1 rounded-md border border-white/[0.08] bg-[#181822] px-2 text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
                          >
                            <Scissors className="h-3 w-3" />
                            <span>Split</span>
                          </button>

                          {idx < project.chunks.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMergeWithNextChunk(chunk.id)}
                              disabled={isGeneratingQueue}
                              title="Merge with next chunk"
                              className="flex h-8 items-center gap-1 rounded-md border border-white/[0.08] bg-[#181822] px-2 text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
                            >
                              <Merge className="h-3 w-3" />
                              <span>Merge</span>
                            </button>
                          )}

                          {project.chunks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = project.chunks
                                  .filter((c) => c.id !== chunk.id)
                                  .map((c, i) => ({ ...c, index: i }));
                                updateProject({ chunks: remaining });
                              }}
                              disabled={isGeneratingQueue}
                              title="Remove chunk"
                              className="flex h-8 items-center gap-1 rounded-md border border-white/[0.08] bg-[#181822] px-2 text-[11px] text-slate-400 hover:text-rose-300 disabled:opacity-40"
                            >
                              <span>Remove</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRegenerateSingleChunk(chunk)}
                            disabled={isGeneratingQueue || !chunk.text.trim()}
                            className="flex h-8 items-center gap-1 rounded-md bg-violet-600/20 border border-violet-500/30 px-2.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-600/35 disabled:opacity-40 whitespace-nowrap"
                          >
                            <RefreshCw className={`h-3 w-3 ${isBusy ? 'animate-spin' : ''}`} />
                            <span>
                              {chunk.status === 'failed'
                                ? 'Retry'
                                : chunk.status === 'completed'
                                  ? 'Regenerate'
                                  : 'Generate'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={chunk.text}
                        onChange={(e) => handleEditChunkText(chunk.id, e.target.value)}
                        rows={3}
                        disabled={isBusy}
                        aria-label={`Chunk ${idx + 1} text`}
                        className="w-full rounded-lg border border-white/[0.06] bg-[#09090D] p-2.5 text-sm leading-relaxed text-slate-200 focus:border-violet-500 focus:outline-none"
                      />

                      {chunk.errorMessage && (
                        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/25 p-2.5 text-xs text-rose-200">
                          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>{chunk.errorMessage}</span>
                        </div>
                      )}

                      {chunk.appliedTagsSummary && chunk.appliedTagsSummary.length > 0 && (
                        <p className="text-[11px] text-amber-300/90">
                          {chunk.appliedTagsSummary.join(' ')}
                        </p>
                      )}

                      {chunk.audioBlob && (
                        <AudioPlayer
                          blob={chunk.audioBlob}
                          compact
                          downloadBaseName={`${project.title.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase()}_chunk_${idx + 1}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Voice Selection + Voice Design + Advanced Controls + Master Export */}
        <div className="xl:col-span-5 space-y-6">
          {/* Voice Selection */}
          <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Mic2 className="h-4 w-4 text-violet-400" />
                  <h2 className="font-display text-base font-semibold text-white">
                    Voice Selection
                  </h2>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {GEMINI_VOICES.length} verified voices · 6 deep &amp; cinematic male narrators
                </p>
              </div>

              <button
                type="button"
                onClick={handleAuditionActiveVoice}
                disabled={auditioning}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181822] px-3 text-xs font-medium text-violet-200 hover:border-violet-500/40 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {auditioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Auditioning...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Audition Voice</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {GEMINI_VOICES.map((voice) => {
                const selected = project.voiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => updateProject({ voiceId: voice.id })}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-violet-500/60 bg-violet-600/10'
                        : 'border-white/[0.07] bg-[#0E0E15] hover:border-white/[0.18]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span>{voice.name}</span>
                        <span className="text-xs font-normal text-slate-400">
                          · {voice.genderPresentation} · {voice.primaryRole}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {voice.description}
                      </p>
                    </div>
                    {selected && (
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {auditionBlob && (
              <AudioPlayer
                blob={auditionBlob}
                compact
                title={`${project.voiceId} Audition`}
                downloadBaseName={`audition_${project.voiceId.toLowerCase()}`}
              />
            )}
          </section>

          {/* Voice Design Persona Studio */}
          <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Voice Design &amp; Cinematic Style
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prompt custom tone, pacing, and emotional texture (powered by Gemini 3.8 Flash TTS).
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={project.useVoiceDesign}
                  disabled={!activeModel.supportsVoiceDesign}
                  onChange={(e) => updateProject({ useVoiceDesign: e.target.checked })}
                  className="h-4 w-4 accent-violet-600 rounded"
                />
                <span>Enable</span>
              </label>
            </div>

            {!activeModel.supportsVoiceDesign && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <p>
                  Custom Voice Design prompting is not supported on Gemini 3.8 Flash Lite TTS. Switch to Gemini 3.8 Flash TTS to unlock persona prompting.
                </p>
                <button
                  type="button"
                  onClick={() => updateProject({ modelId: 'gemini-3.8-flash-tts', useVoiceDesign: true })}
                  className="self-start rounded-md bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
                >
                  Switch to 3.8 Flash TTS
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {VOICE_DESIGN_PRESETS.map((preset) => {
                const active = project.voiceDesignPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!activeModel.supportsVoiceDesign}
                    onClick={() =>
                      updateProject({
                        voiceDesignPresetId: preset.id,
                        voiceDesignPrompt: preset.description,
                        voiceId: preset.recommendedVoice,
                        emotionPreset: preset.defaultEmotion,
                        speedPreset: preset.defaultSpeed,
                        useVoiceDesign: true,
                      })
                    }
                    className={`h-8 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                      active
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#181822] text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={project.voiceDesignPrompt}
              onChange={(e) => updateProject({ voiceDesignPrompt: e.target.value })}
              disabled={!activeModel.supportsVoiceDesign || !project.useVoiceDesign}
              rows={4}
              placeholder="Describe vocal timbre, bass depth, pacing, and Telugu pronunciation style..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090D] p-3 text-xs leading-relaxed text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-500">
              Note: Style descriptions shape delivery tone, pacing, and vocal texture around your selected base voice ({project.voiceId}); they do not clone a separate person&apos;s identity.
            </p>
          </section>

          {/* Advanced Voice Controls (Collapsible on Mobile) */}
          <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvancedControls((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-violet-400" />
                <span className="font-display text-base font-semibold text-white">
                  Advanced Voice &amp; Mixing Controls
                </span>
              </div>
              <span className="text-slate-400">
                {showAdvancedControls ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            <div className={`${showAdvancedControls ? 'block' : 'hidden xl:block'} space-y-4 pt-1`}>
              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  TTS Model
                </label>
                <select
                  value={project.modelId}
                  onChange={(e) => updateProject({ modelId: e.target.value as ModelId })}
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090D] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="gemini-3.8-flash-tts">
                    Gemini 3.8 Flash TTS (Voice Design &amp; Vocal Tags)
                  </option>
                  <option value="gemini-3.8-flash-lite-tts">
                    Gemini 3.8 Flash Lite TTS (Fast General Narration)
                  </option>
                </select>
              </div>

              {/* Verified Speech Language Target (speechConfig.languageCode) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">
                    Speech Pronunciation Target
                  </span>
                  <span className="font-mono-tabular text-[11px] text-violet-300">
                    {languageCodeOverride}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'te-IN', label: 'Telugu (te-IN)' },
                      { id: 'auto', label: 'Auto Detect' },
                      { id: 'en-US', label: 'English (en-US)' },
                    ] as { id: SpeechLanguageOverride; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateProject({ languageCodeOverride: opt.id })}
                      className={`h-9 rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        languageCodeOverride === opt.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#09090D] border border-white/[0.07] text-slate-300 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Cross-Chunk Voice Identity Seed Lock */}
              <div className="rounded-lg border border-white/[0.07] bg-[#09090D] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockVoiceConsistency}
                      onChange={(e) =>
                        updateProject({ lockVoiceConsistency: e.target.checked })
                      }
                      className="h-4 w-4 accent-violet-600 rounded"
                    />
                    <span>Lock Voice Identity Across Chunks</span>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      Seed {lockVoiceConsistency ? voiceSeed : 'Off'}
                    </span>
                    <button
                      type="button"
                      disabled={!lockVoiceConsistency}
                      onClick={() => updateProject({ voiceSeed: generateVoiceSeed() })}
                      title="Generate a fresh deterministic voice seed"
                      className="flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-[#161621] px-2 text-[11px] font-medium text-slate-300 hover:text-white disabled:opacity-40 whitespace-nowrap"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>New Seed</span>
                    </button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Fixes Gemini&apos;s generation seed and vocal continuity anchor so pitch floor and voice texture remain consistent across split chunks.
                </p>
              </div>

              {/* Emotion & Intensity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Emotion Preset
                  </label>
                  <select
                    value={project.emotionPreset}
                    onChange={(e) =>
                      updateProject({ emotionPreset: e.target.value as EmotionPreset })
                    }
                    className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090D] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {EMOTION_PRESETS.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Emotional Intensity
                  </label>
                  <select
                    value={project.emotionalIntensity}
                    onChange={(e) =>
                      updateProject({
                        emotionalIntensity: e.target.value as EmotionalIntensity,
                      })
                    }
                    className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#09090D] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value="Subtle">Subtle</option>
                    <option value="Balanced">Balanced</option>
                    <option value="Intense">Intense</option>
                  </select>
                </div>
              </div>

              {/* Speaking Speed */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Speaking Speed Guidance
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {SPEED_PRESETS.map((sp) => (
                    <button
                      key={sp.label}
                      type="button"
                      onClick={() => updateProject({ speedPreset: sp.label as SpeedPreset })}
                      className={`h-9 rounded-lg px-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        project.speedPreset === sp.label
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#09090D] border border-white/[0.07] text-slate-300 hover:text-white'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Speaking Style Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Extra Delivery Cue (Optional)
                </label>
                <input
                  type="text"
                  value={project.speakingStyleNote}
                  onChange={(e) => updateProject({ speakingStyleNote: e.target.value })}
                  placeholder="e.g., Pause slightly before names, warm midnight radio feel..."
                  className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#09090D] px-3 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Inter-Chunk Pause & Volume Normalization */}
              <div className="space-y-3 border-t border-white/[0.06] pt-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Silence Between Chunks</span>
                    <span className="font-mono-tabular text-violet-300">
                      {project.pauseDurationMs} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={project.pauseDurationMs}
                    onChange={(e) =>
                      updateProject({ pauseDurationMs: Number(e.target.value) })
                    }
                    className="w-full cursor-pointer accent-violet-500"
                  />
                </div>

                <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
                  <span>Normalize loudness across merged chunks (-1 dBFS)</span>
                  <input
                    type="checkbox"
                    checked={project.normalizeVolume}
                    onChange={(e) =>
                      updateProject({ normalizeVolume: e.target.checked })
                    }
                    className="h-4 w-4 accent-violet-600 rounded"
                  />
                </label>
              </div>

              {/* Explicitly Disabled Controls (Provider Honesty) */}
              <div className="space-y-2.5 border-t border-white/[0.06] pt-3 opacity-65">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Lock className="h-3 w-3" />
                  <span>Hardware Parameters Unavailable on Gemini 3.8 TTS</span>
                </div>

                <div className="space-y-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Pitch (Semitones)</span>
                    <span>Disabled · Describe depth in Voice Design</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Voice Stability</span>
                    <span>Disabled · Managed internally by model</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Similarity / Clarity</span>
                    <span>Disabled · Voice-cloning providers only</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Master Combined Narration & Export */}
          <section className="rounded-xl border border-violet-500/30 bg-[#12121A] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Master Combined Narration
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {completedChunks.length === 0
                    ? 'Generate at least one chunk to preview and export the combined audio.'
                    : completedChunks.length < project.chunks.length
                      ? `Merged ${completedChunks.length} of ${project.chunks.length} segments (${project.chunks.length - completedChunks.length} remaining/failed) with ${project.pauseDurationMs}ms pause.`
                      : `Merged all ${completedChunks.length} segments with ${project.pauseDurationMs}ms pause.`}
                </p>
              </div>
              {mergingMaster && (
                <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />
              )}
            </div>

            {masterAudio ? (
              <div className="space-y-3">
                <AudioPlayer
                  blob={masterAudio.wavBlob}
                  title={`${project.title || 'Master Narration'}`}
                  subtitle={`${project.voiceId} · ${completedChunks.length} of ${project.chunks.length} segments merged`}
                  downloadBaseName={`${(project.title || 'voxforge_master').replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase()}`}
                  precomputedPeaks={masterAudio.peaks}
                  precomputedDuration={masterAudio.durationSec}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const safeName = (project.title || 'voxforge_master')
                        .replace(/[^a-zA-Z0-9_-]+/g, '_')
                        .toLowerCase();
                      triggerBlobDownload(masterAudio.wavBlob, `${safeName}_master.wav`);
                    }}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export WAV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMasterMp3}
                    disabled={exportingMasterMp3}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#181822] px-3 text-xs font-semibold text-white hover:border-violet-500/40 disabled:opacity-50 whitespace-nowrap"
                  >
                    {exportingMasterMp3 ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Export MP3</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveMasterToHistory('wav')}
                    disabled={savingHistory}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#181822] px-3 text-xs font-semibold text-violet-200 hover:border-violet-500/40 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingHistory ? 'Saving...' : 'Save History'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/[0.1] bg-[#09090D] p-6 text-center text-xs text-slate-500">
                Completed audio chunks will automatically assemble here for seamless playback and WAV / MP3 export.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
