import {
  Download,
  Loader2,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  analyzeAudioBlob,
  convertAudioBlobToMp3,
  formatDuration,
  triggerBlobDownload,
} from '../services/audioProcessorService';

interface AudioPlayerProps {
  blob: Blob;
  title?: string;
  subtitle?: string;
  downloadBaseName?: string;
  precomputedPeaks?: number[];
  precomputedDuration?: number;
  compact?: boolean;
}

const SPEED_OPTIONS = [0.75, 1, 1.15, 1.25, 1.5];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  blob,
  title,
  subtitle,
  downloadBaseName = 'voxforge_audio',
  precomputedPeaks,
  precomputedDuration,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(precomputedDuration ?? 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [peaks, setPeaks] = useState<number[]>(
    precomputedPeaks ?? new Array(compact ? 48 : 80).fill(0.18)
  );
  const [exportingMp3, setExportingMp3] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Create object URL cleanly for <audio>
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDecodeError(null);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Analyze waveform peaks when blob updates
  useEffect(() => {
    let cancelled = false;
    if (precomputedPeaks && precomputedDuration) {
      setPeaks(precomputedPeaks);
      setDuration(precomputedDuration);
      return;
    }

    analyzeAudioBlob(blob, compact ? 48 : 80)
      .then((res) => {
        if (!cancelled) {
          setPeaks(res.peaks);
          setDuration(res.durationSec);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDecodeError('Waveform analysis failed, audio playback still available.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [blob, compact, precomputedPeaks, precomputedDuration]);

  // Keep volume & speed synced with <audio>
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume;
    el.playbackRate = playbackRate;
  }, [volume, isMuted, playbackRate]);

  // Draw waveform onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const count = peaks.length;
    const gap = 2;
    const barWidth = Math.max(2, (width - gap * (count - 1)) / count);

    for (let i = 0; i < count; i += 1) {
      const barRatio = (i + 0.5) / count;
      const barH = Math.max(4, peaks[i] * (height - 6));
      const x = i * (barWidth + gap);
      const y = (height - barH) / 2;

      ctx.fillStyle = barRatio <= progress ? '#8B5CF6' : 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 2);
      ctx.fill();
    }
  }, [peaks, currentTime, duration]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setDecodeError('Playback was blocked by the browser. Tap play again.');
      }
    }
  };

  const stopPlayback = () => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleWaveformSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const el = audioRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextTime = ratio * duration;
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleRangeSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const nextTime = Number(e.target.value);
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleDownloadWav = () => {
    triggerBlobDownload(blob, `${downloadBaseName}.wav`);
  };

  const handleDownloadMp3 = async () => {
    setExportingMp3(true);
    try {
      const mp3Blob = await convertAudioBlobToMp3(blob);
      triggerBlobDownload(mp3Blob, `${downloadBaseName}.mp3`);
    } catch {
      setDecodeError('Could not encode MP3 from this audio segment.');
    } finally {
      setExportingMp3(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-[#12121A] ${
        compact ? 'p-3' : 'p-4 sm:p-5'
      }`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
        }}
        onError={() => {
          setIsPlaying(false);
          setDecodeError('Audio decoding error occurred in the browser player.');
        }}
      />

      {(title || subtitle) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <p className="truncate text-sm font-semibold text-[#F4F4F7]">{title}</p>
            )}
            {subtitle && (
              <p className="truncate text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          <div className="font-mono-tabular text-xs text-slate-300 whitespace-nowrap shrink-0">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
        </div>
      )}

      {/* Waveform Canvas + Accessible Seek Range */}
      <div className="mb-3">
        <canvas
          ref={canvasRef}
          onClick={handleWaveformSeek}
          aria-label="Audio waveform seek bar"
          className={`w-full cursor-pointer rounded-lg bg-[#09090D]/70 px-1 ${
            compact ? 'h-11' : 'h-16'
          }`}
        />
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={Math.min(currentTime, duration || 1)}
          onChange={handleRangeSeek}
          aria-label="Seek audio position"
          className="mt-1.5 h-1.5 w-full cursor-pointer accent-violet-500"
        />
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className="flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-violet-400 whitespace-nowrap shrink-0"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={stopPlayback}
            aria-label="Stop audio"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            <Square className="h-3.5 w-3.5" />
          </button>

          {!title && !subtitle && (
            <span className="ml-1 font-mono-tabular text-xs text-slate-400 whitespace-nowrap">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Speed selector */}
          <select
            aria-label="Playback speed"
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="h-11 rounded-lg border border-white/[0.08] bg-[#181822] px-2.5 text-xs font-medium text-slate-200 focus:border-violet-500 focus:outline-none font-mono-tabular"
          >
            {SPEED_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>

          {/* Volume control */}
          {!compact && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#181822] px-2.5 h-11">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="text-slate-300 hover:text-white"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setIsMuted(false);
                  setVolume(Number(e.target.value));
                }}
                aria-label="Volume"
                className="w-16 cursor-pointer accent-violet-500"
              />
            </div>
          )}

          {/* Downloads */}
          <button
            type="button"
            onClick={handleDownloadWav}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181822] px-3 text-xs font-medium text-slate-200 transition-colors hover:border-violet-500/50 hover:text-white whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>WAV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMp3}
            disabled={exportingMp3}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181822] px-3 text-xs font-medium text-slate-200 transition-colors hover:border-violet-500/50 hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {exportingMp3 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>MP3</span>
          </button>
        </div>
      </div>

      {decodeError && (
        <p className="mt-2 text-xs text-amber-300">{decodeError}</p>
      )}
    </div>
  );
};
