import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CaptionTimeline } from "../components/editor/CaptionTimeline";
import {
  EditorPlayer,
  type EditorPlayerHandle,
  type VideoAspect,
} from "../components/editor/EditorPlayer";
import {
  clipPreviewUrl,
  clipThumbnailUrl,
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
  const playerRef = useRef<EditorPlayerHandle>(null);

  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [style, setStyle] = useState<CaptionStyle | null>(null);
  const [activePreset, setActivePreset] = useState<CaptionStyleName | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState<VideoAspect>("9:16");
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const currentTimeRef = useRef(0);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

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
      setSelectedIndex(data.cues.length ? 0 : null);

      const resolution = qualities.resolutions[0];
      const [preview, thumb] = await Promise.all([
        clipPreviewUrl(clipId, resolution),
        clipThumbnailUrl(clipId).catch(() => null),
      ]);
      setVideoUrl(`${preview}?t=${Date.now()}`);
      setThumbnailUrl(thumb ? `${thumb}?t=${Date.now()}` : null);

      const fallbackDuration =
        data.cues.length > 0 ? Math.max(...data.cues.map((c) => c.end)) : 60;
      setDuration(fallbackDuration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load captions");
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateCue = (index: number, patch: Partial<CaptionCue>) => {
    setCues((prev) =>
      prev.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)),
    );
  };

  const handleSeek = (time: number) => {
    playerRef.current?.seek(time);
    currentTimeRef.current = time;
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

  const selectedCue = selectedIndex !== null ? cues[selectedIndex] : null;
  const effectiveDuration =
    duration > 0
      ? duration
      : cues.length
        ? Math.max(...cues.map((c) => c.end))
        : 60;

  if (loading) {
    return (
      <div className="editor-shell flex items-center justify-center">
        <div className="text-sm text-app-fg-muted">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <header className="editor-toolbar" data-tauri-drag-region>
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/results/${videoId}`}
            className="editor-toolbar-btn shrink-0"
          >
            ← Back
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">Caption Editor</h1>
            <p className="text-[11px] text-app-fg-subtle truncate">
              {cues.length} captions · {formatCueTime(effectiveDuration)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {error && (
            <span className="text-xs text-red-400 max-w-[200px] truncate">{error}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="editor-toolbar-btn"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleRerender}
            disabled={rendering}
            className="editor-toolbar-btn editor-toolbar-btn-primary"
          >
            {rendering ? "Exporting…" : "Export clip"}
          </button>
        </div>
      </header>

      <div className="editor-workspace">
        <div className="editor-stage">
          <EditorPlayer
            ref={playerRef}
            src={videoUrl}
            poster={thumbnailUrl}
            aspect={aspect}
            cues={cues}
            style={style}
            onTimeUpdate={(t) => {
              currentTimeRef.current = t;
            }}
            onDurationChange={(d) => setDuration(d)}
            onPlayStateChange={setPlaying}
          />
        </div>

        <aside className="editor-inspector">
          <div className="editor-inspector-section">
            <p className="editor-inspector-label">Presets</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p.id)}
                  disabled={saving}
                  className={
                    activePreset === p.id
                      ? "editor-preset editor-preset-active"
                      : "editor-preset"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {style && (
            <>
              <div className="editor-inspector-section">
                <label className="editor-inspector-label">
                  Font
                  <select
                    value={style.font_family}
                    onChange={(e) =>
                      setStyle({ ...style, font_family: e.target.value })
                    }
                    className="editor-input mt-1"
                  >
                    {fontOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="editor-inspector-section">
                <label className="editor-inspector-label">
                  Size · {style.font_size}
                  <input
                    type="range"
                    min={40}
                    max={120}
                    value={style.font_size}
                    onChange={(e) =>
                      setStyle({ ...style, font_size: Number(e.target.value) })
                    }
                    className="editor-range mt-2"
                  />
                </label>
              </div>

              <div className="editor-inspector-section">
                <label className="editor-inspector-label">
                  Words / screen · {style.words_per_screen}
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={style.words_per_screen}
                    onChange={(e) => handleWordsPerScreen(Number(e.target.value))}
                    className="editor-range mt-2"
                  />
                </label>
              </div>

              <div className="editor-inspector-section">
                <label className="editor-inspector-label">
                  Color
                  <input
                    type="color"
                    value={style.primary_color}
                    onChange={(e) =>
                      setStyle({ ...style, primary_color: e.target.value })
                    }
                    className="editor-color mt-1"
                  />
                </label>
              </div>
            </>
          )}
        </aside>
      </div>

      {selectedCue && selectedIndex !== null && (
        <div className="editor-cue-bar">
          <div className="flex items-center gap-3 shrink-0 text-[11px] text-app-fg-subtle tabular-nums">
            <span>#{selectedIndex + 1}</span>
            <input
              type="text"
              defaultValue={formatCueTime(selectedCue.start)}
              key={`s-${selectedIndex}-${selectedCue.start}`}
              onBlur={(e) => {
                const parsed = parseCueTime(e.target.value);
                if (parsed !== null) updateCue(selectedIndex, { start: parsed });
              }}
              className="editor-time-input"
              aria-label="Start time"
            />
            <span>→</span>
            <input
              type="text"
              defaultValue={formatCueTime(selectedCue.end)}
              key={`e-${selectedIndex}-${selectedCue.end}`}
              onBlur={(e) => {
                const parsed = parseCueTime(e.target.value);
                if (parsed !== null) updateCue(selectedIndex, { end: parsed });
              }}
              className="editor-time-input"
              aria-label="End time"
            />
          </div>
          <input
            type="text"
            value={selectedCue.text}
            onChange={(e) => updateCue(selectedIndex, { text: e.target.value })}
            className="editor-cue-input flex-1"
            placeholder="Caption text…"
          />
        </div>
      )}

      <CaptionTimeline
        cues={cues}
        duration={effectiveDuration}
        getCurrentTime={getCurrentTime}
        playing={playing}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onSeek={handleSeek}
        onUpdateCue={updateCue}
      />
    </div>
  );
}
