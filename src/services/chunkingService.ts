import { SPEED_PRESETS } from '../data/studioCatalog';
import type {
  ChunkSizePreset,
  ScriptChunk,
  ScriptLanguageMode,
  SpeedPreset,
} from '../types/studio';

export function resolveTargetChunkSize(
  preset: ChunkSizePreset,
  customSize: number,
  modelMaxChars: number
): number {
  const base =
    preset === 'short'
      ? 300
      : preset === 'medium'
        ? 600
        : preset === 'long'
          ? 1000
          : Math.max(120, customSize || 600);

  return Math.min(base, Math.max(150, modelMaxChars - 100));
}

function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const SegmenterCtor = (Intl as unknown as {
      Segmenter: new (locale: string, opts: { granularity: 'grapheme' }) => {
        segment: (input: string) => Iterable<{ segment: string }>;
      };
    }).Segmenter;
    const segmenter = new SegmenterCtor('te-IN', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * Splits a single overly-long sentence safely on whitespace or Telugu grapheme boundaries
 * without ever slicing words or Unicode combining marks in half.
 */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) {
    return [sentence.trim()].filter(Boolean);
  }

  const words = sentence.split(/(\s+)/);
  const pieces: string[] = [];
  let current = '';

  for (const token of words) {
    if (!token) continue;

    if ((current + token).trim().length <= maxChars) {
      current += token;
      continue;
    }

    if (current.trim()) {
      pieces.push(current.trim());
      current = '';
    }

    if (token.trim().length > maxChars) {
      // Extreme edge case: unbroken token > maxChars; split cleanly by grapheme clusters
      const graphemes = segmentGraphemes(token.trim());
      let buf = '';
      for (const g of graphemes) {
        if ((buf + g).length > maxChars) {
          if (buf) pieces.push(buf);
          buf = g;
        } else {
          buf += g;
        }
      }
      if (buf) current = buf;
    } else {
      current = token.trimStart();
    }
  }

  if (current.trim()) {
    pieces.push(current.trim());
  }

  return pieces;
}

/**
 * Splits a script into resilient chunks prioritizing paragraph breaks first,
 * then sentence boundaries (., !, ?, Telugu danda ।, ॥), preserving punctuation
 * and Telugu Unicode integrity.
 */
export function splitScriptIntoChunks(
  scriptText: string,
  targetMaxChars: number
): string[] {
  const normalized = scriptText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const safeLimit = Math.max(120, targetMaxChars);
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let activeChunk = '';

  const flushActive = () => {
    if (activeChunk.trim()) {
      chunks.push(activeChunk.trim());
      activeChunk = '';
    }
  };

  for (const paragraph of paragraphs) {
    // If whole paragraph fits cleanly with current buffer
    const candidateWithPara = activeChunk ? `${activeChunk}\n\n${paragraph}` : paragraph;
    if (candidateWithPara.length <= safeLimit) {
      activeChunk = candidateWithPara;
      continue;
    }

    // Flush existing buffer before tackling a paragraph that wouldn't fit together
    flushActive();

    if (paragraph.length <= safeLimit) {
      activeChunk = paragraph;
      continue;
    }

    // Split paragraph into sentences while retaining punctuation
    const sentences = paragraph
      .split(/(?<=[.!?।॥\n])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const subParts = splitLongSentence(sentence, safeLimit);
      for (const part of subParts) {
        const joined = activeChunk ? `${activeChunk} ${part}` : part;
        if (joined.length <= safeLimit) {
          activeChunk = joined;
        } else {
          flushActive();
          activeChunk = part;
        }
      }
    }
    flushActive();
  }

  flushActive();
  return chunks;
}

export function buildChunksFromText(
  scriptText: string,
  targetMaxChars: number,
  existingChunks: ScriptChunk[] = []
): ScriptChunk[] {
  const segments = splitScriptIntoChunks(scriptText, targetMaxChars);

  return segments.map((text, index) => {
    // Preserve completed audio if an identical chunk text already exists
    const matchingExisting = existingChunks.find(
      (c) => c.text.trim() === text.trim() && c.status === 'completed' && c.audioBlob
    );

    if (matchingExisting) {
      return {
        ...matchingExisting,
        index,
      };
    }

    return {
      id: `chunk_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      index,
      text,
      status: 'pending',
      retryCount: 0,
    };
  });
}

export function computeScriptMetrics(
  text: string,
  speedPreset: SpeedPreset,
  mode: ScriptLanguageMode
): {
  words: number;
  characters: number;
  estimatedSeconds: number;
  detectedScriptLabel: string;
  hasTeluguUnicode: boolean;
  hasLatin: boolean;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      words: 0,
      characters: 0,
      estimatedSeconds: 0,
      detectedScriptLabel: 'Empty script',
      hasTeluguUnicode: false,
      hasLatin: false,
    };
  }

  // Strip vocal tags for accurate word/duration estimation
  const speakable = trimmed
    .replace(/(?:<breath>|<gasp>|<laugh>|<sigh>|<whisper>|<pause>|<cry>|<shout>|\|mhm\||\|yeah\|)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = speakable ? speakable.split(/\s+/).length : 0;
  const characters = trimmed.length;
  const hasTeluguUnicode = /[\u0C00-\u0C7F]/.test(speakable);
  const hasLatin = /[A-Za-z]/.test(speakable);

  let detectedScriptLabel = 'English / Latin';
  if (mode === 'telugu' || (hasTeluguUnicode && !hasLatin)) {
    detectedScriptLabel = 'Telugu Unicode';
  } else if (hasTeluguUnicode && hasLatin) {
    detectedScriptLabel = 'Mixed Telugu & English';
  } else if (mode === 'roman_telugu') {
    detectedScriptLabel = 'Roman Telugu';
  } else if (mode === 'english') {
    detectedScriptLabel = 'English';
  } else if (hasLatin) {
    detectedScriptLabel = 'Latin (English or Roman Telugu)';
  }

  const speedMeta = SPEED_PRESETS.find((s) => s.label === speedPreset);
  const rate = speedMeta?.previewRate ?? 1.0;

  // Empirically ~12.5 chars/sec for Telugu syllables & ~14.5 chars/sec for English
  const baseCharsPerSec = hasTeluguUnicode ? 12.2 : 14.2;
  const estimatedSeconds = Math.max(1, Math.round(speakable.length / (baseCharsPerSec * rate)));

  return {
    words,
    characters,
    estimatedSeconds,
    detectedScriptLabel,
    hasTeluguUnicode,
    hasLatin,
  };
}
