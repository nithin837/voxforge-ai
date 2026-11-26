import { Mp3Encoder } from '@breezystack/lamejs';

const TARGET_SAMPLE_RATE = 24000;

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export function extractWaveformPeaks(
  samples: Float32Array,
  barCount = 72
): number[] {
  if (samples.length === 0) {
    return new Array(barCount).fill(0.08);
  }
  const blockSize = Math.max(1, Math.floor(samples.length / barCount));
  const peaks: number[] = [];
  let maxOverall = 0.001;

  for (let i = 0; i < barCount; i += 1) {
    const start = i * blockSize;
    const end = Math.min(samples.length, start + blockSize);
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const abs = Math.abs(samples[j]);
      if (abs > peak) peak = abs;
    }
    peaks.push(peak);
    if (peak > maxOverall) maxOverall = peak;
  }

  return peaks.map((p) => Math.max(0.06, Math.min(1, p / maxOverall)));
}

export async function analyzeAudioBlob(
  blob: Blob,
  barCount = 72
): Promise<{ durationSec: number; peaks: number[] }> {
  const ctx = getAudioContext();
  const buffer = await blob.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buffer.slice(0));
  const channel = decoded.getChannelData(0);
  return {
    durationSec: decoded.duration,
    peaks: extractWaveformPeaks(channel, barCount),
  };
}

async function decodeToMonoTargetRate(blob: Blob): Promise<Float32Array> {
  const ctx = getAudioContext();
  const rawBuf = await blob.arrayBuffer();
  const decoded = await ctx.decodeAudioData(rawBuf.slice(0));

  // Mix down to mono
  const length = decoded.length;
  const mono = new Float32Array(length);
  const channels = decoded.numberOfChannels;
  for (let ch = 0; ch < channels; ch += 1) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] / channels;
    }
  }

  if (decoded.sampleRate === TARGET_SAMPLE_RATE) {
    return mono;
  }

  // Resample cleanly using OfflineAudioContext
  const targetLen = Math.max(1, Math.round((length * TARGET_SAMPLE_RATE) / decoded.sampleRate));
  const offline = new OfflineAudioContext(1, targetLen, TARGET_SAMPLE_RATE);
  const srcBuffer = offline.createBuffer(1, length, decoded.sampleRate);
  srcBuffer.copyToChannel(mono, 0);
  const srcNode = offline.createBufferSource();
  srcNode.buffer = srcBuffer;
  srcNode.connect(offline.destination);
  srcNode.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function normalizeSamples(samples: Float32Array, targetPeak = 0.89): Float32Array {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.abs(samples[i]);
    if (v > maxAbs) maxAbs = v;
  }
  if (maxAbs < 0.001) return samples;
  const gain = targetPeak / maxAbs;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

function float32ToInt16(samples: Float32Array): Int16Array {
  const pcm16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm16;
}

export function encodeFloat32ToWavBlob(
  samples: Float32Array,
  sampleRate = TARGET_SAMPLE_RATE
): Blob {
  const pcm16 = float32ToInt16(samples);
  const dataByteLength = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataByteLength, true);

  const outBytes = new Uint8Array(buffer, 44);
  const pcmBytes = new Uint8Array(pcm16.buffer);
  outBytes.set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

export function encodeFloat32ToMp3Blob(
  samples: Float32Array,
  sampleRate = TARGET_SAMPLE_RATE,
  kbps = 192
): Blob {
  const pcm16 = float32ToInt16(samples);
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const mp3Parts: BlobPart[] = [];
  const blockSize = 1152;

  for (let i = 0; i < pcm16.length; i += blockSize) {
    const slice = pcm16.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(slice);
    if (encoded.length > 0) {
      mp3Parts.push(new Uint8Array(encoded));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Parts.push(new Uint8Array(flushed));
  }

  return new Blob(mp3Parts, { type: 'audio/mpeg' });
}

export async function convertAudioBlobToMp3(blob: Blob): Promise<Blob> {
  const samples = await decodeToMonoTargetRate(blob);
  return encodeFloat32ToMp3Blob(samples, TARGET_SAMPLE_RATE, 192);
}

export async function mergeAudioChunks(
  chunkBlobs: Blob[],
  options: { pauseDurationMs: number; normalizeVolume: boolean }
): Promise<{
  wavBlob: Blob;
  pcmSamples: Float32Array;
  durationSec: number;
  peaks: number[];
}> {
  if (chunkBlobs.length === 0) {
    throw new Error('No completed audio chunks available to merge.');
  }

  const decodedChunks: Float32Array[] = [];
  for (const blob of chunkBlobs) {
    let mono = await decodeToMonoTargetRate(blob);
    if (options.normalizeVolume) {
      mono = normalizeSamples(mono, 0.89);
    }
    decodedChunks.push(mono);
  }

  const pauseSamples = Math.max(
    0,
    Math.round((options.pauseDurationMs / 1000) * TARGET_SAMPLE_RATE)
  );

  let totalLength = 0;
  decodedChunks.forEach((arr, idx) => {
    totalLength += arr.length;
    if (idx < decodedChunks.length - 1) {
      totalLength += pauseSamples;
    }
  });

  const merged = new Float32Array(totalLength);
  let cursor = 0;
  decodedChunks.forEach((arr, idx) => {
    merged.set(arr, cursor);
    cursor += arr.length;
    if (idx < decodedChunks.length - 1) {
      cursor += pauseSamples;
    }
  });

  const finalSamples = options.normalizeVolume ? normalizeSamples(merged, 0.9) : merged;
  const wavBlob = encodeFloat32ToWavBlob(finalSamples, TARGET_SAMPLE_RATE);
  const durationSec = finalSamples.length / TARGET_SAMPLE_RATE;
  const peaks = extractWaveformPeaks(finalSamples, 96);

  return {
    wavBlob,
    pcmSamples: finalSamples,
    durationSec,
    peaks,
  };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
