import type {
  ClipRecord,
  HealthResponse,
  JobStatus,
  ProviderConfig,
  ProviderDescriptor,
  UploadResponse,
} from "./types";

const DEFAULT_API_BASE = "http://127.0.0.1:8765";

let apiBasePromise: Promise<string> | null = null;

export async function resolveApiBase(): Promise<string> {
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL;
      }
      try {
        const { getApiBaseUrl } = await import("./credentials");
        return await getApiBaseUrl();
      } catch {
        return DEFAULT_API_BASE;
      }
    })();
  }
  return apiBasePromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await resolveApiBase();
  let resp: Response;
  try {
    resp = await fetch(`${base}${path}`, init);
  } catch (err) {
    throw new Error(formatFetchError(err));
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || resp.statusText);
  }
  return resp.json() as Promise<T>;
}

function formatFetchError(err: unknown): string {
  if (err instanceof TypeError) {
    const message = err.message.toLowerCase();
    if (message.includes("load failed") || message.includes("failed to fetch")) {
      return "Could not reach the PrimeClip API. Run `make dev-api` in another terminal.";
    }
  }
  return err instanceof Error ? err.message : "Network request failed";
}

export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
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
  const base = await resolveApiBase();
  const form = new FormData();
  form.append("file", file);
  let resp: Response;
  try {
    resp = await fetch(`${base}/api/upload`, { method: "POST", body: form });
  } catch (err) {
    throw new Error(formatFetchError(err));
  }
  if (!resp.ok) throw new Error(await resp.text());
  onProgress?.(100);
  return resp.json();
}

export async function uploadVideoPath(path: string): Promise<UploadResponse> {
  return request<UploadResponse>("/api/upload/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
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

export async function clipDownloadUrl(clipId: string): Promise<string> {
  const base = await resolveApiBase();
  return `${base}/api/download/${clipId}`;
}
