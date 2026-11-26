import {
  AlertCircle,
  ArrowDownToLine,
  Languages,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  base64WavToBlob,
  generateSpeechChunk,
  StudioApiError,
  transliterateTextApi,
} from '../services/apiClient';
import type {
  ModelId,
  PrebuiltVoiceId,
  ScriptLanguageMode,
  SpeechLanguageOverride,
} from '../types/studio';
import { AudioPlayer } from './AudioPlayer';

interface TeluguOptimizationPanelProps {
  scriptText: string;
  scriptLanguageMode: ScriptLanguageMode;
  languageCodeOverride?: SpeechLanguageOverride;
  lockVoiceConsistency?: boolean;
  voiceSeed?: number;
  transliteratedPreview: string;
  modelId: ModelId;
  voiceId: PrebuiltVoiceId;
  useVoiceDesign: boolean;
  voiceDesignPrompt: string;
  onUpdatePreview: (val: string) => void;
  onApplyTransliteration: (teluguText: string) => void;
}

export const TeluguOptimizationPanel: React.FC<TeluguOptimizationPanelProps> = ({
  scriptText,
  scriptLanguageMode,
  languageCodeOverride = 'te-IN',
  lockVoiceConsistency = true,
  voiceSeed = 424242,
  transliteratedPreview,
  modelId,
  voiceId,
  useVoiceDesign,
  voiceDesignPrompt,
  onUpdatePreview,
  onApplyTransliteration,
}) => {
  const [translating, setTranslating] = useState(false);
  const [translitError, setTranslitError] = useState<string | null>(null);
  const [translitNote, setTranslitNote] = useState<string | null>(null);

  const [testWord, setTestWord] = useState('శ్రీకాకుళం — మహాభారతం — Vijayanagaram');
  const [testingWord, setTestingWord] = useState(false);
  const [testBlob, setTestBlob] = useState<Blob | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTransliterate = async () => {
    if (!scriptText.trim()) {
      setTranslitError('Enter Roman Telugu text in the script editor first.');
      return;
    }
    setTranslating(true);
    setTranslitError(null);
    setTranslitNote(null);

    try {
      const res = await transliterateTextApi(scriptText);
      onUpdatePreview(res.teluguText);
      setTranslitNote(res.notes);
    } catch (err) {
      setTranslitError(
        err instanceof StudioApiError
          ? err.message
          : 'Failed to transliterate Roman Telugu.'
      );
    } finally {
      setTranslating(false);
    }
  };

  const handleTestPronunciation = async () => {
    if (!testWord.trim()) return;
    setTestingWord(true);
    setTestError(null);
    try {
      const res = await generateSpeechChunk({
        providerId: 'gemini',
        modelId,
        voiceId,
        text: testWord.trim(),
        scriptLanguageMode,
        languageCodeOverride,
        lockVoiceConsistency,
        voiceSeed,
        useVoiceDesign,
        voiceDesignPrompt,
        emotionPreset: 'Neutral',
        emotionalIntensity: 'Balanced',
        speedPreset: 'Normal',
        speakingStyleNote: 'Enunciate each word clearly with authentic native Telugu phonology for pronunciation verification',
      });
      setTestBlob(base64WavToBlob(res.audioBase64, res.mimeType));
    } catch (err) {
      setTestError(
        err instanceof StudioApiError
          ? err.message
          : 'Could not generate pronunciation test.'
      );
    } finally {
      setTestingWord(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-5">
      {/* Roman Telugu Transliteration Workflow */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Languages className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Telugu Language &amp; Roman Telugu Optimizer
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                For the cleanest native Telugu pronunciation, keep Speech Language set to Telugu (te-IN) and convert Roman Telugu scripts to Telugu Unicode below before editing or synthesizing. Punctuation and vocal tags stay intact.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTransliterate}
            disabled={translating || !scriptText.trim()}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600/20 border border-violet-500/40 px-3.5 text-xs font-semibold text-violet-200 hover:bg-violet-600/30 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {translating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Transliterating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Convert Roman Telugu to Unicode</span>
              </>
            )}
          </button>
        </div>

        {translitError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{translitError}</span>
          </div>
        )}

        {translitNote && (
          <p className="text-xs text-emerald-300">{translitNote}</p>
        )}

        {transliteratedPreview && (
          <div className="space-y-2 rounded-lg border border-violet-500/30 bg-[#09090D] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-violet-300">
                Editable Telugu Unicode Preview
              </span>
              <button
                type="button"
                onClick={() => onApplyTransliteration(transliteratedPreview)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 whitespace-nowrap"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                <span>Apply to Script</span>
              </button>
            </div>
            <textarea
              value={transliteratedPreview}
              onChange={(e) => onUpdatePreview(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-white/[0.08] bg-[#12121A] p-3 text-sm leading-relaxed text-white focus:border-violet-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Pronunciation Testing Scratchpad */}
      <div className="border-t border-white/[0.08] pt-4 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-200">
            Telugu Pronunciation Test Scratchpad
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Test difficult Telugu words, character names, or mixed phrases with your active voice before running a full script.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={testWord}
            onChange={(e) => setTestWord(e.target.value)}
            placeholder="Enter a Telugu word, Roman Telugu phrase, or character name..."
            className="h-11 flex-1 rounded-lg border border-white/[0.08] bg-[#09090D] px-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleTestPronunciation}
            disabled={testingWord || !testWord.trim()}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-[#181822] px-4 text-xs font-semibold text-white hover:border-violet-500/40 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {testingWord ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-violet-400" />
                <span>Test Pronunciation</span>
              </>
            )}
          </button>
        </div>

        {testError && (
          <p className="text-xs text-rose-300">{testError}</p>
        )}

        {testBlob && (
          <AudioPlayer
            blob={testBlob}
            compact
            downloadBaseName="voxforge_pronunciation_test"
          />
        )}
      </div>
    </div>
  );
};
