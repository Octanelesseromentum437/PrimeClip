import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { CaptionCue, CaptionStyle, OverlayItem, TimelineState } from "../../lib/types";
import { formatCueTime } from "../../lib/formatTime";
import { overlayZIndex, sortOverlaysByZOrder } from "../../lib/timeline";

export type VideoAspect = "9:16" | "16:9";

export interface EditorPlayerHandle {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlay: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
}

interface EditorPlayerProps {
  src: string | null;
  poster?: string | null;
  aspect?: VideoAspect;
  cues?: CaptionCue[];
  style?: CaptionStyle | null;
  timeline?: TimelineState;
  mediaUrls?: Record<string, string>;
  selectedOverlayId?: string | null;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onSelectOverlay?: (id: string) => void;
  onUpdateOverlay?: (id: string, patch: Partial<OverlayItem>) => void;
}

function overlayStyleFromCaption(captionStyle: CaptionStyle, aspect: VideoAspect) {
  const scale = aspect === "16:9" ? 5.5 : 3.8;
  return {
    fontFamily: captionStyle.font_family,
    fontSize: `${Math.max(16, captionStyle.font_size / scale)}px`,
    color: captionStyle.primary_color,
    fontWeight: captionStyle.bold ? 700 : 400,
    textShadow: `0 0 ${captionStyle.outline_width}px ${captionStyle.outline_color}, 0 0 ${captionStyle.outline_width * 2}px ${captionStyle.outline_color}`,
  } as const;
}

function findActiveCue(cues: CaptionCue[], time: number): CaptionCue | null {
  return cues.find((cue) => time >= cue.start && time < cue.end) ?? null;
}

function activeOverlays(overlays: OverlayItem[], time: number): OverlayItem[] {
  return overlays.filter((o) => time >= o.start && time < o.end);
}

export const EditorPlayer = forwardRef<EditorPlayerHandle, EditorPlayerProps>(
  function EditorPlayer(
    {
      src,
      poster,
      aspect = "9:16",
      cues = [],
      style,
      timeline,
      mediaUrls = {},
      selectedOverlayId = null,
      onTimeUpdate,
      onDurationChange,
      onPlayStateChange,
      onSelectOverlay,
      onUpdateOverlay,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoAudioRef = useRef<HTMLAudioElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const brollRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
    const rafRef = useRef<number>(0);
    const lastCueKeyRef = useRef<string>("");
    const overlayDragRef = useRef<{
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      width: number;
      height: number;
    } | null>(null);

    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [displayTime, setDisplayTime] = useState(0);
    const [overlayText, setOverlayText] = useState<string | null>(null);
    const [overlayDragging, setOverlayDragging] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const aspectRatio = aspect === "16:9" ? 16 / 9 : 9 / 16;
    const trimStart = timeline?.trim.start ?? 0;
    const trimEnd = timeline?.trim.end;
    const audioTrim = timeline?.audio_trim;
    const audioTrimStart = audioTrim?.start ?? trimStart;
    const audioTrimEnd = audioTrim?.end ?? trimEnd;

    const pauseTimelineMedia = useCallback(() => {
      videoAudioRef.current?.pause();
      for (const audio of audioRefs.current.values()) {
        audio.pause();
      }
      for (const broll of brollRefs.current.values()) {
        broll.pause();
      }
    }, []);

    const syncVideoAudio = useCallback(
      (t: number, shouldPlay: boolean) => {
        const audioEl = videoAudioRef.current;
        if (!audioEl || !audioTrim) return;
        const end = audioTrimEnd ?? audioEl.duration;
        const inRange = t >= audioTrimStart && t < end;
        if (inRange && shouldPlay) {
          const relTime = audioTrim.source_start + (t - audioTrimStart);
          if (Math.abs(audioEl.currentTime - relTime) > 0.3) {
            audioEl.currentTime = relTime;
          }
          audioEl.volume = audioTrim.volume;
          if (audioEl.paused) void audioEl.play().catch(() => {});
        } else {
          audioEl.pause();
        }
      },
      [audioTrim, audioTrimStart, audioTrimEnd],
    );

    const syncTimelineMedia = useCallback(
      (t: number, shouldPlay: boolean) => {
        if (!timeline) return;

        for (const item of timeline.audio) {
          const audio = audioRefs.current.get(item.id);
          if (!audio) continue;
          const inRange = t >= item.start && t < item.end;
          if (inRange && shouldPlay) {
            const relTime = t - item.start + item.source_offset;
            if (Math.abs(audio.currentTime - relTime) > 0.3) {
              audio.currentTime = relTime;
            }
            audio.volume = item.volume;
            if (audio.paused) void audio.play().catch(() => {});
          } else {
            audio.pause();
          }
        }

        for (const item of timeline.overlays.filter((o) => o.kind === "broll")) {
          const broll = brollRefs.current.get(item.id);
          if (!broll) continue;
          const inRange = t >= item.start && t < item.end;
          if (inRange && shouldPlay) {
            const relTime = t - item.start;
            if (Math.abs(broll.currentTime - relTime) > 0.3) {
              broll.currentTime = relTime;
            }
            broll.volume = item.volume;
            if (broll.paused) void broll.play().catch(() => {});
          } else {
            broll.pause();
          }
        }
      },
      [timeline],
    );

    const seek = useCallback(
      (time: number) => {
        const video = videoRef.current;
        if (!video || !duration) return;
        const clamped = Math.max(0, Math.min(time, duration));
        const videoTime = Math.max(trimStart, Math.min(clamped, trimEnd ?? duration));
        video.currentTime = videoTime;
        setDisplayTime(clamped);
        onTimeUpdate?.(clamped);
        syncVideoAudio(clamped, false);
      },
      [duration, trimStart, trimEnd, onTimeUpdate, syncVideoAudio],
    );

    const play = useCallback(() => {
      void videoRef.current?.play();
    }, []);

    const pause = useCallback(() => {
      videoRef.current?.pause();
      pauseTimelineMedia();
    }, [pauseTimelineMedia]);

    const stop = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = trimStart;
      pauseTimelineMedia();
      setDisplayTime(trimStart);
      onTimeUpdate?.(trimStart);
    }, [trimStart, onTimeUpdate, pauseTimelineMedia]);

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play();
      else video.pause();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        seek,
        play,
        pause,
        stop,
        togglePlay,
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => duration,
        isPlaying: () => playing,
      }),
      [seek, play, pause, stop, togglePlay, duration, playing],
    );

    useEffect(() => {
      setReady(false);
      setLoadError(null);
      setDisplayTime(trimStart);
      setDuration(0);
      setOverlayText(null);
      lastCueKeyRef.current = "";
    }, [src, trimStart]);

    const visibleOverlays = timeline
      ? sortOverlaysByZOrder(activeOverlays(timeline.overlays, displayTime))
      : [];
    const videoVisible =
      displayTime >= trimStart && displayTime < (trimEnd ?? (duration || Infinity));

    const startOverlayDrag = (e: React.MouseEvent, item: OverlayItem) => {
      if (item.kind !== "image" || !onUpdateOverlay) return;
      e.preventDefault();
      e.stopPropagation();
      onSelectOverlay?.(item.id);
      overlayDragRef.current = {
        id: item.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: item.x,
        origY: item.y,
        width: item.width,
        height: item.height,
      };
      setOverlayDragging(true);
    };

    useEffect(() => {
      if (!overlayDragging) return;

      const onMove = (e: MouseEvent) => {
        const drag = overlayDragRef.current;
        const frame = frameRef.current;
        if (!drag || !frame || !onUpdateOverlay) return;

        const rect = frame.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const deltaX = ((e.clientX - drag.startX) / rect.width) * 100;
        const deltaY = ((e.clientY - drag.startY) / rect.height) * 100;
        const x = Math.round(
          Math.max(0, Math.min(100 - drag.width, drag.origX + deltaX)),
        );
        const y = Math.round(
          Math.max(0, Math.min(100 - drag.height, drag.origY + deltaY)),
        );
        onUpdateOverlay(drag.id, { x, y });
      };

      const onUp = () => {
        overlayDragRef.current = null;
        setOverlayDragging(false);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    }, [overlayDragging, onUpdateOverlay]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onLoaded = () => {
        const d = video.duration;
        if (Number.isFinite(d) && d > 0) {
          setDuration(d);
          onDurationChange?.(d);
          video.currentTime = trimStart;
          setDisplayTime(trimStart);
        }
        setReady(true);
        setLoadError(null);
      };

      const onPlay = () => {
        setPlaying(true);
        onPlayStateChange?.(true);
      };

      const onPause = () => {
        setPlaying(false);
        onPlayStateChange?.(false);
        pauseTimelineMedia();
      };

      const onError = () => {
        setLoadError("Could not load video");
        setReady(false);
      };

      const onTimeUpdateNative = () => {
        const end = trimEnd ?? video.duration;
        if (end && video.currentTime >= end - 0.05) {
          video.pause();
          video.currentTime = end;
        }
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("error", onError);
      video.addEventListener("timeupdate", onTimeUpdateNative);

      if (video.readyState >= 1) onLoaded();

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("error", onError);
        video.removeEventListener("timeupdate", onTimeUpdateNative);
      };
    }, [src, onDurationChange, onPlayStateChange, trimStart, trimEnd, pauseTimelineMedia]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const syncFrame = () => {
        const t = video.currentTime;
        setDisplayTime(t);
        onTimeUpdate?.(t);

        const active = findActiveCue(cues, t);
        const key = active ? `${active.start}-${active.end}-${active.text}` : "";
        if (key !== lastCueKeyRef.current) {
          lastCueKeyRef.current = key;
          setOverlayText(active?.text ?? null);
        }

        if (timeline) {
          syncVideoAudio(t, !video.paused);
          syncTimelineMedia(t, !video.paused);
        }

        if (!video.paused) {
          rafRef.current = requestAnimationFrame(syncFrame);
        }
      };

      if (playing) {
        rafRef.current = requestAnimationFrame(syncFrame);
      }

      return () => cancelAnimationFrame(rafRef.current);
    }, [playing, cues, timeline, onTimeUpdate, syncTimelineMedia, syncVideoAudio]);

    const handleScrub = (value: number) => {
      seek(value);
    };

    const scrubMax = (trimEnd ?? duration) || 1;
    const scrubMin = trimStart;

    return (
      <div className="editor-player">
        <div className="editor-player-canvas">
          {!src && !loadError && (
            <div className="editor-player-empty">No video loaded</div>
          )}
          {loadError && <div className="editor-player-empty text-red-400">{loadError}</div>}
          {src && (
            <div
              ref={frameRef}
              className="editor-player-frame"
              style={{ aspectRatio: `${aspectRatio}` }}
            >
              <video
                ref={videoRef}
                src={src}
                poster={poster ?? undefined}
                playsInline
                muted
                preload="auto"
                className="editor-player-video"
                style={{ opacity: videoVisible ? 1 : 0 }}
                onClick={togglePlay}
              />

              {visibleOverlays.map((item) => {
                const url = mediaUrls[item.asset];
                if (!url) return null;
                const style = {
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                  opacity: item.opacity,
                  zIndex: overlayZIndex(item.kind),
                };
                if (item.kind === "broll") {
                  return (
                    <video
                      key={item.id}
                      ref={(el) => {
                        if (el) brollRefs.current.set(item.id, el);
                        else brollRefs.current.delete(item.id);
                      }}
                      src={url}
                      playsInline
                      muted={false}
                      className="editor-player-overlay"
                      style={style}
                    />
                  );
                }
                const selected = item.id === selectedOverlayId;
                return (
                  <img
                    key={item.id}
                    src={url}
                    alt={item.label}
                    className={`editor-player-overlay editor-player-overlay--image${
                      selected ? " editor-player-overlay--selected" : ""
                    }`}
                    style={style}
                    onMouseDown={(e) => startOverlayDrag(e, item)}
                  />
                );
              })}

              {overlayText && style && (
                <div
                  className="editor-player-caption"
                  style={{ ...overlayStyleFromCaption(style, aspect), zIndex: 10 }}
                >
                  {overlayText}
                </div>
              )}

              {!ready && !loadError && (
                <div className="editor-player-loading">Loading…</div>
              )}
            </div>
          )}
        </div>

        {src && (
          <audio ref={videoAudioRef} src={src} preload="auto" className="hidden" />
        )}

        {timeline?.audio.map((item) => {
          const url = mediaUrls[item.asset];
          if (!url) return null;
          return (
            <audio
              key={item.id}
              ref={(el) => {
                if (el) audioRefs.current.set(item.id, el);
                else audioRefs.current.delete(item.id);
              }}
              src={url}
              preload="auto"
            />
          );
        })}

        <div className="editor-player-controls">
          <button
            type="button"
            className="editor-control-btn"
            onClick={togglePlay}
            disabled={!ready}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M8 5.5v13l10-6.5-10-6.5z" />
              </svg>
            )}
          </button>

          <span className="editor-time tabular-nums">
            {formatCueTime(displayTime - trimStart)}
          </span>

          <input
            type="range"
            min={scrubMin}
            max={scrubMax}
            step={0.05}
            value={Math.min(displayTime, scrubMax)}
            onChange={(e) => handleScrub(Number(e.target.value))}
            className="editor-scrubber flex-1"
            disabled={!ready}
          />

          <span className="editor-time tabular-nums text-app-fg-subtle">
            {formatCueTime((trimEnd ?? duration) - trimStart)}
          </span>
        </div>
      </div>
    );
  },
);
