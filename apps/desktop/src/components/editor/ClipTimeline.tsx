import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CaptionCue, EditorSelection, TimelineState } from "../../lib/types";
import { formatCueTime } from "../../lib/formatTime";
import { collectCutPoints, nextCut, prevCut } from "../../lib/timeline";
import { TimelineFilmstrip } from "./TimelineFilmstrip";
import { TimelineWaveform } from "./TimelineWaveform";

const DEFAULT_PX_PER_SEC = 72;
const MIN_PX_PER_SEC = 24;
const MAX_PX_PER_SEC = 280;
const ZOOM_FACTOR = 1.25;
const TRACK_LABEL_W = 88;
const MIN_BLOCK_W = 6;
const MEDIA_TRACK_H = 48;

const NICE_TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];

interface ClipTimelineProps {
  timeline: TimelineState;
  cues: CaptionCue[];
  duration: number;
  getCurrentTime: () => number;
  playing: boolean;
  selection: EditorSelection | null;
  onSelect: (selection: EditorSelection | null) => void;
  onSeek: (time: number) => void;
  onUpdateCue: (index: number, patch: Partial<CaptionCue>) => void;
  onTimelineChange: (timeline: TimelineState) => void;
  onAddImage: () => void;
  onAddBroll: () => void;
  onAddMusic: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onSplitAtPlayhead: () => void;
  videoUrl?: string | null;
  clipId?: string | null;
  mediaUrls?: Record<string, string>;
}

type DragKind =
  | { type: "trim-start" }
  | { type: "trim-end" }
  | { type: "move-video" }
  | { type: "trim-audio-start" }
  | { type: "trim-audio-end" }
  | { type: "move-video-audio" }
  | { type: "move-caption"; index: number }
  | { type: "move-overlay"; id: string }
  | { type: "move-audio"; id: string }
  | { type: "caption"; index: number; edge: "start" | "end" }
  | { type: "overlay"; id: string; edge: "start" | "end" }
  | { type: "audio"; id: string; edge: "start" | "end" };

function buildTicks(duration: number, pxPerSec: number): number[] {
  if (duration <= 0) return [0];
  const targetPx = 80;
  let step = targetPx / pxPerSec;
  step = NICE_TICK_STEPS.find((s) => s >= step) ?? NICE_TICK_STEPS[NICE_TICK_STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t = Math.round((t + step) * 10) / 10) ticks.push(t);
  if (ticks[ticks.length - 1] !== duration) ticks.push(Math.ceil(duration * 10) / 10);
  return ticks;
}

function clampPxPerSec(value: number): number {
  return Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, Math.round(value)));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function isHandleTarget(target: EventTarget | null): boolean {
  return (target as HTMLElement | null)?.closest(".timeline-block-handle") != null;
}

export function ClipTimeline({
  timeline,
  cues,
  duration,
  getCurrentTime,
  playing,
  selection,
  onSelect,
  onSeek,
  onUpdateCue,
  onTimelineChange,
  onAddImage,
  onAddBroll,
  onAddMusic,
  onPlay,
  onPause,
  onStop,
  onMarkIn,
  onMarkOut,
  onSplitAtPlayhead,
  videoUrl = null,
  clipId = null,
  mediaUrls = {},
}: ClipTimelineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: DragKind;
    startX: number;
    origStart: number;
    origEnd: number;
    moved: boolean;
  } | null>(null);
  const didDragRef = useRef(false);

  const [dragging, setDragging] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const pendingScrollLeftRef = useRef<number | null>(null);

  const timelineWidth = Math.max((duration || 1) * pxPerSec, 400);
  const zoomPercent = Math.round((pxPerSec / DEFAULT_PX_PER_SEC) * 100);
  const ticks = useMemo(() => buildTicks(duration || 1, pxPerSec), [duration, pxPerSec]);
  const trimEnd = timeline.trim.end ?? duration;
  const audioTrimEnd = timeline.audio_trim.end ?? duration;
  const cutPoints = useMemo(
    () => collectCutPoints(duration, timeline, cues),
    [duration, timeline, cues],
  );

  const imageOverlays = timeline.overlays.filter((o) => o.kind === "image");
  const brollOverlays = timeline.overlays.filter((o) => o.kind === "broll");

  const updatePlayhead = useCallback(
    (t: number) => {
      setDisplayTime(t);
      if (duration <= 0) return;
      const x = (t / duration) * timelineWidth;
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }
    },
    [duration, timelineWidth],
  );

  const seekTo = useCallback(
    (t: number) => {
      updatePlayhead(t);
      onSeek(t);
    },
    [updatePlayhead, onSeek],
  );

  useEffect(() => {
    if (!playing || duration <= 0) return;
    let raf = 0;
    const tick = () => {
      updatePlayhead(getCurrentTime());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, getCurrentTime, updatePlayhead]);

  useEffect(() => {
    if (!playing && duration > 0) {
      updatePlayhead(getCurrentTime());
    }
  }, [playing, duration, getCurrentTime, selection, updatePlayhead]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const scroll = scrollRef.current;
      if (!scroll || duration <= 0) return 0;
      const rect = scroll.getBoundingClientRect();
      const x = clientX - rect.left + scroll.scrollLeft - TRACK_LABEL_W;
      const t = (x / timelineWidth) * duration;
      return Math.max(0, Math.min(duration, Math.round(t * 10) / 10));
    },
    [duration, timelineWidth],
  );

  const applyZoom = useCallback(
    (nextPxPerSec: number, anchorClientX?: number) => {
      const scroll = scrollRef.current;
      const clamped = clampPxPerSec(nextPxPerSec);
      if (clamped === pxPerSec) return;

      if (!scroll || duration <= 0) {
        setPxPerSec(clamped);
        return;
      }

      const rect = scroll.getBoundingClientRect();
      const oldWidth = timelineWidth;
      const anchorXInContent =
        anchorClientX != null
          ? anchorClientX - rect.left + scroll.scrollLeft
          : (getCurrentTime() / duration) * oldWidth + TRACK_LABEL_W;
      const anchorTime = Math.max(
        0,
        Math.min(duration, ((anchorXInContent - TRACK_LABEL_W) / oldWidth) * duration),
      );

      const newWidth = Math.max(duration * clamped, 400);
      const newAnchorX = (anchorTime / duration) * newWidth + TRACK_LABEL_W;
      const viewportAnchor =
        anchorClientX != null ? anchorClientX - rect.left : scroll.clientWidth / 2;

      pendingScrollLeftRef.current = Math.max(0, newAnchorX - viewportAnchor);
      setPxPerSec(clamped);
    },
    [duration, getCurrentTime, pxPerSec, timelineWidth],
  );

  const zoomIn = useCallback(
    (anchorClientX?: number) => applyZoom(pxPerSec * ZOOM_FACTOR, anchorClientX),
    [applyZoom, pxPerSec],
  );

  const zoomOut = useCallback(
    (anchorClientX?: number) => applyZoom(pxPerSec / ZOOM_FACTOR, anchorClientX),
    [applyZoom, pxPerSec],
  );

  const resetZoom = useCallback(() => applyZoom(DEFAULT_PX_PER_SEC), [applyZoom]);

  useEffect(() => {
    if (pendingScrollLeftRef.current == null || !scrollRef.current) return;
    scrollRef.current.scrollLeft = pendingScrollLeftRef.current;
    pendingScrollLeftRef.current = null;
  }, [pxPerSec]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      applyZoom(pxPerSec * delta, e.clientX);
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [applyZoom, pxPerSec]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "=" || e.key === "+" || e.code === "Equal")) {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (mod && (e.key === "-" || e.code === "Minus")) {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [zoomIn, zoomOut, resetZoom]);

  const startDrag = (
    e: React.MouseEvent,
    kind: DragKind,
    origStart: number,
    origEnd: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { kind, startX: e.clientX, origStart, origEnd, moved: false };
    setDragging(true);
  };

  const applyMove = (drag: NonNullable<typeof dragRef.current>, deltaSec: number) => {
    const len = drag.origEnd - drag.origStart;
    const newStart = Math.max(0, Math.min(duration - len, drag.origStart + deltaSec));
    return {
      start: Math.round(newStart * 10) / 10,
      end: Math.round((newStart + len) * 10) / 10,
    };
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || duration <= 0) return;
      const deltaPx = e.clientX - drag.startX;
      const deltaSec = (deltaPx / timelineWidth) * duration;
      if (Math.abs(deltaPx) > 2) {
        drag.moved = true;
        didDragRef.current = true;
      }

      const applyEdge = (edge: "start" | "end") => {
        if (edge === "start") {
          return {
            start: Math.max(0, Math.min(drag.origEnd - 0.2, drag.origStart + deltaSec)),
            end: drag.origEnd,
          };
        }
        return {
          start: drag.origStart,
          end: Math.max(drag.origStart + 0.2, Math.min(duration, drag.origEnd + deltaSec)),
        };
      };

      const kind = drag.kind;
      if (kind.type === "trim-start") {
        const next = Math.max(0, Math.min(trimEnd - 0.2, drag.origStart + deltaSec));
        onTimelineChange({
          ...timeline,
          trim: { ...timeline.trim, start: Math.round(next * 10) / 10 },
        });
      } else if (kind.type === "trim-end") {
        const next = Math.max(timeline.trim.start + 0.2, Math.min(duration, drag.origEnd + deltaSec));
        onTimelineChange({
          ...timeline,
          trim: { start: timeline.trim.start, end: Math.round(next * 10) / 10 },
        });
      } else if (kind.type === "move-video") {
        const { start, end } = applyMove(drag, deltaSec);
        onTimelineChange({
          ...timeline,
          trim: { start, end },
        });
      } else if (kind.type === "trim-audio-start") {
        const next = Math.max(0, Math.min(audioTrimEnd - 0.2, drag.origStart + deltaSec));
        onTimelineChange({
          ...timeline,
          audio_trim: {
            ...timeline.audio_trim,
            start: Math.round(next * 10) / 10,
          },
        });
      } else if (kind.type === "trim-audio-end") {
        const next = Math.max(
          timeline.audio_trim.start + 0.2,
          Math.min(duration, drag.origEnd + deltaSec),
        );
        onTimelineChange({
          ...timeline,
          audio_trim: {
            ...timeline.audio_trim,
            end: Math.round(next * 10) / 10,
          },
        });
      } else if (kind.type === "move-video-audio") {
        const { start, end } = applyMove(drag, deltaSec);
        const sourceDelta = start - drag.origStart;
        onTimelineChange({
          ...timeline,
          audio_trim: {
            ...timeline.audio_trim,
            start,
            end,
            source_start: Math.max(
              0,
              Math.round((timeline.audio_trim.source_start + sourceDelta) * 10) / 10,
            ),
          },
        });
      } else if (kind.type === "move-caption") {
        const { start, end } = applyMove(drag, deltaSec);
        onUpdateCue(kind.index, { start, end });
      } else if (kind.type === "move-overlay") {
        const { start, end } = applyMove(drag, deltaSec);
        onTimelineChange({
          ...timeline,
          overlays: timeline.overlays.map((o) =>
            o.id === kind.id ? { ...o, start, end } : o,
          ),
        });
      } else if (kind.type === "move-audio") {
        const { start, end } = applyMove(drag, deltaSec);
        onTimelineChange({
          ...timeline,
          audio: timeline.audio.map((a) =>
            a.id === kind.id ? { ...a, start, end } : a,
          ),
        });
      } else if (kind.type === "caption") {
        const { start, end } = applyEdge(kind.edge);
        onUpdateCue(kind.index, {
          start: Math.round(start * 10) / 10,
          end: Math.round(end * 10) / 10,
        });
      } else if (kind.type === "overlay") {
        const { start, end } = applyEdge(kind.edge);
        onTimelineChange({
          ...timeline,
          overlays: timeline.overlays.map((o) =>
            o.id === kind.id
              ? { ...o, start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10 }
              : o,
          ),
        });
      } else if (kind.type === "audio") {
        const { start, end } = applyEdge(kind.edge);
        onTimelineChange({
          ...timeline,
          audio: timeline.audio.map((a) =>
            a.id === kind.id
              ? { ...a, start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10 }
              : a,
          ),
        });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, duration, timelineWidth, timeline, trimEnd, audioTrimEnd, onTimelineChange, onUpdateCue]);

  const handlePrevCut = useCallback(() => {
    seekTo(prevCut(cutPoints, getCurrentTime()));
  }, [cutPoints, getCurrentTime, seekTo]);

  const handleNextCut = useCallback(() => {
    seekTo(nextCut(cutPoints, getCurrentTime()));
  }, [cutPoints, getCurrentTime, seekTo]);

  const renderBlock = (
    key: string,
    start: number,
    end: number,
    label: string,
    className: string,
    selected: boolean,
    onClick: () => void,
    onEdgeDrag: (edge: "start" | "end") => (e: React.MouseEvent) => void,
    onMoveDrag: (e: React.MouseEvent) => void,
    media?: React.ReactNode,
  ) => {
    if (duration <= 0) return null;
    const left = (start / duration) * timelineWidth;
    const width = Math.max(MIN_BLOCK_W, ((end - start) / duration) * timelineWidth);
    return (
      <button
        key={key}
        type="button"
        className={`timeline-block ${className} ${selected ? "timeline-block-selected" : ""} ${dragging ? "timeline-block-dragging" : ""}`}
        style={{ left, width }}
        onClick={(e) => {
          e.stopPropagation();
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          onClick();
        }}
        onMouseDown={(e) => {
          if (isHandleTarget(e.target)) return;
          onMoveDrag(e);
        }}
        title={`${formatCueTime(start)} – ${formatCueTime(end)}`}
      >
        {media}
        <span
          className="timeline-block-handle timeline-block-handle-start"
          onMouseDown={onEdgeDrag("start")}
        />
        <span className="timeline-block-label">{label}</span>
        <span
          className="timeline-block-handle timeline-block-handle-end"
          onMouseDown={onEdgeDrag("end")}
        />
      </button>
    );
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".timeline-block")) return;
    seekTo(timeFromClientX(e.clientX));
  };

  const videoSelected = selection?.type === "video";
  const videoAudioSelected = selection?.type === "video-audio";
  const videoLeft = (timeline.trim.start / duration) * timelineWidth;
  const videoWidth = Math.max(
    MIN_BLOCK_W,
    ((trimEnd - timeline.trim.start) / duration) * timelineWidth,
  );
  const videoAudioLeft = (timeline.audio_trim.start / duration) * timelineWidth;
  const videoAudioWidth = Math.max(
    MIN_BLOCK_W,
    ((audioTrimEnd - timeline.audio_trim.start) / duration) * timelineWidth,
  );

  const renderTrackRow = (
    label: string,
    className: string,
    children: React.ReactNode,
    tall = false,
  ) => (
    <div className={`timeline-track-row ${className}`}>
      <div className="timeline-track-label">{label}</div>
      <div
        className={`timeline-track ${tall ? "timeline-track--media" : ""}`}
        style={{ width: timelineWidth }}
        onClick={handleTrackClick}
        role="presentation"
      >
        {children}
      </div>
    </div>
  );

  const videoAudioSourceEnd =
    timeline.audio_trim.source_start + (audioTrimEnd - timeline.audio_trim.start);

  return (
    <div ref={rootRef} className="clip-timeline">
      <div className="clip-timeline-toolbar">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAddImage} className="editor-toolbar-btn">
            + Imagem
          </button>
          <button type="button" onClick={onAddBroll} className="editor-toolbar-btn">
            + B-roll
          </button>
          <button type="button" onClick={onAddMusic} className="editor-toolbar-btn">
            + Música
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="editor-toolbar-btn px-2 py-1 min-w-[28px]"
              onClick={() => zoomOut()}
              disabled={pxPerSec <= MIN_PX_PER_SEC}
              title="Diminuir zoom (⌘-)"
              aria-label="Diminuir zoom"
            >
              −
            </button>
            <button
              type="button"
              className="editor-toolbar-btn px-2 py-1 min-w-[44px] tabular-nums"
              onClick={resetZoom}
              title="Resetar zoom (⌘0)"
              aria-label="Resetar zoom"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              className="editor-toolbar-btn px-2 py-1 min-w-[28px]"
              onClick={() => zoomIn()}
              disabled={pxPerSec >= MAX_PX_PER_SEC}
              title="Aumentar zoom (⌘+)"
              aria-label="Aumentar zoom"
            >
              +
            </button>
          </div>
          <span className="text-[11px] text-app-fg-subtle tabular-nums">
            {formatCueTime(duration)}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="clip-timeline-scroll">
        <div className="clip-timeline-inner" style={{ width: timelineWidth + TRACK_LABEL_W }}>
          <div className="caption-ruler" style={{ paddingLeft: TRACK_LABEL_W }}>
            {ticks.map((t) => (
              <div key={t} className="caption-ruler-tick" style={{ left: (t / (duration || 1)) * timelineWidth }}>
                <span>{formatCueTime(t)}</span>
              </div>
            ))}
          </div>

          <div className="clip-timeline-tracks">
            {/* Legendas — sempre no topo */}
            {renderTrackRow(
              "Legendas",
              "timeline-track-row--captions",
              cues.map((cue, index) =>
                renderBlock(
                  `${index}-${cue.start}`,
                  cue.start,
                  cue.end,
                  cue.text || "…",
                  "timeline-block-caption",
                  selection?.type === "caption" && selection.index === index,
                  () => {
                    onSelect({ type: "caption", index });
                    seekTo(cue.start);
                  },
                  (edge) => (e) =>
                    startDrag(e, { type: "caption", index, edge }, cue.start, cue.end),
                  (e) => startDrag(e, { type: "move-caption", index }, cue.start, cue.end),
                ),
              ),
            )}

            {/* Visuais — faixa de cima = mais à frente na tela */}
            {renderTrackRow(
              "B-roll",
              "timeline-track-row--visual-front",
              brollOverlays.map((item) => {
                const blockWidth = Math.max(
                  MIN_BLOCK_W,
                  ((item.end - item.start) / duration) * timelineWidth,
                );
                return renderBlock(
                  item.id,
                  item.start,
                  item.end,
                  item.label || "B-roll",
                  "timeline-block-broll",
                  selection?.type === "overlay" && selection.id === item.id,
                  () => {
                    onSelect({ type: "overlay", id: item.id });
                    seekTo(item.start);
                  },
                  (edge) => (e) =>
                    startDrag(e, { type: "overlay", id: item.id, edge }, item.start, item.end),
                  (e) => startDrag(e, { type: "move-overlay", id: item.id }, item.start, item.end),
                  mediaUrls[item.asset] ? (
                    <TimelineFilmstrip
                      src={mediaUrls[item.asset]!}
                      width={blockWidth}
                      height={MEDIA_TRACK_H - 4}
                      rangeStart={0}
                      rangeEnd={item.end - item.start}
                    />
                  ) : undefined,
                );
              }),
              true,
            )}

            {renderTrackRow(
              "Imagem",
              "timeline-track-row--visual-mid",
              imageOverlays.map((item) =>
                renderBlock(
                  item.id,
                  item.start,
                  item.end,
                  item.label || "Imagem",
                  "timeline-block-image",
                  selection?.type === "overlay" && selection.id === item.id,
                  () => {
                    onSelect({ type: "overlay", id: item.id });
                    seekTo(item.start);
                  },
                  (edge) => (e) =>
                    startDrag(e, { type: "overlay", id: item.id, edge }, item.start, item.end),
                  (e) => startDrag(e, { type: "move-overlay", id: item.id }, item.start, item.end),
                ),
              ),
            )}

            {renderTrackRow(
              "Vídeo",
              "timeline-track-row--visual-back",
              <button
                type="button"
                className={`timeline-block timeline-block-video ${videoSelected ? "timeline-block-selected" : ""} ${dragging ? "timeline-block-dragging" : ""}`}
                style={{ left: videoLeft, width: videoWidth }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (didDragRef.current) {
                    didDragRef.current = false;
                    return;
                  }
                  onSelect({ type: "video" });
                }}
                onMouseDown={(e) => {
                  if (isHandleTarget(e.target)) return;
                  startDrag(e, { type: "move-video" }, timeline.trim.start, trimEnd);
                }}
              >
                {videoUrl && (
                  <TimelineFilmstrip
                    clipId={clipId}
                    src={videoUrl}
                    width={videoWidth}
                    height={MEDIA_TRACK_H - 4}
                    rangeStart={timeline.trim.start}
                    rangeEnd={trimEnd}
                  />
                )}
                <span
                  className="timeline-block-handle timeline-block-handle-start"
                  onMouseDown={(e) =>
                    startDrag(e, { type: "trim-start" }, timeline.trim.start, trimEnd)
                  }
                />
                <span className="timeline-block-label">Principal</span>
                <span
                  className="timeline-block-handle timeline-block-handle-end"
                  onMouseDown={(e) =>
                    startDrag(e, { type: "trim-end" }, timeline.trim.start, trimEnd)
                  }
                />
              </button>,
              true,
            )}

            {/* Áudio — faixas abaixo dos visuais */}
            {renderTrackRow(
              "Áudio vídeo",
              "timeline-track-row--audio-video",
              <button
                type="button"
                className={`timeline-block timeline-block-video-audio ${videoAudioSelected ? "timeline-block-selected" : ""} ${dragging ? "timeline-block-dragging" : ""}`}
                style={{ left: videoAudioLeft, width: videoAudioWidth }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (didDragRef.current) {
                    didDragRef.current = false;
                    return;
                  }
                  onSelect({ type: "video-audio" });
                }}
                onMouseDown={(e) => {
                  if (isHandleTarget(e.target)) return;
                  startDrag(
                    e,
                    { type: "move-video-audio" },
                    timeline.audio_trim.start,
                    audioTrimEnd,
                  );
                }}
              >
                {videoUrl && (
                  <TimelineWaveform
                    clipId={clipId}
                    src={videoUrl}
                    width={videoAudioWidth}
                    height={MEDIA_TRACK_H - 4}
                    sourceStart={timeline.audio_trim.source_start}
                    sourceEnd={videoAudioSourceEnd}
                    fallbackDuration={duration}
                    color="rgba(255,255,255,0.7)"
                  />
                )}
                <span
                  className="timeline-block-handle timeline-block-handle-start"
                  onMouseDown={(e) =>
                    startDrag(
                      e,
                      { type: "trim-audio-start" },
                      timeline.audio_trim.start,
                      audioTrimEnd,
                    )
                  }
                />
                <span className="timeline-block-label">Áudio original</span>
                <span
                  className="timeline-block-handle timeline-block-handle-end"
                  onMouseDown={(e) =>
                    startDrag(
                      e,
                      { type: "trim-audio-end" },
                      timeline.audio_trim.start,
                      audioTrimEnd,
                    )
                  }
                />
              </button>,
              true,
            )}

            {renderTrackRow(
              "Música",
              "timeline-track-row--audio-music",
              timeline.audio.map((item) => {
                const blockWidth = Math.max(
                  MIN_BLOCK_W,
                  ((item.end - item.start) / duration) * timelineWidth,
                );
                const audioSrc = mediaUrls[item.asset];
                return renderBlock(
                  item.id,
                  item.start,
                  item.end,
                  item.label || "Música",
                  "timeline-block-audio",
                  selection?.type === "audio" && selection.id === item.id,
                  () => {
                    onSelect({ type: "audio", id: item.id });
                    seekTo(item.start);
                  },
                  (edge) => (e) =>
                    startDrag(e, { type: "audio", id: item.id, edge }, item.start, item.end),
                  (e) => startDrag(e, { type: "move-audio", id: item.id }, item.start, item.end),
                  audioSrc ? (
                    <TimelineWaveform
                      src={audioSrc}
                      width={blockWidth}
                      height={MEDIA_TRACK_H - 4}
                      sourceStart={item.source_offset}
                      sourceEnd={item.source_offset + (item.end - item.start)}
                      color="rgba(255,255,255,0.75)"
                    />
                  ) : undefined,
                );
              }),
              true,
            )}

            <div ref={playheadRef} className="caption-playhead caption-playhead-tracks">
              <div className="caption-playhead-head" />
              <div className="caption-playhead-line" />
            </div>
          </div>
        </div>
      </div>

      <div className="clip-timeline-transport">
        <div className="clip-timeline-transport-controls">
          <button
            type="button"
            className="editor-control-btn"
            onClick={handlePrevCut}
            title="Ponto anterior (←)"
            aria-label="Ponto anterior"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          <button
            type="button"
            className="editor-control-btn"
            onClick={onPlay}
            disabled={playing}
            title="Play (Space)"
            aria-label="Play"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M8 5.5v13l10-6.5-10-6.5z" />
            </svg>
          </button>

          <button
            type="button"
            className="editor-control-btn"
            onClick={onPause}
            disabled={!playing}
            title="Pause (K)"
            aria-label="Pause"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            className="editor-control-btn"
            onClick={onStop}
            title="Stop (S)"
            aria-label="Stop"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            className="editor-control-btn"
            onClick={handleNextCut}
            title="Próximo ponto (→)"
            aria-label="Próximo ponto"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
            </svg>
          </button>
        </div>

        <div className="clip-timeline-transport-controls clip-timeline-transport-edit">
          <button
            type="button"
            className="editor-control-btn editor-control-btn-label"
            onClick={onMarkIn}
            title="Marcar início do corte (I ou [)"
            aria-label="Marcar início do corte"
          >
            In
          </button>
          <button
            type="button"
            className="editor-control-btn editor-control-btn-label"
            onClick={onMarkOut}
            title="Marcar fim do corte (O ou ])"
            aria-label="Marcar fim do corte"
          >
            Out
          </button>
          <button
            type="button"
            className="editor-control-btn editor-control-btn-label"
            onClick={onSplitAtPlayhead}
            title="Dividir item selecionado (B ou ⌘K)"
            aria-label="Dividir no playhead"
          >
            Split
          </button>
        </div>

        <span className="editor-time tabular-nums">{formatCueTime(displayTime)}</span>

        <span className="clip-timeline-shortcuts text-[10px] text-app-fg-subtle hidden lg:inline">
          I/O trim · B ou ⌘K split · ⌘± zoom · Del apagar · ← → pontos
        </span>
      </div>
    </div>
  );
}
