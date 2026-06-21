import type {
  ClipRecord,
  HealthResponse,
  JobStatus,
  ProviderConfig,
  ProviderDescriptor,
  UploadResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8765";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, init);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || resp.statusText);
  }
  return resp.json() as Promise<T>;
}

export function getApiBase(): string {
  return API_BASE;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request("/api/health");
}

export async function fetchProviders(configuredKinds: string[]): Promise<ProviderDescriptor[]> {
  const headers: Record<string, string> = {};
  if (configuredKinds.length) {
    headers["X-Configured-Providers"] = configuredKinds.join(",");
  }
  const data = await request<{ providers: ProviderDescriptor[] }>("/api/providers", { headers });
  return data.providers;
}

export async function testProvider(config: ProviderConfig) {
  return request<{ ok: boolean; error?: string; latency_ms?: number }>("/api/providers/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}

export async function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(await resp.text());
  onProgress?.(100);
  return resp.json();
}

export async function generateClips(
  videoId: string,
  provider: ProviderConfig,
  numClips: number,
  language?: string,
): Promise<{ job_id: string }> {
  return request("/api/generate-clips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId, provider, num_clips: numClips, language }),
  });
}

export async function fetchJob(jobId: string): Promise<JobStatus> {
  return request(`/api/jobs/${jobId}`);
}

export async function fetchClips(videoId: string): Promise<ClipRecord[]> {
  const data = await request<{ clips: ClipRecord[] }>(`/api/clips/${videoId}`);
  return data.clips;
}

export function clipDownloadUrl(clipId: string): string {
  return `${API_BASE}/api/download/${clipId}`;
}
