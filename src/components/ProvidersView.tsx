import {
  CheckCircle2,
  HardDrive,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { FUTURE_ROADMAP_FEATURES } from '../data/studioCatalog';
import { formatBytes } from '../services/audioProcessorService';
import { getStorageUsageInfo } from '../services/storageService';
import type { ProviderStatusInfo } from '../types/studio';

interface ProvidersViewProps {
  providers: ProviderStatusInfo[];
  onRefreshProviders: () => Promise<void>;
  onClearAudioHistory: () => Promise<void>;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  providers,
  onRefreshProviders,
  onClearAudioHistory,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    usageBytes: number | null;
    quotaBytes: number | null;
  }>({ usageBytes: null, quotaBytes: null });
  const [clearingHistory, setClearingHistory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    getStorageUsageInfo().then(setStorageInfo);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshProviders();
      const updated = await getStorageUsageInfo();
      setStorageInfo(updated);
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    try {
      await onClearAudioHistory();
      setConfirmClear(false);
      const updated = await getStorageUsageInfo();
      setStorageInfo(updated);
    } finally {
      setClearingHistory(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Providers, Capabilities &amp; Privacy
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Inspect active speech synthesis backends, supported features, local storage limits, and unavailable roadmap capabilities.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#12121A] px-4 text-xs font-semibold text-white hover:border-violet-500/40 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Security & API Key Architecture Notice */}
      <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h2 className="font-display text-base font-semibold text-white">
              Server-Side API Key Security &amp; Privacy
            </h2>
            <p className="text-xs leading-relaxed text-slate-300">
              All speech synthesis and Roman Telugu transliteration calls run strictly on the VOXFORGE AI Express backend using the server environment variable <span className="font-mono-tabular text-violet-300">GEMINI_API_KEY</span> managed in AI Studio&apos;s <strong className="text-white">Settings &gt; Secrets</strong> panel. No private credentials are bundled into browser JavaScript or stored in client forms.
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              Your scripts, voice settings, and generated audio files are stored privately inside your local browser&apos;s IndexedDB and are never retained on an external database.
            </p>
          </div>
        </div>
      </section>

      {/* Provider Adapters List */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">
          Configured TTS Provider Adapters
        </h2>

        <div className="space-y-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-violet-400 shrink-0" />
                  <div>
                    <h3 className="font-display text-base font-semibold text-white">
                      {provider.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {provider.documentationHint}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0">
                  {provider.available ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-300">Active &amp; Ready</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-amber-400" />
                      <span className="text-amber-300">Unavailable</span>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#09090D] border border-white/[0.05] px-3.5 py-2.5 text-xs text-slate-300">
                Status: {provider.statusMessage}
              </div>

              {provider.models.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-slate-400">
                        <th className="py-2 pr-4 font-medium">Model</th>
                        <th className="py-2 pr-4 font-medium">Chunk Limit</th>
                        <th className="py-2 pr-4 font-medium">Voice Design</th>
                        <th className="py-2 pr-4 font-medium">Vocal Tags</th>
                        <th className="py-2 pr-4 font-medium">te-IN &amp; Seed Lock</th>
                        <th className="py-2 pr-4 font-medium">Pitch / Stability</th>
                        <th className="py-2 font-medium">Languages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05] text-slate-300">
                      {provider.models.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 pr-4 font-medium text-white whitespace-nowrap">
                            {m.displayName}
                          </td>
                          <td className="py-3 pr-4 font-mono-tabular whitespace-nowrap">
                            {m.maxCharsPerChunk} chars
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {m.supportsVoiceDesign ? 'Supported' : 'Preset voices only'}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {m.supportsNativeVocalTags
                              ? 'Native (<breath>, <gasp>, <laugh>)'
                              : 'Adapted / stripped'}
                          </td>
                          <td className="py-3 pr-4 text-emerald-300 whitespace-nowrap">
                            {m.supportsLanguageCode && m.supportsSeedConsistency
                              ? 'Verified (te-IN + seed)'
                              : 'Partial'}
                          </td>
                          <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
                            Disabled (not exposed by API)
                          </td>
                          <td className="py-3 text-slate-400">
                            {m.supportedLanguages.join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Local Storage Quota & Cleanup */}
      <section className="rounded-xl border border-white/[0.08] bg-[#12121A] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <HardDrive className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Browser Storage &amp; Audio Retention
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Uncompressed 24 kHz WAV chunks consume roughly 2.8 MB per minute of audio. Delete old history exports periodically to preserve mobile browser storage.
              </p>
              {storageInfo.usageBytes !== null && (
                <p className="mt-2 font-mono-tabular text-xs text-slate-300">
                  Used: {formatBytes(storageInfo.usageBytes)}
                  {storageInfo.quotaBytes
                    ? ` · Available Browser Quota: ${formatBytes(storageInfo.quotaBytes)}`
                    : ''}
                </p>
              )}
            </div>
          </div>

          {confirmClear ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={clearingHistory}
                className="h-10 rounded-lg bg-rose-600 px-3.5 text-xs font-semibold text-white hover:bg-rose-500 whitespace-nowrap"
              >
                {clearingHistory ? 'Clearing...' : 'Confirm Clear History'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-10 rounded-lg border border-white/10 px-3 text-xs text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181822] px-3.5 text-xs font-medium text-slate-200 hover:border-rose-500/40 hover:text-rose-200 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Audio History</span>
            </button>
          )}
        </div>
      </section>

      {/* Unavailable Future Features (Phase 4) */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            Upcoming Studio Modules (Currently Unavailable)
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Planned production tools explicitly marked unavailable until underlying model endpoints and consent workflows are enabled.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FUTURE_ROADMAP_FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="rounded-xl border border-white/[0.06] bg-[#0F0F16] p-4 opacity-80"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200">
                  {feat.title}
                </span>
                <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {feat.description}
              </p>
              <p className="mt-2 text-[11px] font-medium text-slate-500">
                {feat.status}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
