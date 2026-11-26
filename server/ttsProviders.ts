import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  GEMINI_MODELS,
  GEMINI_VOICES,
  SPEED_PRESETS,
} from '../src/data/studioCatalog.ts';
import type {
  ApiErrorPayload,
  ModelId,
  PrebuiltVoiceId,
  ProviderStatusInfo,
  SynthesizeRequestPayload,
  SynthesizeResponsePayload,
  TransliterateResponsePayload,
} from '../src/types/studio.ts';

function getConfiguredGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  return key;
}

function createGeminiClient(apiVersion?: 'v1beta' | 'v1alpha'): GoogleGenAI {
  const apiKey = getConfiguredGeminiKey();
  if (!apiKey) {
    throw new ProviderError(
      'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to generate speech.',
      'MISSING_API_KEY',
      401,
      false
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'Speech synthesis request'
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 700
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isRateLimit = msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('rate limit');
      const isTransient =
        isRateLimit ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('high demand') ||
        msg.includes('timeout') ||
        msg.includes('econnreset');

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }

      let waitMs = baseDelayMs * attempt;
      if (isRateLimit) {
        const retryMatch = msg.match(/retry[^\d]*(\d+(?:\.\d+)?)\s*s/);
        const hintedMs = retryMatch ? Math.ceil(Number(retryMatch[1]) * 1000) : 0;
        waitMs = Math.max(4000 * attempt, hintedMs, baseDelayMs * attempt);
      }
      const jitter = Math.floor(Math.random() * 450);
      await new Promise((r) => setTimeout(r, Math.min(25_000, waitMs + jitter)));
    }
  }
  throw lastError;
}

export class ProviderError extends Error {
  code: ApiErrorPayload['code'];
  statusCode: number;
  retryable: boolean;

  constructor(
    message: string,
    code: ApiErrorPayload['code'],
    statusCode = 500,
    retryable = false
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function classifyProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) {
    return err;
  }

  const rawMsg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown provider error';
  const lower = rawMsg.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('permission_denied') || lower.includes('403')) {
    return new ProviderError(
      'Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets.',
      'INVALID_API_KEY',
      403,
      false
    );
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('rate limit')) {
    return new ProviderError(
      'Provider rate limit reached. Wait a few seconds and retry this chunk.',
      'RATE_LIMIT',
      429,
      true
    );
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return new ProviderError(
      'Gemini model is temporarily busy due to high demand. Please retry in a moment.',
      'MODEL_UNAVAILABLE',
      503,
      true
    );
  }
  if (lower.includes('quota')) {
    return new ProviderError(
      'API quota exhausted for the current billing tier. Retry later or check your quota in Settings > Secrets.',
      'QUOTA_EXHAUSTED',
      429,
      false
    );
  }
  if (lower.includes('not_found') || lower.includes('404') || lower.includes('not found')) {
    return new ProviderError(
      'The selected TTS model is currently unavailable for this API key or region.',
      'MODEL_UNAVAILABLE',
      404,
      false
    );
  }
  if (lower.includes('timeout') || lower.includes('deadline') || lower.includes('aborted')) {
    return new ProviderError(
      'Speech synthesis timed out on the provider. Try splitting into a smaller chunk size (300–600 chars) and retry.',
      'TIMEOUT',
      504,
      true
    );
  }

  return new ProviderError(
    `Speech synthesis failed: ${rawMsg}`,
    'GENERATION_FAILED',
    502,
    true
  );
}

const NATIVE_FLASH_TAGS = new Set(['<breath>', '<gasp>', '<laugh>', '|mhm|', '|yeah|']);

export function processVocalTagsForModel(
  rawText: string,
  modelId: ModelId
): {
  processedText: string;
  extraStyleCues: string[];
  tagReport: SynthesizeResponsePayload['tagReport'];
} {
  const supportsNative = modelId === 'gemini-3.8-flash-tts';
  const nativeTagsUsed = new Set<string>();
  const adaptedTagsUsed = new Set<string>();
  const strippedTags = new Set<string>();
  const warnings: string[] = [];
  const extraStyleCues: string[] = [];

  let text = rawText;

  // Handle adapted tags first so they don't get read aloud literally
  const adaptedReplacements: Array<{
    regex: RegExp;
    tag: string;
    flashText: string;
    liteText: string;
    styleCue?: string;
  }> = [
    {
      regex: /<pause>/gi,
      tag: '<pause>',
      flashText: ' ... ',
      liteText: ' ... ',
      styleCue: 'incorporate natural dramatic pauses at ellipses',
    },
    {
      regex: /<sigh>/gi,
      tag: '<sigh>',
      flashText: ' <breath> ',
      liteText: ' ',
      styleCue: 'include a soft weary sighing exhale at emotional beats',
    },
    {
      regex: /<whisper>/gi,
      tag: '<whisper>',
      flashText: ' ',
      liteText: ' ',
      styleCue: 'deliver hushed phrases in a close-mic eerie whisper',
    },
    {
      regex: /<cry>/gi,
      tag: '<cry>',
      flashText: ' <breath> ',
      liteText: ' ',
      styleCue: 'deliver poignant moments with a trembling tearful voice',
    },
    {
      regex: /<shout>/gi,
      tag: '<shout>',
      flashText: ' ',
      liteText: ' ',
      styleCue: 'deliver emphatic exclamations with raised urgent intensity',
    },
  ];

  for (const item of adaptedReplacements) {
    if (item.regex.test(text)) {
      text = text.replace(item.regex, supportsNative ? item.flashText : item.liteText);
      adaptedTagsUsed.add(item.tag);
      if (item.styleCue) {
        extraStyleCues.push(item.styleCue);
      }
    }
  }

  // Handle native tags (<breath>, <gasp>, <laugh>, |mhm|, |yeah|)
  const nativeMatches = text.match(/(?:<breath>|<gasp>|<laugh>|\|mhm\||\|yeah\|)/gi) ?? [];
  for (const match of nativeMatches) {
    const normalized = match.toLowerCase();
    if (NATIVE_FLASH_TAGS.has(normalized)) {
      if (supportsNative) {
        nativeTagsUsed.add(normalized);
      } else {
        strippedTags.add(normalized);
      }
    }
  }

  if (!supportsNative && strippedTags.size > 0) {
    text = text.replace(/(?:<breath>|<gasp>|<laugh>|\|mhm\||\|yeah\|)/gi, ' ');
    warnings.push(
      `Stripped unsupported vocal tags (${Array.from(strippedTags).join(', ')}) because Gemini 3.8 Flash Lite TTS does not support native vocal bursts.`
    );
  }

  if (adaptedTagsUsed.size > 0) {
    warnings.push(
      `Adapted expressive cues (${Array.from(adaptedTagsUsed).join(', ')}) into delivery instructions and punctuation pauses.`
    );
  }

  // Clean up extra whitespace introduced by tag stripping
  text = text.replace(/[ \t]{2,}/g, ' ').trim();

  return {
    processedText: text,
    extraStyleCues,
    tagReport: {
      nativeTagsUsed: Array.from(nativeTagsUsed),
      adaptedTagsUsed: Array.from(adaptedTagsUsed),
      strippedTags: Array.from(strippedTags),
      warnings,
    },
  };
}

export function buildStyleInstruction(
  payload: SynthesizeRequestPayload,
  extraStyleCues: string[],
  resolvedLanguageCode?: string
): string {
  const parts: string[] = [];
  const model = GEMINI_MODELS[payload.modelId];

  if (payload.useVoiceDesign && model.supportsVoiceDesign && payload.voiceDesignPrompt.trim()) {
    parts.push(payload.voiceDesignPrompt.trim());
  }

  if (payload.emotionPreset && payload.emotionPreset !== 'Neutral') {
    const suspenseEmotions = new Set(['Suspense', 'Fear', 'Mystery', 'Dramatic']);
    if (suspenseEmotions.has(payload.emotionPreset)) {
      parts.push(
        `${payload.emotionalIntensity} ${payload.emotionPreset} cinematic storytelling delivery with controlled breath tension, lowered resonant chest register, and deliberate pauses at ellipses`
      );
    } else {
      parts.push(`${payload.emotionalIntensity} ${payload.emotionPreset} emotional delivery`);
    }
  }

  const speedCfg = SPEED_PRESETS.find((s) => s.label === payload.speedPreset);
  if (speedCfg && payload.speedPreset !== 'Normal') {
    parts.push(speedCfg.directive);
  }

  if (payload.speakingStyleNote.trim()) {
    parts.push(payload.speakingStyleNote.trim());
  }

  const isTeluguContext =
    resolvedLanguageCode === 'te-IN' ||
    payload.scriptLanguageMode === 'telugu' ||
    payload.scriptLanguageMode === 'roman_telugu';

  if (payload.scriptLanguageMode === 'roman_telugu') {
    parts.push(
      'Read Romanized Telugu words phonetically as authentic native spoken Telugu without Anglicizing names, retroflex consonants, or vowel lengths'
    );
  } else if (isTeluguContext) {
    parts.push(
      'Speak with authentic native Telugu (te-IN) phonology, crisp consonant articulation, natural long-vowel (deergham) cadence, and zero foreign accent drift'
    );
  } else if (payload.scriptLanguageMode === 'auto') {
    parts.push(
      'Read Telugu script naturally as native Telugu and handle mixed Telugu-English phrases smoothly'
    );
  }

  if (payload.lockVoiceConsistency !== false) {
    parts.push(
      'Maintain strictly consistent vocal timbre, steady pitch floor, microphone proximity, and narrative pacing seamlessly across continuous story segments'
    );
  }

  if (extraStyleCues.length > 0) {
    parts.push(extraStyleCues.join('; '));
  }

  return parts.join('. ').trim() || 'Natural, expressive, clear studio narration';
}

export async function synthesizeWithGemini(
  payload: SynthesizeRequestPayload,
  options?: { timeoutMs?: number; maxAttempts?: number }
): Promise<SynthesizeResponsePayload> {
  const modelMeta = GEMINI_MODELS[payload.modelId];
  if (!modelMeta) {
    throw new ProviderError(`Unsupported Gemini TTS model: ${payload.modelId}`, 'MODEL_UNAVAILABLE', 400, false);
  }

  const validVoice = GEMINI_VOICES.find((v) => v.id === payload.voiceId);
  if (!validVoice) {
    throw new ProviderError(
      `Unsupported voice "${payload.voiceId}". Available voices: ${GEMINI_VOICES.map((v) => v.id).join(', ')}.`,
      'UNSUPPORTED_VOICE',
      400,
      false
    );
  }

  if (payload.text.length > modelMeta.maxCharsPerChunk) {
    throw new ProviderError(
      `Chunk exceeds ${modelMeta.displayName} limit of ${modelMeta.maxCharsPerChunk} characters (${payload.text.length} provided). Reduce chunk size and retry.`,
      'TEXT_TOO_LONG',
      400,
      false
    );
  }

  const { processedText, extraStyleCues, tagReport } = processVocalTagsForModel(
    payload.text,
    payload.modelId
  );

  if (!processedText) {
    throw new ProviderError(
      'Chunk contains no speakable text after tag processing.',
      'VALIDATION_ERROR',
      400,
      false
    );
  }

  const hasTeluguUnicode = /[\u0C00-\u0C7F]/.test(processedText);
  let resolvedLanguageCode: string | undefined;
  if (payload.languageCodeOverride === 'te-IN') {
    resolvedLanguageCode = 'te-IN';
  } else if (payload.languageCodeOverride === 'en-US') {
    resolvedLanguageCode = 'en-US';
  } else if (
    hasTeluguUnicode ||
    payload.scriptLanguageMode === 'telugu' ||
    payload.scriptLanguageMode === 'roman_telugu'
  ) {
    resolvedLanguageCode = 'te-IN';
  }

  const resolvedSeed =
    payload.lockVoiceConsistency !== false &&
    typeof payload.voiceSeed === 'number' &&
    Number.isFinite(payload.voiceSeed)
      ? Math.max(1, Math.min(2147483647, Math.floor(payload.voiceSeed)))
      : undefined;

  const appliedStylePrompt = buildStyleInstruction(payload, extraStyleCues, resolvedLanguageCode);
  const ai = createGeminiClient('v1beta');
  const attemptTimeoutMs = options?.timeoutMs ?? 45_000;
  const maxAttempts = options?.maxAttempts ?? 4;

  try {
    const response = await withRetry(
      () =>
        withTimeout(
          ai.models.generateContent({
            model: payload.modelId,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: processedText,
                    speechMetadata: {
                      style: appliedStylePrompt,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              ...(resolvedSeed !== undefined ? { seed: resolvedSeed } : {}),
              speechConfig: {
                ...(resolvedLanguageCode ? { languageCode: resolvedLanguageCode } : {}),
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: payload.voiceId as PrebuiltVoiceId,
                  },
                },
              },
            },
          }),
          attemptTimeoutMs,
          'Gemini TTS synthesis'
        ),
      maxAttempts
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      throw new ProviderError(
        'Gemini TTS returned a response without audio data. Try simplifying formatting or retrying.',
        'GENERATION_FAILED',
        502,
        true
      );
    }

    return {
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      modelUsed: payload.modelId,
      voiceUsed: payload.voiceId,
      appliedLanguageCode: resolvedLanguageCode,
      appliedSeed: resolvedSeed,
      appliedStylePrompt,
      tagReport,
    };
  } catch (err) {
    throw classifyProviderError(err);
  }
}

export async function transliterateRomanTelugu(
  romanText: string
): Promise<TransliterateResponsePayload> {
  if (!romanText.trim()) {
    throw new ProviderError('Text to transliterate cannot be empty.', 'VALIDATION_ERROR', 400, false);
  }
  if (romanText.length > 12000) {
    throw new ProviderError(
      'Transliteration input exceeds 12,000 characters. Please transliterate in smaller sections.',
      'TEXT_TOO_LONG',
      400,
      false
    );
  }

  const ai = createGeminiClient('v1beta');
  const systemInstruction =
    'You are an expert Telugu phonetic transliterator. Convert Roman Telugu (Telugu words written in Latin/English alphabet) into accurate, natural Telugu Unicode script. Rules: 1) DO NOT translate Telugu meaning into English. 2) Keep genuine English words, brand names, technical terms, or already-written Telugu Unicode words intact (or preserve natural mixed Telugu-English flow). 3) Preserve ALL punctuation, line breaks, numbers, and expressive vocal tags like <breath>, <gasp>, <laugh>, <pause>, <whisper>, <sigh>, <cry>, <shout>, |mhm|, |yeah| verbatim. 4) Output ONLY the converted script text with no commentary or markdown fences.';

  try {
    let response;
    try {
      response = await withRetry(
        () =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: romanText,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction,
            },
          }),
        2,
        500
      );
    } catch (primaryErr) {
      const msg = primaryErr instanceof Error ? primaryErr.message.toLowerCase() : '';
      if (msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand')) {
        response = await withRetry(
          () =>
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: romanText,
              config: {
                systemInstruction,
              },
            }),
          2,
          500
        );
      } else {
        throw primaryErr;
      }
    }

    const converted = (response.text ?? '').trim();
    if (!converted) {
      throw new ProviderError('Transliteration returned empty output.', 'GENERATION_FAILED', 502, true);
    }

    return {
      teluguText: converted,
      notes: 'Converted Roman Telugu phonetics into Telugu Unicode while preserving punctuation and vocal tags.',
    };
  } catch (err) {
    throw classifyProviderError(err);
  }
}

export function getProvidersStatus(): ProviderStatusInfo[] {
  const geminiReady = Boolean(getConfiguredGeminiKey());

  return [
    {
      id: 'gemini',
      name: 'Google Gemini 3.8 Speech',
      configured: geminiReady,
      available: geminiReady,
      statusMessage: geminiReady
        ? 'Connected via server-side GEMINI_API_KEY'
        : 'GEMINI_API_KEY missing in Settings > Secrets',
      documentationHint:
        'Configured automatically through AI Studio Settings > Secrets (GEMINI_API_KEY). All synthesis requests are proxied securely through the Express backend.',
      models: [
        GEMINI_MODELS['gemini-3.8-flash-tts'],
        GEMINI_MODELS['gemini-3.8-flash-lite-tts'],
      ],
      voices: GEMINI_VOICES,
    },
    {
      id: 'google-cloud-tts',
      name: 'Google Cloud Text-to-Speech (Adapter Ready)',
      configured: false,
      available: false,
      statusMessage: 'Not provisioned · Requires Google Cloud service account credentials',
      documentationHint:
        'Provider adapter slot reserved for Wavenet / Neural2 / Chirp Telugu voices (`te-IN`). Unavailable until Google Cloud credentials are configured on the server.',
      models: [],
      voices: [],
    },
  ];
}
