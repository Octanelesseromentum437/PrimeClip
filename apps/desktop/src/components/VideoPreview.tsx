import { useEffect, useRef, useState } from "react";
import type { CaptionCue, CaptionStyle } from "../lib/types";

export type VideoAspect = "9:16" | "16:9";
export type VideoPreviewFit = "width" | "height";

interface VideoPreviewProps {
  src: string | null;
  aspect?: VideoAspect;
  cues?: CaptionCue[];
  style?: CaptionStyle | null;
  className?: string;
  loading?: boolean;
  error?: string | null;
  poster?: string | null;
  fit?: VideoPreviewFit;
}

function overlayStyleFromCaption(style: CaptionStyle, aspect: VideoAspect) {
  const scale = aspect === "16:9" ? 6 : 4;
  return {
    fontFamily: style.font_family,
    fontSize: `${Math.max(14, style.font_size / scale)}px`,
    color: style.primary_color,
    fontWeight: style.bold ? 700 : 400,
    textShadow: `0 0 ${style.outline_width}px ${style.outline_color}, 0 0 ${style.outline_width * 2}px ${style.outline_color}`,
  } as const;
}

function activeCue(cues: CaptionCue[], time: number): CaptionCue | null {
  return cues.find((cue) => time >= cue.start && time < cue.end) ?? null;
}

export function VideoPreview({
  src,
  aspect = "9:16",
  cues,
  style,
  className = "",
  loading = false,
  error = null,
  poster = null,
  fit = "width",
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentTime(0);
    setPlaybackError(null);
  }, [src]);

  const aspectRatio = aspect === "16:9" ? "16 / 9" : "9 / 16";
  const overlayCue = cues && style ? activeCue(cues, currentTime) : null;
  const displayError = error || playbackError;

  const containerClass =
    fit === "height"
      ? "relative overflow-hidden bg-black rounded-xl shadow-lg ring-1 ring-app-border/60 max-h-full max-w-full"
      : `relative w-full overflow-hidden bg-black rounded-xl shadow-lg ring-1 ring-app-border/60 ${
          aspect === "16:9" ? "aspect-video" : "aspect-[9/16]"
        }`;

  const containerStyle =
    fit === "height"
      ? { height: "100%", aspectRatio, maxWidth: "100%" as const }
      : undefined;

  return (
    <div className={`${containerClass} ${className}`} style={containerStyle}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs text-white/80">
          Loading preview…
        </div>
      )}
      {displayError && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-3 text-center text-xs text-red-300 bg-black/80">
          {displayError}
        </div>
      )}
      {src && (
        <video
          ref={videoRef}
          key={src}
          src={src}
          poster={poster ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-contain bg-black"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onError={() => setPlaybackError("Could not play video")}
        />
      )}
      {!src && !loading && !displayError && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-app-fg-muted">
          No preview
        </div>
      )}
      {overlayCue?.text && style && (
        <div
          className="pointer-events-none absolute bottom-[10%] left-0 right-0 z-20 text-center px-4 leading-tight"
          style={overlayStyleFromCaption(style, aspect)}
        >
          {overlayCue.text}
        </div>
      )}
    </div>
  );
}
