import type {
  CaptionEditResponse,
  CaptionCue,
  CaptionStyle,
  CaptionStyleName,
  ClipRecord,
  HealthResponse,
  JobStatus,
  ProviderConfig,
  ProviderDescriptor,
  UploadResponse,
  VideoDetail,
  VideoSummary,
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
  aspectRatio?: "9:16" | "16:9",
): Promise<{ job_id: string }> {
  return request("/api/generate-clips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_id: videoId,
      provider,
      num_clips: numClips,
      language,
      aspect_ratio: aspectRatio ?? "9:16",
    }),
  });
}

export async function fetchJob(jobId: string): Promise<JobStatus> {
  return request(`/api/jobs/${jobId}`);
}

export async function cancelJob(jobId: string): Promise<JobStatus> {
  return request(`/api/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function fetchClips(videoId: string): Promise<ClipRecord[]> {
  const data = await request<{ clips: ClipRecord[] }>(`/api/clips/${videoId}`);
  return data.clips;
}

export async function clipDownloadUrl(clipId: string, resolution?: string): Promise<string> {
  const base = await resolveApiBase();
  const params = resolution ? `?resolution=${encodeURIComponent(resolution)}` : "";
  return `${base}/api/download/${clipId}${params}`;
}

export async function fetchClipQualities(
  clipId: string,
): Promise<{ resolutions: string[]; aspect_ratio: string }> {
  return request<{ resolutions: string[]; aspect_ratio: string }>(
    `/api/download/${clipId}/qualities`,
  );
}

export async function clipPreviewUrl(clipId: string, resolution?: string): Promise<string> {
  const base = await resolveApiBase();
  const params = resolution ? `?resolution=${encodeURIComponent(resolution)}` : "";
  return `${base}/api/download/${clipId}/preview${params}`;
}

export async function clipThumbnailUrl(clipId: string): Promise<string> {
  const base = await resolveApiBase();
  return `${base}/api/download/${clipId}/thumbnail`;
}

export async function fetchSystemFonts(): Promise<string[]> {
  const data = await request<{ fonts: string[] }>("/api/fonts");
  return data.fonts;
}

export async function fetchVideos(): Promise<VideoSummary[]> {
  const data = await request<{ videos: VideoSummary[] }>("/api/videos");
  return data.videos;
}

export async function fetchVideo(videoId: string): Promise<VideoDetail> {
  return request<VideoDetail>(`/api/videos/${videoId}`);
}

export async function deleteVideo(videoId: string): Promise<void> {
  const base = await resolveApiBase();
  const resp = await fetch(`${base}/api/videos/${videoId}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(await resp.text());
}

export async function videoSourceUrl(videoId: string): Promise<string> {
  const base = await resolveApiBase();
  return `${base}/api/videos/${videoId}/source`;
}

export async function fetchCaptions(clipId: string): Promise<CaptionEditResponse> {
  return request<CaptionEditResponse>(`/api/clips/${clipId}/captions`);
}

export async function patchCaptions(
  clipId: string,
  patch: {
    cues?: CaptionCue[];
    style?: Partial<CaptionStyle>;
    preset?: CaptionStyleName;
    words_per_screen?: number;
  },
): Promise<CaptionEditResponse> {
  return request<CaptionEditResponse>(`/api/clips/${clipId}/captions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function rerenderClip(clipId: string): Promise<{ clip_id: string; status: string }> {
  return request(`/api/clips/${clipId}/re-render`, { method: "POST" });
}

export async function importFromUrl(url: string): Promise<{ import_id: string; status: string }> {
  return request("/api/upload/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function fetchImportStatus(importId: string): Promise<{
  import_id: string;
  status: string;
  progress_pct: number;
  video_id: string | null;
  filename: string | null;
  error_message: string | null;
}> {
  return request(`/api/upload/url/${importId}`);
}

export async function fetchDriveAuthUrl(): Promise<string> {
  const data = await request<{ url: string }>("/api/drive/auth-url");
  return data.url;
}

export async function exchangeDriveCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string | null;
}> {
  return request("/api/drive/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function fetchDriveFiles(accessToken: string): Promise<
  { id: string; name: string; mime_type: string; size: number | null }[]
> {
  const data = await request<{ files: { id: string; name: string; mime_type: string; size: number | null }[] }>(
    "/api/drive/files",
    { headers: { "X-Google-Access-Token": accessToken } },
  );
  return data.files;
}

export async function uploadFromDrive(
  fileId: string,
  filename: string,
  accessToken: string,
): Promise<UploadResponse> {
  return request<UploadResponse>("/api/upload/drive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Google-Access-Token": accessToken,
    },
    body: JSON.stringify({ file_id: fileId, filename }),
  });
}
