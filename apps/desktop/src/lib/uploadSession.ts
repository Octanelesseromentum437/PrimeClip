import type { UploadResponse } from "./types";

export type SourceTab = "file" | "url" | "drive";

export interface PersistedUploadState {
  sourceTab: SourceTab;
  importUrl: string;
  importId: string | null;
  readyVideo: UploadResponse | null;
  activeGeneration: { videoId: string; jobId: string } | null;
}

const STORAGE_KEY = "primeclip-upload-session";

const DEFAULT: PersistedUploadState = {
  sourceTab: "file",
  importUrl: "",
  importId: null,
  readyVideo: null,
  activeGeneration: null,
};

export function loadUploadSession(): PersistedUploadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<PersistedUploadState>;
    return {
      sourceTab: parsed.sourceTab ?? DEFAULT.sourceTab,
      importUrl: parsed.importUrl ?? DEFAULT.importUrl,
      importId: parsed.importId ?? null,
      readyVideo: parsed.readyVideo ?? null,
      activeGeneration: parsed.activeGeneration ?? null,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveUploadSession(state: PersistedUploadState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function patchUploadSession(patch: Partial<PersistedUploadState>): PersistedUploadState {
  const next = { ...loadUploadSession(), ...patch };
  saveUploadSession(next);
  return next;
}

export function clearActiveGeneration(): void {
  patchUploadSession({ activeGeneration: null });
}
