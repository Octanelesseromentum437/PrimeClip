import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Nav } from "../components/Nav";
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="flex gap-4">
        <div className="w-24 h-40 shrink-0 rounded-lg overflow-hidden bg-slate-800">
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
          <p className="text-sm text-slate-400">{formatDuration(video.duration_sec)}</p>
          <p className="text-sm text-slate-400">{formatDate(video.created_at)}</p>
          <p className="text-sm">
            <span className="text-slate-400">Status: </span>
            {statusLabel(video.latest_job_status)}
          </p>
          <p className="text-sm text-slate-400">{video.clip_count} clips</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleViewResults}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700"
        >
          View results
        </button>
        <button
          type="button"
          onClick={() => setShowGenerate((v) => !v)}
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 hover:bg-brand-500"
        >
          Generate new clips
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="px-3 py-1.5 text-sm rounded-lg text-red-400 hover:bg-red-950/40"
        >
          Delete
        </button>
      </div>

      {showGenerate && (
        <div className="rounded-lg border border-slate-700 p-3 space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Provider</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ProviderKind)}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
            >
              {providers.map((p) => (
                <option key={p.kind} value={p.kind}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Clips: {numClips}</span>
            <input
              type="range"
              min={1}
              max={20}
              value={numClips}
              onChange={(e) => setNumClips(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !selected}
            className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-semibold"
          >
            {generating ? "Starting…" : "Start generation"}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
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
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Library</h1>
          <Link
            to="/"
            className="text-sm text-brand-400 hover:text-brand-300"
          >
            Upload new video
          </Link>
        </div>

        {loading && <p className="text-slate-400">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && videos.length === 0 && (
          <p className="text-slate-400">
            No uploads yet.{" "}
            <Link to="/" className="text-brand-400 hover:underline">
              Upload a video
            </Link>
          </p>
        )}

        <div className="space-y-4">
          {videos.map((video) => (
            <VideoRow key={video.id} video={video} onDeleted={refresh} />
          ))}
        </div>
      </main>
    </div>
  );
}
