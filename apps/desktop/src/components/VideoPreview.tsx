import { useEffect, useRef, useState } from "react";
import type { CaptionCue, CaptionStyle } from "../lib/types";

export type VideoAspect = "9:16" | "16:9";

interface VideoPreviewProps {
  src: string | null;
  aspect?: VideoAspect;
  cues?: CaptionCue[];
  style?: CaptionStyle | null;
  className?: string;
  loading?: boolean;
  error?: string | null;
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
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setCurrentTime(0);
  }, [src]);

  const aspectClass = aspect === "16:9" ? "aspect-video" : "aspect-[9/16]";
  const overlayCue = cues && style ? activeCue(cues, currentTime) : null;

  return (
    <div
      className={`relative mx-auto w-full max-w-full ${aspectClass} rounded-xl overflow-hidden bg-black shadow-lg ring-1 ring-app-border ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-app-fg-muted">
          Loading preview…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-error">
          {error}
        </div>
      )}
      {src && !error && (
        <>
          <video
            ref={videoRef}
            key={src}
            src={src}
            controls
            className="absolute inset-0 h-full w-full object-cover"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          />
          {overlayCue?.text && style && (
            <div
              className="pointer-events-none absolute bottom-[10%] left-0 right-0 text-center px-4 leading-tight"
              style={overlayStyleFromCaption(style, aspect)}
            >
              {overlayCue.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}
