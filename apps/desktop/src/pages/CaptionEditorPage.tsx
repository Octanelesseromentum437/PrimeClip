import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import {
  clipDownloadUrl,
  fetchCaptions,
  patchCaptions,
  rerenderClip,
} from "../lib/api";
import { webVttBlobUrl } from "../lib/webvtt";
import type { CaptionCue, CaptionStyle, CaptionStyleName } from "../lib/types";

const PRESETS: { id: CaptionStyleName; label: string }[] = [
  { id: "reels", label: "Reels" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "podcast", label: "Podcast" },
];

const FONTS = ["Impact", "Arial", "Helvetica", "Georgia", "Verdana"];

export function CaptionEditorPage() {
  const { videoId, clipId } = useParams<{ videoId: string; clipId: string }>();
  const navigate = useNavigate();
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [style, setStyle] = useState<CaptionStyle | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vttUrl, setVttUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clipId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCaptions(clipId);
      setCues(data.cues);
      setStyle(data.style);
      setVideoUrl(await clipDownloadUrl(clipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load captions");
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (vttUrl) URL.revokeObjectURL(vttUrl);
    const url = webVttBlobUrl(cues);
    setVttUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cues]);

  const overlayStyle = useMemo(
    () =>
      style
        ? {
            fontFamily: style.font_family,
            fontSize: `${Math.max(14, style.font_size / 4)}px`,
            color: style.primary_color,
            fontWeight: style.bold ? 700 : 400,
            textShadow: `0 0 ${style.outline_width}px ${style.outline_color}, 0 0 ${style.outline_width * 2}px ${style.outline_color}`,
          }
        : undefined,
    [style],
  );

  const updateCue = (index: number, field: keyof CaptionCue, value: string | number) => {
    setCues((prev) =>
      prev.map((cue, i) => (i === index ? { ...cue, [field]: value } : cue)),
    );
  };

  const handleSave = async () => {
    if (!clipId || !style) return;
    setSaving(true);
    setError(null);
    try {
      const data = await patchCaptions(clipId, { cues, style });
      setCues(data.cues);
      setStyle(data.style);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = async (preset: CaptionStyleName) => {
    if (!clipId) return;
    setSaving(true);
    try {
      const data = await patchCaptions(clipId, { preset });
      setCues(data.cues);
      setStyle(data.style);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preset failed");
    } finally {
      setSaving(false);
    }
  };

  const handleWordsPerScreen = async (value: number) => {
    if (!clipId || !style) return;
    setStyle({ ...style, words_per_screen: value });
    setSaving(true);
    try {
      const data = await patchCaptions(clipId, { words_per_screen: value });
      setCues(data.cues);
      setStyle(data.style);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRerender = async () => {
    if (!clipId) return;
    setRendering(true);
    setError(null);
    try {
      await patchCaptions(clipId, { cues, style: style ?? undefined });
      await rerenderClip(clipId);
      setVideoUrl(`${await clipDownloadUrl(clipId)}?t=${Date.now()}`);
      navigate(`/results/${videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-render failed");
    } finally {
      setRendering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="p-6 text-slate-400">Loading editor…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Caption Editor</h1>
          <Link
            to={`/results/${videoId}`}
            className="text-sm text-brand-400 hover:underline"
          >
            Back to results
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-2">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[480px]">
              {videoUrl && (
                <>
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  >
                    {vttUrl && <track kind="captions" srcLang="en" label="Preview" src={vttUrl} default />}
                  </video>
                  {style && (
                    <div
                      className="pointer-events-none absolute bottom-8 left-0 right-0 text-center px-4"
                      style={overlayStyle}
                    >
                      {cues.find((c) => c.text)?.text ?? ""}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-2 max-h-[520px] overflow-y-auto">
            <h2 className="font-semibold text-sm text-slate-400">Captions</h2>
            {cues.map((cue, index) => (
              <div key={index} className="rounded-lg border border-slate-800 p-3 space-y-2">
                <textarea
                  value={cue.text}
                  onChange={(e) => updateCue(index, "text", e.target.value)}
                  rows={2}
                  className="w-full rounded bg-slate-900 border border-slate-700 p-2 text-sm"
                />
                <div className="flex gap-2 text-xs">
                  <label className="flex-1">
                    Start
                    <input
                      type="number"
                      step={0.1}
                      value={cue.start}
                      onChange={(e) => updateCue(index, "start", Number(e.target.value))}
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 p-1"
                    />
                  </label>
                  <label className="flex-1">
                    End
                    <input
                      type="number"
                      step={0.1}
                      value={cue.end}
                      onChange={(e) => updateCue(index, "end", Number(e.target.value))}
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 p-1"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1 space-y-4">
            <h2 className="font-semibold text-sm text-slate-400">Style</h2>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p.id)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {style && (
              <>
                <label className="block text-sm">
                  Font
                  <select
                    value={style.font_family}
                    onChange={(e) => setStyle({ ...style, font_family: e.target.value })}
                    className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2"
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  Size: {style.font_size}
                  <input
                    type="range"
                    min={40}
                    max={120}
                    value={style.font_size}
                    onChange={(e) => setStyle({ ...style, font_size: Number(e.target.value) })}
                    className="w-full mt-1"
                  />
                </label>

                <label className="block text-sm">
                  Words per screen: {style.words_per_screen}
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={style.words_per_screen}
                    onChange={(e) => handleWordsPerScreen(Number(e.target.value))}
                    className="w-full mt-1"
                  />
                </label>

                <label className="block text-sm">
                  Text color
                  <input
                    type="color"
                    value={style.primary_color}
                    onChange={(e) => setStyle({ ...style, primary_color: e.target.value })}
                    className="mt-1 block h-10 w-full cursor-pointer"
                  />
                </label>
              </>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 font-medium"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleRerender}
                disabled={rendering}
                className="py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold"
              >
                {rendering ? "Re-rendering…" : "Re-render clip"}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </main>
    </div>
  );
}
