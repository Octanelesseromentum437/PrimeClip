import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteVideo, fetchVideos, generateClips, videoSourceUrl } from "../lib/api";
import { getApiKey } from "../lib/credentials";
import { loadProviders, resolveModelForProvider } from "../lib/providers";
import type { ProviderDescriptor, ProviderKind, VideoSummary } from "../lib/types";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function statusLabel(status: string | null): string {
  if (!status) return "No jobs";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function VideoRow({
  video,
  onDeleted,
}: {
  video: VideoSummary;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [kind, setKind] = useState<ProviderKind>("ollama");
  const [model, setModel] = useState("");
  const [numClips, setNumClips] = useState(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    videoSourceUrl(video.id).then(setSourceUrl);
  }, [video.id]);

  useEffect(() => {
    if (!showGenerate) return;
    loadProviders().then(({ providers: list }) => {
      setProviders(list);
      const active = list.find((p) => p.kind === "ollama") || list[0];
      if (active) {
        setKind(active.kind);
        setModel(resolveModelForProvider(active, ""));
      }
    });
  }, [showGenerate]);

  const selected = providers.find((p) => p.kind === kind);

  const handleViewResults = () => {
    const params = video.latest_job_id ? `?job=${video.latest_job_id}` : "";
    navigate(`/results/${video.id}${params}`);
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setError(null);
    try {
      const apiKey = selected.requires_api_key ? await getApiKey(kind) : null;
      const { job_id } = await generateClips(
        video.id,
        {
          kind,
          model: resolveModelForProvider(selected, model),
          api_key: apiKey,
          base_url: kind === "ollama" ? DEFAULT_OLLAMA_URL : null,
        },
        numClips,
      );
      navigate(`/results/${video.id}?job=${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${video.filename}" and all its clips?`)) return;
    try {
      await deleteVideo(video.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="card-muted p-4 space-y-3">
      <div className="flex gap-4">
        <div className="w-24 h-40 shrink-0 rounded-lg overflow-hidden bg-app-muted">
          {sourceUrl && (
            <video
              src={sourceUrl}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="font-semibold truncate">{video.filename}</h2>
          <p className="text-sm text-muted">{formatDuration(video.duration_sec)}</p>
          <p className="text-sm text-muted">{formatDate(video.created_at)}</p>
          <p className="text-sm">
            <span className="text-muted">Status: </span>
            {statusLabel(video.latest_job_status)}
          </p>
          <p className="text-sm text-muted">{video.clip_count} clips</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleViewResults}
          className="btn-ghost"
        >
          View results
        </button>
        <button
          type="button"
          onClick={() => setShowGenerate((v) => !v)}
          className="btn-ghost bg-brand-600 hover:bg-brand-500 text-white"
        >
          Generate new clips
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="btn-ghost text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          Delete
        </button>
      </div>

      {showGenerate && (
        <div className="rounded-lg border border-app-border p-3 space-y-3">
          <label className="block">
            <span className="label-xs">Provider</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ProviderKind)}
              className="input mt-1"
            >
              {providers.map((p) => (
                <option key={p.kind} value={p.kind}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-xs">Clips: {numClips}</span>
            <input
              type="range"
              min={1}
              max={20}
              value={numClips}
              onChange={(e) => setNumClips(Number(e.target.value))}
              className="w-full mt-1 accent-brand-600"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !selected}
            className="w-full btn-primary text-sm"
          >
            {generating ? "Starting…" : "Start generation"}
          </button>
        </div>
      )}

      {error && <p className="text-error">{error}</p>}
    </div>
  );
}

export function LibraryPage() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVideos(await fetchVideos());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="page-shell space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-subtitle">Your uploaded videos and generated clips</p>
        </div>
        <Link to="/" className="btn-primary shrink-0">
          Upload new video
        </Link>
      </header>

        {loading && <p className="text-muted">Loading…</p>}
        {error && <p className="text-error">{error}</p>}

        {!loading && videos.length === 0 && (
          <p className="text-muted">
            No uploads yet.{" "}
            <Link to="/" className="link-brand">
              Upload a video
            </Link>
          </p>
        )}

        <div className="space-y-4">
          {videos.map((video) => (
            <VideoRow key={video.id} video={video} onDeleted={refresh} />
          ))}
        </div>
    </div>
  );
}
