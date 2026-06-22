import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { CaptionCue, CaptionStyle } from "../../lib/types";
import { formatCueTime } from "../../lib/formatTime";

export type VideoAspect = "9:16" | "16:9";

export interface EditorPlayerHandle {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
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
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
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

export const EditorPlayer = forwardRef<EditorPlayerHandle, EditorPlayerProps>(
  function EditorPlayer(
    {
      src,
      poster,
      aspect = "9:16",
      cues = [],
      style,
      onTimeUpdate,
      onDurationChange,
      onPlayStateChange,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);
    const lastCueKeyRef = useRef<string>("");

    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [displayTime, setDisplayTime] = useState(0);
    const [overlayText, setOverlayText] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const aspectRatio = aspect === "16:9" ? 16 / 9 : 9 / 16;

    const seek = useCallback(
      (time: number) => {
        const video = videoRef.current;
        if (!video || !duration) return;
        const clamped = Math.max(0, Math.min(time, duration));
        video.currentTime = clamped;
        setDisplayTime(clamped);
        onTimeUpdate?.(clamped);
      },
      [duration, onTimeUpdate],
    );

    const play = useCallback(() => {
      void videoRef.current?.play();
    }, []);

    const pause = useCallback(() => {
      videoRef.current?.pause();
    }, []);

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
        togglePlay,
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => duration,
        isPlaying: () => playing,
      }),
      [seek, play, pause, togglePlay, duration, playing],
    );

    useEffect(() => {
      setReady(false);
      setLoadError(null);
      setDisplayTime(0);
      setDuration(0);
      setOverlayText(null);
      lastCueKeyRef.current = "";
    }, [src]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onLoaded = () => {
        const d = video.duration;
        if (Number.isFinite(d) && d > 0) {
          setDuration(d);
          onDurationChange?.(d);
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
      };

      const onError = () => {
        setLoadError("Could not load video");
        setReady(false);
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("error", onError);

      if (video.readyState >= 1) onLoaded();

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("error", onError);
      };
    }, [src, onDurationChange, onPlayStateChange]);

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

        if (!video.paused) {
          rafRef.current = requestAnimationFrame(syncFrame);
        }
      };

      if (playing) {
        rafRef.current = requestAnimationFrame(syncFrame);
      }

      return () => cancelAnimationFrame(rafRef.current);
    }, [playing, cues, onTimeUpdate]);

    const handleScrub = (value: number) => {
      seek(value);
    };

    return (
      <div className="editor-player">
        <div ref={canvasRef} className="editor-player-canvas">
          {!src && !loadError && (
            <div className="editor-player-empty">No video loaded</div>
          )}
          {loadError && <div className="editor-player-empty text-red-400">{loadError}</div>}
          {src && (
            <div
              className="editor-player-frame"
              style={{ aspectRatio: `${aspectRatio}` }}
            >
              <video
                ref={videoRef}
                src={src}
                poster={poster ?? undefined}
                playsInline
                preload="auto"
                className="editor-player-video"
                onClick={togglePlay}
              />
              {overlayText && style && (
                <div
                  className="editor-player-caption"
                  style={overlayStyleFromCaption(style, aspect)}
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
            {formatCueTime(displayTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={Math.min(displayTime, duration || 0)}
            onChange={(e) => handleScrub(Number(e.target.value))}
            className="editor-scrubber flex-1"
            disabled={!ready}
          />

          <span className="editor-time tabular-nums text-app-fg-subtle">
            {formatCueTime(duration)}
          </span>
        </div>
      </div>
    );
  },
);
