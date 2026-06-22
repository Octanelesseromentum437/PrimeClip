import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Nav } from "../components/Nav";
import {
  exchangeDriveCode,
  fetchDriveAuthUrl,
  fetchDriveFiles,
  fetchImportStatus,
  generateClips,
  importFromUrl,
  uploadFromDrive,
  uploadVideo,
  uploadVideoPath,
} from "../lib/api";
import {
  deleteGoogleTokens,
  getApiKey,
  getGoogleAccessToken,
  storeGoogleTokens,
} from "../lib/credentials";
import { loadProviders, resolveModelForProvider } from "../lib/providers";
import { isTauriApp, pickVideoFile } from "../lib/tauri";
import type { ProviderDescriptor, ProviderKind, UploadResponse } from "../lib/types";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

type SourceTab = "file" | "url" | "drive";

export function UploadPage() {
  const navigate = useNavigate();
  const [sourceTab, setSourceTab] = useState<SourceTab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [readyVideo, setReadyVideo] = useState<UploadResponse | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<
    { id: string; name: string; mime_type: string; size: number | null }[]
  >([]);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string>("");
  const [authCode, setAuthCode] = useState("");
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [kind, setKind] = useState<ProviderKind>("ollama");
  const [model, setModel] = useState("");
  const [numClips, setNumClips] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProviders = useCallback(async () => {
    setProvidersLoading(true);
    const { providers: list, error: loadError } = await loadProviders();
    setProviders(list);
    setProvidersError(loadError);
    setProvidersLoading(false);

    if (list.length === 0) return;

    setKind((currentKind) => {
      const active =
        list.find((p) => p.kind === currentKind) ||
        list.find((p) => p.kind === "ollama") ||
        list[0];
      return active.kind;
    });
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const selected = providers.find((p) => p.kind === kind);
  const modelOptions = selected?.models ?? [];
  const modelValue = resolveModelForProvider(selected, model);

  useEffect(() => {
    if (!selected) return;
    setModel((current) => resolveModelForProvider(selected, current));
  }, [selected, modelOptions.join(",")]);

  const onProviderChange = (nextKind: ProviderKind) => {
    const provider = providers.find((p) => p.kind === nextKind);
    if (!provider) return;
    setKind(nextKind);
    setModel(resolveModelForProvider(provider, model));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setLocalPath(null);
    }
  }, []);

  const onBrowse = useCallback(async () => {
    if (isTauriApp()) {
      try {
        const path = await pickVideoFile();
        if (path) {
          setLocalPath(path);
          setFile(null);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open file picker");
      }
      return;
    }
    document.getElementById("video-file-input")?.click();
  }, []);

  useEffect(() => {
    refreshProviders();
    getGoogleAccessToken().then(setDriveToken);
  }, [refreshProviders]);

  const startDriveAuth = async () => {
    try {
      const url = await fetchDriveAuthUrl();
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Drive auth unavailable");
    }
  };

  const completeDriveAuth = async () => {
    if (!authCode.trim()) return;
    try {
      const tokens = await exchangeDriveCode(authCode.trim());
      await storeGoogleTokens(tokens.access_token, tokens.refresh_token);
      setDriveToken(tokens.access_token);
      setAuthCode("");
      await refreshDriveFiles(tokens.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google auth failed");
    }
  };

  const refreshDriveFiles = async (token?: string) => {
    const accessToken = token ?? driveToken;
    if (!accessToken) return;
    try {
      const files = await fetchDriveFiles(accessToken);
      setDriveFiles(files);
      if (files.length) setSelectedDriveFileId(files[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list Drive files");
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;
    setUploading(true);
    setError(null);
    setImportProgress(0);
    try {
      const { import_id } = await importFromUrl(importUrl.trim());
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        const status = await fetchImportStatus(import_id);
        setImportProgress(status.progress_pct);
        if (status.status === "completed" && status.video_id) {
          setReadyVideo({
            video_id: status.video_id,
            filename: status.filename ?? "imported video",
            duration_sec: 0,
          });
          break;
        }
        if (status.status === "failed") {
          throw new Error(status.error_message ?? "Import failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
      setImportProgress(null);
    }
  };

  const resolveUpload = async (): Promise<UploadResponse> => {
    if (readyVideo && sourceTab !== "file") return readyVideo;
    if (sourceTab === "drive") {
      if (!driveToken || !selectedDriveFileId) throw new Error("Select a Google Drive file");
      const selected = driveFiles.find((f) => f.id === selectedDriveFileId);
      return uploadFromDrive(selectedDriveFileId, selected?.name ?? "source.mp4", driveToken);
    }
    if (localPath) return uploadVideoPath(localPath);
    if (file) return uploadVideo(file);
    throw new Error("No video selected");
  };

  const canGenerate =
    sourceTab === "file"
      ? Boolean(file || localPath)
      : sourceTab === "url"
        ? Boolean(readyVideo)
        : Boolean(driveToken && selectedDriveFileId);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setUploading(true);
    setError(null);
    try {
      const upload = await resolveUpload();
      const apiKey = selected?.requires_api_key ? await getApiKey(kind) : null;
      const { job_id } = await generateClips(
        upload.video_id,
        {
          kind,
          model: modelValue,
          api_key: apiKey,
          base_url: kind === "ollama" ? DEFAULT_OLLAMA_URL : null,
        },
        numClips,
      );
      navigate(`/results/${upload.video_id}?job=${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Generate Clips</h1>

        <div className="flex gap-2 text-sm">
          {(["file", "url", "drive"] as SourceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSourceTab(tab)}
              className={`px-3 py-1.5 rounded-lg capitalize ${
                sourceTab === tab ? "bg-brand-600" : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {tab === "file" ? "Local file" : tab === "url" ? "URL" : "Google Drive"}
            </button>
          ))}
        </div>

        {sourceTab === "file" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-brand-500 transition-colors"
        >
          {(localPath?.split(/[/\\]/).pop() ?? file?.name) ? (
            <p>{localPath?.split(/[/\\]/).pop() ?? file?.name}</p>
          ) : (
            <p className="text-slate-400">Drag & drop a video, or</p>
          )}
          {isTauriApp() ? (
            <button
              type="button"
              onClick={onBrowse}
              className="mt-4 text-sm text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              Choose video file
            </button>
          ) : (
            <input
              id="video-file-input"
              type="file"
              accept="video/*"
              className="mt-4 text-sm"
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setFile(next);
                setLocalPath(null);
              }}
            />
          )}
          )}
        </div>
        )}

        {sourceTab === "url" && (
          <div className="rounded-xl border border-slate-700 p-6 space-y-4">
            <p className="text-sm text-slate-400">
              Paste a public YouTube, Vimeo, or Google Drive link. Respect copyright and platform terms.
            </p>
            <input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm"
            />
            <button
              type="button"
              onClick={handleUrlImport}
              disabled={uploading || !importUrl.trim()}
              className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
            >
              {uploading ? `Downloading… ${importProgress ?? 0}%` : "Download video"}
            </button>
            {readyVideo && (
              <p className="text-sm text-green-400">Ready: {readyVideo.filename}</p>
            )}
          </div>
        )}

        {sourceTab === "drive" && (
          <div className="rounded-xl border border-slate-700 p-6 space-y-4">
            {!driveToken ? (
              <>
                <button
                  type="button"
                  onClick={startDriveAuth}
                  className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                >
                  Connect Google Drive
                </button>
                <input
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste authorization code"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm"
                />
                <button
                  type="button"
                  onClick={completeDriveAuth}
                  className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-500"
                >
                  Complete sign-in
                </button>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => refreshDriveFiles()}
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-800"
                  >
                    Refresh files
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteGoogleTokens();
                      setDriveToken(null);
                      setDriveFiles([]);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
                <select
                  value={selectedDriveFileId}
                  onChange={(e) => setSelectedDriveFileId(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                >
                  {driveFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-400">LLM Provider</span>
            <select
              value={kind}
              disabled={providersLoading || providers.length === 0}
              onChange={(e) => onProviderChange(e.target.value as ProviderKind)}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2 disabled:opacity-50"
            >
              {providers.map((p) => (
                <option key={p.kind} value={p.kind}>
                  {p.display_name}
                  {p.kind === "ollama" && p.configured ? " · online" : ""}
                  {p.requires_api_key && p.configured ? " · configured" : ""}
                </option>
              ))}
            </select>
          </label>

          {providersLoading && (
            <p className="text-sm text-slate-500">Loading providers…</p>
          )}

          {providersError && (
            <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200 space-y-2">
              <p>{providersError}</p>
              <button
                type="button"
                onClick={refreshProviders}
                className="text-amber-100 underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {selected?.requires_api_key && !selected.configured && (
            <p className="text-sm text-amber-300">
              This provider needs an API key. Add it in Settings before generating clips.
            </p>
          )}

          {modelOptions.length ? (
            <label className="block">
              <span className="text-sm text-slate-400">Model</span>
              <select
                value={modelValue}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm text-slate-400">Model</span>
              <input
                value={modelValue}
                onChange={(e) => setModel(e.target.value)}
                placeholder={selected?.default_model || "model name"}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm text-slate-400">Number of clips: {numClips}</span>
            <input
              type="range"
              min={1}
              max={20}
              value={numClips}
              onChange={(e) => setNumClips(Number(e.target.value))}
              className="w-full mt-2"
            />
          </label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || uploading || providersLoading}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold"
        >
          {uploading ? "Processing..." : "Generate Clips"}
        </button>
      </main>
    </div>
  );
}
