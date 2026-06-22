import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClipTimeline } from "../components/editor/ClipTimeline";
import { EditorInspector } from "../components/editor/EditorInspector";
import {
  EditorPlayer,
  type EditorPlayerHandle,
  type VideoAspect,
} from "../components/editor/EditorPlayer";
import {
  clipMediaUrl,
  clipPreviewUrl,
  clipThumbnailUrl,
  fetchCaptions,
  fetchClipQualities,
  fetchSystemFonts,
  patchCaptions,
  rerenderClip,
  uploadEditorMediaLocal,
} from "../lib/api";
import { formatCueTime } from "../lib/formatTime";
import {
  createTimelineId,
  defaultTimeline,
  effectiveDuration,
  mediaBlockDuration,
  collectCutPoints,
  markAudioTrimIn,
  markAudioTrimOut,
  markTrimIn,
  markTrimOut,
  nextCut,
  prevCut,
  normalizeTimeline,
  splitAudio,
  splitCue,
  splitOverlay,
} from "../lib/timeline";
import {
  isTauriApp,
  pickAudioFile,
  pickBrollFile,
  pickImageFile,
} from "../lib/tauri";
import type {
  AudioItem,
  CaptionCue,
  CaptionStyle,
  CaptionStyleName,
  EditorSelection,
  OverlayItem,
  TimelineState,
  VideoTrim,
  VideoAudioTrim,
} from "../lib/types";

const FALLBACK_FONTS = ["Impact", "Arial", "Helvetica", "Georgia", "Verdana"];

export function CaptionEditorPage() {
  const { videoId, clipId } = useParams<{ videoId: string; clipId: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<EditorPlayerHandle>(null);

  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [style, setStyle] = useState<CaptionStyle | null>(null);
  const [timeline, setTimeline] = useState<TimelineState>(defaultTimeline());
  const [activePreset, setActivePreset] = useState<CaptionStyleName | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState<VideoAspect>("9:16");
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rawDuration, setRawDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const currentTimeRef = useRef(0);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  const effectiveDur = effectiveDuration(rawDuration, timeline.trim);

  const resolveMediaUrls = useCallback(
    async (tl: TimelineState) => {
      if (!clipId) return;
      const assets = [
        ...tl.overlays.map((o) => o.asset),
        ...tl.audio.map((a) => a.asset),
      ];
      const unique = [...new Set(assets)];
      const entries = await Promise.all(
        unique.map(async (asset) => [asset, await clipMediaUrl(clipId, asset)] as const),
      );
      setMediaUrls(Object.fromEntries(entries));
    },
    [clipId],
  );

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
      setTimeline(normalizeTimeline(data.timeline ?? defaultTimeline()));
      setActivePreset(data.preset);
      setAspect(qualities.aspect_ratio === "16:9" ? "16:9" : "9:16");
      setFonts(systemFonts.length ? systemFonts : FALLBACK_FONTS);
      setSelection(data.cues.length ? { type: "caption", index: 0 } : { type: "video" });

      const resolution = qualities.resolutions[0];
      const [preview, thumb] = await Promise.all([
        clipPreviewUrl(clipId, resolution),
        clipThumbnailUrl(clipId).catch(() => null),
      ]);
      setVideoUrl(`${preview}?t=${Date.now()}`);
      setThumbnailUrl(thumb ? `${thumb}?t=${Date.now()}` : null);

      const tl = normalizeTimeline(data.timeline ?? defaultTimeline());
      await resolveMediaUrls(tl);

      const fallbackDuration =
        data.cues.length > 0 ? Math.max(...data.cues.map((c) => c.end)) : 60;
      setRawDuration(fallbackDuration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load editor");
    } finally {
      setLoading(false);
    }
  }, [clipId, resolveMediaUrls]);

  useEffect(() => {
    load();
  }, [load]);

  const updateCue = (index: number, patch: Partial<CaptionCue>) => {
    setCues((prev) => prev.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)));
  };

  const handleSeek = (time: number) => {
    playerRef.current?.seek(time);
    currentTimeRef.current = time;
  };

  const handlePlay = () => {
    playerRef.current?.play();
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleStop = () => {
    playerRef.current?.stop();
    currentTimeRef.current = timeline.trim.start;
  };

  const handleTogglePlay = () => {
    playerRef.current?.togglePlay();
  };

  const handleSave = async () => {
    if (!clipId || !style) return;
    setSaving(true);
    setError(null);
    try {
      const data = await patchCaptions(clipId, { cues, style, timeline });
      setCues(data.cues);
      setStyle(data.style);
      setTimeline(data.timeline ?? timeline);
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
      await patchCaptions(clipId, { cues, style: style ?? undefined, timeline });
      await rerenderClip(clipId);
      navigate(`/results/${videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-render failed");
    } finally {
      setRendering(false);
    }
  };

  const handleTrimChange = (trim: VideoTrim) => {
    setTimeline((prev) => ({ ...prev, trim }));
  };

  const handleVideoAudioChange = (audioTrim: VideoAudioTrim) => {
    setTimeline((prev) => ({ ...prev, audio_trim: audioTrim }));
  };

  const handleMarkIn = useCallback(() => {
    const t = currentTimeRef.current;
    setTimeline((prev) => ({
      ...prev,
      trim: markTrimIn(prev.trim, t, rawDuration),
    }));
    setSelection({ type: "video" });
  }, [rawDuration]);

  const handleMarkOut = useCallback(() => {
    const t = currentTimeRef.current;
    setTimeline((prev) => ({
      ...prev,
      trim: markTrimOut(prev.trim, t, rawDuration),
    }));
    setSelection({ type: "video" });
  }, [rawDuration]);

  const handleMarkAudioIn = useCallback(() => {
    const t = currentTimeRef.current;
    setTimeline((prev) => ({
      ...prev,
      audio_trim: markAudioTrimIn(prev.audio_trim, t, rawDuration),
    }));
    setSelection({ type: "video-audio" });
  }, [rawDuration]);

  const handleMarkAudioOut = useCallback(() => {
    const t = currentTimeRef.current;
    setTimeline((prev) => ({
      ...prev,
      audio_trim: markAudioTrimOut(prev.audio_trim, t, rawDuration),
    }));
    setSelection({ type: "video-audio" });
  }, [rawDuration]);

  const handleSplitAtPlayhead = useCallback(() => {
    const t = currentTimeRef.current;
    if (!selection) return;

    if (selection.type === "caption") {
      const cue = cues[selection.index];
      if (!cue) return;
      const parts = splitCue(cue, t);
      if (!parts) return;
      setCues((prev) => {
        const next = [...prev];
        next.splice(selection.index, 1, parts[0], parts[1]);
        return next;
      });
      setSelection({ type: "caption", index: selection.index + 1 });
      return;
    }

    if (selection.type === "overlay") {
      const item = timeline.overlays.find((o) => o.id === selection.id);
      if (!item) return;
      const parts = splitOverlay(item, t);
      if (!parts) return;
      setTimeline((prev) => {
        const idx = prev.overlays.findIndex((o) => o.id === selection.id);
        if (idx < 0) return prev;
        const overlays = [...prev.overlays];
        overlays.splice(idx, 1, parts[0], parts[1]);
        return { ...prev, overlays };
      });
      setSelection({ type: "overlay", id: parts[1].id });
      return;
    }

    if (selection.type === "audio") {
      const item = timeline.audio.find((a) => a.id === selection.id);
      if (!item) return;
      const parts = splitAudio(item, t);
      if (!parts) return;
      setTimeline((prev) => {
        const idx = prev.audio.findIndex((a) => a.id === selection.id);
        if (idx < 0) return prev;
        const audio = [...prev.audio];
        audio.splice(idx, 1, parts[0], parts[1]);
        return { ...prev, audio };
      });
      setSelection({ type: "audio", id: parts[1].id });
    }
  }, [selection, cues, timeline]);

  const handleTimelineChange = (next: TimelineState) => {
    setTimeline(next);
  };

  const handleUpdateOverlay = (id: string, patch: Partial<OverlayItem>) => {
    setTimeline((prev) => ({
      ...prev,
      overlays: prev.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  };

  const handleUpdateAudio = (id: string, patch: Partial<AudioItem>) => {
    setTimeline((prev) => ({
      ...prev,
      audio: prev.audio.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const handleDeleteOverlay = (id: string) => {
    setTimeline((prev) => ({
      ...prev,
      overlays: prev.overlays.filter((o) => o.id !== id),
    }));
    if (selection?.type === "overlay" && selection.id === id) {
      setSelection({ type: "video" });
    }
  };

  const handleDeleteAudio = (id: string) => {
    setTimeline((prev) => ({
      ...prev,
      audio: prev.audio.filter((a) => a.id !== id),
    }));
    if (selection?.type === "audio" && selection.id === id) {
      setSelection({ type: "video" });
    }
  };

  const handleDeleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.type === "overlay") {
      handleDeleteOverlay(selection.id);
    } else if (selection.type === "audio") {
      handleDeleteAudio(selection.id);
    } else if (selection.type === "caption") {
      setCues((prev) => prev.filter((_, i) => i !== selection.index));
      setSelection(
        cues.length > 1
          ? { type: "caption", index: Math.min(selection.index, cues.length - 2) }
          : { type: "video" },
      );
    }
  }, [selection, cues.length]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const editPoints = collectCutPoints(rawDuration, timeline, cues);
      const t = currentTimeRef.current;
      const mod = e.metaKey || e.ctrlKey;

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
        return;
      }
      if (
        (mod && (e.key === "k" || e.key === "K" || e.key === "b" || e.key === "B")) ||
        (!mod && (e.key === "b" || e.key === "B"))
      ) {
        e.preventDefault();
        handleSplitAtPlayhead();
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        handlePause();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleStop();
        return;
      }
      if (e.key === "i" || e.key === "I" || e.key === "[") {
        e.preventDefault();
        if (e.shiftKey) handleMarkAudioIn();
        else handleMarkIn();
        return;
      }
      if (e.key === "o" || e.key === "O" || e.key === "]") {
        e.preventDefault();
        if (e.shiftKey) handleMarkAudioOut();
        else handleMarkOut();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelection();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === ",") {
        e.preventDefault();
        handleSeek(prevCut(editPoints, t));
        return;
      }
      if (e.key === "ArrowRight" || e.key === ".") {
        e.preventDefault();
        handleSeek(nextCut(editPoints, t));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    rawDuration,
    timeline,
    cues,
    handleMarkIn,
    handleMarkOut,
    handleMarkAudioIn,
    handleMarkAudioOut,
    handleSplitAtPlayhead,
    handleDeleteSelection,
  ]);

  const uploadAsset = async (path: string) => {
    if (!clipId) throw new Error("No clip");
    return uploadEditorMediaLocal(clipId, path);
  };

  const addOverlay = async (kind: "image" | "broll") => {
    if (!isTauriApp()) {
      setError("Importe mídia pelo app desktop (Tauri).");
      return;
    }
    const path =
      kind === "image" ? await pickImageFile() : await pickBrollFile();
    if (!path || !clipId) return;

    setSaving(true);
    setError(null);
    try {
      const uploaded = await uploadAsset(path);
      const url = await clipMediaUrl(clipId, uploaded.asset);
      setMediaUrls((prev) => ({ ...prev, [uploaded.asset]: url }));

      const t = currentTimeRef.current;
      const blockDur = mediaBlockDuration(t, effectiveDur);
      const id = createTimelineId();
      const item: OverlayItem = {
        id,
        kind,
        start: t,
        end: t + blockDur,
        asset: uploaded.asset,
        label: uploaded.label,
        x: kind === "image" ? 10 : 0,
        y: kind === "image" ? 10 : 0,
        width: kind === "image" ? 40 : 100,
        height: kind === "image" ? 30 : 100,
        opacity: 1,
        volume: kind === "broll" ? 0.8 : 1,
      };
      setTimeline((prev) => ({ ...prev, overlays: [...prev.overlays, item] }));
      setSelection({ type: "overlay", id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const addMusic = async () => {
    if (!isTauriApp()) {
      setError("Importe mídia pelo app desktop (Tauri).");
      return;
    }
    const path = await pickAudioFile();
    if (!path || !clipId) return;

    setSaving(true);
    setError(null);
    try {
      const uploaded = await uploadAsset(path);
      const url = await clipMediaUrl(clipId, uploaded.asset);
      setMediaUrls((prev) => ({ ...prev, [uploaded.asset]: url }));

      const t = currentTimeRef.current;
      const blockDur = mediaBlockDuration(t, effectiveDur, 8);
      const id = createTimelineId();
      const item: AudioItem = {
        id,
        start: t,
        end: Math.min(effectiveDur, t + blockDur),
        asset: uploaded.asset,
        label: uploaded.label,
        volume: 0.35,
        source_offset: 0,
        fade_in: 0.5,
        fade_out: 0.5,
      };
      setTimeline((prev) => ({ ...prev, audio: [...prev.audio, item] }));
      setSelection({ type: "audio", id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const fontOptions =
    style && !fonts.includes(style.font_family)
      ? [style.font_family, ...fonts]
      : fonts;

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
            <h1 className="text-sm font-semibold truncate">Editor de Clip</h1>
            <p className="text-[11px] text-app-fg-subtle truncate">
              {cues.length} legendas · {formatCueTime(effectiveDur)}
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
            timeline={timeline}
            mediaUrls={mediaUrls}
            selectedOverlayId={
              selection?.type === "overlay" ? selection.id : null
            }
            onTimeUpdate={(t) => {
              currentTimeRef.current = t;
            }}
            onDurationChange={(d) => {
              setRawDuration(d);
            }}
            onPlayStateChange={setPlaying}
            onSelectOverlay={(id) => setSelection({ type: "overlay", id })}
            onUpdateOverlay={handleUpdateOverlay}
          />
        </div>

        <aside className="editor-inspector">
          <EditorInspector
            selection={selection}
            timeline={timeline}
            duration={rawDuration}
            cues={cues}
            style={style}
            activePreset={activePreset}
            fontOptions={fontOptions}
            saving={saving}
            mediaUrls={mediaUrls}
            onPreset={handlePreset}
            onStyleChange={setStyle}
            onWordsPerScreen={handleWordsPerScreen}
            onTrimChange={handleTrimChange}
            onVideoAudioChange={handleVideoAudioChange}
            onUpdateCue={updateCue}
            onUpdateOverlay={handleUpdateOverlay}
            onUpdateAudio={handleUpdateAudio}
            onDeleteOverlay={handleDeleteOverlay}
            onDeleteAudio={handleDeleteAudio}
          />
        </aside>
      </div>

      <ClipTimeline
        timeline={timeline}
        cues={cues}
        duration={rawDuration}
        getCurrentTime={getCurrentTime}
        playing={playing}
        selection={selection}
        onSelect={setSelection}
        onSeek={handleSeek}
        onUpdateCue={updateCue}
        onTimelineChange={handleTimelineChange}
        onAddImage={() => void addOverlay("image")}
        onAddBroll={() => void addOverlay("broll")}
        onAddMusic={() => void addMusic()}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onMarkIn={handleMarkIn}
        onMarkOut={handleMarkOut}
        onSplitAtPlayhead={handleSplitAtPlayhead}
        videoUrl={videoUrl}
        mediaUrls={mediaUrls}
      />
    </div>
  );
}
