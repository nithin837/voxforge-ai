import type {
  ApiErrorPayload,
  ProviderStatusInfo,
  SynthesizeRequestPayload,
  SynthesizeResponsePayload,
  TransliterateResponsePayload,
} from '../types/studio';

export class StudioApiError extends Error {
  code: ApiErrorPayload['code'];
  retryable: boolean;
  status: number;

  constructor(
    message: string,
    code: ApiErrorPayload['code'],
    retryable: boolean,
    status: number
  ) {
    super(message);
    this.name = 'StudioApiError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

async function parseErrorResponse(res: Response): Promise<StudioApiError> {
  try {
    const data = (await res.json()) as Partial<ApiErrorPayload>;
    return new StudioApiError(
      data.error || `Request failed with status ${res.status}`,
      data.code || 'GENERATION_FAILED',
      typeof data.retryable === 'boolean' ? data.retryable : res.status >= 500 || res.status === 429,
      res.status
    );
  } catch {
    return new StudioApiError(
      `Server returned HTTP ${res.status} (${res.statusText || 'Unknown error'})`,
      'GENERATION_FAILED',
      res.status >= 500,
      res.status
    );
  }
}

export async function fetchProvidersStatus(): Promise<ProviderStatusInfo[]> {
  const res = await fetch('/api/providers');
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  const data = (await res.json()) as { providers: ProviderStatusInfo[] };
  return data.providers;
}

export async function generateSpeechChunk(
  payload: SynthesizeRequestPayload,
  signal?: AbortSignal,
  timeoutMs = 120_000
): Promise<SynthesizeResponsePayload> {
  const internalController = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => internalController.abort();
  if (signal) {
    if (signal.aborted) {
      throw new StudioApiError('Generation was cancelled.', 'TIMEOUT', true, 0);
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer =
    timeoutMs > 0
      ? window.setTimeout(() => {
          timedOut = true;
          internalController.abort();
        }, timeoutMs)
      : undefined;

  try {
    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: internalController.signal,
    });

    if (!res.ok) {
      throw await parseErrorResponse(res);
    }

    return (await res.json()) as SynthesizeResponsePayload;
  } catch (err) {
    if (err instanceof StudioApiError) {
      throw err;
    }
    if (timedOut) {
      throw new StudioApiError(
        'Chunk synthesis timed out waiting for server response. Completed chunks are preserved — retry this chunk.',
        'TIMEOUT',
        true,
        504
      );
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new StudioApiError('Generation was cancelled.', 'TIMEOUT', true, 0);
    }
    throw new StudioApiError(
      err instanceof Error
        ? `Network interruption: ${err.message}`
        : 'Network interruption while contacting speech synthesis server.',
      'GENERATION_FAILED',
      true,
      0
    );
  } finally {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function transliterateTextApi(
  text: string
): Promise<TransliterateResponsePayload> {
  const res = await fetch('/api/tts/transliterate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  return (await res.json()) as TransliterateResponsePayload;
}

export function base64WavToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
