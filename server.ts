import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifyProviderError,
  getProvidersStatus,
  synthesizeWithGemini,
  transliterateRomanTelugu,
} from './server/ttsProviders.ts';
import type { SynthesizeRequestPayload } from './src/types/studio.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Lightweight per-IP sliding window rate limiter to prevent accidental runaway loops
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 45;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(ip);
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Provider capabilities & server configuration readiness
  app.get('/api/providers', (_req: Request, res: Response) => {
    res.json({
      providers: getProvidersStatus(),
      serverTime: new Date().toISOString(),
    });
  });

  // Real TTS synthesis endpoint
  app.post('/api/tts/generate', async (req: Request, res: Response) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many synthesis requests in the last minute. Please wait briefly before retrying.',
        code: 'RATE_LIMIT',
        retryable: true,
      });
    }

    const body = req.body as Partial<SynthesizeRequestPayload> | undefined;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: 'Invalid JSON request payload.',
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
    }

    if (body.providerId && body.providerId !== 'gemini') {
      return res.status(400).json({
        error: `Provider "${String(body.providerId)}" is not configured in this environment. Select Google Gemini 3.8 Speech.`,
        code: 'UNSUPPORTED_PROVIDER',
        retryable: false,
      });
    }

    if (typeof body.text !== 'string' || !body.text.trim()) {
      return res.status(400).json({
        error: 'Script chunk text must be a non-empty string.',
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
    }

    const payload: SynthesizeRequestPayload = {
      providerId: 'gemini',
      modelId:
        body.modelId === 'gemini-3.8-flash-lite-tts'
          ? 'gemini-3.8-flash-lite-tts'
          : 'gemini-3.8-flash-tts',
      voiceId: typeof body.voiceId === 'string' ? (body.voiceId as SynthesizeRequestPayload['voiceId']) : 'Charon',
      text: body.text,
      scriptLanguageMode: body.scriptLanguageMode ?? 'auto',
      languageCodeOverride: body.languageCodeOverride ?? 'te-IN',
      lockVoiceConsistency: body.lockVoiceConsistency !== false,
      voiceSeed:
        typeof body.voiceSeed === 'number' && Number.isFinite(body.voiceSeed)
          ? Math.max(1, Math.min(2147483647, Math.floor(body.voiceSeed)))
          : undefined,
      useVoiceDesign: Boolean(body.useVoiceDesign),
      voiceDesignPrompt: typeof body.voiceDesignPrompt === 'string' ? body.voiceDesignPrompt.slice(0, 800) : '',
      emotionPreset: body.emotionPreset ?? 'Neutral',
      emotionalIntensity: body.emotionalIntensity ?? 'Balanced',
      speedPreset: body.speedPreset ?? 'Normal',
      speakingStyleNote: typeof body.speakingStyleNote === 'string' ? body.speakingStyleNote.slice(0, 400) : '',
    };

    try {
      const result = await synthesizeWithGemini(payload);
      return res.json(result);
    } catch (err) {
      const classified = classifyProviderError(err);
      return res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
        retryable: classified.retryable,
      });
    }
  });

  // Roman Telugu -> Telugu Unicode transliteration helper
  app.post('/api/tts/transliterate', async (req: Request, res: Response) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Rate limit reached. Please wait a moment before transliterating again.',
        code: 'RATE_LIMIT',
        retryable: true,
      });
    }

    const text = req.body?.text;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: 'Provide non-empty Roman Telugu text to transliterate.',
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
    }

    try {
      const result = await transliterateRomanTelugu(text);
      return res.json(result);
    } catch (err) {
      const classified = classifyProviderError(err);
      return res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
        retryable: classified.retryable,
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VOXFORGE AI studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VOXFORGE AI server:', err);
  process.exit(1);
});
