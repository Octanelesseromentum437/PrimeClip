import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Nav } from "../components/Nav";
import { generateClips, uploadVideo, uploadVideoPath } from "../lib/api";
import { getApiKey } from "../lib/credentials";
import { loadProviders, resolveModelForProvider } from "../lib/providers";
import { isTauriApp, pickVideoFile } from "../lib/tauri";
import type { ProviderDescriptor, ProviderKind } from "../lib/types";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
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

  const selectedLabel = localPath?.split(/[/\\]/).pop() ?? file?.name ?? null;

  const handleGenerate = async () => {
    if (!file && !localPath) return;
    setUploading(true);
    setError(null);
    try {
      const upload = localPath ? await uploadVideoPath(localPath) : await uploadVideo(file!);
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

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-brand-500 transition-colors"
        >
          {selectedLabel ? (
            <p>{selectedLabel}</p>
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
        </div>

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
          disabled={(!file && !localPath) || uploading || providersLoading}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold"
        >
          {uploading ? "Processing..." : "Generate Clips"}
        </button>
      </main>
    </div>
  );
}
