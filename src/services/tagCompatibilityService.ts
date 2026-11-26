import { VOCAL_TAGS } from '../data/studioCatalog';
import type { ModelId, ScriptLanguageMode } from '../types/studio';

export interface TagCompatibilityAnalysis {
  foundTags: string[];
  nativeTags: string[];
  adaptedTags: string[];
  unsupportedTags: string[];
  advisoryMessage: string | null;
}

export function analyzeVocalTagsInScript(
  scriptText: string,
  modelId: ModelId
): TagCompatibilityAnalysis {
  const foundTags: string[] = [];
  const nativeTags: string[] = [];
  const adaptedTags: string[] = [];
  const unsupportedTags: string[] = [];

  const lower = scriptText.toLowerCase();

  for (const def of VOCAL_TAGS) {
    if (lower.includes(def.tag.toLowerCase())) {
      foundTags.push(def.tag);
      const support =
        modelId === 'gemini-3.8-flash-tts' ? def.flashTtsSupport : def.liteTtsSupport;

      if (support === 'native') {
        nativeTags.push(def.tag);
      } else if (support === 'adapted') {
        adaptedTags.push(def.tag);
      } else {
        unsupportedTags.push(def.tag);
      }
    }
  }

  let advisoryMessage: string | null = null;
  if (unsupportedTags.length > 0) {
    advisoryMessage = `${unsupportedTags.join(', ')} are not supported on Gemini 3.8 Flash Lite TTS and will be stripped so they are not spoken aloud. Switch to Gemini 3.8 Flash TTS for native vocal bursts.`;
  } else if (adaptedTags.length > 0) {
    advisoryMessage = `${adaptedTags.join(', ')} are translated into delivery instructions and punctuation pauses rather than raw model tokens.`;
  }

  return {
    foundTags,
    nativeTags,
    adaptedTags,
    unsupportedTags,
    advisoryMessage,
  };
}

const ROMAN_TELUGU_HINTS = [
  'nenu',
  'nuvvu',
  'meeku',
  'naaku',
  'oka',
  'undi',
  'unnaru',
  'ayindi',
  'ledu',
  'leru',
  'kani',
  'mariyu',
  'cheppu',
  'chala',
  'ikkada',
  'akkada',
  'eppudu',
  'ela',
  'enduku',
  'katha',
  'ratri',
  'bhayam',
  'intlo',
  'manishi',
];

export function looksLikeRomanTelugu(
  text: string,
  mode: ScriptLanguageMode
): boolean {
  if (mode === 'roman_telugu') return true;
  if (mode === 'english' || mode === 'telugu') return false;

  const lower = text.toLowerCase();
  let matches = 0;
  for (const hint of ROMAN_TELUGU_HINTS) {
    if (new RegExp(`\\b${hint}\\b`, 'i').test(lower)) {
      matches += 1;
    }
  }
  return matches >= 2;
}
