import { GEMINI_MODELS, VOICE_DESIGN_PRESETS } from '../data/studioCatalog';
import type { AudioHistoryRecord, ProjectRecord } from '../types/studio';

const DB_NAME = 'voxforge-studio-db';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const HISTORY_STORE = 'audioHistory';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

export function generateVoiceSeed(): number {
  return Math.floor(100000 + Math.random() * 899999);
}

export function createBlankProject(overrides?: Partial<ProjectRecord>): ProjectRecord {
  const now = Date.now();
  const defaultPreset = VOICE_DESIGN_PRESETS[0];
  return {
    id: `proj_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: 'Untitled Telugu Narration',
    createdAt: now,
    updatedAt: now,
    scriptText: '',
    scriptLanguageMode: 'auto',
    languageCodeOverride: 'te-IN',
    lockVoiceConsistency: true,
    voiceSeed: generateVoiceSeed(),
    transliteratedPreview: '',
    providerId: 'gemini',
    modelId: 'gemini-3.8-flash-tts',
    voiceId: 'Charon',
    useVoiceDesign: true,
    voiceDesignPresetId: defaultPreset.id,
    voiceDesignPrompt: defaultPreset.description,
    emotionPreset: defaultPreset.defaultEmotion,
    emotionalIntensity: 'Balanced',
    speedPreset: defaultPreset.defaultSpeed,
    speakingStyleNote: '',
    chunkSizePreset: 'medium',
    customChunkSize: GEMINI_MODELS['gemini-3.8-flash-tts'].recommendedChunkChars,
    pauseDurationMs: 450,
    normalizeVolume: true,
    parallelChunks: false,
    chunks: [],
    ...overrides,
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as ProjectRecord[]) || [];
      rows.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error || new Error('Failed to load projects'));
  });
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const db = await openDb();
  // Never store transient 'generating' status on disk
  const cleanProject: ProjectRecord = {
    ...project,
    updatedAt: Date.now(),
    chunks: project.chunks.map((c) =>
      c.status === 'generating' ? { ...c, status: 'pending' } : c
    ),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.put(cleanProject);
    req.onsuccess = () => resolve(cleanProject);
    req.onerror = () => reject(req.error || new Error('Failed to save project in local storage'));
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to delete project'));
  });
}

export async function duplicateProject(source: ProjectRecord): Promise<ProjectRecord> {
  const now = Date.now();
  const copy: ProjectRecord = {
    ...source,
    id: `proj_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: `${source.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    chunks: source.chunks.map((c, idx) => ({
      ...c,
      id: `chunk_${now}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    })),
  };
  return saveProject(copy);
}

export async function listAudioHistory(): Promise<AudioHistoryRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as AudioHistoryRecord[]) || [];
      rows.sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error || new Error('Failed to load audio history'));
  });
}

export async function saveAudioHistoryItem(
  item: AudioHistoryRecord
): Promise<AudioHistoryRecord> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error || new Error('Failed to save audio to history'));
  });
}

export async function deleteAudioHistoryItem(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to delete audio entry'));
  });
}

export async function clearAudioHistory(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to clear audio history'));
  });
}

export async function getStorageUsageInfo(): Promise<{
  usageBytes: number | null;
  quotaBytes: number | null;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return {
        usageBytes: typeof est.usage === 'number' ? est.usage : null,
        quotaBytes: typeof est.quota === 'number' ? est.quota : null,
      };
    } catch {
      return { usageBytes: null, quotaBytes: null };
    }
  }
  return { usageBytes: null, quotaBytes: null };
}
