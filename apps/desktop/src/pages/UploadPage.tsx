import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Nav } from "../components/Nav";
import { fetchProviders, generateClips, uploadVideo } from "../lib/api";
import { getApiKey, listConfiguredProviders } from "../lib/credentials";
import type { ProviderDescriptor, ProviderKind } from "../lib/types";

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [kind, setKind] = useState<ProviderKind>("ollama");
  const [model, setModel] = useState("qwen3");
  const [numClips, setNumClips] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listConfiguredProviders().then(async (configured) => {
      const list = await fetchProviders(configured);
      setProviders(list);
      const defaultP = list.find((p) => p.kind === "ollama") || list[0];
      if (defaultP) {
        setKind(defaultP.kind);
        setModel(defaultP.default_model);
      }
    });
  }, []);

  const selected = providers.find((p) => p.kind === kind);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleGenerate = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const upload = await uploadVideo(file);
      const apiKey = selected?.requires_api_key ? await getApiKey(kind) : null;
      const { job_id } = await generateClips(
        upload.video_id,
        {
          kind,
          model,
          api_key: apiKey,
          base_url: kind === "ollama" ? "http://localhost:11434" : null,
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
          {file ? (
            <p>{file.name}</p>
          ) : (
            <p className="text-slate-400">Drag & drop a video, or</p>
          )}
          <input
            type="file"
            accept="video/*"
            className="mt-4 text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-400">LLM Provider</span>
            <select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as ProviderKind;
                setKind(k);
                const p = providers.find((x) => x.kind === k);
                if (p) setModel(p.default_model);
              }}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2"
            >
              {providers.map((p) => (
                <option key={p.kind} value={p.kind}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>

          {selected?.models.length ? (
            <label className="block">
              <span className="text-sm text-slate-400">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2"
              >
                {selected.models.map((m) => (
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
                value={model}
                onChange={(e) => setModel(e.target.value)}
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
          disabled={!file || uploading}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold"
        >
          {uploading ? "Processing..." : "Generate Clips"}
        </button>
      </main>
    </div>
  );
}
