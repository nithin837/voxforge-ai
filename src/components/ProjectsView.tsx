import {
  Check,
  Copy,
  Edit3,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { ProjectRecord } from '../types/studio';

interface ProjectsViewProps {
  projects: ProjectRecord[];
  activeProjectId: string;
  onCreateNew: () => void;
  onOpenProject: (projectId: string) => void;
  onRenameProject: (projectId: string, nextTitle: string) => void;
  onDuplicateProject: (project: ProjectRecord) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  activeProjectId,
  onCreateNew,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.scriptText.toLowerCase().includes(q) ||
        p.voiceId.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const startRename = (proj: ProjectRecord) => {
    setEditingId(proj.id);
    setDraftTitle(proj.title);
  };

  const commitRename = (projectId: string) => {
    const clean = draftTitle.trim();
    if (clean) {
      onRenameProject(projectId, clean);
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Projects</h1>
          <p className="mt-1 text-sm text-slate-400">
            Projects, scripts, voice configurations, and generated chunks autosave to your browser&apos;s IndexedDB storage.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter projects by title, script text, or voice..."
          className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#12121A] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-10 text-center">
          <FolderOpen className="mx-auto h-9 w-9 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-white">
            {projects.length === 0 ? 'No saved projects yet' : 'No matching projects'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {projects.length === 0
              ? 'Create a voiceover project to start writing scripts and synthesizing audio.'
              : 'Try clearing your search query.'}
          </p>
          {projects.length === 0 && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-4 h-11 rounded-xl bg-violet-600 px-5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              Create New Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((proj) => {
            const total = proj.chunks.length;
            const completed = proj.chunks.filter((c) => c.status === 'completed').length;
            const failed = proj.chunks.filter((c) => c.status === 'failed').length;
            const isCurrent = proj.id === activeProjectId;

            let statusText = 'Draft';
            if (total > 0 && completed === total) statusText = 'All Chunks Ready';
            else if (failed > 0) statusText = `${failed} Chunk(s) Need Retry`;
            else if (completed > 0) statusText = `In Progress (${completed}/${total})`;

            return (
              <div
                key={proj.id}
                className={`rounded-xl border bg-[#12121A] p-4 sm:p-5 transition-colors ${
                  isCurrent ? 'border-violet-500/50' : 'border-white/[0.08]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {editingId === proj.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(proj.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="h-10 flex-1 rounded-lg border border-violet-500 bg-[#09090D] px-3 text-sm text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(proj.id)}
                          aria-label="Confirm rename"
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel rename"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-semibold text-white truncate">
                          {proj.title}
                        </h2>
                        {isCurrent && (
                          <span className="text-xs font-medium text-violet-300">
                            · Open in Studio
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                      <span>Voice: {proj.voiceId}</span>
                      <span aria-hidden="true">·</span>
                      <span>Model: {proj.modelId === 'gemini-3.8-flash-tts' ? '3.8 Flash' : '3.8 Flash Lite'}</span>
                      <span aria-hidden="true">·</span>
                      <span className={failed > 0 ? 'text-rose-300' : completed === total && total > 0 ? 'text-emerald-300' : 'text-slate-300'}>
                        {statusText}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        Modified {new Date(proj.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-xs text-slate-500">
                      {proj.scriptText.trim() || 'Empty script — click Continue Editing to write or paste Telugu/English copy.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj.id)}
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500 whitespace-nowrap"
                    >
                      <span>{isCurrent ? 'Go to Studio' : 'Continue Editing'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startRename(proj)}
                      aria-label={`Rename ${proj.title}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-white"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj)}
                      aria-label={`Duplicate ${proj.title}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-300 hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {confirmDeleteId === proj.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteProject(proj.id);
                            setConfirmDeleteId(null);
                          }}
                          className="h-10 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500 whitespace-nowrap"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-10 rounded-lg border border-white/10 px-2.5 text-xs text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(proj.id)}
                        aria-label={`Delete ${proj.title}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#181822] text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
