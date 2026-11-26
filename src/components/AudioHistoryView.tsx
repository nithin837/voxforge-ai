import {
  AudioWaveform,
  Download,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  formatBytes,
  formatDuration,
  triggerBlobDownload,
} from '../services/audioProcessorService';
import type { AudioHistoryRecord } from '../types/studio';
import { AudioPlayer } from './AudioPlayer';

interface AudioHistoryViewProps {
  history: AudioHistoryRecord[];
  initialExpandedId?: string | null;
  onDeleteEntry: (id: string) => void;
}

export const AudioHistoryView: React.FC<AudioHistoryViewProps> = ({
  history,
  initialExpandedId,
  onDeleteEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);

  React.useEffect(() => {
    if (initialExpandedId) {
      setExpandedId(initialExpandedId);
    }
  }, [initialExpandedId]);

  const uniqueVoices = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => set.add(h.voiceId));
    return Array.from(set);
  }, [history]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      if (voiceFilter !== 'all' && item.voiceId !== voiceFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.projectTitle.toLowerCase().includes(q) ||
        item.languageLabel.toLowerCase().includes(q) ||
        item.voiceId.toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery, voiceFilter]);

  const totalBytes = history.reduce((acc, item) => acc + (item.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Audio History</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search, replay, and download exported narrations stored locally in IndexedDB.
          </p>
        </div>

        <div className="font-mono-tabular text-xs text-slate-400 whitespace-nowrap">
          {history.length} files · {formatBytes(totalBytes)} stored
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by audio name, project, or language..."
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#12121A] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by voice"
          value={voiceFilter}
          onChange={(e) => setVoiceFilter(e.target.value)}
          className="h-11 rounded-xl border border-white/[0.08] bg-[#12121A] px-3.5 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Voices</option>
          {uniqueVoices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-10 text-center">
          <History className="mx-auto h-9 w-9 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-white">
            {history.length === 0 ? 'No audio exports saved yet' : 'No matching audio clips'}
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            {history.length === 0
              ? 'Generate chunks in the Voice Studio and click "Save to History" or export a narration to keep recordings accessible here.'
              : 'Adjust your search or voice filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const safeBase = item.name.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase();

            return (
              <div
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <AudioWaveform className="h-4 w-4 text-violet-400 shrink-0" />
                      <h2 className="font-display text-base font-semibold text-white truncate">
                        {item.name}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                      <span>Project: {item.projectTitle}</span>
                      <span aria-hidden="true">·</span>
                      <span>Voice: {item.voiceId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.languageLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {formatDuration(item.durationSec)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {item.format.toUpperCase()} ({formatBytes(item.sizeBytes)})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="h-10 rounded-lg bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500 whitespace-nowrap"
                    >
                      {isExpanded ? 'Hide Player' : 'Play & Waveform'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        triggerBlobDownload(item.audioBlob, `${safeBase}.${item.format}`)
                      }
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181822] px-3 text-xs font-medium text-slate-200 hover:border-violet-500/40 whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteEntry(item.id)}
                      aria-label={`Delete ${item.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <AudioPlayer
                    blob={item.audioBlob}
                    downloadBaseName={safeBase}
                    precomputedDuration={item.durationSec}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
