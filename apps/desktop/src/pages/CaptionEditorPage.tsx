import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { VideoPreview, type VideoAspect } from "../components/VideoPreview";
import {
  clipPreviewUrl,
  fetchCaptions,
  fetchClipQualities,
  fetchSystemFonts,
  patchCaptions,
  rerenderClip,
} from "../lib/api";
import { formatCueTime, parseCueTime } from "../lib/formatTime";
import type { CaptionCue, CaptionStyle, CaptionStyleName } from "../lib/types";

const PRESETS: { id: CaptionStyleName; label: string }[] = [
  { id: "reels", label: "Reels" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "podcast", label: "Podcast" },
];

const FALLBACK_FONTS = ["Impact", "Arial", "Helvetica", "Georgia", "Verdana"];

export function CaptionEditorPage() {
  const { videoId, clipId } = useParams<{ videoId: string; clipId: string }>();
  const navigate = useNavigate();
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [style, setStyle] = useState<CaptionStyle | null>(null);
  const [activePreset, setActivePreset] = useState<CaptionStyleName | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState<VideoAspect>("9:16");
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clipId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, qualities, systemFonts] = await Promise.all([
        fetchCaptions(clipId),
        fetchClipQualities(clipId).catch(() => ({
          resolutions: ["1080x1920"],
          aspect_ratio: "9:16",
        })),
        fetchSystemFonts().catch(() => FALLBACK_FONTS),
      ]);
      setCues(data.cues);
      setStyle(data.style);
      setActivePreset(data.preset);
      setAspect(qualities.aspect_ratio === "16:9" ? "16:9" : "9:16");
      setFonts(systemFonts.length ? systemFonts : FALLBACK_FONTS);
      const resolution = qualities.resolutions[0];
      setVideoUrl(`${await clipPreviewUrl(clipId, resolution)}?t=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load captions");
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    load();
  }, [load]);

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
      setActivePreset(data.preset);
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
      setActivePreset(data.preset);
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
      setActivePreset(data.preset);
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
      navigate(`/results/${videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-render failed");
    } finally {
      setRendering(false);
    }
  };

  const fontOptions =
    style && !fonts.includes(style.font_family)
      ? [style.font_family, ...fonts]
      : fonts;

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-app-bg">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-app-fg-muted">
          Loading editor…
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-app-bg text-app-fg overflow-hidden">
      <Nav />

      <header className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 border-b border-app-border bg-app-surface">
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">Caption Editor</h1>
          <p className="text-xs text-app-fg-subtle">{cues.length} caption cues</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && <p className="text-error max-w-xs truncate">{error}</p>}
          <Link to={`/results/${videoId}`} className="link-brand whitespace-nowrap">
            ← Back to results
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <aside className="lg:w-72 xl:w-80 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-app-border bg-app-surface-muted p-3 lg:p-4 min-h-0 max-h-[45vh] lg:max-h-none">
          <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-app-fg-subtle mb-2">
            Preview
          </p>
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="h-full max-h-full w-auto max-w-full">
              <VideoPreview
                src={videoUrl}
                aspect={aspect}
                cues={cues}
                style={style}
                error={error}
              />
            </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="panel-header">
            <h2 className="font-medium text-sm">Captions</h2>
            <span className="text-xs text-app-fg-subtle">Edit text and timing</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2">
            {cues.map((cue, index) => (
              <div
                key={index}
                className="rounded-lg border border-app-border bg-app-surface p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-app-fg-subtle">Cue {index + 1}</span>
                  <span className="text-xs text-app-fg-muted tabular-nums">
                    {formatCueTime(cue.start)} – {formatCueTime(cue.end)}
                  </span>
                </div>
                <textarea
                  value={cue.text}
                  onChange={(e) => updateCue(index, "text", e.target.value)}
                  rows={2}
                  className="input resize-none"
                  placeholder="Caption text…"
                />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label>
                    <span className="label-xs">Start</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatCueTime(cue.start)}
                      key={`${index}-start-${formatCueTime(cue.start)}`}
                      onBlur={(e) => {
                        const parsed = parseCueTime(e.target.value);
                        if (parsed !== null) updateCue(index, "start", parsed);
                      }}
                      className="input-sm mt-1 font-mono"
                      placeholder="0:00.0"
                    />
                  </label>
                  <label>
                    <span className="label-xs">End</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatCueTime(cue.end)}
                      key={`${index}-end-${formatCueTime(cue.end)}`}
                      onBlur={(e) => {
                        const parsed = parseCueTime(e.target.value);
                        if (parsed !== null) updateCue(index, "end", parsed);
                      }}
                      className="input-sm mt-1 font-mono"
                      placeholder="0:00.0"
                    />
                  </label>
                </div>
              </div>
            ))}
            {cues.length === 0 && (
              <p className="text-sm text-app-fg-muted text-center py-8">No captions yet.</p>
            )}
          </div>
        </section>

        <aside className="lg:w-72 xl:w-80 shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-app-border bg-app-surface min-h-0 max-h-[50vh] lg:max-h-none">
          <div className="panel-header">
            <h2 className="font-medium text-sm">Style</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4 min-h-0">
            <div>
              <p className="label-xs mb-2">Presets</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p.id)}
                    disabled={saving}
                    className={activePreset === p.id ? "chip-active" : "chip"}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {style && (
              <div className="space-y-3">
                <label className="block">
                  <span className="label-xs">Font</span>
                  <select
                    value={style.font_family}
                    onChange={(e) => setStyle({ ...style, font_family: e.target.value })}
                    className="input mt-1"
                  >
                    {fontOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="label-xs">Size: {style.font_size}</span>
                  <input
                    type="range"
                    min={40}
                    max={120}
                    value={style.font_size}
                    onChange={(e) => setStyle({ ...style, font_size: Number(e.target.value) })}
                    className="w-full mt-1 accent-brand-600"
                  />
                </label>

                <label className="block">
                  <span className="label-xs">Words per screen: {style.words_per_screen}</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={style.words_per_screen}
                    onChange={(e) => handleWordsPerScreen(Number(e.target.value))}
                    className="w-full mt-1 accent-brand-600"
                  />
                </label>

                <label className="block">
                  <span className="label-xs">Text color</span>
                  <input
                    type="color"
                    value={style.primary_color}
                    onChange={(e) => setStyle({ ...style, primary_color: e.target.value })}
                    className="mt-1 block h-9 w-full cursor-pointer rounded border border-app-border bg-app-input"
                  />
                </label>
              </div>
            )}
          </div>

          <footer className="shrink-0 p-3 lg:p-4 border-t border-app-border space-y-2 bg-app-surface-muted/50">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-secondary w-full"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={handleRerender}
              disabled={rendering}
              className="btn-primary w-full"
            >
              {rendering ? "Re-rendering…" : "Re-render clip"}
            </button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
