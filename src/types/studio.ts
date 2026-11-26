export type AppView =
  | 'dashboard'
  | 'studio'
  | 'voices'
  | 'projects'
  | 'history'
  | 'providers';

export type ProviderId = 'gemini' | 'google-cloud-tts';

export type ModelId = 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts';

export type PrebuiltVoiceId =
  | 'Charon'
  | 'Algenib'
  | 'Orus'
  | 'Enceladus'
  | 'Umbriel'
  | 'Fenrir'
  | 'Puck'
  | 'Kore'
  | 'Zephyr';

export type ScriptLanguageMode = 'auto' | 'telugu' | 'roman_telugu' | 'english';

export type SpeechLanguageOverride = 'te-IN' | 'auto' | 'en-US';

export type EmotionPreset =
  | 'Neutral'
  | 'Suspense'
  | 'Fear'
  | 'Sadness'
  | 'Happiness'
  | 'Anger'
  | 'Excitement'
  | 'Mystery'
  | 'Serious'
  | 'Dramatic';

export type SpeedPreset = 'Very Slow' | 'Slow' | 'Normal' | 'Fast' | 'Very Fast';

export type EmotionalIntensity = 'Subtle' | 'Balanced' | 'Intense';

export type ChunkSizePreset = 'short' | 'medium' | 'long' | 'custom';

export type VoiceCategory =
  | 'All'
  | 'Deep Male'
  | 'Cinematic Male'
  | 'Mature Male'
  | 'Young Male'
  | 'Deep Female'
  | 'Cinematic Female'
  | 'Documentary Narrator'
  | 'News Presenter'
  | 'Friendly Narrator'
  | 'Calm Storyteller'
  | 'Horror Narrator'
  | 'Anime-style Narrator';

export interface VoiceProfile {
  id: PrebuiltVoiceId;
  name: string;
  genderPresentation: 'Male' | 'Female';
  primaryRole: string;
  categories: Exclude<VoiceCategory, 'All'>[];
  languages: string[];
  description: string;
  compatibleModels: ModelId[];
  auditionSampleText: string;
  auditionStylePrompt: string;
}

export interface VoiceDesignPreset {
  id: string;
  label: string;
  recommendedVoice: PrebuiltVoiceId;
  description: string;
  defaultEmotion: EmotionPreset;
  defaultSpeed: SpeedPreset;
}

export interface VocalTagDefinition {
  tag: string;
  label: string;
  description: string;
  flashTtsSupport: 'native' | 'adapted';
  liteTtsSupport: 'unsupported' | 'adapted';
  adaptationNote: string;
}

export interface ModelCapabilities {
  id: ModelId;
  providerId: ProviderId;
  displayName: string;
  shortLabel: string;
  description: string;
  maxCharsPerChunk: number;
  recommendedChunkChars: number;
  supportsVoiceDesign: boolean;
  supportsNativeVocalTags: boolean;
  supportsLanguageCode: boolean;
  supportsSeedConsistency: boolean;
  supportsSpeedGuidance: boolean;
  supportsEmotionStyle: boolean;
  supportsPitchSemitones: boolean;
  supportsStabilitySlider: boolean;
  supportsSimilaritySlider: boolean;
  supportedLanguages: string[];
  rateLimitNote: string;
}

export interface ProviderStatusInfo {
  id: ProviderId;
  name: string;
  configured: boolean;
  available: boolean;
  statusMessage: string;
  documentationHint: string;
  models: ModelCapabilities[];
  voices: VoiceProfile[];
}

export type ChunkStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface ScriptChunk {
  id: string;
  index: number;
  text: string;
  status: ChunkStatus;
  audioBlob?: Blob;
  durationSec?: number;
  errorMessage?: string;
  errorCode?: string;
  retryCount: number;
  lastGeneratedAt?: number;
  appliedTagsSummary?: string[];
}

export interface ProjectRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  scriptText: string;
  scriptLanguageMode: ScriptLanguageMode;
  languageCodeOverride: SpeechLanguageOverride;
  lockVoiceConsistency: boolean;
  voiceSeed: number;
  transliteratedPreview: string;
  providerId: ProviderId;
  modelId: ModelId;
  voiceId: PrebuiltVoiceId;
  useVoiceDesign: boolean;
  voiceDesignPresetId: string;
  voiceDesignPrompt: string;
  emotionPreset: EmotionPreset;
  emotionalIntensity: EmotionalIntensity;
  speedPreset: SpeedPreset;
  speakingStyleNote: string;
  chunkSizePreset: ChunkSizePreset;
  customChunkSize: number;
  pauseDurationMs: number;
  normalizeVolume: boolean;
  parallelChunks: boolean;
  chunks: ScriptChunk[];
}

export interface AudioHistoryRecord {
  id: string;
  name: string;
  projectId: string;
  projectTitle: string;
  createdAt: number;
  voiceId: PrebuiltVoiceId;
  modelId: ModelId;
  languageLabel: string;
  durationSec: number;
  format: 'wav' | 'mp3';
  sizeBytes: number;
  audioBlob: Blob;
}

export interface SynthesizeRequestPayload {
  providerId: ProviderId;
  modelId: ModelId;
  voiceId: PrebuiltVoiceId;
  text: string;
  scriptLanguageMode: ScriptLanguageMode;
  languageCodeOverride?: SpeechLanguageOverride;
  lockVoiceConsistency?: boolean;
  voiceSeed?: number;
  useVoiceDesign: boolean;
  voiceDesignPrompt: string;
  emotionPreset: EmotionPreset;
  emotionalIntensity: EmotionalIntensity;
  speedPreset: SpeedPreset;
  speakingStyleNote: string;
}

export interface SynthesizeResponsePayload {
  audioBase64: string;
  mimeType: 'audio/wav';
  modelUsed: ModelId;
  voiceUsed: PrebuiltVoiceId;
  appliedLanguageCode?: string;
  appliedSeed?: number;
  appliedStylePrompt: string;
  tagReport: {
    nativeTagsUsed: string[];
    adaptedTagsUsed: string[];
    strippedTags: string[];
    warnings: string[];
  };
}

export interface TransliterateResponsePayload {
  teluguText: string;
  notes: string;
}

export interface ApiErrorPayload {
  error: string;
  code:
    | 'MISSING_API_KEY'
    | 'INVALID_API_KEY'
    | 'RATE_LIMIT'
    | 'QUOTA_EXHAUSTED'
    | 'MODEL_UNAVAILABLE'
    | 'TIMEOUT'
    | 'UNSUPPORTED_VOICE'
    | 'UNSUPPORTED_PROVIDER'
    | 'TEXT_TOO_LONG'
    | 'VALIDATION_ERROR'
    | 'GENERATION_FAILED';
  retryable: boolean;
}
